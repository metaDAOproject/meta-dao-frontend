import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Connection } from '@solana/web3.js';
import { useNetworkConfiguration } from './useNetworkConfiguration';

const useInitializeClusterDataSubscription = () => {
  const config = useNetworkConfiguration();
  const queryClient = useQueryClient();
  const [clusterDataConnection, setClusterDataConnection] = useState<Connection>();
  useEffect(() => {
    if (!clusterDataConnection) {
      const newConnection = new Connection(config.endpoint, 'finalized');
      setClusterDataConnection(newConnection);
    }
  }, [!!clusterDataConnection]);

  useEffect(() => {
    if (clusterDataConnection) {
      const subscription = clusterDataConnection.onSlotUpdate(async (slotUpdate) => {
        const { slot, timestamp, type } = slotUpdate;
        queryClient.setQueryData(['getSlot'], (oldSlot: number) => {
          if (oldSlot < slot) {
            return slot;
          }
          return oldSlot;
        });
        queryClient.setQueryData(['latestBlockTime'], (oldTimestamp: number) => {
          if (oldTimestamp < timestamp) {
            return timestamp;
          }
          return oldTimestamp;
        });
        queryClient.setQueryData(['latestBlockUpdateType'], () => type);
      });

      return () => {
        clusterDataConnection.removeSlotUpdateListener(subscription);
      };
    }
  }, [!!clusterDataConnection]);
};

export default useInitializeClusterDataSubscription;
