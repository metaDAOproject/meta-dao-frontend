import { PublicKey } from '@solana/web3.js';
import { useEffect } from 'react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { defaultAmount, useBalances } from '../contexts/BalancesContext';

export function useBalance(mint?: PublicKey) {
  const { fetchBalance } = useBalances();
  const { publicKey: owner } = useWallet();
  const { connection } = useConnection();

  const fetchAmount = async () => {
    if (mint) {
      await fetchBalance(mint);
    }
  };

  const account = (mint && owner)
  ? getAssociatedTokenAddressSync(new PublicKey(mint.toString()), owner, true) : null;

  const { error, data } = useQuery({
    queryKey: [`getTokenAccountBalance-${account?.toString()}-undefined`],
    queryFn: () => connection.getTokenAccountBalance(account ?? new PublicKey('')),
    staleTime: 30_000,
    enabled: !!account,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (error) {
      console.error(
        `Error with this account fetch ${account?.toString()} (owner: ${(
          owner
        )?.toString()}, mint: ${mint?.toString()}), please review issue and solve.`,
      );
    }
  }, [error]);

  return { amount: data?.value ?? defaultAmount, fetchAmount };
}
