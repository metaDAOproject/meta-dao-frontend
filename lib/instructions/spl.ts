import { BN, utils } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token';
import { AUTOCRAT_VERSIONS } from '@/lib/constants';
import { InstructionFieldTypes, InstructionSet } from '../types';

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
        },
        {
          type: InstructionFieldTypes.Key,
          required: true,
          label: 'Token Mint',
          description: 'The mint of the token to transfer from the treasury',
        },
        {
          type: InstructionFieldTypes.Number,
          required: true,
          label: 'Amount',
          description: 'The amount of tokens to transfer',
        },
      ],
      instruction: async (params, options = {}) => {
        if (!options?.connection) throw new Error('Connection not provided');

        const recipient = new PublicKey(params[0]);
        const mint = new PublicKey(params[1]);
        const mintAccount = await getMint(options.connection, mint);
        const amount = new BN(Number(params[2]) * 10 ** mintAccount.decimals);
        const ix = createTransferCheckedInstruction(
          getAssociatedTokenAddressSync(mint, daoTreasury, true),
          mint,
          getAssociatedTokenAddressSync(mint, recipient, true),
          daoTreasury,
          amount,
          mintAccount.decimals,
        );

        return {
          programId: TOKEN_PROGRAM_ID,
          accounts: ix.keys,
          data: ix.data,
        };
      },
    },
  ],
};
