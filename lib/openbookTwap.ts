import { PublicKey } from '@solana/web3.js';
import { OPENBOOK_TWAP_PROGRAM_ID, QUOTE_LOTS } from './constants';
import { TWAPOracle } from './types';

export const calculateTWAP = (twapOracle?: TWAPOracle) => {
  if (!twapOracle) return;
  const slotsPassed = twapOracle.lastUpdatedSlot.sub(twapOracle.initialSlot);
  if (!slotsPassed.toNumber()) return;
  const twapValue = twapOracle.observationAggregator.div(slotsPassed);
  return twapValue.toNumber() * QUOTE_LOTS;
};

export const getTwapMarketKey = (market: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('twap_market'), market.toBuffer()],
    OPENBOOK_TWAP_PROGRAM_ID,
  )[0];
