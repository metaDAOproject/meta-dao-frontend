import { Group, Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Commitment,
  ComputeBudgetProgram,
  Transaction as LegacyTransaction,
  PublicKey,
  SignatureResult,
  VersionedTransaction,
} from '@solana/web3.js';
import { IconCircleCheck, IconCircleX, IconExclamationCircle } from '@tabler/icons-react';
import base58 from 'bs58';
import { useCallback, useEffect, useState } from 'react';

import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { usePriorityFee } from '@/hooks/usePriorityFee';

const DEFAULT_CONFIRMATION_TIMEOUT_MS = 30_000;

// copy '@solana/web3.js' since unable to import const enum when `isolatedModules` is enabled
enum TransactionStatus {
  BLOCKHEIGHT_EXCEEDED = 0,
  PROCESSED = 1,
  TIMED_OUT = 2,
  NONCE_INVALID = 3,
}

type Transaction = LegacyTransaction | VersionedTransaction;

type SingleOrArray<T> = T | T[];

/**
 * this is just a type for simplicity. in the future, it might make sense to create a class that extends
 * Transaction | VersionedTransaction but adds additional attributes/functions that we can use in the process
 * transaction(s) flow
 */
type TransactionWithMetadata<T extends Transaction> = {
  tx: T;
  canonicalDescriptor?: string;
};

type TransactionInfo<T extends Transaction> = {
  signature: string;
  transaction: TransactionWithMetadata<T>;
  result?: SignatureResult;
  status?: TransactionStatus;
};

