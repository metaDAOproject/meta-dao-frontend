import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { AutocratProgram, ProgramVersion } from './types';

export const OPENBOOK_PROGRAM_ID = new PublicKey('opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb');
export const OPENBOOK_TWAP_PROGRAM_ID = new PublicKey(
  'TWAPrdhADy2aTKN5iFZtNnkQYXERD9NvKjPFVPMSCNN',
);

export const NUMERAL_FORMAT = '0,0.00';
export const BASE_FORMAT = '0,0';
export const SLOTS_PER_10_SECS: number = 25;
export const TEN_DAYS_IN_SLOTS: number = 10 * 24 * 60 * 6 * SLOTS_PER_10_SECS;
export const QUOTE_LOTS = 0.0001;
export const BN_0 = new BN(0);
export const MAX_REFETCH_RATE = 2000; // ms

const AUTOCRAT_V0_IDL: AutocratProgram = require('@/lib/idl/autocrat_v0.json');
const AUTOCRAT_V0_1_IDL: AutocratProgram = require('@/lib/idl/autocrat_v0.1.json');

export const AUTOCRAT_VERSIONS: ProgramVersion[] = [
  {
    label: 'V0.1',
    programId: new PublicKey('metaX99LHn3A7Gr7VAcCfXhpfocvpMpqQ3eyp3PGUUq'),
    idl: AUTOCRAT_V0_1_IDL,
  },
  {
    label: 'V0',
    programId: new PublicKey('meta3cxKzFBmWYgCVozmvCQAS3y9b3fGxrG9HkHL7Wi'),
    idl: AUTOCRAT_V0_IDL,
  },
];
