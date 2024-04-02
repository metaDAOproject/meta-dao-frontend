import { Group, Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Commitment,
  ComputeBudgetProgram,
  RpcResponseAndContext,
  SignatureResult,
  Transaction,
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

type SingleOrArray<T> = T | T[];

/**
 * this is just a type for simplicity. in the future, it might make sense to create a class that extends
 * Transaction | VersionedTransaction but adds additional attributes/functions that we can use in the process
 * transaction(s) flow
 */
type TransactionWithMetadata<T extends Transaction | VersionedTransaction> = {
  tx: T;
  canonicalDescriptor?: string;
};

type TransactionInfo<T extends Transaction | VersionedTransaction> = {
  signature: string;
  transaction: TransactionWithMetadata<T>;
  result?: SignatureResult;
  status?: TransactionStatus;
};

// type guard function function for TransactionWithMetadata since instanceof won't work
const isTransactionWithMetadata = <T extends Transaction | VersionedTransaction>(
  obj: any,
): obj is TransactionWithMetadata<T> => {
  return typeof obj === 'object' && obj !== null && 'tx' in obj;
};

export const useTransactionSender = <T extends Transaction | VersionedTransaction>(args?: {
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
    asyncClearStateForNotificationId();

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

  const asyncClearStateForNotificationId = () => {
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
  };

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
  const confirmTransaction = async (transactionInfos: Array<TransactionInfo<T>>, id: string) => {
    transactionInfos.forEach(async (transactionInfo) => {
      const controller = new AbortController();
      const signal = controller.signal;

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const confirmTransactionPromise = connection.confirmTransaction({
        signature: transactionInfo.signature,
        blockhash,
        lastValidBlockHeight,
      });

      const timeoutPromise = new Promise((_, reject) => {
        /**
         * note: we use a constant timeout of 30s (seems standard across many solana projects) for simplicity
         * for now. in the future, we might opt to dynamically set this timeout based on various cluster stats,
         * like ping time
         */
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, confirmationTimeoutMs);

        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Transaction confirmation aborted'));
        });
      });

      Promise.race([confirmTransactionPromise, timeoutPromise])
        .then((result) => {
          if ((result as any).value) {
            const transactionHasError =
              (result as RpcResponseAndContext<SignatureResult>).value.err !== null;

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
          }
        })
        .catch((err) => {
          console.error(
            `an error occurred resolving transaction for signature [${transactionInfo.signature}]`,
            err,
          );

          updateSingleTransactionInfo(transactionInfo.signature, id, () => ({
            status: TransactionStatus.TIMED_OUT,
          }));
        });
    });
  };

  const send = useCallback(
    /**
     * Sends transactions.
     * @param txs A sequence of sets of transactions. Sets are executed simultaneously.
     * @returns A sequence of set of tx signatures.
     */
    async (txs: SingleOrArray<T | TransactionWithMetadata<T>>[]) => {
      if (!connection || !wallet.publicKey || !wallet.signAllTransactions) {
        throw new Error('Bad wallet connection');
      }

      if (txs.length === 0 || (txs[0] instanceof Array && txs[0].length === 0)) {
        throw new Error('No transactions passed');
      }

      const sequence = (
        txs[0] instanceof Array
          ? (txs as (T | TransactionWithMetadata<T>)[][])
          : ([txs] as (T | TransactionWithMetadata<T>)[][])
      ).map((arr) =>
        arr.map((el) =>
          isTransactionWithMetadata(el)
            ? el
            : {
                tx: el,
                canonicalDescriptor: undefined,
              },
        ),
      );

      const { blockhash } = await connection.getLatestBlockhash({
        commitment,
      });
      const timedTxs = sequence.map((set) =>
        set.map((el) => {
          const tx = el.tx;
          if (!(tx instanceof VersionedTransaction)) {
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey!;

            // Priority fee ix
            tx.instructions = [
              ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
              ...tx.instructions,
            ];
          }
          return tx;
        }),
      );

      try {
        const signedTxs = await wallet.signAllTransactions(timedTxs.flat());

        // Reconstruct signed sequence
        const signedSequence: TransactionInfo<T>[][] = [];
        let i = 0;
        sequence.forEach((set) => {
          const signedSet: TransactionInfo<T>[] = [];
          set.forEach((el) => {
            const transactionSignature = signedTxs[i].signatures[0];
            const signature =
              transactionSignature instanceof Uint8Array
                ? Buffer.from(transactionSignature)
                : transactionSignature.signature;

            if (signature) {
              signedSet.push({
                signature: base58.encode(signature),
                transaction: {
                  ...el,
                  tx: signedTxs[i],
                },
              });

              i += 1;
            }
          });
          signedSequence.push(signedSet);
        });

        // Send signed transactions
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

        const transactionInfos = signedSequence.flat();

        // render an initial set of transactions in a single notification
        const id = notifications.show({
          title: <Text fw="bold">{generateTitle(transactionInfos)}</Text>,
          message: generateNotficationBody(transactionInfos),
          ...generateDefaultNotificationOptions(),
        });

        setIdToTransactionInfos((state) => ({
          ...state,
          [id]: transactionInfos,
        }));
        confirmTransaction(transactionInfos, id);

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
