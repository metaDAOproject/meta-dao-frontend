import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, PublicKey } from '@solana/web3.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { SubscriptionAccount } from './useMultiAccountSubscription';

export type Response<T> = {
  data: T | undefined;
  status: 'error' | 'success' | 'pending';
  isLoading: boolean;
};
/**
 * This handler will update the state directly and will also trigger a timeout to check for a websocket event or execute fallback
 */
type directStateUpdate<T> = (data: T) => void;
type accountSubscriptionHandler<T, U> =
  | ((accountInfo: AccountInfo<Buffer>, metaData?: U) => T)
  | ((accountInfo: AccountInfo<Buffer>, metaData?: U) => Promise<T>);

/**
 * Custom hook to subscribe to an account's changes and manage its data.
 *
 * @param publicKey - The PublicKey of the account to subscribe to.
 * @param handler - A function that processes the incoming data from the subscription.
 * @param fetch - A fallback function that is called to fetch the data if the websocket update is not received within the timeout.
 * @param globalTimeout - The global timeout setting for the fallback mechanism, defaults to 45000 milliseconds (45 seconds).
 * @returns A tuple containing the current data state and a function to manually set the data state.
 */

type AccountSubscriptionOptions<T, U> = {
  account: SubscriptionAccount<U> | undefined;
  handler: accountSubscriptionHandler<T, U>;
  fetch: (publicKey?: PublicKey | undefined) => Promise<T | undefined>;
  globalTimeout?: number;
};

export default function useAccountSubscription<T, U>(
  options: AccountSubscriptionOptions<T, U>,
): [Response<T>, directStateUpdate<T>] {
  const { account, handler, fetch, globalTimeout = 45000 } = options;
  const publicKey = account?.publicKey;
  const metaData = account?.metaData;
  const queryClient = useQueryClient();
  const [fallbackTimeout, setFallbackTimeout] = useState<NodeJS.Timeout | undefined>();
  const [lastEventReceivedTime, setlastEventReceivedTime] = useState<Date | undefined>();
  const [subscriptionConnected, setSubscriptionConnected] = useState(false);
  const { connection } = useConnection();

  // Using React Query's useQuery to fetch and cache the initial data
  // increase the stale time on this perhaps
  const { data, status, isLoading } = useQuery<T | undefined>({
    queryKey: ['accountData', publicKey?.toString()],
    queryFn: async () => fetch(publicKey),
    enabled: !subscriptionConnected || !publicKey,
  });

  useEffect(() => {
    if (publicKey) {
      const subscription = connection.onAccountChange(publicKey, async (accountInfo) => {
        const processedData = handler(accountInfo, metaData);
        let result: T;
        if (processedData instanceof Promise) {
          result = await processedData;
        } else {
          result = processedData;
        }

        //TODO check for difference before setting query data
        queryClient.setQueryData(['accountData', publicKey?.toString()], () => result);
        // clear any timeout that was running so we don't refetch
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
        }
        setlastEventReceivedTime(new Date());
      });

      if (subscription !== 0) {
        //successfully subscribed
        setSubscriptionConnected(true);
      }

      //cleanup subscription and timeout
      return () => {
        clearTimeout(fallbackTimeout);
        if (subscription) {
          connection.removeAccountChangeListener(subscription);
          setSubscriptionConnected(false);
        }
      };
    }
  }, [publicKey?.toString(), globalTimeout, subscriptionConnected]);

  const updateData = (updatedData: T) => {
    queryClient.setQueryData(['accountData', publicKey?.toString()], () => updatedData);
    // If we haven't received an event in the last 3 seconds, and the values are different, create the fallback timeout
    const threeSecondsAgo = new Date(new Date().getTime() - 3000);
    if (!lastEventReceivedTime || threeSecondsAgo < lastEventReceivedTime) {
      const timeoutId = setTimeout(async () => {
        // this timeout will run if a websocket event hasn't come through
        queryClient.refetchQueries({ queryKey: ['accountData', publicKey?.toString()] });
      }, globalTimeout);
      setFallbackTimeout(timeoutId);
    }
  };

  return [{ data, status, isLoading }, updateData];
}
