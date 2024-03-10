import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, PublicKey } from '@solana/web3.js';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

export type Response<T> = {
  data: T | undefined;
  status: 'error' | 'success' | 'pending';
  isLoading: boolean;
};
/**
 * This handler will update the state directly and will also trigger a timeout to check for a websocket event or execute fallback
 */
type directStateUpdate<T> = (data: T, publicKey: PublicKey) => void;

export type SubscriptionAccount<T> = {
  publicKey: PublicKey;
  metaData: T;
};

/**
 * Custom hook to subscribe to an account's changes and manage its data.
 *
 * @param accounts - An array of accounts to subscribe to with any associated metadata
 * @param handler - A function that processes the incoming data from the subscriptions.
 * @param fetch - A fallback function that is called to fetch the data if the websocket update is not received within the timeout.
 * @param globalTimeout - The global timeout setting for the fallback mechanism, defaults to 45000 milliseconds (45 seconds).
 * @returns A tuple containing the current data state and a function to manually set the data state.
 */

type AccountSubscriptionOptions<T, U> = {
  accounts: SubscriptionAccount<U>[];
  handler: (accountInfo: AccountInfo<Buffer>, metaData: U) => T;
  fetch: (publicKey: PublicKey | undefined) => Promise<T | undefined>;
  globalTimeout?: number;
};

export default function useMultiAccountSubscription<T, U>(
  options: AccountSubscriptionOptions<T, U>,
): [Response<T>[], directStateUpdate<T>] {
  const { accounts, handler, fetch, globalTimeout = 45000 } = options;
  const queryClient = useQueryClient();
  const [fallbackTimeouts, setFallbackTimeouts] = useState<
    Record<string, NodeJS.Timeout | undefined>
  >({});
  const [lastEventReceivedTimes, setlastEventReceivedTimes] = useState<Record<string, Date>>({});
  const [subscriptionsConnected, setSubscriptionsConnected] = useState<Record<string, boolean>>({});
  const { connection } = useConnection();

  // Using React Query's useQueries to fetch and cache the initial data
  const results = useQueries({
    queries: accounts.map((a) => ({
      queryKey: ['accountData', a.publicKey?.toString()],
      queryFn: async () => fetch(a.publicKey),
      enabled: !subscriptionsConnected[a.publicKey?.toString()] || !a.publicKey,
    })),
  });

  const responses: Response<T>[] = useMemo(() => {
    return results.map((r) => ({
      data: r.data,
      status: r.status,
      isLoading: r.isLoading,
    }));
  }, [results]);

  useEffect(() => {
    accounts.map((a) => {
      if (a.publicKey) {
        const subscription = connection.onAccountChange(a.publicKey, (accountInfo) => {
          const processedData = handler(accountInfo, a.metaData);

          queryClient.setQueryData(['accountData', a.publicKey.toString()], () => processedData);
          // clear any timeout that was running so we don't refetch
          if (fallbackTimeouts[a.publicKey.toString()]) {
            clearTimeout(fallbackTimeouts[a.publicKey.toString()]);
          }
          setlastEventReceivedTimes((times) => {
            times[a.publicKey.toString()] = new Date();
            return times;
          });
        });

        if (subscription !== 0) {
          //successfully subscribed
          setSubscriptionsConnected((subs) => {
            subs[a.publicKey.toString()] = true;
            return subs;
          });
        }

        //cleanup subscription and timeout
        return () => {
          clearTimeout(fallbackTimeouts[a.publicKey.toString()]);
          if (subscription) {
            connection.removeAccountChangeListener(subscription);
            setSubscriptionsConnected((subs) => {
              subs[a.publicKey.toString()] = false;
              return subs;
            });
          }
        };
      }
    });
  }, [accounts, globalTimeout, JSON.stringify(subscriptionsConnected)]);

  const updateData = (updatedData: T, publicKey: PublicKey) => {
    const publicKeyStr = publicKey.toString();
    queryClient.setQueryData(['accountData', publicKeyStr], () => updatedData);
    // If we haven't received an event in the last 3 seconds, and the values are different, create the fallback timeout
    const threeSecondsAgo = new Date(new Date().getTime() - 3000);
    if (
      !lastEventReceivedTimes[publicKeyStr] ||
      threeSecondsAgo < lastEventReceivedTimes[publicKeyStr]
    ) {
      const timeoutId = setTimeout(async () => {
        // this timeout will run if a websocket event hasn't come through
        queryClient.refetchQueries({ queryKey: ['accountData', publicKeyStr] });
      }, globalTimeout);
      setFallbackTimeouts((timeouts) => {
        timeouts[publicKeyStr] = timeoutId;
        return timeouts;
      });
    }
  };

  return [responses, updateData];
}