export const useTransactionSender = <T extends Transaction>(args?: {
  confirmationTimeoutMs?: number;
  commitment?: Commitment;
}) => {
  const confirmationTimeoutMs = args?.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS;
  const commitment = args?.commitment ?? 'processed';

  const { connection } = useConnection();
  const wallet = useWallet();
  const { priorityFee } = usePriorityFee();
  const { generateExplorerLink } = useExplorerConfiguration();

  const [idToTransactionInfos, setIdToTransactionInfos] = useState<
    Record<string, Array<TransactionInfo<T>>>
  >({});
  const [successfulSignatureCount, setSuccessfulSignatureCount] = useState<Record<string, number>>(
    {},
  );
  const [idsToClear, setIdsToClear] = useState<Array<string>>([]);

  useEffect(() => {
    idsToClear.forEach((id) => {
      if (!(id in idToTransactionInfos)) return;

      // remove successful count for notification id
      setSuccessfulSignatureCount((state) =>
        Object.keys(state).reduce((acc, o) => {
          if (o === id) return acc;
          return {
            ...acc,
            [o]: state[o],
          };
        }, {} as Record<string, number>),
      );

      // remove transaction info for the specified notification id
      setIdToTransactionInfos((state) =>
        Object.keys(state).reduce((acc, o) => {
          if (o === id) return acc;
          return {
            ...acc,
            [o]: state[o],
          };
        }, {} as Record<string, Array<TransactionInfo<T>>>),
      );
    });

    return () => {
      setIdsToClear([]);
    };
  }, [idsToClear]);

  /**
   * render a notification update when a transaction result is received
   */
  useEffect(() => {
    const notificationIds = Object.keys(idToTransactionInfos);
    if (notificationIds.length === 0) return;

    notificationIds.forEach((id) => {
      const transactionInfos = idToTransactionInfos[id];

      notifications.update({
        id,
        title: <Text fw="bold">{generateTitle(transactionInfos, id)}</Text>,
        message: generateNotficationBody(transactionInfos),
      });
    });
  }, [idToTransactionInfos]);

  const updateSingleTransactionInfo = (
    signature: string,
    id: string,
    updateStateFieldsCallback: () => Partial<TransactionInfo<T>>,
  ) => {
    setIdToTransactionInfos((state) => {
      if (!state[id]) return state;
      const indexToUpdate = state[id].findIndex((x) => x.signature === signature);

      // no transaction info for id, ignore
      if (indexToUpdate === -1) return state;
      return {
        ...state,
        [id]: [
          ...(indexToUpdate === 0 ? [] : state[id].slice(0, indexToUpdate)),
          {
            ...state[id][indexToUpdate],
            ...updateStateFieldsCallback(),
          },
          // start index is inclusive, add 1 to skip the updated element
          ...(indexToUpdate + 1 >= state[id].length ? [] : state[id].slice(indexToUpdate + 1)),
        ],
      };
    });
  };

  /**
   * all state that we process in this function wasn't yet updated. i failed
   * to figure out exactly what was going on, but my problems were solved by pushing new state
   * and allowing async state updates to trigger state cleanup logic
   */
  const onNotificationClose = (id: string) => setIdsToClear((state) => [...state, id]);

  const generateDefaultNotificationOptions = () => ({
    withCloseButton: true,
    onClose: (props: any) => onNotificationClose(props.id),
    loading: false,
    autoClose: false,
    color: 'var(--mantine-color-dark-4)',
  });

  const isTransactionSuccessful = (transactionInfo: TransactionInfo<T>) =>
    transactionInfo.result !== undefined && transactionInfo.result.err === null;
  const isTransactionFailed = (transactionInfo: TransactionInfo<T>) =>
    transactionInfo.result !== undefined && transactionInfo.result.err !== null;
  const isTransactionUnconfirmed = (transactionInfo: TransactionInfo<T>) =>
    transactionInfo.status === TransactionStatus.TIMED_OUT;

  const generateTitle = (transactionInfos: Array<TransactionInfo<T>>, notificationId?: string) => {
    if (transactionInfos.length === 1) {
      const transactionInfo = transactionInfos[0];

      if (isTransactionSuccessful(transactionInfo)) return 'Transaction Succeeded';
      if (isTransactionUnconfirmed(transactionInfo)) return 'Unable to Confirm Transaction Status';
      if (isTransactionFailed(transactionInfo)) return 'Transaction Failed';

      return 'Confirming transaction';
    }

    return `Confirmed ${notificationId ? successfulSignatureCount[notificationId] ?? 0 : 0} of ${
      transactionInfos.length
    } transactions`;
  };

  const generateNotficationBody = (transactionInfos: Array<TransactionInfo<T>>) => {
    return (
      <>
        {transactionInfos.map((transactionInfo, idx) => {
          const {
            transaction: { canonicalDescriptor },
            signature,
          } = transactionInfo;

          return (
            <Group align="flex-start" key={idx}>
              {renderSignatureIcon(transactionInfo)}
              <Text>
                <a
                  href={generateExplorerLink(signature, 'transaction')}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ textDecoration: 'underline', fontWeight: '400' }}
                >
                  View Transaction
                </a>
                {': '}
                {canonicalDescriptor ? canonicalDescriptor : `Transaction ${idx + 1}`}
              </Text>
            </Group>
          );
        })}
      </>
    );
  };

  const renderSignatureIcon = (transactionInfo: TransactionInfo<T>) => {
    if (isTransactionSuccessful(transactionInfo)) {
      return (
        <IconCircleCheck
          stroke={2}
          style={{ width: '1.25rem', height: '1.25rem' }}
          color="var(--mantine-color-green-filled)"
        />
      );
    } else if (isTransactionFailed(transactionInfo)) {
      return (
        <IconCircleX
          stroke={2}
          style={{ width: '1.25rem', height: '1.25rem' }}
          color="var(--mantine-color-red-filled)"
        />
      );
    } else if (isTransactionUnconfirmed(transactionInfo)) {
      return (
        <IconExclamationCircle
          stroke={2}
          style={{ width: '1.25rem', height: '1.25rem' }}
          color="var(--mantine-color-yellow-filled)"
        />
      );
    }

    return <Loader size="xs" color="var(--mantine-color-dark-2)" />;
  };

  /**
   * asynchronously confirm transaction result for each signature and update state when resolved
   */
  const confirmTransactions = async (transactionInfos: Array<TransactionInfo<T>>, id: string) => {
    const cancelSignatureSubscription = (subscriptionId?: number) => {
      if (subscriptionId) {
        console.log('cancelling subscription...');
        connection
          .removeSignatureListener(subscriptionId)
          .then(() => console.log('unsubscribed'))
          .catch(console.error);
      }
    };

    transactionInfos.forEach(async (transactionInfo) => {
      let subscriptionId: number | undefined = undefined;
      /**
       * note: we use a constant timeout (optionally caller defined, default 30s) for simplicity. in the future,
       * we might opt to keep trying to confirm until the transaction blockhash expires, dynamically set this
       * timeout based on various cluster stats, or something else - all with a max limit as optionally supplied
       * by the caller
       */
      const timeoutId = setTimeout(() => {
        cancelSignatureSubscription(subscriptionId);
        updateSingleTransactionInfo(transactionInfo.signature, id, () => ({
          status: TransactionStatus.TIMED_OUT,
        }));
      }, confirmationTimeoutMs);

      subscriptionId = connection.onSignature(
        transactionInfo.signature,
        (result, context) => {
          console.debug('WS result: ', transactionInfo.signature, result, context);
          clearTimeout(timeoutId);
          cancelSignatureSubscription(subscriptionId);

          const transactionHasError = result.err !== null;
          updateSingleTransactionInfo(transactionInfo.signature, id, () => ({
            result: {
              err: transactionHasError ? {} : null,
            },
          }));

          setSuccessfulSignatureCount((state) => {
            const current = state[id] ?? 0;
            return {
              ...state,
              [id]: transactionHasError ? current : current + 1,
            };
          });
        },
        commitment,
      );
    });
  };

  const startProcessingTransactions = (transactionInfos: TransactionInfo<T>[]) => {
    /**
     * render an initial set of transactions in a single notification
     *
     * the `id` is a unique identifier for each notification within the
     * mantine/core notification system. it is used to delete and update
     * individual notifications.
     *
     * source: https://mantine.dev/x/notifications/#notification-props
     */
    const id = notifications.show({
      title: <Text fw="bold">{generateTitle(transactionInfos)}</Text>,
      message: generateNotficationBody(transactionInfos),
      ...generateDefaultNotificationOptions(),
    });

    setIdToTransactionInfos((state) => ({
      ...state,
      [id]: transactionInfos,
    }));
    confirmTransactions(transactionInfos, id);
  };

  const send = useCallback(
    /**
     * Sends transactions.
     * @param txs A sequence of sets of transactions. Sets are executed simultaneously.
     * @returns A sequence of set of tx signatures.
     */
    async (txs: SingleOrArray<T | TransactionWithMetadata<T>>[]) => {
      if (!connection || !wallet.publicKey || !wallet.signAllTransactions)
        throw new Error('Bad wallet connection');
      if (txs.length === 0 || (txs[0] instanceof Array && txs[0].length === 0))
        throw new Error('No transactions passed');

      const sequence = toTransactionWithMetadataSequence(
        txs[0] instanceof Array
          ? (txs as (T | TransactionWithMetadata<T>)[][])
          : ([txs] as (T | TransactionWithMetadata<T>)[][]),
      );

      const { blockhash } = await connection.getLatestBlockhash({
        commitment,
      });
      const txsWithPriorityFee = sequence.map((set) =>
        set.map((el) =>
          addComputeBudgetInstructions(el.tx, {
            fee: priorityFee,
            blockhash,
            payer: wallet.publicKey!,
          }),
        ),
      );

      try {
        const signedTxs = await wallet.signAllTransactions(txsWithPriorityFee.flat());

        const signedSequence = reconstructSequenceFromSignedTxs(sequence, signedTxs);
        const signatures = await Promise.all(
          signedSequence.flatMap((set) =>
            set.map((el) =>
              connection.sendRawTransaction(el.transaction.tx.serialize(), {
                skipPreflight: true,
                preflightCommitment: commitment,
              }),
            ),
          ),
        );

        startProcessingTransactions(signedSequence.flat());

        return signatures;
      } catch (err: any) {
        console.error('send tx error: ', err);
        const message = err?.message ?? err?.toString();
        notifications.show({
          title: 'Transactions not sent!',
          message: <Text>An error occured: {message}</Text>,
          autoClose: 5000,
        });
        return [];
      }
    },
    [wallet.publicKey, connection, priorityFee],
  );

  return { send };
};

