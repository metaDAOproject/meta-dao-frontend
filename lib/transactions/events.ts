import {
  SimulatedTransactionResponse,
  TransactionConfirmationStatus,
  TransactionError,
  TransactionSignature,
} from '@solana/web3.js';

export type EventPhase = 'pending' | 'active' | 'completed';

export interface TransactionSimulateEvent {
  type: 'simulate';
  status?: 'success' | 'failed';
  err?: any;
  phase: EventPhase;
  transactionId?: TransactionSignature;
  result?: SimulatedTransactionResponse;
}

export interface TransactionSentEvent {
  type: 'send';
  phase: EventPhase;
  transactionId?: TransactionSignature;
}

export interface TransactionConfirmedEvent {
  type: 'confirm';
  phase: EventPhase;
  status?: TransactionConfirmationStatus;
  err?: TransactionError;
  transactionId: TransactionSignature;
}

export interface TransactionTimeoutEvent {
  type: 'timeout';
  phase: EventPhase;
  transactionId: TransactionSignature;
  durationMs: number;
}

export type TransactionLifecycleEventCallback = (
  event:
    | TransactionSentEvent
    | TransactionConfirmedEvent
    | TransactionTimeoutEvent
    | TransactionSimulateEvent
) => void;
