import {
  Blockhash,
  Commitment,
  SendOptions,
  TransactionConfirmationStatus,
} from '@solana/web3.js';

export type SendTransactionConfig = {
  /**
   * Controller used to decide when to stop sending transactions iff `continuouslySendTransactions` is defined
   * and has a boolean value of true
   */
  controller?: AbortController;
  /**
   * Whether or not the transaction should continuously be sent to the cluster
   * before returning.
   */
  continuouslySendTransactions?: boolean;
  /**
   * If continuously sending transactions to the cluster status is used, what is the
   * amount of time between calls, in milliseconds. Ignored if 'continuouslySendTransactions'
   * is false.
   */
  pollingSendTransactionTimeoutMs?: number;
  /**
   * Options passed to the `sendRawTransaction` function from the Connection class in @solana/webe.js
   */
  sendOptions?: SendOptions;
};

export type BaseConfig = {
  /**
   * Commitment level used when first setting up a websocket connection
   * to listen for the status of a transaction.
   */
  initialConfirmationCommitment?: Commitment;
  /**
   * The confirmation status values that should be verified before returning.
   */
  requiredConfirmationLevels?: TransactionConfirmationStatus[];
  /**
   * If polling for transaction status is used, what is the amount of time between
   * calls, in milliseconds.
   */
  pollingConfirmationTimeoutMs?: number;
  /**
   * Commitment level used when creating the transaction. If not defined,
   * the fallback values will be:
   *
   * 1. the Connection instance's commitment level,
   * 2. the defined `DEFAULT_COMMITMENT` constant
   */
  transactionCommitment?: Commitment;
};

export type StaticTimeoutConfig = BaseConfig & {
  type: 'static';
  /**
   * Duration to wait when confirming a transaction before timing out, in milliseconds.
   */
  timeoutMs: number;
};

export type TransactionExpirationTimeoutConfig = BaseConfig & {
  type: 'expiration';
  transactionBlockhash: Blockhash;
  /**
   * What is the amount of time between calls when checking if the transaction blockhash
   * is still valid, in milliseconds.
   */
  blockhashValidityPollingTimeoutMs?: number;
};

export type NoTimeoutConfig = BaseConfig & {
  type: 'none';
};
