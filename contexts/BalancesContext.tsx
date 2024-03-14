import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountInfo, PublicKey, TokenAmount } from '@solana/web3.js';
import { AccountLayout, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useQueryClient } from '@tanstack/react-query';
import { BN } from '@coral-xyz/anchor';
import { Response } from '@/hooks/useAccountSubscription';
import useMultiAccountSubscription, {
  SubscriptionAccount,
} from '@/hooks/useMultiAccountSubscription';
import { MarketAccount } from '@openbook-dex/openbook-v2';
import { VaultAccount } from '@/lib/types';

export const defaultAmount: TokenAmount = {
  amount: '0.0',
  decimals: 0.0,
  uiAmount: 0.0,
};

type Balances = { [token: string]: Response<TokenAmount | undefined> };

export interface BalancesInterface {
  balances: Balances;
  setBalance(publicKey: PublicKey, amount: TokenAmount): void;
  setBalanceByMint(mint: PublicKey, stateUpdater: (oldAmount: TokenAmount) => TokenAmount): void;
  /**
   * @deprecated
   * Manually refetch
   * This function is deprecated and we should replace this with a direct update to the state to avoid expensive refetches.
   * @param publicKey address of the associated token account to be fetched
   */
  fetchBalance(publicKey: PublicKey): void;
  /**
   * @deprecated
   * Manually refetch
   * This function is deprecated and we should replace this with a direct update to the state to avoid expensive refetches.
   * @param publicKey address of the associated token account to be fetched
   */
  fetchBalanceByMint(publicKey: PublicKey): void;
}

export const balancesContext = createContext<BalancesInterface>({
  balances: {},
  setBalance: () => {},
  setBalanceByMint: () => {},
  fetchBalance: () => {},
  fetchBalanceByMint: () => {},
});

export const useBalances = () => {
  const context = useContext(balancesContext);
  if (!context) {
    throw new Error('useBalances must be used within a BalancesContextProvider');
  }
  return context;
};

type tokenMetaData = {
  decimals: number;
  lotSize: number;
};

export function BalancesProvider({ children }: { children: React.ReactNode }) {
  const { publicKey: owner } = useWallet();
  const queryClient = useQueryClient();
  const { connection } = useConnection();
  const [accounts, setAccounts] = useState<SubscriptionAccount<tokenMetaData>[]>([]);
  const markets = queryClient.getQueryData<Array<MarketAccount>>(['markets']);
  const vaultAccounts = queryClient.getQueryData<Array<VaultAccount> | undefined>([
    'conditionalVault',
  ]);

  const getAta = useCallback(
    (publicKey: PublicKey | undefined) => {
      if (publicKey && owner) {
        return getAssociatedTokenAddressSync(publicKey, owner, true);
      }
    },
    [owner],
  );

  useEffect(() => {
    if (markets && vaultAccounts) {
      const baseDecimals = markets?.[0].baseDecimals;
      const quoteDecimals = markets?.[0].quoteDecimals;
      const underlyingTokenAccounts: SubscriptionAccount<tokenMetaData>[] = vaultAccounts
        ? [
            {
              publicKey: getAta(vaultAccounts[0].underlyingTokenMint),
              metaData: {
                decimals: baseDecimals,
                lotSize: 10 ** (baseDecimals || 0),
              },
            },
            {
              publicKey: getAta(vaultAccounts[1].underlyingTokenMint),
              metaData: {
                decimals: quoteDecimals,
                lotSize: 10 ** (quoteDecimals || 0),
              },
            },
          ].filter((m): m is SubscriptionAccount<tokenMetaData> => !!m.publicKey) ?? []
        : [];

      const conditionalTokenAccounts =
        markets
          ?.flatMap((m) => [
            {
              publicKey: getAta(m.baseMint),
              metaData: {
                decimals: baseDecimals,
                lotSize: 10 ** (baseDecimals || 0),
              },
            },
            {
              publicKey: getAta(m.quoteMint),
              metaData: {
                decimals: quoteDecimals,
                lotSize: 10 ** (quoteDecimals || 0),
              },
            },
          ])
          .filter((m): m is SubscriptionAccount<tokenMetaData> => !!m.publicKey) ?? [];
      const newAccounts = [...underlyingTokenAccounts, ...conditionalTokenAccounts];
      if (newAccounts.length > 0) {
        setAccounts(newAccounts);
      }
    }
  }, [!!markets, !!vaultAccounts]);

  const accountSubscriptionCallback = (
    accountInfo: AccountInfo<Buffer>,
    metaData: tokenMetaData,
  ) => {
    const accountData = AccountLayout.decode(accountInfo.data);
    const dividedTokenAmount = new BN(accountData.amount) / new BN(metaData.lotSize);
    const tokenVal: TokenAmount = {
      amount: dividedTokenAmount.toString(),
      decimals: metaData.decimals,
      uiAmount: dividedTokenAmount,
      uiAmountString: dividedTokenAmount.toString(),
    };

    return tokenVal;
  };

  const fetchBalance = useCallback(
    async (ata: PublicKey | undefined) => {
      if (connection && owner && ata) {
        try {
          const amount = await queryClient.fetchQuery({
            queryKey: ['accountData', ata?.toString()],
            queryFn: async () => connection.getTokenAccountBalance(ata),
          });
          return amount.value;
        } catch (err) {
          console.error(
            `Error with this account fetch ${ata.toString()} (owner: ${owner.toString()}), please review issue and solve.`,
            err,
          );
        }
      } else {
        return defaultAmount;
      }
    },
    [connection, owner],
  );
  const fetchBalanceByMint = useCallback(
    async (mint: PublicKey | undefined) => {
      if (connection && owner && mint) {
        try {
          const ata = getAta(mint);
          if (ata) {
            const amount = await queryClient.fetchQuery({
              queryKey: ['accountData', ata],
              queryFn: async () => connection.getTokenAccountBalance(ata),
            });
            return amount.value;
          }
          throw new Error(`Associated token address could not be found from mint: ${mint}`);
        } catch (err) {
          console.error(
            `Error with this account fetch. (owner: ${owner.toString()}), please review issue and solve.`,
          );
          return defaultAmount;
        }
      } else {
        return defaultAmount;
      }
    },
    [connection, owner],
  );

  const [accountsData, updateAccountState] = useMultiAccountSubscription<
    TokenAmount,
    tokenMetaData
  >({
    accounts,
    fetch: fetchBalance,
    handler: accountSubscriptionCallback,
  });

  const emptyBalances: Balances = {};
  const balances: Balances = accountsData.reduce((prev, curr) => {
    if (!curr.response.data) {
      return prev;
    }
    prev[curr.publicKey.toString()] = curr.response;
    return prev;
  }, emptyBalances);

  function setBalance(publicKey: PublicKey, amount: TokenAmount) {
    updateAccountState(amount, publicKey);
  }
  function setBalanceByMint(
    mint: PublicKey,
    stateUpdater: (oldAmount: TokenAmount) => TokenAmount,
  ) {
    const ata = getAta(mint);
    if (ata) {
      const balance = balances[ata.toString()];
      if (balance.data) {
        const newAmount = stateUpdater(balance.data);
        updateAccountState(newAmount, ata);
      }
    }
  }

  const value = useMemo(
    () => ({
      balances,
      setBalance,
      setBalanceByMint,
      fetchBalance,
      fetchBalanceByMint,
    }),
    [balances],
  );

  return <balancesContext.Provider value={value}>{children}</balancesContext.Provider>;
}
