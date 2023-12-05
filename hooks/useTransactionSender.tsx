import { Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useCallback } from 'react';
import { NotificationLink } from '../components/Layout/NotificationLink';

export const useTransactionSender = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const send = useCallback(
    async (txs: (Transaction | VersionedTransaction)[], synchronous?: boolean) => {
      if (!connection || !wallet.publicKey || !wallet.signAllTransactions) {
        throw new Error('Bad wallet connection');
      }

      const blockhask = await connection.getLatestBlockhash();
      const timedTxs = txs.map((e: Transaction | VersionedTransaction) => {
        const tx = e;
        if (!(tx instanceof VersionedTransaction)) {
          tx.recentBlockhash = blockhask.blockhash;
          tx.feePayer = wallet.publicKey!;
        }
        return tx;
      });
      const signedTxs = await wallet.signAllTransactions(timedTxs);
      const signatures = [];

      if (synchronous) {
        // Using loops here to make sure transaction are executed in the correct order
        // eslint-disable-next-line no-restricted-syntax
        for (const tx of signedTxs) {
          // eslint-disable-next-line no-await-in-loop
          const txSignature = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
          });
          // eslint-disable-next-line no-await-in-loop
          await connection.confirmTransaction(txSignature);
          signatures.push(txSignature);
        }
      } else {
        signatures.push(
          ...(await Promise.all(
            signedTxs.map((tx) =>
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
    },
    [wallet.publicKey, connection],
  );

  return { send };
};
