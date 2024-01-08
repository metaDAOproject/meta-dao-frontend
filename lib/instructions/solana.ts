import { utils } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
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
  name: 'Solana',
  actions: [
    {
      label: 'Transfer lamports',
      fields: [
        {
          type: InstructionFieldTypes.Key,
          required: true,
          label: 'Recipient',
          description: 'The wallet that will receive the token',
          validate: async (value?: string) => validateType(InstructionFieldTypes.Key, value),
        },
        {
          type: InstructionFieldTypes.BigNumber,
          required: true,
          label: 'Amount',
          description: 'The amount of SOL to transfer',
          validate: async (value?: string) => validateType(InstructionFieldTypes.BigNumber, value),
        },
      ],
      instruction: async (params: any[]) => {
        const ix = SystemProgram.transfer({
          fromPubkey: daoTreasury,
          toPubkey: params[0],
          lamports: params[1],
        });

        return {
          programId: SystemProgram.programId,
          accounts: ix.keys,
          data: ix.data,
        };
      },
    },
  ],
};
