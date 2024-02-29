import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TokenAmount } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Use this to fetch the account of any entity, but use `useBalance` to know user's balances
 * @param mint Mint of the token account
 * @param owner Owner of the account, defaulting to the connected wallet
 * @returns The amount of tokens in the account and tools to fetch
 */

const defaultAmount: TokenAmount = {
  amount: '0.0',
  decimals: 0.0,
  uiAmount: 0.0,
};

export function useTokenAmount(mint?: PublicKey, owner?: PublicKey) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const account = useMemo(() => {
    const realOwner = owner || wallet.publicKey;
    if (realOwner && mint) return getAssociatedTokenAddressSync(mint, realOwner, true);
  }, [mint, owner, wallet.publicKey]);

  const { error, data } = useQuery({
    queryKey: [`getTokenAccountBalance-${account?.toString()}-undefined`],
    queryFn: () => connection.getTokenAccountBalance(account ?? new PublicKey("")),
    staleTime: 10_000,
    enabled: !!account,
  });

  useEffect(() => {
    if (error) {
      console.error(
        `Error with this account fetch ${account?.toString()} (owner: ${(
          owner || wallet.publicKey
        )?.toString()}, mint: ${mint?.toString()}), please review issue and solve.`,
      );
    }
  }, [error]);



  return { amount: data?.value ?? defaultAmount, account };
}
