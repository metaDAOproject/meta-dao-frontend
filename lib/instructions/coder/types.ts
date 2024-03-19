import { Instruction } from '@coral-xyz/anchor';
import { InstructionDisplay } from '@coral-xyz/anchor/dist/cjs/coder/borsh/instruction';
import { PublicKey } from '@solana/web3.js';

export type DecodeInstructionCoder = {
  decode(ix: Buffer | Uint8Array | string, encoding: 'hex' | 'base58'): Instruction | null;
};

export type DecodedInstruction = { name: string; programId: PublicKey; } & InstructionDisplay;
