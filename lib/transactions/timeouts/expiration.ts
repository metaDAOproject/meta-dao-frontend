import { Commitment, Connection } from '@solana/web3.js';

import { DEFAULT_COMMITMENT, DEFAULT_POLLING_TIMEOUT } from '../constants';
import { TransactionExpirationTimeoutConfig } from '../types';
import { abortableSleep } from '../utils';
import { log } from '../../logger';

/**
 * Monitors the validity of a blockhash associated with a transaction, repeatedly polling until the blockhash expires
 * or the process is aborted. If the blockhash is determined to be invalid and the abort signal has not been triggered,
 * the process is aborted and the associated promise is rejected. This function is used to manage transaction expiration
 * in environments where transaction validity is linked to blockhash validity for a set period.
 *
 * See the following link for information on transaction expiry: https://solana.com/docs/core/transactions/confirmation#why-do-transactions-expire
 *
 * @param {Object} params - The parameters for checking blockhash expiration.
 * @param {Connection} params.connection - The connection to use for checking blockhash validity.
 * @param {TransactionExpirationTimeoutConfig} params.config - Configuration for transaction expiration,
 *        including the blockhash to check and the polling timeout in milliseconds.
 * @param {AbortController} params.controller - The AbortController used to manage abortion of the blockhash checking process.
 * @param {(reason?: any) => void} params.reject - The reject function of the Promise to be called if the blockhash is found to be invalid.
 * @param {Commitment} [params.transactionCommitment] - The commitment level to use when checking blockhash validity, which influences
 *        how the network confirms the status of a blockhash.
 */

export const applyTransactionExpiration = async ({
  connection,
  config,
  controller,
  reject,
  transactionCommitment,
}: {
  connection: Connection;
  config: TransactionExpirationTimeoutConfig;
  controller: AbortController;
  reject: (reason?: any) => void;
  transactionCommitment?: Commitment;
}) => {
  const pollingTimeout = config.blockhashValidityPollingTimeoutMs ?? DEFAULT_POLLING_TIMEOUT;
  const commitment = transactionCommitment ?? connection.commitment ?? DEFAULT_COMMITMENT;

  while (!controller.signal.aborted) {
    /* eslint-disable no-await-in-loop */
    const isBlockhashValid = await connection.isBlockhashValid(config.transactionBlockhash, {
      commitment,
    });

    log(
      `blockhash: ${config.transactionBlockhash}, commitment: ${commitment} is valid? `,
      isBlockhashValid,
    );

    if (!isBlockhashValid.value) {
      if (controller.signal.aborted) return;
      controller.abort();

      reject({ timeout: true });
    }

    /* eslint-disable no-await-in-loop */
    await abortableSleep(pollingTimeout, controller);
  }
};
