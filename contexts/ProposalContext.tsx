import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { notifications } from '@mantine/notifications';
import {
  MarketAccountWithKey,
  Markets,
  OpenOrdersAccountWithKey,
  OrderBook,
  Proposal,
  ProposalAccountWithKey,
} from '@/lib/types';
import { useAutocrat } from '@/contexts/AutocratContext';
import { useConditionalVault } from '@/hooks/useConditionalVault';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { LeafNode } from '@/lib/types';
import { getLeafNodes } from '../lib/openbook';
import { debounce } from '../lib/utils';

export interface ProposalInterface {
  proposal?: Proposal;
  proposalNumber?: number;
  markets?: Markets;
  orders?: OpenOrdersAccountWithKey[];
  orderBookObject?: OrderBook;
  loading: boolean;
  isCranking: boolean;
  metaDisabled: boolean;
  usdcDisabled: boolean;
  handleCrank: (isPassMarket: boolean, individualEvent?: PublicKey) => Promise<void>;
  fetchOpenOrders: (owner: PublicKey) => Promise<void>;
  fetchMarketsInfo: () => Promise<void>;
  createTokenAccounts: (fromBase?: boolean) => Promise<void>;
  createTokenAccountsTransactions: (fromBase?: boolean) => Promise<Transaction[] | undefined>;
  finalizeProposalTransactions: () => Promise<Transaction[] | undefined>;
  mintTokensTransactions: (
    amount: number,
    fromBase?: boolean,
  ) => Promise<Transaction[] | undefined>;
  mintTokens: (amount: number, fromBase?: boolean) => Promise<void>;
  placeOrderTransactions: (
    amount: number,
    price: number,
    market: MarketAccountWithKey,
    limitOrder?: boolean | undefined,
    ask?: boolean | undefined,
    pass?: boolean | undefined,
    indexOffset?: number | undefined,
  ) => Promise<any>;
  placeOrder: (
    amount: number,
    price: number,
    limitOrder?: boolean,
    ask?: boolean,
    pass?: boolean,
  ) => Promise<void>;
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
  const { autocratProgram, dao, daoState, daoTreasury, openbook, openbookTwap, proposals } =
    useAutocrat();
  const { connection } = useConnection();
  const wallet = useWallet();
  const sender = useTransactionSender();
  const { placeOrderTransactions } = useOpenbookTwap();
  const {
    program: vaultProgram,
    mintConditionalTokens,
    getVaultMint,
    createConditionalTokensAccounts,
  } = useConditionalVault();
  const [loading, setLoading] = useState(false);
  const [metaDisabled, setMetaDisabled] = useState(false);
  const [usdcDisabled, setUsdcDisabled] = useState(false);
  const [markets, setMarkets] = useState<Markets>();
  const [orders, setOrders] = useState<OpenOrdersAccountWithKey[]>([]);
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

