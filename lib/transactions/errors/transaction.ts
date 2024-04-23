export class TransactionError extends Error {
  message: string;
  transactionId?: string;

  constructor({
    transactionId,
    message,
  }: {
    transactionId?: string;
    message: string;
  }) {
    super();
    this.message = message;
    this.transactionId = transactionId;
  }
}
