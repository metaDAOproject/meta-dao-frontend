import { ActionIcon, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useOpenbookMarket } from '@/contexts/OpenbookMarketContext';
import {
  isEmptyOrder,
  _isOpenOrder,
} from '@/lib/openbook';
import { OpenbookMarket } from '@/lib/types';
import { OpenOrdersTab } from '../Orders/OpenOrdersTab';
import { UnsettledOrdersTab } from '@/components/Orders/UnsettledOrdersTab';

export function MarketOrdersCard({
  market,
}: {
  market: OpenbookMarket;
}) {
  const wallet = useWallet();
  const { fetchOpenOrders, orders } = useOpenbookMarket();

  if (!wallet || !orders) return <></>;
  const openOrders = useMemo(
    () => orders.filter((order) => _isOpenOrder(order, market)), [orders.length]
  );
  const unsettledOrders = useMemo(
    () => orders.filter((order) => isEmptyOrder(order)), [orders.length]
  );

  return !wallet || !orders ? (
    <Group justify="center" w="100%" h="100%">
      <Loader />
    </Group>
  ) : (
    <>
      <Stack gap={2}>
        <Group justify="space-between" align="flex-start">
          <Text fw="bolder" size="xl">
            Orders
          </Text>
          <ActionIcon
            variant="subtle"
            // @ts-ignore
            onClick={() => fetchOpenOrders(wallet.publicKey)}
          >
            <IconRefresh />
          </ActionIcon>
        </Group>
        <Stack justify="start" align="start" />
      </Stack>
      {orders.length > 0 ?
      <Tabs defaultValue="open">
        <Tabs.List>
          <Tabs.Tab value="open">Open</Tabs.Tab>
          <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <OpenOrdersTab orders={openOrders} />
        </Tabs.Panel>
        <Tabs.Panel value="unsettled">
          <UnsettledOrdersTab orders={unsettledOrders} />
        </Tabs.Panel>
      </Tabs>
    :
      <Text>No orders for this market have been located.</Text>
    }
    </>
  );
}
