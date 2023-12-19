'use client';

import {
  AppShell,
  Button,
  Card,
  Flex,
  Group,
  Menu,
  NativeSelect,
  Stack,
  Switch,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useFavicon } from '@mantine/hooks';
import '@mantine/notifications/styles.css';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  IconBooks,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandTwitter,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef } from 'react';
import { Networks, useNetworkConfiguration } from '../../hooks/useNetworkConfiguration';
import { shortKey } from '@/lib/utils';
import icon from '@/public/meta.png';
import _favicon from '@/public/favicon.ico';
import { Explorers, useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import classes from '../../app/globals.module.css';

const links = [
  {
    name: 'Github',
    href: 'https://github.com/Dodecahedr0x/meta-dao-frontend',
    icon: IconBrandGithub,
  },
  { name: 'Docs', href: 'https://docs.themetadao.org/', icon: IconBooks },
  { name: 'Discord', href: 'https://discord.gg/metadao', icon: IconBrandDiscord },
  { name: 'Twitter', href: 'https://twitter.com/MetaDAOProject', icon: IconBrandTwitter },
];

const networks = [
  { label: 'Mainnet', value: Networks.Mainnet.toString() },
  { label: 'Devnet', value: Networks.Devnet.toString() },
  { label: 'Localnet', value: Networks.Localnet.toString() },
  { label: 'Custom', value: Networks.Custom.toString() },
];

const explorers = [
  { label: 'Solana.fm', value: Explorers.SolanaFM.toString() },
  { label: 'Solscan', value: Explorers.Solscan.toString() },
  { label: 'X-Ray', value: Explorers.Xray.toString() },
  { label: 'Solana Explorer', value: Explorers.Solana.toString() },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const modal = useWalletModal();
  const { network, endpoint, setNetwork, setCustomEndpoint } = useNetworkConfiguration();
  const { explorer, setExplorer } = useExplorerConfiguration();
  const colorScheme = useMantineColorScheme();
  const logoRef = useRef(null);

  useFavicon(_favicon.src);
  useEffect(() => {
    if (!wallet.connected && wallet.wallet) wallet.connect();
  }, [wallet]);

  return (
    <div>
      <AppShell header={{ height: 60 }} padding="md">
        <AppShell.Header withBorder>
          <Flex justify="space-between" align="center" p="md" w="100%" h="100%">
            <Link href="/proposals" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Flex justify="flex-start" align="center" gap="xs">
                <Image src={icon} alt="App logo" width={36} height={36} ref={logoRef} />
                <Title order={3}>the Meta-DAO</Title>
              </Flex>
            </Link>
            <Group>
              {wallet?.publicKey ? (
                <Menu position="bottom-end">
                  <Menu.Target>
                    <Button variant="secondary">{shortKey(wallet.publicKey)}</Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Stack p="md">
                      <NativeSelect
                        label="Network"
                        data={networks}
                        value={network}
                        onChange={(e) => setNetwork(e.target.value as Networks)}
                      />
                      {network === Networks.Custom ? (
                        <TextInput
                          label="RPC URL"
                          placeholder="Your custom RPC URL"
                          onChange={(e) => setCustomEndpoint(e.target.value)}
                          defaultValue={endpoint}
                        />
                      ) : null}
                      <NativeSelect
                        label="Explorer"
                        data={explorers}
                        value={explorer}
                        onChange={(e) => setExplorer(e.target.value as Explorers)}
                      />
                      <Button fullWidth onClick={() => wallet.disconnect()}>
                        Disconnect
                      </Button>
                    </Stack>
                  </Menu.Dropdown>
                </Menu>
              ) : (
                <Button
                  variant="light"
                  onClick={() => modal.setVisible(true)}
                  loading={modal.visible || wallet.connecting}
                >
                  Connect wallet
                </Button>
              )}
              <Switch
                variant="outline"
                size="md"
                color="red"
                onChange={() => colorScheme.toggleColorScheme()}
                checked={colorScheme.colorScheme === 'light'}
              />
            </Group>
          </Flex>
        </AppShell.Header>
        <AppShell.Main>{children}</AppShell.Main>
      </AppShell>
      <footer>
        <Card withBorder style={{ borderRadius: '0px', borderLeft: '0px', borderRight: '0px' }}>
          <Group justify="space-between" p="md">
            <Title order={4}>the Meta-DAO</Title>
            <Group justify="center" p="xs">
              {links.map((link, i) => (
                <Link
                  key={`link-${i}`}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit' }}
                >
                  <link.icon strokeWidth={1.3} className={classes.redHover} />
                </Link>
              ))}
            </Group>
          </Group>
        </Card>
      </footer>
    </div>
  );
}
