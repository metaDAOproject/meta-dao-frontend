import { Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Handle errors thrown specifically on the Transaction::serialize method.
 * Errors are either Invalid, Missing, or General verification failure
 *
 * source: https://github.com/solana-labs/solana-web3.js/blob/7265594ce8ac9480dea2b0f5fe84b24fdacf115b/packages/library-legacy/src/transaction/legacy.ts#L797-L833
 */
export class SignatureError extends Error {
  message: string;
  rawTransaction: Buffer | Uint8Array;

  constructor({
    transaction,
    message,
  }: {
    transaction: Transaction | VersionedTransaction;
    message: string;
  }) {
    super();

    this.message = message;
    this.rawTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
  }
}
