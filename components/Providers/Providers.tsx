'use client';

import React, { useCallback, useMemo } from 'react';
import { MantineProvider } from '@mantine/core';
import { WalletError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { MoongateWalletAdapter } from '@moongate/moongate-adapter';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { Notifications } from '@mantine/notifications';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { theme } from '@/theme';
import { useNetworkConfiguration } from '@/hooks/useNetworkConfiguration';
import { AutocratProvider } from '@/contexts/AutocratContext';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode; }) {
  const { endpoint } = useNetworkConfiguration();

  const wallets = useMemo(
    () => [
      new MoongateWalletAdapter({ position: 'bottom-right' }),
      new SolflareWalletAdapter(),
      new PhantomWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [],
  );

  const onError = useCallback((error: WalletError) => {
    console.error(error);
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} onError={onError}>
          <WalletModalProvider>
            <QueryClientProvider client={queryClient}>
              <AutocratProvider>{children}</AutocratProvider>
            </QueryClientProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </MantineProvider>
  );
}
