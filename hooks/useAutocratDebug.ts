import { useCallback } from 'react';
import { Transaction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useTokens } from './useTokens';
import { useAutocrat } from '../contexts/AutocratContext';

export function useAutocratDebug() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { tokens } = useTokens();
  const { dao, daoState, daoTreasury, autocratProgram: program } = useAutocrat();

  const initializeDao = useCallback(async () => {
    if (
      !tokens?.meta?.publicKey ||
      !tokens?.usdc?.publicKey ||
      !wallet?.publicKey ||
      !wallet.signAllTransactions ||
      !connection ||
      !program
    ) {
      return;
    }

    const txs: Transaction[] = [];

    const daoTx = new Transaction().add(
      await program.methods
        .initializeDao()
        .accounts({
          dao,
          metaMint: tokens.meta.publicKey,
          usdcMint: tokens.usdc.publicKey,
        })
        .instruction(),
    );

    const blockhask = await connection.getLatestBlockhash();
    daoTx.feePayer = wallet.publicKey!;
    daoTx.recentBlockhash = blockhask.blockhash;

    txs.push(daoTx);

    const signedTxs = await wallet.signAllTransactions(txs);
    await Promise.all(
      signedTxs.map((tx) => connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })),
    );
  }, [program, dao, wallet, tokens, connection, program]);

  return { program, dao, daoTreasury, daoState, initializeDao, };
}
