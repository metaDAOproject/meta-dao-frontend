import { Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ComputeBudgetProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useCallback } from 'react';
import { NotificationLink } from '../components/Layout/NotificationLink';
import { usePriorityFee } from './usePriorityFee';

type SingleOrArray<T> = T | T[];

export const useTransactionSender = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { priorityFee } = usePriorityFee();

  const send = useCallback(
    /**
     * Sends transactions.
     * @param txs A sequence of sets of transactions. Sets are executed simultaneously.
     * @returns A sequence of set of tx signatures.
     */
    async <T extends Transaction | VersionedTransaction>(txs: SingleOrArray<T>[]) => {
      if (!connection || !wallet.publicKey || !wallet.signAllTransactions) {
        throw new Error('Bad wallet connection');
      }

      if (txs.length === 0 || (txs[0] instanceof Array && txs[0].length === 0)) {
        throw new Error('No transactions passed');
      }

      const sequence = txs[0] instanceof Array ? (txs as T[][]) : ([txs] as T[][]);

      const blockhask = await connection.getLatestBlockhash();
      const timedTxs = sequence.map((set) =>
        set.map((e: T) => {
          const tx = e;
          if (!(tx instanceof VersionedTransaction)) {
            tx.recentBlockhash = blockhask.blockhash;
            tx.feePayer = wallet.publicKey!;
            // Compute limit ix & priority fee ix
            // Create Open Orders Account & Place Order (73.8k) needs 80k https://explorer.solana.com/tx/5b4LCzgkgFyFY25qUDMnftExLvFsXsP9XopAn88HXKhUHg43QY62rGJqiEhsbfYPvccNMNQj1eRTxLqurSo9vsHX
            // Mint (59.095) needs 70k https://explorer.solana.com/tx/4gFeSPnHB59FH12vpuhnjznc2aZA2nf4krwLwhQRLUgiMQU1kuTn49TtPiqxkry5cQ6NYr9xMA8aT7frHBxtXa3r
            // Crank (6.4k) needs 10k https://explorer.solana.com/tx/5sf9b225oNZVu2WyiDTTXFiC6wytZQPJrK5JsBK1QfLtmkCkDyCvPWbte8X83t1q2zyoSzxUsQu6qYDvN56GCnVS
            // Close open orders account (9.9k) needs 15k https://explorer.solana.com/tx/5jY5CsmSHoiU9npaCTqYCKMjxT4uzQUe33NJ7BVwSakG6KzNo8f2A5nNgoX4ktao1Wp4FK11SH5QVZerjvQjeG9D
            // Cancel order & settle funds (56.4k) needs 60k https://explorer.solana.com/tx/5W6Mt8vzC9dh8CdVe4oi1S769VkGbHXprdpJmx8qMpHu7F5sZSkCY3wT9D3hV9Dh2fXMJzPgYBip2SU4q9wAUh9K
            // Settle funds (38.8k) needs 50k https://explorer.solana.com/tx/5cuDkbi8bNQTKzC4TUhjRFfzPefZnKX8qJvaGak7y8qEjsGshYnuJwfuoVdXVk43jDq4qrsqpuGdwUL5TWB9tVzo
            // Redeem (60.9k) needs 80k https://explorer.solana.com/tx/4jpgdd7RoHwSv8Ci15z4K2G2rVxfrSqyPMuf1F7YotdNjmyRg5froCHp7NBzMu2fMNEHUH2WkgkEtKxMeGsjQouN
            // TODO: Finalize
            // TODO: Create Proposal
            // TODO: Initialize DAO
            tx.instructions = [
              ComputeBudgetProgram.setComputeUnitLimit({ units: 90_000 }),
              ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
              ...tx.instructions,
            ];
          }
          return tx;
        }),
      );

      try {
        const signedTxs = await wallet.signAllTransactions(timedTxs.flat());
        const signatures = [];

        // Reconstruct signed sequence
        const signedSequence: T[][] = [];
        let i = 0;
        sequence.forEach((set) => {
          const signedSet: T[] = [];
          set.forEach(() => {
            signedSet.push(signedTxs[i]);
            i += 1;
          });
          signedSequence.push(signedSet);
        });

        // eslint-disable-next-line no-restricted-syntax
        for (const set of signedSequence) {
          signatures.push(
            // eslint-disable-next-line no-await-in-loop
            ...(await Promise.all(
              set.map((tx) =>
                connection
                  .sendRawTransaction(tx.serialize(), {
                    skipPreflight: true,
                  })
                  .then((txSignature) =>
                    connection.confirmTransaction(txSignature).then(() => txSignature),
                  ),
              ),
            )),
          );
        }

        notifications.show({
          title: 'Transactions sent!',
          message: (
            <Stack>
              {signatures.map((signature) => (
                <NotificationLink key={signature} signature={signature} />
              ))}
            </Stack>
          ),
          autoClose: 5000,
        });
        return signatures;
      } catch (err) {
        notifications.show({
          title: 'Transactions not sent!',
          message: <Text>An error occured: {err?.toString()}</Text>,
          autoClose: 5000,
        });
        return [];
      }
    },
    [wallet.publicKey, connection, priorityFee],
  );

  return { send };
};
