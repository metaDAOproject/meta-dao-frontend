import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { AutocratProgram, ProgramVersion, TokensDict } from './types';

export const OPENBOOK_PROGRAM_ID = new PublicKey('opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb');
export const OPENBOOK_TWAP_PROGRAM_IDV0_1 = new PublicKey('TWAPrdhADy2aTKN5iFZtNnkQYXERD9NvKjPFVPMSCNN');
export const OPENBOOK_TWAP_PROGRAM_IDV0_2 = new PublicKey('twAP5sArq2vDS1mZCT7f4qRLwzTfHvf5Ay5R5Q5df1m');

export const NUMERAL_FORMAT = '0,0.00'; // TODO: Need to dynamically format these
export const BASE_FORMAT = '0,0.000'; // TODO: Need to dynamically format these
export const MAX_FORMAT = '0,0.00';
export const SLOTS_PER_10_SECS: number = 25;
export const TEN_DAYS_IN_SLOTS: number = 10 * 24 * 60 * 6 * SLOTS_PER_10_SECS;
export const QUOTE_LOTS = 0.0001;
export const BN_0 = new BN(0);

const AUTOCRAT_V0_IDL: AutocratProgram = require('@/lib/idl/autocrat_v0.json');
const AUTOCRAT_V0_1_IDL: AutocratProgram = require('@/lib/idl/autocrat_v0.1.json');
const AUTOCRAT_V0_2_IDL: AutocratProgram = require('@/lib/idl/autocrat_v0.2.json');
const AUTOCRAT_V0_3_IDL: AutocratProgram = require('@/lib/idl/autocrat_v0.3.json');

// TODO: Need to stub in DaoStateWithKey
export const DAOS: any[] = [
  {
    publicKey: new PublicKey('8tanoHEyJEQgaasEkv1DxN6umYNWDotbaEpuzstcEufb'),
    name: 'MetaDAO',
    icon: 'metaToken.png',
  },
  {
    publicKey: new PublicKey('8tanoHEyJEQgaasEkv1DxN6umYNWDotbaEpuzstcEufb'),
    name: 'FutureDAO',
    icon: 'futureToken.png',
  },
];

export const AUTOCRAT_VERSIONS: ProgramVersion[] = [
  {
    label: 'V0.3',
    programId: new PublicKey('FuTPR6ScKMPHtZFwacq9qrtf9VjscawNEFTb2wSYr1gY'),
    idl: AUTOCRAT_V0_3_IDL,
  },
  {
    label: 'V0.2',
    programId: new PublicKey('metaRK9dUBnrAdZN6uUDKvxBVKW5pyCbPVmLtUZwtBp'),
    idl: AUTOCRAT_V0_2_IDL,
  },
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
export const staticTokens = {
  wsol: {
    name: 'Solana',
    symbol: 'SOL',
    icon: '',
    publicKey: new PublicKey('So11111111111111111111111111111111111111112'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
};

export const mainnetTokens: TokensDict = {
  meta: {
    name: 'Meta',
    symbol: 'META',
    icon: '',
    publicKey: new PublicKey('METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  usdc: {
    name: 'USD Coin',
    symbol: 'USDC',
    icon: '',
    publicKey: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    decimals: 6,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  future: {
    name: 'Future',
    symbol: 'FUTURE',
    icon: '',
    publicKey: new PublicKey('FUTURETnhzFApq2TiZiNbWLQDXMx4nWNpFtmvTf11pMy'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
};

export const devnetTokens: TokensDict = {
  meta: {
    name: 'Meta',
    symbol: 'META',
    icon: '',
    publicKey: new PublicKey('METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  usdc: {
    name: 'USD Coin',
    symbol: 'USDC',
    icon: '',
    publicKey: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    decimals: 6,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  musdc: {
    name: 'Meta USD Coin',
    symbol: 'mUSDC',
    icon: '',
    publicKey: new PublicKey('B9CZDrwg7d34MiPiWoUSmddriCtQB5eB2h9EUSDHt48b'),
    decimals: 6,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  future: {
    name: 'Future',
    symbol: 'FUTURE',
    icon: '',
    publicKey: new PublicKey('DUMm13RrZZoJAaqr1Tz7hv44xUcrYWXADw7SEBGAvbcK'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
};
