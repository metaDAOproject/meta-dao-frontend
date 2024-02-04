import { PublicKey } from '@solana/web3.js';
import { useEffect } from 'react';
import { defaultAmount, useBalances } from '../contexts/BalancesContext';

export function useBalance(mint?: PublicKey) {
  const { balances, fetchBalance } = useBalances();

  const fetchAmount = async () => {
    if (mint) {
      await fetchBalance(mint);
    }
  };

  useEffect(() => {
    if (mint) {
      fetchBalance(mint);
    }
  }, [mint, fetchBalance]);

  return { amount: mint ? balances[mint.toString()] : defaultAmount, fetchAmount };
}
