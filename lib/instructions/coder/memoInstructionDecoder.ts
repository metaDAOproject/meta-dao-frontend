import { Idl } from '@coral-xyz/anchor';
import {
  Instruction,
  InstructionDisplay,
} from '@coral-xyz/anchor/dist/cjs/coder/borsh/instruction';
import { AccountMeta } from '@solana/web3.js';
import bs58 from 'bs58';
import { Buffer } from 'buffer';

import { DecodeInstructionCoder } from './types';

export class MemoInstructionDecoder implements DecodeInstructionCoder {
  public constructor(private _idl: Idl) {}

  public decode(
    ix: Buffer | Uint8Array | string,
    encoding: 'hex' | 'base58' = 'hex',
  ): Instruction | null {
    if (typeof ix === 'string') {
      ix = encoding === 'hex' ? Buffer.from(ix, 'hex') : bs58.decode(ix);
    }

    return {
      data: Buffer.from(ix).toString('utf-8'),
      name: 'addMemo',
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public format(ix: Instruction, _accountMetas: AccountMeta[]): InstructionDisplay | null {
    return {
      args: [
        {
          name: ix.name,
          type: 'string',
          data: ix.data as string,
        },
      ],
      accounts: [],
    };
  }
}
