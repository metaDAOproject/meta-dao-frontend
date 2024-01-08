import { BN, utils } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { AUTOCRAT_VERSIONS } from '@/lib/constants';
import { InstructionFieldTypes, InstructionSet } from '../types';
import { validateType } from '../utils';

const defaultVersion = AUTOCRAT_VERSIONS[0];
const dao = PublicKey.findProgramAddressSync(
  [utils.bytes.utf8.encode('WWCACOTMICMIBMHAFTTWYGHMB')],
  defaultVersion.programId,
)[0];
const daoTreasury = PublicKey.findProgramAddressSync([dao.toBuffer()], defaultVersion.programId)[0];
export const instructions: InstructionSet = {
  name: 'SPL',
  actions: [
    {
      label: 'Transfer tokens',
      fields: [
        {
          type: InstructionFieldTypes.Key,
          required: true,
          label: 'Recipient',
          description:
            'The wallet that will receive the token (not the token account) from the treasury',
          validate: async (value?: string) => validateType(InstructionFieldTypes.Key, value),
        },
        {
          type: InstructionFieldTypes.Key,
          required: true,
          label: 'Token Mint',
          description: 'The mint of the token to transfer from the treasury',
          validate: async (value?: string) => validateType(InstructionFieldTypes.Key, value),
        },
        {
          type: InstructionFieldTypes.BigNumber,
          required: true,
          label: 'Amount',
          description: 'The amount of tokens to transfer',
          validate: async (value?: string) => validateType(InstructionFieldTypes.BigNumber, value),
        },
      ],
      instruction: async (params: string[]) => {
        const recipient = new PublicKey(params[0]);
        const mint = new PublicKey(params[1]);
        const amount = new BN(params[2]);
        const ix = createTransferInstruction(
          getAssociatedTokenAddressSync(mint, daoTreasury, true),
          getAssociatedTokenAddressSync(mint, recipient, true),
          daoTreasury,
          amount,
        );

        return {
          programId: SystemProgram.programId,
          accounts: ix.keys,
          data: ix.data,
        };
      },
    },
  ],
};
