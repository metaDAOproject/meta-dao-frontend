import '@dialectlabs/react-ui/index.css';

import {
  ConfigProps,
  DialectNoBlockchainSdk,
  DialectThemeProvider,
  DialectUiManagementProvider,
  NotificationsButton,
} from '@dialectlabs/react-ui';
import {
  DialectSolanaSdk,
  DialectSolanaWalletAdapter,
  SolanaConfigProps,
} from '@dialectlabs/react-sdk-blockchain-solana';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import React, { FC, useEffect, useMemo, useState } from 'react';

// (4) Set DAPP_ADDRESS variable to the public key generated in previous section
const DAPP_ADDRESS = 'Pingp1guDfoB3YESh5uwTN6eRgfC8GMe9LWArovhxRc';

const solanaWalletToDialectWallet = (
  wallet: WalletContextState
): DialectSolanaWalletAdapter | null => {
  if (
    !wallet.connected ||
    wallet.connecting ||
    wallet.disconnecting ||
    !wallet.publicKey
  ) {
    return null;
  }

  return {
    publicKey: wallet.publicKey!,
    signMessage: wallet.signMessage,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    diffieHellman: wallet.wallet?.adapter?._wallet?.diffieHellman
      ? async (pubKey: any) =>
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
           wallet.wallet?.adapter?._wallet?.diffieHellman(pubKey)

      : undefined,
  };
};

const SdkProvider: FC<React.PropsWithChildren> = (props) => {
  const solanaWallet = useWallet();
  const [dialectSolanaWalletAdapter, setDialectSolanaWalletAdapter] =
    useState<DialectSolanaWalletAdapter | null>(null);

  // Basic Dialect-related configuration
  const dialectConfig: ConfigProps = useMemo(
    () => ({
      // general environment to target
      environment: 'production',
      dialectCloud: {
        // how to store/cache authorization token to make API calls
        tokenStore: 'local-storage',
      },
    }),
    []
  );

  // Solana-specific configuration
  const solanaConfig: SolanaConfigProps = useMemo(
    () => ({
      wallet: dialectSolanaWalletAdapter,
    }),
    [dialectSolanaWalletAdapter]
  );

  useEffect(() => {
    // solanaWalletToDialectWallet is a function that needs to be implemented by you.
    // See "Converting your wallet for Dialect" section below.
    setDialectSolanaWalletAdapter(solanaWalletToDialectWallet(solanaWallet));
  }, [solanaWallet]);

  // If our wallet has been initialized, then switch to Solana SDK provider
  if (dialectSolanaWalletAdapter) {
    return (
      <DialectSolanaSdk config={dialectConfig} solanaConfig={solanaConfig}>
        {props.children}
      </DialectSolanaSdk>
    );
  }

  return <DialectNoBlockchainSdk>{props.children}</DialectNoBlockchainSdk>;
};

const DialectProviders: FC<React.PropsWithChildren> = ({ children }) => (
  <SdkProvider>
    {/* 'dark' | 'light' */}
    <DialectThemeProvider
      theme="dark"
    >
      <DialectUiManagementProvider>{children}</DialectUiManagementProvider>
    </DialectThemeProvider>
  </SdkProvider>
);

export const DialectNotificationComponent = () => (
    // (2) Kick-start some components to hold Dialect-related providers.
    <DialectProviders>
      {/* (3) Add notifications button */}
      <NotificationsButton
        dialectId="dialect-notifications"
        dappAddress={DAPP_ADDRESS}
      />
    </DialectProviders>
  );

export default DialectNotificationComponent;
