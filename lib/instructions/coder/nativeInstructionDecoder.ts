import { Idl, Instruction } from '@coral-xyz/anchor';
import { IdlCoder } from '@coral-xyz/anchor/dist/cjs/coder/borsh/idl';
import { IdlField, IdlStateMethod } from '@coral-xyz/anchor/dist/cjs/idl';
import * as borsh from '@coral-xyz/borsh';
import { AccountMeta } from '@solana/web3.js';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { InstructionDisplay } from '@coral-xyz/anchor/dist/cjs/coder/borsh/instruction';
import { Layout } from 'buffer-layout';
import camelCase from 'camelcase';

import { InstructionFormatter } from '../formatter';
import { DecodeInstructionCoder } from './types';

/**
 * this is a stripped down version of the BorshInstructionCoder (1). All we care about for incompatible (aka non-anchor) programs
 * are the instruction decoders. we used the native-to-anchor library (2) to generate IDLs for these programs and use those IDLs to
 * instantiate instances of these decoders.
 *
 * for the most part, they work the same way. the main difference is that BorshInstructionCoder looks at the discriminator to derive the
 * instruction from instruction data. Here, we rely on the leading enum.
 *
 * note: there are some existing coder's for SPL programs in the @coral-xyz/anchor repo (3), but the instruction coders only contain an
 * encode function, whereas we explicitly need the decode function. Until support is added elsewhere, it seems like we will need to
 * run custom decoding code.
 *
 * 1. https://github.com/coral-xyz/anchor/blob/d931b31c0a52cc11148434f2c99c10b3129543a4/ts/packages/anchor/src/coder/borsh/instruction.ts#L24
 * 2. https://github.com/acheroncrypto/native-to-anchor
 * 3. https://github.com/coral-xyz/anchor/tree/d931b31c0a52cc11148434f2c99c10b3129543a4/ts/packages
 */
export class NativeInstructionDecoder implements DecodeInstructionCoder {
  private ixLayout: Map<string, Layout>;
  private sighashLayouts: Map<string, { layout: Layout; name: string }>;

  private isValidIxName = (name: string) => this.ixLayout.has(name);

  private formatIxName = (name: string) => {
    if (this.isValidIxName(name)) return name;

    const lowerCamelCase = name.slice(0, 1).toLowerCase() + name.slice(1);
    if (this.isValidIxName(lowerCamelCase)) {
      return lowerCamelCase;
    }

    return undefined;
  };

  public constructor(private idl: Idl) {
    this.ixLayout = NativeInstructionDecoder.parseIxLayout(idl);

    const sighashLayouts = new Map();
    if (idl.instructions) {
      idl.instructions.forEach((ix, idx) => {
        const ixName = this.formatIxName(ix.name);
        if (!ixName) return;

        sighashLayouts.set(bs58.encode([idx]), {
          layout: this.ixLayout.get(ixName) as Layout,
          name: ix.name,
        });
      });
    }

    this.sighashLayouts = sighashLayouts;
  }

  // given an instruction layout, derive the layout that can be used to decode each respective field
  private static parseIxLayout(idl: Idl): Map<string, Layout> {
    const stateMethods = idl.instructions ? idl.instructions : [];

    const ixLayouts = stateMethods.map((m: IdlStateMethod): [string, Layout<unknown>] => {
      const fieldLayouts = m.args.map((arg: IdlField) =>
        IdlCoder.fieldLayout(arg, Array.from([...(idl.accounts ?? []), ...(idl.types ?? [])])),
      );
      const name = camelCase(m.name);
      return [name, borsh.struct(fieldLayouts, name)];
    });

    return new Map(ixLayouts);
  }

  public decode(ix: Buffer | string, encoding: 'hex' | 'base58' = 'hex'): Instruction | null {
    if (typeof ix === 'string') {
      ix = encoding === 'hex' ? Buffer.from(ix, 'hex') : Buffer.from(bs58.decode(ix));
    }

    const idlHasMultipleInstructions = this.sighashLayouts.size > 1;
    const ixEnum = idlHasMultipleInstructions ? ix.subarray(0, 1) : [0];
    const decoder = this.sighashLayouts.get(bs58.encode(ixEnum));

    if (!decoder) return null;
    return {
      data: decoder.layout.decode(idlHasMultipleInstructions ? ix.subarray(1) : ix),
      name: decoder.name,
    };
  }

  /**
   * Returns a formatted table of all the fields in the given instruction data.
   */
  public format(ix: Instruction, accountMetas: AccountMeta[]): InstructionDisplay | null {
    return InstructionFormatter.format(ix, accountMetas, this.idl);
  }
}
