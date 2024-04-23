import {
  Commitment,
  Connection,
  TransactionConfirmationStatus,
  TransactionSignature,
} from '@solana/web3.js';

import { debug } from '../logger';
import { DEFAULT_COMMITMENT, DEFAULT_POLLING_TIMEOUT } from './constants';
import { TransactionLifecycleEventCallback } from './events';
import { applyTransactionExpiration } from './timeouts/expiration';
import { applyStaticTimeout } from './timeouts/static';
import { NoTimeoutConfig, StaticTimeoutConfig, TransactionExpirationTimeoutConfig } from './types';
import { abortableSleep, tryInvokeAbort } from './utils';

const TRANSACTION_CONFIRMATION_VALUES = ['processed', 'confirmed', 'finalized'] as const;

const cleanupSubscription = async (connection: Connection, subscriptionId?: number) => {
  if (subscriptionId) {
    connection.removeSignatureListener(subscriptionId).catch((err) => {
      debug(
        `[Web Socket] error in invoking removeSignatureListener for subscription ${subscriptionId}`,
        err,
      );
    });
  }
};

// enum to help define ordering of transaction confirmation statuses
enum TransactionConfirmationStatusEnum {
  processed = 1,
  confirmed,
  finalized,
}

const areConfirmationLevelsSatisfied = (
  requiredStatuses: TransactionConfirmationStatus[],
  currentStatus?: TransactionConfirmationStatus,
): boolean => {
  if (!currentStatus) return false;
  const currentStatusValue = TransactionConfirmationStatusEnum[currentStatus];
  const requiredStatusOrders = requiredStatuses.map((s) => TransactionConfirmationStatusEnum[s]);

  return currentStatusValue >= Math.max(...requiredStatusOrders);
};

/**
 * Monitors and confirms a transaction signature's status based on specified configurations. The function leverages both
 * WebSocket and REST polling strategies to verify the transaction status against a set of required confirmation levels.
 * Waits for the confirmation of a transaction signature. It handles different configurations for timeouts and allows for
 * the process to be aborted externally. Transaction events are emitted throughout the process for each phase: pending,
 * active, or completed. The function has 3 steps to it:
 *
 * 1. Start an async timeout process in case confirmation takes an arbitrarily long time. We
 *    want to be able to pull the escape hatch and stop all related processes if exceed the
 *    specified timeout configuration.
 * 2. Setup a websocket connection to listen for a events for a signature given a specific
 *    commitment level.
 * 3. If the caller requested additional commitment levels beyond what was specified in the
 *    websocket subscription, we will poll for signature status until we satisfy the additional
 *    commitment levels.
 *
 * As an example, consider the case where a user wants to timeout confirmation after 30 seconds
 * and wants to use the subscription to wait for an initial 'confirmed' commitment status
 * but wants to keep polling until it reaches the 'finalized' status. We will first start the
 * 30 second timer and then setup the subscription to listen for the transaction signature and
 * provide the 'confirmed' commitment level. Assuming that we get a response that the signature
 * is successful, we will then start polling for signature status because confirmed < finalized
 * w.r.t. commitment levels. If we can get a finalized status within 30s from starting the function,
 * we will return successfully. If not, we will return a rejected promise, indicating there was a timeout.
 *
 * @param {Object} params - The parameters needed for transaction signature confirmation.
 * @param {Connection} params.connection - The blockchain connection used for sending requests and subscribing to events.
 * @param {string} params.transactionId - The transaction signature to be confirmed.
 * @param {StaticTimeoutConfig | TransactionExpirationTimeoutConfig | NoTimeoutConfig} [params.config] - The configuration
 *        defining the confirmation process behavior, including timeouts and required confirmation levels.
 * @param {TransactionLifecycleEventCallback} [params.onTransactionEvent] - Callback function to handle transaction lifecycle events.
 * @param {AbortController} [params.controller] - An optional AbortController to manage cancellation of the confirmation process.
 * @param {Commitment} [params.transactionCommitment] - The commitment level at which the transaction needs to be confirmed.
 *
 * @returns {Promise<Object>} - A promise that resolves with the transaction status or rejects with an error if the transaction fails
 *          to meet the confirmation criteria or if an error occurs during the confirmation process.
 *
 * @throws {Error} - Throws an error if the WebSocket or REST polling encounters an exception that is not handled by the configured
 *                   error management strategy.
 */
