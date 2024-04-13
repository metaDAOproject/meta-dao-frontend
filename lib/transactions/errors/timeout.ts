import {
  StaticTimeoutConfig,
  TransactionExpirationTimeoutConfig,
} from '../types';

namespace ConfirmationTimeoutError {
  export type ErrorTimeoutConfig =
    | Pick<StaticTimeoutConfig, 'type' | 'timeoutMs'>
    | Pick<
        TransactionExpirationTimeoutConfig,
        'type' | 'transactionCommitment' | 'blockhashValidityPollingTimeoutMs'
      >;
}

export class ConfirmationTimeoutError extends Error {
  transactionId: string;
  message: string;
  config: ConfirmationTimeoutError.ErrorTimeoutConfig;

  constructor({
    transactionId,
    message,
    config,
  }: {
    transactionId: string;
    message: string;
    config: ConfirmationTimeoutError.ErrorTimeoutConfig;
  }) {
    super();
    this.message = message;
    this.transactionId = transactionId;
    this.config = config;
  }

  static formatConfig = (
    config: StaticTimeoutConfig | TransactionExpirationTimeoutConfig
  ) =>
    config.type === 'static'
      ? {
          type: config.type,
          timeoutMs: config.timeoutMs,
        }
      : {
          type: config.type,
          transactionCommitment: config.transactionCommitment,
          blockhashValidityPollingTimeoutMs:
            config.blockhashValidityPollingTimeoutMs,
        };
}
