import { ActionIcon, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useProposal } from '@/contexts/ProposalContext';
import {
  isCompletedOrder,
  isEmptyOrder,
  isOpenOrder,
  totalMetaInOrder,
  totalUsdcInOrder,
} from '@/lib/openbook';
import { ProposalOpenOrdersTab } from '@/components/Orders/ProposalOpenOrdersTab';
import { ProposalUnsettledOrdersTab } from '@/components/Orders/ProposalUnsettledOrdersTab';
import { ProposalUncrankedOrdersTab } from '@/components/Orders/ProposalUncrankedOrdersTab';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';

export function ProposalOrdersCard() {
  const wallet = useWallet();
  const { proposal } = useProposal();
  const { fetchOpenOrders, markets, orders } = useProposalMarkets();

  if (!orders || !markets) return <></>;
  const openOrders = orders.filter((order) => isOpenOrder(order, markets));
  const unCrankedOrders = orders.filter((order) => isCompletedOrder(order, markets));
  const unsettledOrders = orders.filter((order) => isEmptyOrder(order));

  return !proposal || !markets || !orders ? (
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
              condUSDC
            </Text>
            <Text>|</Text>
            <Text size="lg">
              <Text span fw="bold">
                {totalMetaInOrder(orders)}
              </Text>{' '}
              condMETA
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
      <Tabs defaultValue="open">
        <Tabs.List>
          <Tabs.Tab value="open">Open</Tabs.Tab>
          <Tabs.Tab value="uncranked">Uncranked</Tabs.Tab>
          <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <ProposalOpenOrdersTab orders={openOrders} />
        </Tabs.Panel>
        <Tabs.Panel value="uncranked">
          <ProposalUncrankedOrdersTab
            orders={unCrankedOrders}
          />
        </Tabs.Panel>
        <Tabs.Panel value="unsettled">
          <ProposalUnsettledOrdersTab orders={unsettledOrders} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
