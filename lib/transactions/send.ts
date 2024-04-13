import {
  Connection,
  SendTransactionError,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

import { error, log } from '../logger';
import { SignatureError } from './errors';
import { TransactionLifecycleEventCallback } from './events';
import { SendTransactionConfig } from './types';
import { abortableSleep, getTransactionSignatureOrThrow } from './utils';

const MAX_SEND_TX_RETRIES = 10;

// source: https://github.com/solana-labs/solana-web3.js/blob/master/packages/errors/src/messages.ts
const TRANSACTION_ALREADY_PROCESSED_MESSAGE = 'This transaction has already been processed';

/**
 * Asynchronously sends a signed transaction to the Solana network and invoke a callback function for various lifecycle events.
 * This function supports both one-time and continuous transaction submissions, with configurable options for sending transactions
 * such as skipping preflight checks and setting maximum retries.
 *
 * @param {Object} params - The parameters for sending the transaction.
 * @param {Transaction | VersionedTransaction} params.signedTransaction - The signed transaction to be sent.
 * @param {Connection} params.connection - The blockchain connection to use for sending the transaction.
 * @param {SendTransactionConfig} [params.config] - Optional configuration for transaction sending options,
 *        including whether to skip preflight checks, the number of maximum retries, the timeout for polling in continuous mode,
 *        and an AbortController for handling cancellations in continuous mode.
 * @param {TransactionLifecycleEventCallback} [params.onTransactionEvent] - Optional callback to handle transaction lifecycle events,
 *        which are invoked with an object containing the type of event, the transaction phase, and the transaction ID.
 *
 * @returns {Promise<string>} - A promise that resolves to the transaction ID of the submitted transaction.
 *
 * @throws {SignatureError} - Throws an error if there is a signature error in the transaction serialization process.
 * @throws {Error} - Throws a general error if the transaction fails to send, or if required configurations for continuous sending are missing.
 */
export const sendSignedTransaction = async ({
  signedTransaction,
  connection,
  config = {
    sendOptions: {
      skipPreflight: true,
      maxRetries: MAX_SEND_TX_RETRIES,
    },
  },
  onTransactionEvent,
}: {
  signedTransaction: Transaction | VersionedTransaction;
  connection: Connection;
  config?: SendTransactionConfig;
  onTransactionEvent?: TransactionLifecycleEventCallback;
}): Promise<string> => {
  const transactionProcessedController = new AbortController();
  let rawTransaction: Buffer | Uint8Array;

  try {
    /**
     * throws on signature errors unless explicitly told not to via config
     *
     * source: https://github.com/solana-labs/solana-web3.js/blob/7265594ce8ac9480dea2b0f5fe84b24fdacf115b/packages/library-legacy/src/transaction/legacy.ts#L797-L833
     */
    rawTransaction = signedTransaction.serialize();
  } catch (err: any) {
    error('Serialize transaction error: ', err.message);
    throw new SignatureError({
      transaction: signedTransaction,
      message: err.message,
    });
  }

  const transactionId = getTransactionSignatureOrThrow(signedTransaction);
  (async () => {
    const pollingSendTransactionTimeoutMs = config.pollingSendTransactionTimeoutMs ?? 1_000;
    const continuouslySendTransactions = config.continuouslySendTransactions ?? false;

    if (continuouslySendTransactions && !config.controller) {
      throw new Error(
        'AbortController is required to continuously send a transaction to the cluster',
      );
    }

    while (!transactionProcessedController.signal.aborted && !config.controller?.signal.aborted) {
      onTransactionEvent?.({
        type: 'send',
        phase: 'pending',
        transactionId,
      });

      /**
       * todo: handle the possible `SendTransactionError` errors, which right now we just catch and
       * throw a generic error related to sending a transaction
       *
       * source: https://github.com/solana-labs/solana-web3.js/blob/2d48c0954a3823b937a9b4e572a8d63cd7e4631c/packages/library-legacy/src/connection.ts#L5918-L5927
       */
      connection
        .sendRawTransaction(rawTransaction, config.sendOptions)
        .catch((err: SendTransactionError) => {
          if (err.message.includes(TRANSACTION_ALREADY_PROCESSED_MESSAGE)) {
            transactionProcessedController.abort();
            return;
          }

          error('SendTransactionError: ', err);
          throw new Error('Failed to send transaction');
        });

      onTransactionEvent?.({
        type: 'send',
        phase: 'completed',
        transactionId,
      });

      if (!continuouslySendTransactions) {
        log('[Continuous send = false] first transaction sent, bailing...');
        break;
      }

      /* eslint-disable no-await-in-loop */
      await abortableSleep(pollingSendTransactionTimeoutMs, config.controller);
    }
  })();

  return transactionId;
};
