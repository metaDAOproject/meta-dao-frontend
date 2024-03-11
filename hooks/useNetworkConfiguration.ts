import { useLocalStorage } from '@mantine/hooks';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo } from 'react';

export enum Networks {
  Mainnet = 'mainnet-beta',
  Mainnet2 = 'mainnet-beta2',
  Devnet = 'devnet',
  Localnet = 'local',
  Custom = 'custom',
}

export function useNetworkConfiguration() {
  const [network, setNetwork] = useLocalStorage<Networks>({
    key: 'meta-dao-network-configuration',
    defaultValue: Networks.Mainnet,
    getInitialValueInEffect: false,
  });

  const [customEndpoint, setCustomEndpoint] = useLocalStorage<string>({
    key: 'futarchy-custom-endpoint',
    defaultValue: 'https://sudden-jocelyn-fast-mainnet.helius-rpc.com/',
    getInitialValueInEffect: true,
  });

  const endpoint = useMemo(() => {
    switch (network) {
      case Networks.Mainnet:
        return 'https://rpc-proxy.themetadao-org.workers.dev/';
      case Networks.Mainnet2:
        return 'https://rpc2-proxy.themetadao-org.workers.dev/';
      case Networks.Devnet:
        return 'https://netty-8ka8l7-fast-devnet.helius-rpc.com/';
      case Networks.Localnet:
        return 'http://127.0.0.1:8899';
      case Networks.Custom:
        return customEndpoint || clusterApiUrl('mainnet-beta');
      default:
        return clusterApiUrl('mainnet-beta');
    }
  }, [network, customEndpoint]);

  return {
    endpoint,
    network,
    setNetwork,
    setCustomEndpoint: (s: string) =>
      setCustomEndpoint((old) =>
        /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi.test(s)
          ? s
          : old,
      ),
  };
}
