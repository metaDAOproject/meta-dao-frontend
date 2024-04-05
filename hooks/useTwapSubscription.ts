import { AccountInfo, PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { calculateTWAP, getLastObservedAndSlot } from '@/lib/openbookTwap';

import { Markets } from '@/lib/types';
import useAccountSubscription from './useAccountSubscription';
import { useProposal } from '@/contexts/ProposalContext';
import useClusterDataSubscription from './useClusterDataSubscription';
import { useOpenbookTwap } from './useOpenbookTwap';

// these have the same structure but assigning them both to TwapStructure type for understanding
export type TwapStructure = Markets['passTwap'] | Markets['failTwap'];
export type TwapSubscriptionRes = {
  twapLoading?: boolean;
  twap: number | undefined;
  aggregateObservation: number;
  lastObservationValue: number | undefined;
  lastObservedSlot: number;
  midPrice: number | undefined;
  totalImpact: number;
  observableTwap: number;
};

const useTwapSubscription = (
  twapMarket: PublicKey | undefined,
  midPrice: number | undefined,
): TwapSubscriptionRes => {
  const openbookTwap = useOpenbookTwap();
  const { connection } = useConnection();
  const { proposal } = useProposal();
  const {
    data: { slot },
  } = useClusterDataSubscription();
  const getObservableTwap = (midPrice: number, lastObservationValue: number) => {
    if (midPrice > lastObservationValue) {
      const max_observation = (lastObservationValue * (10_000 + 100)) / 10_000 + 1;
      const evaluated = Math.min(midPrice, max_observation);
      return evaluated;
    }
    const min_observation = (lastObservationValue * (10_000 + 100)) / 10_000;
    const evaluated = Math.max(midPrice, min_observation);
    return evaluated;
  };

  const getTotalImpact = (
    aggregateObservation: number,
    lastObservationValue: number,
    midPrice: number,
    slot: number,
  ): number => {
    const twapObserved = getObservableTwap(midPrice, lastObservationValue);
    if (twapObserved) {
      const _slotDiffObserved = twapObserved * (slot - lastObservedSlot);
      const newAggregate = aggregateObservation + _slotDiffObserved;
      const startSlot = proposal?.account.slotEnqueued.toNumber();
      const proposalTimeInSlots: number = lastObservedSlot - startSlot;
      const oldValue = aggregateObservation / proposalTimeInSlots;
      const newValue = newAggregate / proposalTimeInSlots;
      return (newValue - oldValue) / oldValue;
    }
    return 0;
  };
  const fetchTwap = async () => {
    if (openbookTwap && twapMarket) {
      const accountInfos = await connection.getAccountInfo(twapMarket);
      const twap: TwapStructure = await openbookTwap.coder.accounts.decodeUnchecked(
        'TWAPMarket',
        accountInfos!.data,
      );
      return twap;
    }
  };
  const twapSubscriptionCallback = async (
    accountInfo: AccountInfo<Buffer>,
    _: any,
  ): Promise<TwapStructure> => openbookTwap!.coder.accounts.decodeUnchecked('TWAPMarket', accountInfo.data);

  const twapSubAccount = twapMarket ? { publicKey: twapMarket, metaData: {} } : undefined;
  const [{ data: twapData, isLoading: twapLoading }, _set] = useAccountSubscription<
    TwapStructure,
    any
  >({
    account: twapSubAccount,
    fetch: () => fetchTwap(),
    handler: twapSubscriptionCallback,
  });

  const twap = calculateTWAP(twapData?.twapOracle);
  const aggregateObservation =
    Number.parseInt(twapData?.twapOracle.observationAggregator.toString()) ?? 0;
  const lastObservedAndSlot = getLastObservedAndSlot(twapData?.twapOracle);
  const lastObservedSlot = lastObservedAndSlot?.lastObservationSlot?.toNumber();
  const lastObservationValue = lastObservedAndSlot?.lastObservationValue;

  return {
    twapLoading,
    twap,
    aggregateObservation,
    lastObservationValue,
    lastObservedSlot,
    totalImpact: getTotalImpact(
      aggregateObservation,
      lastObservationValue ?? 0,
      midPrice ?? 0,
      slot,
    ),
    midPrice,
    observableTwap: getObservableTwap(midPrice ?? 0, lastObservationValue ?? 0),
  };
};

export default useTwapSubscription;
