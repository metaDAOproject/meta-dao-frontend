import { ActionIcon, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useOpenBookMarket } from '@/contexts/OpenBookMarketContext';
import {
  _isCompletedOrder,
  isEmptyOrder,
  _isOpenOrder,
  totalMetaInOrder,
  totalUsdcInOrder,
} from '@/lib/openbook';
import { OpenBookMarket } from '@/lib/types';
import { OpenOrdersTab } from '@/components/Orders/OpenOrdersTab';
import { UnsettledOrdersTab } from '@/components/Orders/UnsettledOrdersTab';
import { UncrankedOrdersTab } from '@/components/Orders/UncrankedOrdersTab';

export function MarketOrdersCard({
  market,
}: {
  market: OpenBookMarket;
}) {
  const wallet = useWallet();
  const { fetchOpenOrders, orders } = useOpenBookMarket();

  if (!wallet || !orders) return <></>;

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
          <Group justify="space-between" align="flex-start">
            <Text size="lg">
              <Text span fw="bold">
                ${totalUsdcInOrder(orders)}
              </Text>{' '}
              USDC
            </Text>
            <Text>|</Text>
            <Text size="lg">
              <Text span fw="bold">
                {totalMetaInOrder(orders)}
              </Text>{' '}
              META
            </Text>
          </Group>
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
          <Tabs.Tab value="uncranked">Uncranked</Tabs.Tab>
          <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <Text>Yo</Text>
          {/* <OpenOrdersTab orders={orders.filter((order) => _isOpenOrder(order, market))} /> */}
        </Tabs.Panel>
        <Tabs.Panel value="uncranked">
          <Text>Hey</Text>
          {/* <UncrankedOrdersTab orders={orders.filter((order) => _isCompletedOrder(order, market))} /> */}
        </Tabs.Panel>
        <Tabs.Panel value="unsettled">
          <Text>Yes</Text>
          {/* <UnsettledOrdersTab orders={orders.filter((order) => isEmptyOrder(order))} /> */}
        </Tabs.Panel>
      </Tabs>
    :
      <Text>No orders for this market have been located.</Text>
    }
    </>
  );
}
