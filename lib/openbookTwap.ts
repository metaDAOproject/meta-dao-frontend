import { PublicKey } from '@solana/web3.js';
import { OPENBOOK_TWAP_PROGRAM_ID, QUOTE_LOTS } from './constants';
import { DaoState, TWAPOracle } from './types';

export const calculateTWAP = (twapOracle?: TWAPOracle) => {
  if (!twapOracle) return undefined;

  // only the initial twap record is recorded, use initial value
  if (twapOracle.lastUpdatedSlot.eq(twapOracle.initialSlot)) {
    return parseInt(twapOracle.observationAggregator.toString(), 10) * QUOTE_LOTS;
  }

  const slotsPassed = twapOracle.lastUpdatedSlot.sub(twapOracle.initialSlot);
  const twapValue = twapOracle.observationAggregator.div(slotsPassed);
  return parseInt(twapValue.toString(), 10) * QUOTE_LOTS;
};

export const getLastObservedAndSlot = (twapOracle?: TWAPOracle) => {
  if (!twapOracle) return undefined;

  return {
    lastObservationValue: twapOracle.lastObservation * QUOTE_LOTS,
    lastObservationSlot: twapOracle.lastObservedSlot,
  };
};

export const getTwapMarketKey = (market: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('twap_market'), market.toBuffer()],
    OPENBOOK_TWAP_PROGRAM_ID,
  )[0];

export const getWinningTwap = (
  passTwap: number | undefined,
  failTwap: number | undefined,
  daoState: DaoState | undefined,
): 'pass' | 'fail' | undefined => {
  if (passTwap && failTwap && daoState) {
    const fail = (failTwap * (10000 + daoState.passThresholdBps)) / 10000;
    return passTwap > fail ? 'pass' : 'fail';
  }
};
