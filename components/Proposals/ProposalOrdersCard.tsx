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
import { useOpenbook } from '@/hooks/useOpenbook';
import { useCallback } from 'react';

export function ProposalOrdersCard() {
  const { publicKey: owner } = useWallet();
  const { proposal } = useProposal();
  const {
    markets,
    openOrders,
    unsettledOrders,
    uncrankedOrders: unCrankedOrders,
    refreshUserOpenOrders,
    fetchNonOpenOrders,
  } = useProposalMarkets();
  const { program: openBookClient } = useOpenbook();

  if (!openOrders || !markets) return <></>;

  const onRefresh = () => {
    if (proposal && markets) {
      refreshUserOpenOrders(
        openBookClient,
        proposal,
        markets.passBids,
        markets.passAsks,
        markets.failBids,
        markets.failAsks,
      );
    }
  };

  const onTabChange = useCallback(
    (event: string | null) => {
      if ((event === 'unsettled' || event === 'uncranked') && owner) {
        fetchNonOpenOrders(owner, openBookClient.program, proposal, markets);
      }
    },
    [!!owner],
  );

  return !proposal || !markets || !openOrders ? (
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
                ${totalUsdcInOrder(openOrders)}
              </Text>{' '}
              condUSDC
            </Text>
            <Text>|</Text>
            <Text size="lg">
              <Text span fw="bold">
                {totalMetaInOrder(openOrders)}
              </Text>{' '}
              condMETA
            </Text>
          </Group>
          <ActionIcon
            variant="subtle"
            // @ts-ignore
            onClick={onRefresh}
          >
            <IconRefresh />
          </ActionIcon>
        </Group>
        <Stack justify="start" align="start" />
      </Stack>
      <Tabs onChange={onTabChange} defaultValue="open">
        <Tabs.List>
          <Tabs.Tab value="open">Open</Tabs.Tab>
          <Tabs.Tab value="uncranked">Uncranked</Tabs.Tab>
          <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <ProposalOpenOrdersTab orders={openOrders} />
        </Tabs.Panel>
        <Tabs.Panel value="uncranked">
          <ProposalUncrankedOrdersTab orders={unCrankedOrders ?? []} />
        </Tabs.Panel>
        <Tabs.Panel value="unsettled">
          <ProposalUnsettledOrdersTab orders={unsettledOrders ?? []} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
