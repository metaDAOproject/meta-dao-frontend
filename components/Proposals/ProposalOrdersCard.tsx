import { ActionIcon, Flex, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useProposal } from '@/contexts/ProposalContext';
import {
  isCompletedOrder,
  isEmptyOrder,
  isOpenOrder,
  totalInOrder,
  totalMetaInOrder,
  totalUsdcInOrder,
} from '@/lib/openbook';
import { OpenOrdersTab } from '@/components/Orders/OpenOrdersTab';
import { UnsettledOrdersTab } from '@/components/Orders/UnsettledOrdersTab';
import { UncrankedOrdersTab } from '@/components/Orders/UncrankedOrdersTab';

export function ProposalOrdersCard() {
  const wallet = useWallet();
  const { fetchOpenOrders, proposal, orders, markets } = useProposal();

  if (!orders || !markets) return <></>;

  return !proposal || !markets || !orders ? (
    <Group justify="center" w="100%" h="100%">
      <Loader />
    </Group>
  ) : (
    <>
      <Group justify="space-between" align="center">
        <Group>
          <Text fw="bolder" size="xl">
            Orders
          </Text>
          <ActionIcon
            variant="subtle"
            // @ts-ignore
            onClick={() => fetchOpenOrders(proposal, wallet.publicKey)}
          >
            <IconRefresh />
          </ActionIcon>
        </Group>
        <Flex justify="flex-end" align="flex-end" direction="row" wrap="wrap">
          <Stack gap={0} align="center" justify="flex-end">
            <Group>
              <Text size="xl" fw="bold">
                ${totalUsdcInOrder(orders)}
              </Text>
              <Text size="md">condUSDC</Text>|
              <Text size="xl" fw="bold">
                {totalMetaInOrder(orders)}
              </Text>
              <Text size="md">condMETA</Text>
            </Group>
            <Text fw="bolder" size="xl">
              (${totalInOrder(orders)}) Total
            </Text>
          </Stack>
        </Flex>
      </Group>
      <Tabs defaultValue="open">
        <Tabs.List>
          <Tabs.Tab value="open">Open</Tabs.Tab>
          <Tabs.Tab value="uncranked">Uncranked</Tabs.Tab>
          <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <OpenOrdersTab orders={orders.filter((order) => isOpenOrder(order, markets))} />
        </Tabs.Panel>
        <Tabs.Panel value="uncranked">
          <UncrankedOrdersTab orders={orders.filter((order) => isCompletedOrder(order, markets))} />
        </Tabs.Panel>
        <Tabs.Panel value="unsettled">
          <UnsettledOrdersTab orders={orders.filter((order) => isEmptyOrder(order))} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
