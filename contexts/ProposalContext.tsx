import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountMeta, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  MarketAccountWithKey,
  Markets,
  OpenOrdersAccountWithKey,
  OrderBook,
  Proposal,
  ProposalAccountWithKey,
  LeafNode,
} from '@/lib/types';
import { useAutocrat } from '@/contexts/AutocratContext';
import { useConditionalVault } from '@/hooks/useConditionalVault';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { getLeafNodes } from '../lib/openbook';
import { debounce } from '../lib/utils';
import { useProposalMarkets } from './ProposalMarketsContext';

export interface ProposalInterface {
  proposal?: Proposal;
  proposalNumber?: number;
  loading: boolean;
  isCranking: boolean;
  metaDisabled: boolean;
  usdcDisabled: boolean;
  crankMarkets: (individualEvent?: PublicKey) => Promise<void>;
  createTokenAccounts: (fromBase?: boolean) => Promise<void>;
  createTokenAccountsTransactions: (fromBase?: boolean) => Promise<Transaction[] | undefined>;
  finalizeProposalTransactions: (
    remainingAccounts?: AccountMeta[],
  ) => Promise<Transaction[] | undefined>;
  mintTokensTransactions: (
    amount: number,
    fromBase?: boolean,
  ) => Promise<Transaction[] | undefined>;
  mintTokens: (amount: number, fromBase?: boolean) => Promise<void>;
}

export const proposalContext = createContext<ProposalInterface | undefined>(undefined);

export const useProposal = () => {
  const context = useContext(proposalContext);
  if (!context) {
    throw new Error('useProposal must be used within a ProposalContextProvider');
  }
  return context;
};

