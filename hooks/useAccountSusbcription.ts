import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, PublicKey } from '@solana/web3.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

type Data<T> = {
  data: T | undefined;
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
): [Data<T>, directStateUpdate<T>] {
  const { publicKey, handler, fetch, globalTimeout = 45000 } = options;
  const queryClient = useQueryClient();
  const [isFallbackTriggered, setIsFallbackTriggered] = useState(false);
  //   const [data, setData] = useState<Data<T>>({ data: undefined });
  const [fallbackTimeout, setFallbackTimeout] = useState<NodeJS.Timeout | undefined>();
  const { connection } = useConnection();

  // Using React Query's useQuery to fetch and cache the initial data
  const { data, status } = useQuery<Data<T>>({
    queryKey: ['accountData', publicKey],
    queryFn: () => fetch(publicKey),
    onSuccess: (data: T) => {
      // Call the handler with the fetched data
      queryClient.setQueryData(['accountData', publicKey], data);
    },
  });

  useEffect(() => {
    if (publicKey) {
      // Initial fetch of the data
      const fetchData = async () => {
        const initialData = await fetch(publicKey);
        setData({ data: initialData });
      };
      fetchData();

      const subscription = connection.onAccountChange(publicKey, (accountInfo) => {
        const processedData = handler(accountInfo);
        setData({ data: processedData });
        // clear any timeout that was running
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
  }, [publicKey, handler, fetch, globalTimeout]);

  const updateData = (data: T) => {
    setData({ data });
    // Set up a fallback mechanism with timeout
    if (fetch) {
      const timeoutId = setTimeout(async () => {
        const fallbackData = await fetch(publicKey);
        setData({ data: fallbackData });
      }, globalTimeout);
      setFallbackTimeout(timeoutId);
    }
  };

  return [data, updateData];
}