/**
 * This logic can be extended to offer the ability to set a dynamic priority fee (with an optional max),
 * with data from the getRecentPrioritizationFees method.
 *
 * One thing we need to figure out is how to adapt this logic for VersionedTransaction objects, or at least
 * how to allow configuration + setting before creating the VersionedTransaction.
 */
const addComputeBudgetInstructions = <T extends Transaction>(
  tx: T,
  config?: {
    fee?: number | bigint;
    blockhash?: string;
    payer?: PublicKey;
  },
): T => {
  if (tx instanceof VersionedTransaction) return tx;
  if (!config?.fee) return tx;

  if (config?.blockhash) tx.recentBlockhash = config?.blockhash;
  if (config?.payer) tx.feePayer = config?.payer;

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
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: config?.fee }),
    ...tx.instructions,
  ];

  return tx;
};

// type guard function function for TransactionWithMetadata since instanceof won't work
const isTransactionWithMetadata = <T extends Transaction>(
  obj: any,
): obj is TransactionWithMetadata<T> => {
  return typeof obj === 'object' && obj !== null && 'tx' in obj;
};

const toTransactionWithMetadataSequence = <T extends Transaction>(
  txSet: (T | TransactionWithMetadata<T>)[][],
) =>
  txSet.map((set) =>
    set.map((tx) =>
      isTransactionWithMetadata(tx)
        ? tx
        : {
            tx: tx,
            canonicalDescriptor: undefined,
          },
    ),
  );

const reconstructSequenceFromSignedTxs = <T extends Transaction | VersionedTransaction>(
  sequence: TransactionWithMetadata<T>[][],
  signedTransactions: T[],
) => {
  const signedSequence: TransactionInfo<T>[][] = [];
  let i = 0;
  sequence.forEach((set) => {
    const signedSet: TransactionInfo<T>[] = [];
    set.forEach((el) => {
      const transactionSignature = signedTransactions[i].signatures[0];
      const signature =
        transactionSignature instanceof Uint8Array
          ? Buffer.from(transactionSignature)
          : transactionSignature.signature;

      if (signature) {
        signedSet.push({
          signature: base58.encode(signature),
          transaction: {
            ...el,
            tx: signedTransactions[i],
          },
        });

        i += 1;
      }
    });

    signedSequence.push(signedSet);
  });

  return signedSequence;
};
