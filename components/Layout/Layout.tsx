'use client';

import {
  AppShell,
  Button,
  Card,
  Flex,
  Group,
  Menu,
  NativeSelect,
  NumberInput,
  Stack,
  Switch,
  TextInput,
  Title,
  rem,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useFavicon, useMediaQuery } from '@mantine/hooks';
import '@mantine/notifications/styles.css';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import numeral from 'numeral';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  IconBooks,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandTwitter,
  IconSun,
  IconMoonStars,
  IconExternalLink,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Networks, useNetworkConfiguration } from '../../hooks/useNetworkConfiguration';
import { shortKey } from '@/lib/utils';
import icon from '@/public/meta.png';
import _favicon from '@/public/favicon.ico';
import { Explorers, useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import classes from '../../app/globals.module.css';
import { usePriorityFee } from '../../hooks/usePriorityFee';
import { NUMERAL_FORMAT } from '../../lib/constants';

const links = [
  {
    name: 'Github',
    href: 'https://github.com/metaDAOproject/meta-dao-frontend',
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

function getTokenPrice(data:any) {
  const price = (Math.round((Number(data.outAmount) / Number(data.inAmount)) * 1000000) / 1000);
  return price;
}

function useTokenPrice() {
  const url = 'https://quote-api.jup.ag/v6/quote?inputMint=METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50&swapMode=ExactIn&onlyDirectRoutes=false&asLegacyTransaction=false&maxAccounts=64&experimentalDexes=Jupiter%20LO';
  const tokenPriceFetcher = () => fetch(url).then(res => res.json()).then(data => getTokenPrice(data));
  const { data, error, isLoading } = useSWR('metaSpotPrice', tokenPriceFetcher);

  return {
      price: data,
      isLoading,
      isError: error,
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const modal = useWalletModal();
  const { network, endpoint, setNetwork, setCustomEndpoint } = useNetworkConfiguration();
  const { explorer, setExplorer } = useExplorerConfiguration();
  const colorScheme = useMantineColorScheme();
  const theme = useMantineTheme();
  const isTiny = useMediaQuery(`(max-width: ${theme.breakpoints.xs})`);
  const logoRef = useRef(null);
  const { priorityFee, setPriorityFee } = usePriorityFee();
  const [solPrice, setSolPrice] = useState<number>();

  useFavicon(_favicon.src);
  useEffect(() => {
    if (!wallet.connected && wallet.wallet) wallet.connect();
  }, [wallet]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        );
        const data = await res.json();

        if (data?.solana?.usd) {
          setSolPrice(data.solana.usd);
        } else {
          setSolPrice(0);
        }
      } catch {
        setSolPrice(0);
      }
    };

    // Call fetchData immediately when component mounts
    fetchData();
  }, []); // Empty dependency array means this effect will only run once
  const tokenPrice = useTokenPrice();

  const feesCost = (((priorityFee / 100000) * 200000) / LAMPORTS_PER_SOL) * (solPrice || 0);

  const ThemeSwitch = () => (
    <Switch
      variant="outline"
      size="md"
      color="red"
      onChange={() => colorScheme.toggleColorScheme()}
      checked={colorScheme.colorScheme === 'light'}
      onLabel={<IconSun style={{ width: rem(16), height: rem(16) }} stroke={2.5} />}
      offLabel={<IconMoonStars style={{ width: rem(16), height: rem(16) }} stroke={2.5} />}
    />
  );

  return (
    <div>
      <AppShell header={{ height: 60 }} padding="md">
        <AppShell.Header withBorder>
          <Flex justify="space-between" align="center" p="md" w="100%" h="100%">
            <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Flex justify="flex-start" align="center" gap="xs">
                <Image src={icon} alt="App logo" width={36} height={36} ref={logoRef} />
                <Title order={!isTiny ? 3 : 4}>the Meta-DAO</Title>
              </Flex>
            </Link>

            <Group gap="0" justify="center" ta="center">

              <div style={{ fontSize: 'small' }}>
            {tokenPrice.isLoading ? 'loading...' : !tokenPrice.isError ? `1 META ≈ $${tokenPrice.price}` : ''}
            <Link
              target="_blank"
              href="https://birdeye.so/token/METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr?chain=solana"
            >
            <IconExternalLink height=".7rem" width="1rem" />
            </Link>
              </div>
            </Group>

            <Group>
              {wallet?.publicKey ? (
                <Menu position="bottom-end">
                  <Menu.Target>
                    <Button variant="secondary">{shortKey(wallet.publicKey)}</Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Stack p="md" align="center">
                      <NativeSelect
                        w="100%"
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
                        w="100%"
                        label="Explorer"
                        data={explorers}
                        value={explorer}
                        onChange={(e) => setExplorer(e.target.value as Explorers)}
                      />
                      <NumberInput
                        w="100%"
                        label="Priority fee (µLamports)"
                        description={`Adds up to $${numeral(feesCost).format(
                          NUMERAL_FORMAT,
                        )} per tx`}
                        onChange={(e) => setPriorityFee(Number(e || 0))}
                        defaultValue={priorityFee}
                        hideControls
                      />
                      {isTiny ? <ThemeSwitch /> : null}
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
              {!isTiny ? <ThemeSwitch /> : null}
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
