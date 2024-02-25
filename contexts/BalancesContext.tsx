import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, TokenAmount } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { dedup } from '../lib/utils';
import { MAX_REFETCH_RATE } from '../lib/constants';

export const defaultAmount: TokenAmount = {
  amount: '0.0',
  decimals: 0.0,
  uiAmount: 0.0,
};

type Balances = { [token: string]: TokenAmount };

export interface BalancesInterface {
  balances: Balances;
  fetchBalance: (mint: PublicKey) => TokenAmount;
  getBalance: (mint: PublicKey) => TokenAmount;
}

export const balancesContext = createContext<BalancesInterface>({
  balances: {},
  fetchBalance: () => defaultAmount,
  getBalance: () => defaultAmount,
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
  const [pendingFetches, setPendingFetches] = useState<(PublicKey | string)[]>([]);

  // Timeout used to btach fetches
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Execute all pending requests
  const balanceFetcher = useCallback(async () => {
    if (connection && owner) {
      const newFetches = dedup(pendingFetches, (e) => e.toString());
      newFetches.map(async (mint) => {
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
      });
      setPendingFetches([]);
    } else {
      return defaultAmount;
    }
  }, [connection, owner, pendingFetches]);

  const fetchBalance = useCallback(
    (mint: PublicKey | string) => {
      setPendingFetches((old) => [...old, mint]);

      // Return the stale value while fetching
      return balances[mint.toString()];
    },
    [balances],
  );

  // Clean timeout on unmount
  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  // Fetch once there has not been requests for long enough
  useEffect(() => {
    if (pendingFetches.length > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        balanceFetcher();
      }, MAX_REFETCH_RATE);
    }
  }, [timeoutRef, balanceFetcher]);

  const getBalance = useCallback(
    (mint: PublicKey | string) => {
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
