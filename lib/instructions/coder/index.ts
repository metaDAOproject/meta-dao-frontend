import { BorshCoder, Idl, Program, Provider } from '@coral-xyz/anchor';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

import { IDL as SPL_MEMO_IDL } from '../../idl/spl/memo';
import { IDL as SPL_TOKEN_IDL } from '../../idl/spl/token';
import { MemoInstructionDecoder } from './memoInstructionDecoder';
import { NativeInstructionDecoder } from './nativeInstructionDecoder';
import { DecodedInstruction } from './types';

export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
export const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const SPL_MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export class InstructionDecoder {
  private ix: TransactionInstruction;
  private provider?: Provider;

  private IDL_FOR_PROGRAM_ID = {
    [SPL_TOKEN_PROGRAM_ID]: SPL_TOKEN_IDL,
    [SPL_MEMO_PROGRAM_ID]: SPL_MEMO_IDL,
    /**
     * we currently don't have any instructions using this, but the native program instructions are incompatible with
     * the BorshInstructionCoder, so we leaving here to uncomment when needed.
     *
     * we need to import the IDL as well:
     * ```
     * import { IDL as NATIVE_PROGRAM_IDL } from '../../idl/native';
     * ```
     */
    // [SYSTEM_PROGRAM_ID]: NATIVE_PROGRAM_IDL,
  };

  constructor(ix: TransactionInstruction, provider?: Provider) {
    this.ix = ix;
    this.provider = provider;
  }

  getIdlFor = async (programId: PublicKey, provider?: Provider): Promise<any | undefined> => {
    const pubkeyStr = programId.toBase58();

    // if we don't have a locally stored version of the IDL, try to fetch what is stored on-chain
    if (!(pubkeyStr in this.IDL_FOR_PROGRAM_ID)) {
      return Program.fetchIdl(programId, provider);
    }

    return this.IDL_FOR_PROGRAM_ID[pubkeyStr as keyof typeof this.IDL_FOR_PROGRAM_ID];
  };

  decodeInstruction = async (provider?: Provider): Promise<DecodedInstruction | undefined> => {
    const idl = await this.getIdlFor(this.ix.programId, provider ?? this.provider);
    if (!idl) return undefined;

    return this.decode(idl, this.ix);
  };

  private getInstructionDecoderForProgramId = (programId: PublicKey, idl: Idl) => {
    switch (programId.toBase58()) {
      case SYSTEM_PROGRAM_ID:
      case SPL_TOKEN_PROGRAM_ID:
        return new NativeInstructionDecoder(idl);
      case SPL_MEMO_PROGRAM_ID:
        return new MemoInstructionDecoder(idl);
      default:
        return new BorshCoder(idl).instruction;
    }
  };

  private decode = (idl: Idl, ix: TransactionInstruction): DecodedInstruction | undefined => {
    const decoder = this.getInstructionDecoderForProgramId(ix.programId, idl);

    const ixDataBuffer = Buffer.from(ix.data);
    const hexData = ixDataBuffer.toString('hex');
    const decodedIx = decoder.decode(hexData, 'hex');
    // console.debug('decodedIx: ', decodedIx);

    if (decodedIx) {
      const instructionDisplay = decoder.format(decodedIx, ix.keys);
      if (instructionDisplay) {
        return { name: decodedIx.name, programId: ix.programId, ...instructionDisplay };
      }
    }

    return undefined;
  };
}
