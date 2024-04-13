import {
  AccountMeta,
  Transaction,
  TransactionError,
  TransactionInstruction,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';

export class InstructionError extends Error {
  transactionId?: string;
  message: string;
  error: TransactionError;
  instruction: TransactionInstruction;

  constructor({
    transactionId,
    transaction,
    error,
    message,
  }: {
    transactionId?: string;
    transaction: Transaction | VersionedTransaction;
    error: TransactionError;
    message?: string;
  }) {
    super();
    this.transactionId = transactionId;
    this.error = error;

    const [ixKey, errorName] = (error as any).InstructionError;
    this.instruction =
      transaction instanceof Transaction
        ? transaction.instructions[ixKey]
        : this.toTransactionInstruction(transaction.message, ixKey);

    const displayableErrorName =
      typeof errorName === 'string' ? errorName : JSON.stringify(errorName);
    this.message =
      message ??
      `Transaction failed with error ${displayableErrorName} at instruction at index = ${ixKey}`;
  }

  private toTransactionInstruction = (
    message: VersionedMessage,
    idx: number,
  ): TransactionInstruction => {
    const instruction = message.compiledInstructions[idx];
    const accountKeys = message.getAccountKeys();
    return new TransactionInstruction({
      keys: instruction.accountKeyIndexes.map(
        (i) =>
          ({
            pubkey: accountKeys.staticAccountKeys[i],
            isSigner: message.isAccountSigner(i),
            isWritable: message.isAccountWritable(i),
          } as AccountMeta),
      ),
      programId: accountKeys.staticAccountKeys[instruction.programIdIndex],
      data: Buffer.from(instruction.data),
    });
  };
}
