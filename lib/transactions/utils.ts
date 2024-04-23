import { Transaction, VersionedTransaction } from '@solana/web3.js';
import base58 from 'bs58';

import { log } from '../logger';

export const getUnixTs = () => new Date().getTime() / 1000;

/* eslint-disable no-promise-executor-return */
export const sleep = async (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const sleepWithController = async (ms: number, controller: AbortController) =>
  new Promise<void>((resolve) => {
    if (controller?.signal.aborted) {
      resolve();
    }

    let timeoutId: NodeJS.Timeout;
    const onAbort = () => {
      log(`Received abort, removing abort listener for timeout = ${timeoutId}`);

      clearTimeout(timeoutId);
      controller?.signal.removeEventListener('abort', onAbort);
      resolve();
    };

    if (controller?.signal.aborted) {
      onAbort();
    } else {
      controller?.signal.addEventListener('abort', onAbort);

      timeoutId = setTimeout(() => {
        controller?.signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
    }
  });

export const abortableSleep = async (ms: number, controller?: AbortController) =>
  !controller ? sleep(ms) : sleepWithController(ms, controller);

export const tryInvokeAbort = (controller: AbortController) => {
  if (!controller.signal.aborted) {
    controller.abort();
  }
};

export const getTransactionSignatureOrThrow = (
  transaction: Transaction | VersionedTransaction,
): string => {
  if (transaction.signatures.length === 0) {
    throw new Error('Transaction does not have any signatures');
  }

  const signatureBuffer =
    transaction.signatures[0] instanceof Uint8Array
      ? Buffer.from(transaction.signatures[0])
      : transaction.signatures[0].signature;
  if (!signatureBuffer) throw new Error('Invalid signature');

  return base58.encode(Buffer.from(signatureBuffer));
};

export const getTransactionSignature = (
  transaction: Transaction | VersionedTransaction,
): string | undefined => {
  try {
    return getTransactionSignatureOrThrow(transaction);
  } catch (err: any) {
    return undefined;
  }
};
