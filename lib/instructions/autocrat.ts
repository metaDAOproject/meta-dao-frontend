import { BorshInstructionCoder, utils } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { AUTOCRAT_VERSIONS } from '@/lib/constants';
import { InstructionFieldTypes, InstructionSet } from '../types';

const defaultVersion = AUTOCRAT_VERSIONS[0];
const coder = new BorshInstructionCoder(defaultVersion.idl);
// const program = new Program<AutocratV0>(AUTOCRAT_IDL, AUTOCRAT_PROGRAM_ID);
const dao = PublicKey.findProgramAddressSync(
  [utils.bytes.utf8.encode('WWCACOTMICMIBMHAFTTWYGHMB')],
  defaultVersion.programId,
)[0];
const daoTreasury = PublicKey.findProgramAddressSync([dao.toBuffer()], defaultVersion.programId)[0];
export const instructions: InstructionSet = {
  name: 'Autocrat',
  actions: [
    {
      label: 'Set Pass Threshold',
      fields: [
        {
          type: InstructionFieldTypes.Number,
          label: 'Threshold',
          description:
            'The difference threshold needed between PASS and FAIL market for a proposal to pass, in basis points',
          deserialize: (value: string) => Number(value),
        },
      ],
      instruction: (params: any[]) => ({
        programId: defaultVersion.programId,
        accounts: [
          {
            pubkey: dao,
            isSigner: true,
            isWritable: true,
          },
          {
            pubkey: daoTreasury,
            isSigner: true,
            isWritable: false,
          },
        ],
        data: coder.encode('set_pass_threshold_bps', {
          passThresholdBps: params[0],
        }),
      }),
    },
  ],
};