  const fetchMarketsInfo = useCallback(
    debounce(async () => {
      if (!proposal || !openbook || !openbookTwap || !openbookTwap.views || !connection) {
        return;
      }
      const accountInfos = await connection.getMultipleAccountsInfo([
        proposal.account.openbookPassMarket,
        proposal.account.openbookFailMarket,
        proposal.account.openbookTwapPassMarket,
        proposal.account.openbookTwapFailMarket,
        proposal.account.baseVault,
        proposal.account.quoteVault,
      ]);
      if (!accountInfos || accountInfos.indexOf(null) >= 0) return;

      const pass = await openbook.coder.accounts.decode('market', accountInfos[0]!.data);
      const fail = await openbook.coder.accounts.decode('market', accountInfos[1]!.data);
      const passTwap = await openbookTwap.coder.accounts.decodeUnchecked(
        'TWAPMarket',
        accountInfos[2]!.data,
      );
      const failTwap = await openbookTwap.coder.accounts.decodeUnchecked(
        'TWAPMarket',
        accountInfos[3]!.data,
      );
      const baseVault = await vaultProgram.coder.accounts.decode(
        'conditionalVault',
        accountInfos[4]!.data,
      );
      const quoteVault = await vaultProgram.coder.accounts.decode(
        'conditionalVault',
        accountInfos[5]!.data,
      );

      const bookAccountInfos = await connection.getMultipleAccountsInfo([
        pass.asks,
        pass.bids,
        fail.asks,
        fail.bids,
      ]);
      const passAsks = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[0]!.data),
        openbook,
      );
      const passBids = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[1]!.data),
        openbook,
      );
      const failAsks = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[2]!.data),
        openbook,
      );
      const failBids = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[3]!.data),
        openbook,
      );

      setMarkets({
        pass,
        passAsks,
        passBids,
        fail,
        failAsks,
        failBids,
        passTwap,
        failTwap,
        baseVault,
        quoteVault,
      });
    }, 1000),
    [markets, vaultProgram, openbook, openbookTwap, proposal],
  );
  const fetchOpenOrders = useCallback(
    debounce<[PublicKey]>(async (owner: PublicKey) => {
      if (!openbook || !proposal) {
        return;
      }
      const passOrders = await openbook.account.openOrdersAccount.all([
        { memcmp: { offset: 8, bytes: owner.toBase58() } },
        { memcmp: { offset: 40, bytes: proposal.account.openbookPassMarket.toBase58() } },
      ]);
      const failOrders = await openbook.account.openOrdersAccount.all([
        { memcmp: { offset: 8, bytes: owner.toBase58() } },
        { memcmp: { offset: 40, bytes: proposal.account.openbookFailMarket.toBase58() } },
      ]);
      setOrders(
        passOrders
          .concat(failOrders)
          .sort((a, b) => (a.account.accountNum < b.account.accountNum ? 1 : -1)),
      );
    }, 1000),
    [openbook, proposal],
  );

  useEffect(() => {
    if (!orders && proposal && wallet.publicKey) {
      fetchOpenOrders(wallet.publicKey);
    }
  }, [orders, markets, fetchOpenOrders]);

  useEffect(() => {
    if (!markets && proposal) {
      fetchMarketsInfo();
    }
  }, [markets, fetchMarketsInfo]);

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
        metaBalance = await connection.getTokenAccountBalance(metaTokenAccount);
      } catch (err) {
        console.log('unable to fetch balance for META token account');
      }
      try {
        if (fromBase) {
          await connection.getTokenAccountBalance(userBasePass);
        } else {
          await connection.getTokenAccountBalance(userQuotePass);
        }
      } catch (err) {
        error = true;
        console.log("turns out the account doesn't exist we can create it");
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

  const finalizeProposalTransactions = useCallback(async () => {
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
      .transaction();

    return [tx];
  }, [autocratProgram, proposal, vaultProgram, dao, daoTreasury]);

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

  const orderBookObject = useMemo(() => {
    const getSide = (side: LeafNode[], isBidSide?: boolean) => {
      if (side.length === 0) {
        return null;
      }
      const parsed = side
        .map((e) => ({
          price: e.key.shrn(64).toNumber(),
          size: e.quantity.toNumber(),
        }))
        .sort((a, b) => a.price - b.price);

      const sorted = isBidSide
        ? parsed.sort((a, b) => b.price - a.price)
        : parsed.sort((a, b) => a.price - b.price);

      const deduped = new Map();
      sorted.forEach((order) => {
        if (deduped.get(order.price) === undefined) {
          deduped.set(order.price, order.size);
        } else {
          deduped.set(order.price, deduped.get(order.price) + order.size);
        }
      });

      const total = parsed.reduce((a, b) => ({
        price: a.price + b.price,
        size: a.size + b.size,
      }));
      return { parsed, total, deduped };
    };

    const orderBookSide = (orderBookForSide: LeafNode[], isBidSide?: boolean) => {
      if (orderBookForSide) {
        const _orderBookSide = getSide(orderBookForSide, isBidSide);
        if (_orderBookSide) {
          return Array.from(_orderBookSide.deduped?.entries()).map((side) => [
            (side[0] / 10_000).toFixed(4),
            side[1],
          ]);
        }
      }
      if (isBidSide) {
        return [[0, 0]];
      }
      return [[69, 0]];
    };

    const getToB = (bids: LeafNode[], asks: LeafNode[]) => {
      const _bids = orderBookSide(bids, true);
      const _asks = orderBookSide(asks);
      const tobAsk: number = Number(_asks[0][0]);
      const tobBid: number = Number(_bids[0][0]);
      return {
        topAsk: tobAsk,
        topBid: tobBid,
      };
    };

    const getSpreadString = (bids: LeafNode[], asks: LeafNode[]) => {
      const { topAsk, topBid } = getToB(bids, asks);
      const spread: number = topAsk - topBid;
      const spreadPercent: string = ((spread / topAsk) * 100).toFixed(2);

      return spread === topAsk
        ? '∞ (100.00%)'
        : `${spread.toFixed(2).toString()} (${spreadPercent}%)`;
    };

    if (markets) {
      return {
        passBidsProcessed: getSide(markets.passBids, true),
        passAsksProcessed: getSide(markets.passAsks),
        passBidsArray: orderBookSide(markets.passBids, true),
        passAsksArray: orderBookSide(markets.passAsks),
        failBidsProcessed: getSide(markets.failBids, true),
        failAsksProcessed: getSide(markets.failAsks),
        failBidsArray: orderBookSide(markets.failBids, true),
        failAsksArray: orderBookSide(markets.failAsks),
        passToB: getToB(markets.passBids, markets.passAsks),
        failToB: getToB(markets.failBids, markets.failAsks),
        passSpreadString: getSpreadString(markets.passBids, markets.passAsks),
        failSpreadString: getSpreadString(markets.failBids, markets.failAsks),
      };
    }
    return undefined;
  }, [markets]);

  const placeOrder = useCallback(
    async (amount: number, price: number, limitOrder?: boolean, ask?: boolean, pass?: boolean) => {
      if (!proposal || !markets) return;
      const market = pass
        ? { publicKey: proposal?.account.openbookPassMarket, account: markets?.pass }
        : { publicKey: proposal?.account.openbookFailMarket, account: markets?.fail };
      const placeTxs = await placeOrderTransactions(amount, price, market, limitOrder, ask, pass);

      if (!placeTxs || !wallet.publicKey) {
        return;
      }

      try {
        setLoading(true);

        await sender.send(placeTxs);
        await fetchMarketsInfo();
        await fetchOpenOrders(wallet.publicKey);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [
      wallet,
      proposal,
      markets,
      connection,
      sender,
      placeOrderTransactions,
      fetchMarketsInfo,
      fetchOpenOrders,
    ],
  );

  const handleCrank = useCallback(
    async (isPassMarket: boolean, individualEvent?: PublicKey) => {
      if (!proposal || !markets || !wallet?.publicKey) return;
      let marketAccounts: MarketAccountWithKey = {
        publicKey: markets.passTwap.market,
        account: markets.pass,
      };
      let { eventHeap } = markets.pass;
      if (!isPassMarket) {
        marketAccounts = { publicKey: markets.failTwap.market, account: markets.fail };
        eventHeap = markets.fail.eventHeap;
      }
      try {
        setIsCranking(true);
        const txs = await crankMarketTransactions(marketAccounts, eventHeap, individualEvent);
        if (!txs) return;
        await sender.send(txs);
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
        markets,
        orders,
        orderBookObject,
        loading,
        isCranking,
        metaDisabled,
        usdcDisabled,
        fetchOpenOrders,
        fetchMarketsInfo,
        createTokenAccounts,
        createTokenAccountsTransactions,
        handleCrank,
        finalizeProposalTransactions,
        mintTokensTransactions,
        mintTokens,
        placeOrderTransactions,
        placeOrder,
      }}
    >
      {children}
    </proposalContext.Provider>
  );
}
