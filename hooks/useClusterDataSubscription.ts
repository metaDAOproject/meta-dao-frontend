import { useQuery } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';

const useClusterDataSubscription = () => {
  const { connection } = useConnection();

  const {
    data: slotData,
    isLoading: isSlotLoading,
    error: slotError,
  } = useQuery({
    queryKey: ['getSlot'],
    queryFn: () => connection?.getSlot(),
    enabled: !!connection,
  });
  const slot = slotData ?? 0;

  const {
    data: clusterTimestamp,
    isLoading: isBlockTimeLoading,
    error: blockTimeLoadingError,
  } = useQuery({
    queryKey: ['latestBlockTime'],
    queryFn: () => connection?.getBlockTime(slot),
    enabled: !!slot && !!connection,
  });
  const {
    data: blockUpdateType,
    isLoading: isBlockUpdateTypeLoading,
    error: blockUpdateTypeError,
  } = useQuery({
    queryKey: ['latestBlockUpdateType'],
    queryFn: () => 'finalized',
    enabled: !!slot && !!connection,
  });

  const isLoading = isSlotLoading || isBlockTimeLoading || isBlockUpdateTypeLoading;
  const error = slotError || blockTimeLoadingError || blockUpdateTypeError;

  return { data: { slot, clusterTimestamp, blockUpdateType }, error, isLoading };
};

export default useClusterDataSubscription;
