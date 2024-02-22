import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, TokenAmount } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

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
  getBalance: () => new Promise(() => { }),
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
  const { connection } = useConnection();
  const [balances, setBalances] = useState<{ [token: string]: TokenAmount }>({});

  const fetchBalance = useCallback(
    async (mint: PublicKey | string) => {
      if (connection && owner) {
        const account = getAssociatedTokenAddressSync(new PublicKey(mint.toString()), owner, true);
        try {
          const amount = await connection.getTokenAccountBalance(account);
          setBalances((old) => ({
            ...old,
            [mint.toString()]: amount.value,
          }));
          return amount.value;
        } catch (err) {
          console.error(
            `Error with this account fetch ${account.toString()} (owner: ${owner.toString()}, mint: ${mint?.toString()}), please review issue and solve.`,
          );
          return defaultAmount;
        }
      } else {
        return defaultAmount;
      }
    },
    [connection, owner],
  );

  const getBalance = useCallback(
    async (mint: PublicKey | string) => {
      if (Object.prototype.hasOwnProperty.call(balances, mint.toString())) {
        return balances[mint.toString()];
      }
      return fetchBalance(mint)
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
