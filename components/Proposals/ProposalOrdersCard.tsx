import { ActionIcon, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useCallback } from 'react';
import { ProposalOpenOrdersTab } from '@/components/Orders/ProposalOpenOrdersTab';
import { ProposalUncrankedOrdersTab } from '@/components/Orders/ProposalUncrankedOrdersTab';
import { ProposalUnsettledOrdersTab } from '@/components/Orders/ProposalUnsettledOrdersTab';
import { useProposal } from '@/contexts/ProposalContext';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';
import { useOpenbook } from '@/hooks/useOpenbook';
import { totalBaseInOrder, totalUsdcInOrder } from '@/lib/openbook';
import { useAutocrat } from '@/contexts/AutocratContext';

export function ProposalOrdersCard() {
  const { publicKey: owner } = useWallet();
  const { proposal } = useProposal();
  const { daoTokens } = useAutocrat();
  const {
    markets,
    openOrders,
    unsettledOrders,
    uncrankedOrders: unCrankedOrders,
    refreshUserOpenOrders,
    fetchNonOpenOrders,
  } = useProposalMarkets();
  const { program: openbook, client: openBookClient } = useOpenbook();

  if (!openOrders || !markets) return <></>;

  const onRefresh = () => {
    if (proposal && markets) {
      refreshUserOpenOrders(
        openBookClient,
        markets.pass,
        markets.fail,
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
        fetchNonOpenOrders(owner, openbook, proposal, markets);
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
              cond{daoTokens?.quoteToken?.symbol}
            </Text>
            <Text>|</Text>
            <Text size="lg">
              <Text span fw="bold">
                {totalBaseInOrder(openOrders)}
              </Text>{' '}
              cond{daoTokens?.baseToken?.symbol}
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