export function ProposalProvider({
  children,
  proposalNumber,
  fromProposal,
}: {
  children: React.ReactNode;
  proposalNumber?: number | undefined;
  fromProposal?: ProposalAccountWithKey;
}) {
  const client = useQueryClient();
  const { autocratProgram, dao, daoState, daoTreasury, proposals } =
    useAutocrat();
  const { connection } = useConnection();
  const { markets, fetchMarketsInfo, fetchOpenOrders } = useProposalMarkets();
  const wallet = useWallet();
  const sender = useTransactionSender();
  const {
    program: vaultProgram,
    mintConditionalTokens,
    getVaultMint,
    createConditionalTokensAccounts,
  } = useConditionalVault();
  const [loading, setLoading] = useState(false);
  const [metaDisabled, setMetaDisabled] = useState(false);
  const [usdcDisabled, setUsdcDisabled] = useState(false);
  const [isCranking, setIsCranking] = useState<boolean>(false);
  const { crankMarketTransactions } = useOpenbookTwap();

  const proposal = useMemo<Proposal | undefined>(
    () =>
      proposals?.filter(
        (t) =>
          t.account.number === proposalNumber ||
          t.publicKey.toString() === fromProposal?.publicKey.toString(),
      )[0],
    [proposals, fromProposal, proposalNumber],
  );

  const createTokenAccountsTransactions = useCallback(
    async (fromBase?: boolean) => {
      if (!proposal || !markets) {
        return;
      }
      const createAccounts = await createConditionalTokensAccounts(
        proposal.account,
        fromBase ? markets.baseVault : markets.quoteVault,
        fromBase,
      );
      const tx = new Transaction().add(...(createAccounts?.ixs ?? []));

      return [tx];
    },
    [proposal, markets],
  );

  const createTokenAccounts = useCallback(
    async (fromBase?: boolean) => {
      const txs = await createTokenAccountsTransactions(fromBase);
      if (!txs || !proposal || !wallet.publicKey) {
        return;
      }
      let error = false;
      let metaBalance = null;
      const metaMint = new PublicKey('METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr');
      const quoteVault = await getVaultMint(proposal.account.quoteVault);
      const baseVault = await getVaultMint(proposal.account.baseVault);
      const userBasePass = getAssociatedTokenAddressSync(
        baseVault.conditionalOnFinalizeTokenMint,
        wallet.publicKey,
      );
      const userQuotePass = getAssociatedTokenAddressSync(
        quoteVault.conditionalOnFinalizeTokenMint,
        wallet.publicKey,
      );
      const metaTokenAccount = getAssociatedTokenAddressSync(metaMint, wallet.publicKey, false);

      try {
        metaBalance = await client.fetchQuery({
          queryKey: [`getTokenAccountBalance-${metaTokenAccount.toString()}-undefined`],
          queryFn: () => connection.getTokenAccountBalance(metaTokenAccount),
          staleTime: 10_000,
        });
      } catch (err) {
        console.error('unable to fetch balance for META token account');
      }
      try {
        if (fromBase) {
          // WHY do we fetch these but do nothing with result?
          await connection.getTokenAccountBalance(userBasePass);
        } else {
          await connection.getTokenAccountBalance(userQuotePass);
        }
      } catch (err) {
        error = true;
        console.error("turns out the account doesn't exist we can create it");
      }
      if (!error) {
        notifications.show({
          title: 'Token Accounts Exist',
          message: "You won't need to press this button again.",
          autoClose: 5000,
        });
        if (fromBase) {
          setMetaDisabled(true);
        } else {
          setUsdcDisabled(true);
        }
      }

      if (error) {
        if (metaBalance === null) {
          const tx = new Transaction();
          tx.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey, // payer
              metaTokenAccount, // ata
              wallet.publicKey, // owner
              metaMint, // mint
            ),
          );
          txs.unshift(tx);
        }
        setLoading(true);

        try {
          await sender.send(txs);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    },
    [wallet, connection, sender, createTokenAccountsTransactions, proposal],
  );

  const finalizeProposalTransactions = useCallback(
    async (remainingAccounts: AccountMeta[] = []) => {
      if (!autocratProgram || !proposal || !dao || !daoState || !vaultProgram) return;

      const tx = await autocratProgram.methods
        .finalizeProposal()
        .accounts({
          proposal: proposal.publicKey,
          openbookTwapPassMarket: proposal.account.openbookTwapPassMarket,
          openbookTwapFailMarket: proposal.account.openbookTwapFailMarket,
          dao,
          daoTreasury,
          baseVault: proposal.account.baseVault,
          quoteVault: proposal.account.quoteVault,
          vaultProgram: vaultProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      return [tx];
    },
    [autocratProgram, proposal, vaultProgram, dao, daoTreasury],
  );

  const mintTokensTransactions = useCallback(
    async (amount: number, fromBase?: boolean) => {
      if (!proposal || !markets || !wallet.publicKey) {
        return;
      }

      const mint = await mintConditionalTokens(
        amount,
        proposal.account,
        fromBase ? markets.baseVault : markets.quoteVault,
        fromBase,
      );
      const tx = new Transaction().add(...(mint?.ixs ?? []));

      return [tx];
    },
    [proposal, markets],
  );

  const mintTokens = useCallback(
    async (amount: number, fromBase?: boolean) => {
      const txs = await mintTokensTransactions(amount, fromBase);
      if (!txs || !proposal) {
        return;
      }

      setLoading(true);

      try {
        await sender.send(txs);
        await fetchMarketsInfo();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [connection, sender, mintTokensTransactions, proposal],
  );

  const crankMarkets = useCallback(
    async (individualEvent?: PublicKey) => {
      if (!proposal || !markets || !wallet?.publicKey) return;
      try {
        setIsCranking(true);
        const passTxs = await crankMarketTransactions(
          {
            publicKey: markets.passTwap.market,
            account: markets.pass,
          },
          markets.pass.eventHeap,
          individualEvent,
        );
        const failTxs = await crankMarketTransactions(
          { publicKey: markets.failTwap.market, account: markets.fail },
          markets.fail.eventHeap,
          individualEvent,
        );
        if (!passTxs || !failTxs) return;
        const txs = [...passTxs, ...failTxs].filter(Boolean);
        await sender.send(txs as VersionedTransaction[]);
        fetchOpenOrders(wallet.publicKey);
      } catch (err) {
        console.error(err);
      } finally {
        setIsCranking(false);
      }
    },
    [markets, proposal, wallet.publicKey, sender, crankMarketTransactions, fetchOpenOrders],
  );

  return (
    <proposalContext.Provider
      value={{
        proposal,
        proposalNumber,
        loading,
        isCranking,
        metaDisabled,
        usdcDisabled,
        createTokenAccounts,
        createTokenAccountsTransactions,
        crankMarkets,
        finalizeProposalTransactions,
        mintTokensTransactions,
        mintTokens,
      }}
    >
      {children}
    </proposalContext.Provider>
  );
}
