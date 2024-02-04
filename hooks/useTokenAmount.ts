import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TokenAmount } from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Use this to fetch the account of any entity, but use `useBalance` to know user's balances
 * @param mint Mint of the token account
 * @param owner Owner of the account, defaulting to the connected wallet
 * @returns The amount of tokens in the account and tools to fetch
 */
export function useTokenAmount(mint?: PublicKey, owner?: PublicKey) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const account = useMemo(() => {
    const realOwner = owner || wallet.publicKey;
    if (realOwner && mint) return getAssociatedTokenAddressSync(mint, realOwner, true);
  }, [mint, owner, wallet.publicKey]);
  const [amount, setAmount] = useState<TokenAmount>();

  const fetchAmount = useCallback(async () => {
    if (account && connection && wallet) {
      const defaultAmount: TokenAmount = {
        amount: '0.0',
        decimals: 0.0,
        uiAmount: 0.0,
      };
      try {
        setAmount((await connection.getTokenAccountBalance(account)).value);
      } catch (err) {
        console.error(
          `Error with this account fetch ${account.toString()} (owner: ${(
            owner || wallet.publicKey
          )?.toString()}, mint: ${mint?.toString()}), please review issue and solve.`,
        );
        setAmount(defaultAmount);
      }
    }
  }, [account, connection, wallet]);

  useEffect(() => {
    fetchAmount();
  }, [fetchAmount]);

  return { amount, account, fetchAmount };
}
