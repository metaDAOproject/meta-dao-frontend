import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Button,
  Card,
  Code,
  Container,
  Divider,
  Flex,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Select,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { IconChevronLeft } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useQueryClient } from '@tanstack/react-query';
import { ProposalOrdersCard } from './ProposalOrdersCard';
import { ConditionalMarketCard } from '../Markets/ConditionalMarketCard';
import { JupSwapCard } from './JupSwapCard';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useAutocrat } from '@/contexts/AutocratContext';
import { shortKey } from '@/lib/utils';
import { StateBadge } from './StateBadge';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { useConditionalVault } from '../../hooks/useConditionalVault';
import { useProposal } from '@/contexts/ProposalContext';
import ExternalLink from '../ExternalLink';
import MarketsBalances from './MarketsBalances';
import classes from '../../app/globals.module.css';
import { useTokens } from '../../hooks/useTokens';
import { isClosableOrder, isEmptyOrder, isOpenOrder, isPartiallyFilled } from '../../lib/openbook';
import { useOpenbookTwap } from '../../hooks/useOpenbookTwap';
import { Proposal } from '../../lib/types';
import { ProposalCountdown } from './ProposalCountdown';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';

export function ProposalDetailCard() {
  const queryClient = useQueryClient();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { fetchProposals, daoTreasury, daoState } = useAutocrat();
  const { redeemTokensTransactions } = useConditionalVault();
  const { tokens } = useTokens();
  const { proposal, finalizeProposalTransactions } =
    useProposal();
  const { orders,
    fetchOpenOrders,
    markets,
    passAsks,
    passBids,
    failAsks,
    failBids,
    lastPassSlotUpdated,
    lastFailSlotUpdated,
    passSpreadString,
    failSpreadString } = useProposalMarkets();
  const { cancelOrderTransactions, settleFundsTransactions, closeOpenOrdersAccountTransactions } =
    useOpenbookTwap();
  const sender = useTransactionSender();
  const { colorScheme } = useMantineColorScheme();

  const { generateExplorerLink } = useExplorerConfiguration();
  const [lastSlot, setLastSlot] = useState<number>();
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const theme = useMantineTheme();
  const isSmall = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const isMedium = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);

  const remainingSlots = useMemo(() => {
    if (!proposal || !daoState || !lastSlot) return;

    // v0 doesn't have slots per proposal, so if it's v0 we say it's already done
    if (!daoState.slotsPerProposal) {
      return 0;
    }

    const endSlot = proposal.account.slotEnqueued.toNumber() + daoState.slotsPerProposal.toNumber();

    return Math.max(endSlot - lastSlot, 0);
  }, [proposal, lastSlot, daoState]);

  const handleFinalize = useCallback(async () => {
    if (!tokens?.meta || !daoTreasury || !wallet?.publicKey) return;

    setIsFinalizing(true);
    // HACK: Use a UI to add remaining accounts
    const txs = await finalizeProposalTransactions([
      {
        pubkey: getAssociatedTokenAddressSync(tokens.meta.publicKey, daoTreasury, true),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: getAssociatedTokenAddressSync(tokens.meta.publicKey, wallet.publicKey, true),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: daoTreasury,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: tokens.meta.publicKey,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: wallet.publicKey,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ]);
    if (!txs) return;
    try {
      await sender.send(txs);
      await fetchProposals();
    } finally {
      setIsFinalizing(false);
    }
  }, [tokens, daoTreasury, sender, finalizeProposalTransactions, fetchProposals]);

  const handleCloseOrders = useCallback(async () => {
    if (!proposal || !orders || !markets || !wallet.publicKey) {
      return;
    }

    const openOrders = orders.filter((order) => isOpenOrder(order, markets));
    // TODO: also handle uncranked orders
    // const uncrankedOrders = orders.filter((order) => isCompletedOrder(order, markets));
    const unsettledOrders = orders.filter((order) => isEmptyOrder(order));

    const ordersToSettle = unsettledOrders.filter((order) => isPartiallyFilled(order));
    const ordersToClose = unsettledOrders.filter((order) => isClosableOrder(order));

    const cancelOpenOrdersTxs = (
      await Promise.all(
        openOrders.map((order) =>
          cancelOrderTransactions(
            new BN(order.account.accountNum),
            proposal.account.openbookPassMarket.equals(order.account.market)
              ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
              : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
          ),
        ),
      )
    ).flat();

    const settleOrdersTxs = (
      await Promise.all(
        openOrders.concat(ordersToSettle).map((order) => {
          const pass = order.account.market.equals(proposal.account.openbookPassMarket);
          return settleFundsTransactions(
            order.account.accountNum,
            pass,
            proposal,
            pass
              ? { account: markets.pass, publicKey: proposal.account.openbookPassMarket }
              : { account: markets.fail, publicKey: proposal.account.openbookFailMarket },
          );
        }),
      )
    ).flat();

    const closeOrdersTxs = (
      await Promise.all(
        openOrders
          .concat(ordersToSettle)
          .concat(ordersToClose)
          .map((order) => closeOpenOrdersAccountTransactions(new BN(order.account.accountNum))),
      )
    ).flat();

    setIsClosing(true);
    try {
      await sender.send(
        [cancelOpenOrdersTxs, settleOrdersTxs, closeOrdersTxs].filter((set) => set.length !== 0),
      );
    } finally {
      fetchOpenOrders(wallet.publicKey);
      setIsClosing(false);
    }
  }, [
    orders,
    markets,
    proposal,
    sender,
    wallet.publicKey,
    cancelOrderTransactions,
    fetchOpenOrders,
  ]);

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
      const slot = await queryClient.fetchQuery({
        queryKey: ['getSlot'],
        queryFn: () => connection.getSlot(),
        staleTime: 30_000,
      });
      setLastSlot(slot);
    }

    fetchSlot();
  }, [connection, lastSlot]);

  const router = useRouter();
  const { proposals } = useAutocrat();

  const [pendingProposals, setPendingProposals] = useState<Proposal[] | null>(null);

  useEffect(() => {
    if (proposals) {
      setPendingProposals(proposals?.filter((p) => p.account.state.pending));
    }
  }, [proposals]);

  const handleProposalChange = (title: string | null) => {
    const proposalId = pendingProposals?.filter((p) => p?.title === title)[0].account.number;

    if (proposalId) {
      router.replace(`/proposal?id=${proposalId}`);
    }
  };

  return !proposal || !markets ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <Flex
      direction={isMedium ? 'column' : 'row'}
      align="start"
      justify="start"
      gap={isMedium ? 'xl' : 'md'}
      mt="-1rem"
    >
      {isMedium ? (
        isSmall ? null : (
          <Button
            pos="fixed"
            top="76px"
            className={classes.colorschemebutton}
            leftSection={<IconChevronLeft />}
            href="/"
            component="a"
            style={{ textDecoration: 'none', width: 'fit-content', zIndex: '40' }}
          >
            Back to Proposals
          </Button>
        )
      ) : (
        <Button
          pos="fixed"
          top="76px"
          className={classes.colorschemebutton}
          leftSection={<IconChevronLeft />}
          href="/"
          component="a"
          style={{ textDecoration: 'none', width: 'fit-content', zIndex: '40' }}
        >
          Back to Proposals
        </Button>
      )}
      <Stack
        pos={isMedium ? 'relative' : 'sticky'}
        top={isMedium ? '10px' : '100px'}
        justify="space-between"
        p="md"
        w={isMedium ? '100%' : '530px'}
        miw="420px"
      >
        <Stack gap="sm">
          <Group
            justify={isMedium ? (isSmall ? 'space-around' : 'center') : 'space-between'}
            align="start"
          >
            {isSmall ? (
              <ActionIcon
                my="auto"
                className={classes.colorschemebutton}
                href="/"
                component="a"
                style={{ textDecoration: 'none', width: 'fit-content', zIndex: '40' }}
              >
                <IconChevronLeft />
              </ActionIcon>
            ) : null}
            {
              proposal.account.state.pending && pendingProposals && pendingProposals.length > 1 ?
                <Select
                  data={pendingProposals?.map(el => el.title)}
                  defaultValue={proposal.title}
                  onChange={handleProposalChange}
                  value={proposal.title}
                  size="md"
                  fw={800}
                />
                :
                <Title order={2}>{proposal.title}</Title>
            }
            <StateBadge proposal={proposal} />
          </Group>
          {proposal.description ? (
            <Card bg={colorScheme === 'dark' ? 'dark' : '#f9f9f9'} w="fit-content">
              <Stack justify="end" align="end" w="fit-content">
                <ScrollArea.Autosize mah={isMedium ? '340px' : '240px'} mx="auto">
                  {/* <Markdown className="markdown">{proposal.description}</Markdown> */}
                </ScrollArea.Autosize>
                <ExternalLink href={proposal.account.descriptionUrl} />
              </Stack>
            </Card>
          ) : null}
          <ProposalCountdown remainingSlots={remainingSlots} />
          <Text>Account:{' '}
            <a
              href={generateExplorerLink(proposal.publicKey.toString(), 'account')}
              target="blank"
            >
              {shortKey(proposal.publicKey)}
            </a>
          </Text>
          {proposal.account.instruction.data
            &&
            <>
            <Text>Instruction:</Text>
            <Stack pl={15}>
              {(proposal.account.instruction.accounts.length > 0)
              &&
              <>
              <Text size="xs">Accounts</Text>
              {proposal.account.instruction.accounts.map((account) =>
                <Code>{account.pubkey.toString()}</Code>
              )}
              </>
              }
              <Text size="xs">Data</Text><Code>[{Uint8Array.from(proposal.account.instruction.data).toString()}]</Code>
              <Text size="xs">Program</Text><Code>{proposal.account.instruction.programId.toString()}</Code>
            </Stack>
            </>
          }
          <Group wrap="wrap" justify="space-between" pt={10}>
            <ExternalLink href={proposal.account.descriptionUrl} />
            <Text opacity={0.6} style={{ textAlign: 'right' }}>
              Proposed by{' '}
              <a
                href={generateExplorerLink(proposal.account.proposer.toString(), 'account')}
                target="blank"
              >
                {shortKey(proposal.account.proposer)}
              </a>
            </Text>
          </Group>
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
        {(proposal.account.state.passed || proposal.account.state.failed) && (
          <>
            <Button
              loading={isClosing}
              disabled={(orders?.length || 0) === 0}
              onClick={handleCloseOrders}
            >
              Close remaining orders
            </Button>
            {(orders?.length || 0) === 0 ? (
              <Button color="green" loading={isRedeeming} onClick={handleRedeem}>
                Redeem
              </Button>
            ) : (
              <Tooltip label="You have open orders left!">
                <Button color="green" loading={isRedeeming} variant="outline" onClick={handleRedeem}>
                  Redeem
                </Button>
              </Tooltip>
            )}
          </>
        )}
        <JupSwapCard />
      </Stack>
      <Divider orientation={isMedium ? 'horizontal' : 'vertical'} />
      <Container mt="1rem" p={isMedium ? '0' : 'sm'}>
        <Stack style={{ flex: 1 }}>
          {markets ? (
            <Group gap="md" justify="space-around" mt="xl" p="0">
              <ConditionalMarketCard
                asks={passAsks ?? []}
                bids={passBids ?? []}
                lastSlotUpdated={lastPassSlotUpdated}
                spreadString={passSpreadString}
                isPassMarket
              />
              <ConditionalMarketCard
                asks={failAsks ?? []}
                bids={failBids ?? []}
                lastSlotUpdated={lastFailSlotUpdated}
                spreadString={failSpreadString}
                isPassMarket={false}
              />
            </Group>
          ) : null}
          <ProposalOrdersCard />
        </Stack>
      </Container>
    </Flex>
  );
}
