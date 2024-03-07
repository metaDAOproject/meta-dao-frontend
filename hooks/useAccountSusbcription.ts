import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, PublicKey } from '@solana/web3.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

type Response<T> = {
  data: T | undefined;
  status: 'error' | 'success' | 'pending';
};
/**
 * This handler will update the state directly and will also trigger a timeout to check for a websocket event or execute fallback
 */
type directStateUpdate<T> = (data: T) => void;

/**
 * Custom hook to subscribe to an account's changes and manage its data.
 *
 * @param publicKey - The PublicKey of the account to subscribe to.
 * @param handler - A function that processes the incoming data from the subscription.
 * @param fetch - A fallback function that is called to fetch the data if the websocket update is not received within the timeout.
 * @param globalTimeout - The global timeout setting for the fallback mechanism, defaults to 45000 milliseconds (45 seconds).
 * @returns A tuple containing the current data state and a function to manually set the data state.
 */

type AccountSubscriptionOptions<T> = {
  publicKey: PublicKey | undefined;
  handler: (accountInfo: AccountInfo<Buffer>) => T;
  fetch: (publicKey: PublicKey | undefined) => Promise<T | undefined>;
  globalTimeout?: number;
};

export default function useAccountSubscription<T>(
  options: AccountSubscriptionOptions<T>,
): [Response<T>, directStateUpdate<T>] {
  const { publicKey, handler, fetch, globalTimeout = 45000 } = options;
  const queryClient = useQueryClient();
  const [fallbackTimeout, setFallbackTimeout] = useState<NodeJS.Timeout | undefined>();
  const { connection } = useConnection();

  // Using React Query's useQuery to fetch and cache the initial data
  const { data, status } = useQuery<T | undefined>({
    queryKey: ['accountData', publicKey],
    queryFn: async () => fetch(publicKey),
  });

  useEffect(() => {
    if (publicKey) {
      const subscription = connection.onAccountChange(publicKey, (accountInfo) => {
        const processedData = handler(accountInfo);
        //TODO check for difference before setting query data
        queryClient.setQueryData(['accountData', publicKey], () => processedData);
        // clear any timeout that was running so we don't refetch
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
        }
      });

      //cleanup subscription and timeout
      return () => {
        clearTimeout(fallbackTimeout);
        if (subscription) {
          connection.removeAccountChangeListener(subscription);
        }
      };
    }
  }, [publicKey, handler, fetch, globalTimeout, data]);

  const updateData = (updatedData: T) => {
    queryClient.setQueryData(['accountData', publicKey], () => updatedData);
    // Set up a fallback mechanism with timeout
    const timeoutId = setTimeout(async () => {
      // this timeout will run if a websocket event hasn't come through
      queryClient.refetchQueries({ queryKey: ['accountData', publicKey] });
    }, globalTimeout);
    setFallbackTimeout(timeoutId);
  };

  return [{ data, status }, updateData];
}
