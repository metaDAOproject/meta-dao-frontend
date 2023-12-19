import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Container,
  Divider,
  Flex,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Title,
  em,
  useMantineColorScheme,
} from '@mantine/core';
import Markdown from 'react-markdown';
import { useConnection } from '@solana/wallet-adapter-react';
import { IconChevronLeft } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { ProposalOrdersCard } from './ProposalOrdersCard';
import { ConditionalMarketCard } from '../Markets/ConditionalMarketCard';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useAutocrat } from '@/contexts/AutocratContext';
import { shortKey } from '@/lib/utils';
import { StateBadge } from './StateBadge';
import { SLOTS_PER_10_SECS, TEN_DAYS_IN_SLOTS } from '../../lib/constants';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { useConditionalVault } from '../../hooks/useConditionalVault';
import { useProposal } from '@/contexts/ProposalContext';
import { MarketCard } from './MarketCard';
import ExternalLink from '../ExternalLink';
import MarketsBalances from './MarketsBalances';
import classes from '../../app/globals.module.css';

export function ProposalDetailCard() {
  const { connection } = useConnection();
  const { fetchProposals, daoState } = useAutocrat();
  const { redeemTokensTransactions } = useConditionalVault();
  const { proposal, markets, finalizeProposalTransactions } = useProposal();
  const sender = useTransactionSender();
  const { colorScheme } = useMantineColorScheme();

  const { generateExplorerLink } = useExplorerConfiguration();
  const [lastSlot, setLastSlot] = useState<number>();
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const isMobile = useMediaQuery(`(max-width: ${em(1546)})`);

  const remainingSlots = useMemo(() => {
    if (!proposal || !daoState || !lastSlot) return;

    // v0 doesn't have slots per proposal, so if it's v0 we say it's already done
    if (!daoState.slotsPerProposal) {
      return 0;
    }

    const endSlot = proposal.account.slotEnqueued.toNumber() + daoState.slotsPerProposal.toNumber();

    return Math.max(endSlot - lastSlot, 0);
  }, [proposal, lastSlot, daoState]);

  useEffect(() => {
    setSecondsLeft(((remainingSlots || 0) / SLOTS_PER_10_SECS) * 10);
  }, [remainingSlots]);

  useEffect(() => {
    const interval = setInterval(
      () => (secondsLeft && secondsLeft > 0 ? setSecondsLeft((old) => old - 1) : 0),
      1000,
    );

    return () => clearInterval(interval);
  });


  const timeLeft = useMemo(() => {
    if (!secondsLeft) return;
    const seconds = secondsLeft;
    const days = Math.floor(seconds / (60 * 60 * 24));
    const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secLeft = Math.floor(seconds % 60);

    return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(
      minutes,
    ).padStart(2, '0')}:${String(secLeft).padStart(2, '0')}`;
  }, [secondsLeft]);

  const handleFinalize = useCallback(async () => {
    setIsFinalizing(true);
    const txs = await finalizeProposalTransactions();
    if (!txs) return;
    try {
      await sender.send(txs);
      await fetchProposals();
    } finally {
      setIsFinalizing(false);
    }
  }, [sender, finalizeProposalTransactions, fetchProposals]);

  const handleRedeem = useCallback(async () => {
    if (!markets || !proposal) return;
    setIsRedeeming(true);
    const baseTxs = await redeemTokensTransactions({
      publicKey: proposal.account.baseVault,
      account: markets.baseVault,
    });
    const quoteTxs = await redeemTokensTransactions({
      publicKey: proposal.account.quoteVault,
      account: markets.quoteVault,
    });
    if (!baseTxs || !quoteTxs) {
      throw new Error('Failed creating redeem txs, some accounts are missing values');
    }
    const txs = baseTxs.concat(quoteTxs);
    try {
      await sender.send(txs);
    } finally {
      setIsRedeeming(false);
    }
  }, [sender, redeemTokensTransactions, fetchProposals]);

  useEffect(() => {
    if (lastSlot) return;
    async function fetchSlot() {
      setLastSlot(await connection.getSlot());
    }

    fetchSlot();
  }, [connection, lastSlot]);

  return !proposal || !markets ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <Flex
      direction={isMobile ? 'column' : 'row'}
      align="start"
      justify="start"
      gap={isMobile ? 'xl' : 'md'}
    >
      <Button
        pos="fixed"
        top="76px"
        className={classes.colorschemebutton}
        leftSection={<IconChevronLeft />}
        href="/proposals"
        component="a"
        style={{ textDecoration: 'none', width: 'fit-content', zIndex: '40' }}
      >
        Back to Proposals
      </Button>
      <Stack
        pos={isMobile ? 'relative' : 'sticky'}
        top={isMobile ? '10px' : '96px'}
        justify="space-between"
        p="md"
        w={isMobile ? '100%' : '530'}
      >
        <Stack py="lg">
          <Group justify="space-between" align="start">
            <Title fw={500} w={380} order={3}>
              {proposal.title}
            </Title>
            <StateBadge proposal={proposal} />
          </Group>
          {secondsLeft !== 0 && <Text fw="bold">Ends in {timeLeft}</Text>}
          <Card bg={colorScheme === 'dark' ? 'dark' : '#f9f9f9'} w="fit-content">
            <Stack justify="end" align="end" w="fit-content">
              {proposal.description && (
                <ScrollArea.Autosize mah={isMobile ? '340px' : '240px'} mx="auto">
                  <Markdown className="markdown">{proposal.description}</Markdown>
                </ScrollArea.Autosize>
              )}
              <ExternalLink href={proposal.account.descriptionUrl} />
            </Stack>
          </Card>
          <Text opacity={0.6} style={{ textAlign: 'right' }}>
            Proposed by{' '}
            <a
              href={generateExplorerLink(proposal.account.proposer.toString(), 'account')}
              target="blank"
            >
              {shortKey(proposal.account.proposer)}
            </a>
          </Text>
        </Stack>
        <MarketsBalances />
        {proposal.account.state.pending && (
          <Button
            disabled={(remainingSlots || 0) > 0}
            loading={isFinalizing}
            onClick={handleFinalize}
          >
            Finalize
          </Button>
        )}
        {proposal.account.state.passed && (
          <Button color="green" loading={isRedeeming} onClick={handleRedeem}>
            Redeem
          </Button>
        )}
      </Stack>
      <Divider orientation={isMobile ? 'horizontal' : 'vertical'} />
      <Container>
        <Stack style={{ flex: 1 }}>
          <Tabs defaultValue="order-book">
            <Tabs.List>
              <Tabs.Tab value="order-book">Order Book</Tabs.Tab>
              <Tabs.Tab value="bet">Bet</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="order-book">
              {markets ? (
                <Group gap="md" justify="space-around" p="sm" pt="xl">
                  <ConditionalMarketCard isPassMarket />
                  <ConditionalMarketCard />
                </Group>
              ) : null}
            </Tabs.Panel>
            <Tabs.Panel value="bet">
              <MarketCard />
            </Tabs.Panel>
          </Tabs>
          <ProposalOrdersCard />
        </Stack>
      </Container>
    </Flex>
  );
}
