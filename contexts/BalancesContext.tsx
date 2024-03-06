import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, PublicKey, TokenAmount } from '@solana/web3.js';
import { AccountLayout, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useQueryClient } from '@tanstack/react-query';
import { BN } from '@coral-xyz/anchor';
import { META_BASE_LOTS, USDC_BASE_LOTS, useTokens } from '@/hooks/useTokens';
import { useProposalMarkets } from './ProposalMarketsContext';

export const defaultAmount: TokenAmount = {
  amount: '0.0',
  decimals: 0.0,
  uiAmount: 0.0,
};

type Balances = { [token: string]: TokenAmount };

export interface BalancesInterface {
  balances: Balances;
  fetchBalance: (mint: PublicKey) => Promise<TokenAmount>;
  getBalance: (mint: PublicKey) => Promise<TokenAmount>;
}

export const balancesContext = createContext<BalancesInterface>({
  balances: {},
  fetchBalance: () => new Promise(() => {}),
  getBalance: () => new Promise(() => {}),
});

export const useBalances = () => {
  const context = useContext(balancesContext);
  if (!context) {
    throw new Error('useBalances must be used within a BalancesContextProvider');
  }
  return context;
};

export function BalancesProvider({
  children,
  owner,
}: {
  children: React.ReactNode;
  owner?: PublicKey;
}) {
  const { markets } = useProposalMarkets();
  const client = useQueryClient();
  const { connection } = useConnection();
  const [balances, setBalances] = useState<{ [ata: string]: TokenAmount }>({});
  const [websocketConnected, setWebsocketConnected] = useState<boolean>(false);
  const { tokens } = useTokens();

  const fetchBalance = useCallback(
    async (mint: PublicKey | string) => {
      if (connection && owner) {
        const ata = getAssociatedTokenAddressSync(new PublicKey(mint.toString()), owner, true);
        try {
          const amount = await client.fetchQuery({
            queryKey: [`getTokenAccountBalance-${ata.toString()}-undefined`],
            queryFn: () => connection.getTokenAccountBalance(ata),
            staleTime: 10_000,
          });
          setBalances((old) => ({
            ...old,
            [ata.toString()]: amount.value,
          }));
          return amount.value;
        } catch (err) {
          console.error(
            `Error with this account fetch ${ata.toString()} (owner: ${owner.toString()}, mint: ${mint?.toString()}), please review issue and solve.`,
          );
          return defaultAmount;
        }
      } else {
        return defaultAmount;
      }
    },
    [connection, owner],
  );

  function findTokenAccountsForOwner(
    walletPublicKey: PublicKey,
    mints: PublicKey[],
  ): { ata: PublicKey; mint: PublicKey }[] {
    return mints
      .map((mint: PublicKey) => {
        if (!mint) return;
        return {
          ata: getAssociatedTokenAddressSync(mint, walletPublicKey),
          mint,
        };
      })
      .filter((p): p is { ata: PublicKey; mint: PublicKey } => !!p);
  }

  async function subscribeToTokenBalances() {
    if (!owner) return;
    // token WS for tokens we care about
    const metaMints = [
      tokens.meta?.publicKey,
      markets?.baseVault.conditionalOnFinalizeTokenMint,
      markets?.baseVault.conditionalOnRevertTokenMint,
    ];
    const usdcMints = [
      tokens.usdc?.publicKey,
      markets?.quoteVault.conditionalOnRevertTokenMint,
      markets?.quoteVault.conditionalOnRevertTokenMint,
    ];

    const mints = [...metaMints, ...usdcMints].filter((m): m is PublicKey => !!m);
    const atasWithMints = findTokenAccountsForOwner(owner, mints);

    // eslint-disable-next-line no-restricted-syntax
    for (const pubkeys of atasWithMints) {
      connection.onAccountChange(pubkeys.ata, (accountInfo: AccountInfo<Buffer>) => {
        const accountData = AccountLayout.decode(accountInfo.data);

        const relatedToken = metaMints.includes(pubkeys.mint)
          ? { decimals: tokens.meta?.decimals, baseLots: META_BASE_LOTS }
          : { decimals: tokens.usdc?.decimals, baseLots: USDC_BASE_LOTS };
        if (!relatedToken) {
          return;
        }
        const dividedTokenAmount = new BN(accountData.amount) / new BN(relatedToken.baseLots);
        const tokenVal: TokenAmount = {
          amount: dividedTokenAmount.toString(),
          decimals: relatedToken?.decimals ?? 0,
          uiAmount: dividedTokenAmount,
          uiAmountString: dividedTokenAmount.toString(),
        };

        // compare the difference before triggering state update, if it's the same don't update
        if (!balances[pubkeys.ata.toString()]) {
          setBalances((old) => ({
            ...old,
            [pubkeys.ata.toString()]: tokenVal,
          }));
        } else if (balances[pubkeys.ata.toString()].amount !== tokenVal.amount) {
          setBalances((old) => ({
            ...old,
            [pubkeys.ata.toString()]: tokenVal,
          }));
        }
      });
    }

    setWebsocketConnected(true);
  }

  useEffect(() => {
    if (!websocketConnected && owner && markets) {
      subscribeToTokenBalances();
    }
  }, [owner, markets]);

  const getBalance = useCallback(
    async (mint: PublicKey | string) => {
      if (Object.prototype.hasOwnProperty.call(balances, mint.toString())) {
        return balances[mint.toString()];
      }
      return fetchBalance(mint);
    },
    [balances, fetchBalance],
  );

  return (
    <balancesContext.Provider
      value={{
        balances,
        fetchBalance,
        getBalance,
      }}
    >
      {children}
    </balancesContext.Provider>
  );
}
