import { PublicKey } from '@solana/web3.js';
import { useEffect } from 'react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { defaultAmount, useBalances } from '../contexts/BalancesContext';

export function useBalance(mint?: PublicKey) {
  const { balances } = useBalances();
  const { publicKey: owner } = useWallet();

  const account =
    mint && owner
      ? getAssociatedTokenAddressSync(new PublicKey(mint.toString()), owner, true)
      : null;

  const balance = balances[account?.toString() ?? ''];

  return { amount: balance ?? defaultAmount };
}
