import {
  Connection,
  SimulateTransactionConfig,
  SimulatedTransactionResponse,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import { debug, error, log } from '../logger';
import { InstructionError } from './errors';
import { TransactionError } from './errors/transaction';
import { TransactionSimulateEvent } from './events';
import { getTransactionSignature } from './utils';

const toVersionedTransaction = async ({
  connection,
  transaction,
}: {
  connection: Connection;
  transaction: Transaction;
}) => {
  if (!transaction.feePayer) {
    throw new Error('Cannot convert a transaction that is missing fee payer');
  }

  const { blockhash: recentBlockhash } = await connection.getLatestBlockhash({
    commitment: 'confirmed',
  });

  return new VersionedTransaction(
    new TransactionMessage({
      payerKey: transaction.feePayer!,
      recentBlockhash,
      instructions: transaction.instructions,
    }).compileToV0Message(),
  );
};

/**
 * Simulates a transaction on the Solana blockchain.
 *
 * @param transaction - The transaction to simulate.
 * @param connection - The Solana connection object.
 * @param config - The configuration options for the simulation (optional).
 * @param onTransactionEvent - The callback function to handle transaction events (optional).
 *
 * @returns A promise that resolves to the simulated transaction response.
 * @throws {TransactionError} If the simulation result is null.
 * @throws {InstructionError} If the simulation result contains an error.
 */
export const simulateTransaction = async ({
  transaction,
  connection,
  config = {
    commitment: 'confirmed',
  },
  onTransactionEvent,
}: {
  transaction: Transaction | VersionedTransaction;
  connection: Connection;
  config?: SimulateTransactionConfig;
  onTransactionEvent?: (event: TransactionSimulateEvent) => void;
}): Promise<SimulatedTransactionResponse> => {
  const transactionId = getTransactionSignature(transaction);

  debug('Transaction failed, trying to simulate transaction');
  let simulationResult: SimulatedTransactionResponse | null = null;
  try {
    const transactionToSimulate =
      transaction instanceof VersionedTransaction
        ? transaction
        : await toVersionedTransaction({
            connection,
            transaction,
          });

    onTransactionEvent?.({
      type: 'simulate',
      phase: 'pending',
      transactionId,
    });

    simulationResult = (await connection.simulateTransaction(transactionToSimulate, config)).value;

    log(`Transaction ${transactionId} simulation result: `, simulationResult);
    onTransactionEvent?.({
      type: 'simulate',
      phase: 'completed',
      status: 'success',
      transactionId,
      result: simulationResult,
    });
  } catch (err) {
    // note: at the moment, no event callback invoked here
    error(`Simulate transaction ${transactionId} threw an error: `, err);

    throw new TransactionError({
      message: 'Unable to simulate failed transaction',
      transactionId,
    });
  }

  // todo: what are the cases in which this result is null?
  if (!simulationResult) {
    error(`Simulate transaction ${transactionId} result was null`);

    onTransactionEvent?.({
      type: 'simulate',
      phase: 'completed',
      status: 'failed',
      transactionId,
    });

    throw new TransactionError({
      message: 'Unable to simulate failed transaction',
      transactionId,
    });
  } else {
    debug(`Simulate transaction ${transactionId} result: `, simulationResult);

    onTransactionEvent?.({
      type: 'simulate',
      phase: 'completed',
      status: 'success',
      transactionId,
      result: simulationResult,
    });

    if (simulationResult.err) {
      error(
        'Transaction error from simulation: ',
        JSON.stringify(simulationResult.err, undefined, 2),
      );

      // note: mango parses logs if available to surface a transaction message
      // source: https://github.com/blockworks-foundation/mango-client-v3/blob/fb92f9cf8caaf72966e4f4135c9d6ebd14756df4/src/client.ts#L521
      if (!simulationResult.logs) {
        debug(`Simulate transaction ${transactionId} logs: `, simulationResult.logs);
      }

      throw new InstructionError({
        transactionId,
        error: simulationResult.err,
        transaction,
      });
    }
  }

  return simulationResult;
};
