import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

import { log } from '../logger';
import { awaitTransactionSignatureConfirmation } from './confirm';
import { ConfirmationTimeoutError } from './errors';
import { TransactionError } from './errors/transaction';
import { TransactionLifecycleEventCallback } from './events';
import { sendSignedTransaction } from './send';
import { simulateTransaction } from './simulate';
import {
  NoTimeoutConfig,
  SendTransactionConfig,
  StaticTimeoutConfig,
  TransactionExpirationTimeoutConfig,
} from './types';
import { getUnixTs, tryInvokeAbort } from './utils';

const DEFAULT_CONFIRMATION_TIMEOUT = 30_000;

/**
 * Sends a signed transaction and then awaits its confirmation according to the specified configurations.
 *
 * @param {Object} params - The parameters for sending and confirming the transaction.
 * @param {Transaction | VersionedTransaction} params.signedTransaction - The signed transaction to be sent.
 * @param {Connection} params.connection - The blockchain connection to use for sending the transaction and monitoring its confirmation.
 * @param {SendTransactionConfig & (StaticTimeoutConfig | TransactionExpirationTimeoutConfig | NoTimeoutConfig)} [params.config] - Configuration options for sending and confirming the transaction, including timeout settings and send options.
 * @param {TransactionLifecycleEventCallback} [params.onTransactionEvent] - Optional callback to handle transaction lifecycle events.
 *
 * @returns {Promise<string>} - A promise that resolves with the transaction ID if the transaction is confirmed successfully, or rejects with an error if the transaction fails or timeouts.
 *
 * @throws {ConfirmationTimeoutError} - Throws this error if the confirmation process times out.
 * @throws {InstructionError} - Throws this error if there is an issue with the transaction's instructions.
 * @throws {TransactionError} - Throws this error for general transaction failures.
 */

export const sendAndConfirmTransaction = async ({
  signedTransaction,
  connection,
  config,
  onTransactionEvent,
}: {
  signedTransaction: Transaction | VersionedTransaction;
  connection: Connection;
  config?: SendTransactionConfig &
    (StaticTimeoutConfig | TransactionExpirationTimeoutConfig | NoTimeoutConfig);
  onTransactionEvent?: TransactionLifecycleEventCallback;
}): Promise<string> => {
  const startTime = getUnixTs();
  const controller = new AbortController();

  const {
    continuouslySendTransactions,
    pollingSendTransactionTimeoutMs,
    sendOptions,
    ...confirmationConfig
  } = config ?? {
    type: 'static',
    timeoutMs: DEFAULT_CONFIRMATION_TIMEOUT,
  };

  const transactionId = await sendSignedTransaction({
    signedTransaction,
    connection,
    config: {
      controller,
      continuouslySendTransactions,
      pollingSendTransactionTimeoutMs,
      sendOptions,
    },
    onTransactionEvent,
  });

  if (confirmationConfig.type === 'none') {
    controller.abort();
    log(
      'Caller requested no confirmation, skipping all confirmation and returning after initial transaction sent to cluster',
    );

    return transactionId;
  }

  try {
    await awaitTransactionSignatureConfirmation({
      connection,
      transactionId,
      config: confirmationConfig,
      onTransactionEvent,
      controller,
      transactionCommitment:
        confirmationConfig?.type === 'expiration'
          ? confirmationConfig?.transactionCommitment
          : undefined,
    });

    log('Finished transaction status confirmation: ', transactionId, getUnixTs() - startTime);
  } catch (error: any) {
    if (error.timeout) {
      throw new ConfirmationTimeoutError({
        transactionId,
        message: 'Timed out awaiting confirmation on transaction',
        config: ConfirmationTimeoutError.formatConfig(confirmationConfig),
      });
    }

    await simulateTransaction({
      transaction: signedTransaction,
      connection,
      onTransactionEvent,
    });

    // question: is there any additional processing we can do to give back more information to the caller?
    throw new TransactionError({
      message: 'Transaction failed',
      transactionId,
    });
  } finally {
    tryInvokeAbort(controller);
  }

  log('Transaction confirmation latency: ', transactionId, getUnixTs() - startTime);

  return transactionId;
};