export const awaitTransactionSignatureConfirmation = async ({
  connection,
  transactionId,
  config,
  onTransactionEvent,
  controller: _controller,
  transactionCommitment,
}: {
  connection: Connection;
  transactionId: TransactionSignature;
  config?: StaticTimeoutConfig | TransactionExpirationTimeoutConfig | NoTimeoutConfig;
  onTransactionEvent?: TransactionLifecycleEventCallback;
  controller?: AbortController;
  transactionCommitment?: Commitment;
}) => {
  const controller = _controller ?? new AbortController();

  const subscriptionConfirmationCommitment =
    config?.initialConfirmationCommitment ?? connection.commitment ?? DEFAULT_COMMITMENT;
  const requiredConfirmationLevels = config?.requiredConfirmationLevels ?? ['confirmed'];

  onTransactionEvent?.({
    type: 'confirm',
    phase: 'pending',
    transactionId,
  });

  /* eslint-disable no-async-promise-executor */
  const signatureConfirmationResult = await new Promise(async (resolve, reject) => {
    // [Step 1] kick off timeout processes if specified
    if (config?.type === 'static') {
      applyStaticTimeout(config, controller, reject);
    } else if (config?.type === 'expiration') {
      applyTransactionExpiration({
        connection,
        config,
        controller,
        reject,
        transactionCommitment,
      });
    }

    // [Step 2] setup websocket connection to verify signature with intitial commitment
    await new Promise(async (innerResolve) => {
      let subscriptionId: number | undefined;
      try {
        debug('[WebSocket] Setting up onSignature subscription...');
        subscriptionId = connection.onSignature(
          transactionId,
          async (result) => {
            debug('[WebSocket] result confirmed: ', transactionId, result);

            cleanupSubscription(connection, subscriptionId);
            if (result.err) {
              onTransactionEvent?.({
                type: 'confirm',
                phase: 'completed',
                transactionId,
                err: result.err,
                status: subscriptionConfirmationCommitment as TransactionConfirmationStatus,
              });

              tryInvokeAbort(controller);
              /* eslint-disable prefer-promise-reject-errors */
              reject({
                err: result.err,
              });
            } else {
              const isValidConfirmationValue = TRANSACTION_CONFIRMATION_VALUES.includes(
                subscriptionConfirmationCommitment as Extract<
                  Commitment,
                  TransactionConfirmationStatus
                >,
              );

              // resolve promise if valid transaction confirmation value OR all target commitments are satisfied.
              // else, continue polling for transaction status below.
              if (
                !isValidConfirmationValue ||
                (isValidConfirmationValue &&
                  areConfirmationLevelsSatisfied(
                    requiredConfirmationLevels,
                    subscriptionConfirmationCommitment as TransactionConfirmationStatus,
                  ))
              ) {
                onTransactionEvent?.({
                  type: 'confirm',
                  phase: 'completed',
                  transactionId,
                  status: subscriptionConfirmationCommitment as TransactionConfirmationStatus,
                });

                tryInvokeAbort(controller);
                resolve(result);
              } else {
                onTransactionEvent?.({
                  type: 'confirm',
                  phase: 'pending',
                  transactionId,
                  status: subscriptionConfirmationCommitment as TransactionConfirmationStatus,
                });

                innerResolve(result);
              }
            }
          },
          subscriptionConfirmationCommitment,
        );

        debug('[WebSocket] Setup connection for transaction ', transactionId);
        controller.signal.addEventListener('abort', () => {
          cleanupSubscription(connection, subscriptionId);
        });
      } catch (err: any) {
        // note: at the moment, no event callback invoked here

        cleanupSubscription(connection, subscriptionId);
        tryInvokeAbort(controller);
        debug('[WebSocket] error: ', transactionId, err);
      }
    });

    // [Step 3] start polling signature status if caller requested additional commitment levels
    // beyond the commitment specified in the above websocket subscription
    const pollingTimeout = config?.pollingConfirmationTimeoutMs ?? DEFAULT_POLLING_TIMEOUT;
    while (!controller.signal.aborted) {
      try {
        /* eslint-disable no-await-in-loop */
        const signatureStatuses = await connection.getSignatureStatuses([transactionId]);
        debug('[REST] Signature status result: ', signatureStatuses);

        const result = signatureStatuses && signatureStatuses.value[0];
        if (!controller.signal.aborted) {
          if (!result) {
            debug('[REST] result is null: ', transactionId, result);
          } else if (result.err) {
            debug('[REST] result has error: ', transactionId, result);

            onTransactionEvent?.({
              type: 'confirm',
              phase: 'completed',
              transactionId,
              err: result.err,
              status: result.confirmationStatus,
            });

            tryInvokeAbort(controller);

            /* eslint-disable prefer-promise-reject-errors */
            reject({
              err: result.err,
            });
          } else if (!(result.confirmations || result.confirmationStatus)) {
            debug(
              '[REST] result "confirmations" or "confirmationStatus" is null: ',
              transactionId,
              requiredConfirmationLevels,
              result,
            );
          } else if (
            !areConfirmationLevelsSatisfied(requiredConfirmationLevels, result.confirmationStatus)
          ) {
            debug('[REST] result confirmed with commitment: ', transactionId, result);

            onTransactionEvent?.({
              type: 'confirm',
              phase: 'active',
              transactionId,
              status: result.confirmationStatus,
            });
          } else {
            debug('[REST] result confirmed: ', transactionId, result);

            onTransactionEvent?.({
              type: 'confirm',
              phase: 'completed',
              transactionId,
              status: result.confirmationStatus,
            });

            tryInvokeAbort(controller);
            resolve(result);
          }
        }
      } catch (e) {
        // note: at the moment, no event callback invoked here
        if (!controller.signal.aborted) {
          debug('[REST] connection error: ', transactionId, e);
        }

        tryInvokeAbort(controller);
      }

      /* eslint-disable no-await-in-loop */
      await abortableSleep(pollingTimeout, controller);
    }
  });

  return signatureConfirmationResult;
};
