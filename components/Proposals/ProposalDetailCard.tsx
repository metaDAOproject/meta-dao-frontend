import { BN } from '@coral-xyz/anchor';
import {
  ActionIcon,
  Button,
  Card,
  Container,
  Divider,
  Flex,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { SystemProgram } from '@solana/web3.js';
import { IconChevronLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import numeral from 'numeral';
import classes from '@/app/globals.module.css';
import { useAutocrat } from '@/contexts/AutocratContext';
import { useProposal } from '@/contexts/ProposalContext';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';
import { useConditionalVault } from '@/hooks/useConditionalVault';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { Proposal } from '@/lib/types';
import { shortKey } from '@/lib/utils';
import { isClosableOrder, isPartiallyFilled } from '../../lib/openbook';
import ExternalLink from '../ExternalLink';
import { ConditionalMarketCard } from '../Markets/ConditionalMarketCard';
import ProposalInstructionCard from './Instructions/ProposalInstructionCard';
import { JupSwapCard } from './JupSwapCard';
import MarketsBalances from './MarketsBalances';
import { ProposalCountdown } from './ProposalCountdown';
import { ProposalOrdersCard } from './ProposalOrdersCard';
import { StateBadge } from './StateBadge';
import useTwapSubscription from '@/hooks/useTwapSubscription';
import { getWinningTwap } from '@/lib/openbookTwap';
import { NUMERAL_FORMAT, AUTOCRAT_VERSIONS } from '@/lib/constants';
import useClusterDataSubscription from '@/hooks/useClusterDataSubscription';
import useInitializeClusterDataSubscription from '@/hooks/useInitializeClusterDataSubscription';
import { ConditionalMarketTable } from '../Markets/ConditionalMarketTable';

export type ProposalProps = {
  programKey: string | null;
  proposalNumber: number | null;
};

export function ProposalDetailCard(props: ProposalProps) {
  const { programKey, proposalNumber } = props;
  const wallet = useWallet();
  const { daoTreasuryKey, daoTokens, daoState, programVersion, setProgramVersion } = useAutocrat();

  // NOTE: Added as we don't want to willy nilly just update stuff already set.
  const isSameProgram = programVersion?.programId.toString() === programKey;

  const tokens = daoTokens;
  const { redeemTokensTransactions } = useConditionalVault();
  const { proposal, finalizeProposalTransactions } = useProposal();
  const {
    openOrders,
    unsettledOrders,
    markets,
    passAsks,
    passBids,
    failAsks,
    failBids,
    lastPassSlotUpdated,
    lastFailSlotUpdated,
    passSpreadString,
    failSpreadString,
    orderBookObject,
  } = useProposalMarkets();
  const { cancelOrderTransactions, settleFundsTransactions, closeOpenOrdersAccountTransactions } =
    useOpenbookTwap();
  const sender = useTransactionSender();
  const { colorScheme } = useMantineColorScheme();

  const { generateExplorerLink } = useExplorerConfiguration();
  useInitializeClusterDataSubscription();
  const {
    data: { slot: lastSlot },
  } = useClusterDataSubscription();
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const theme = useMantineTheme();
  const isSmall = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const isMedium = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
  const passMidPrice =
    (Number(orderBookObject?.passToB.topAsk) + Number(orderBookObject?.passToB.topBid)) / 2;
  const failMidPrice =
    (Number(orderBookObject?.failToB.topAsk) + Number(orderBookObject?.failToB.topBid)) / 2;

  const passTwapStructure = useTwapSubscription(
    proposal?.account.openbookTwapPassMarket,
    passMidPrice,
  );
  const failTwapStructure = useTwapSubscription(
    proposal?.account.openbookTwapFailMarket,
    failMidPrice,
  );

  if (programKey && proposalNumber && !isSameProgram) {
    const haveUrlProgram = AUTOCRAT_VERSIONS.find(
      (program) => program.programId.toString() === programKey,
    );
    if (haveUrlProgram) {
      // NOTE: This sets up our autocrat from using the URL
      setProgramVersion(AUTOCRAT_VERSIONS.indexOf(haveUrlProgram));
    }
  }

  const winningMarket = getWinningTwap(passTwapStructure?.twap, failTwapStructure?.twap, daoState);

  const daoPercentageMargin = daoState
    ? `${numeral(daoState.passThresholdBps / 100).format(NUMERAL_FORMAT)}%`
    : '???';
  const minimumToPass =
    daoState && failTwapStructure?.twap
      ? `(> ${numeral(
          ((failTwapStructure?.twap ?? 0) * (10000 + daoState.passThresholdBps)) / 10000,
        ).format(NUMERAL_FORMAT)})`
      : null;

  const twapDescription = `The Time Weighted Average Price (TWAP) is the measure used to decide if the proposal
          passes: if the TWAP of the pass market is
          ${daoPercentageMargin}
          above the fail market
          ${minimumToPass}
          , the proposal will pass once the countdown ends.`;

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
    if (!tokens?.meta || !daoTreasuryKey || !wallet?.publicKey) return;

    setIsFinalizing(true);
    // HACK: Use a UI to add remaining accounts
    const txs = await finalizeProposalTransactions([
      {
        pubkey: getAssociatedTokenAddressSync(tokens.meta.publicKey, daoTreasuryKey, true),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: getAssociatedTokenAddressSync(tokens.meta.publicKey, wallet.publicKey, true),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: daoTreasuryKey,
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
      // await fetchProposals();
    } finally {
      setIsFinalizing(false);
    }
  }, [tokens, daoTreasuryKey, sender, finalizeProposalTransactions]);

  const handleCloseOrders = useCallback(async () => {
    if (!proposal || !openOrders || !markets || !wallet.publicKey) {
      return;
    }

    // TODO: also handle uncranked orders
    // const uncrankedOrders = orders.filter((order) => isCompletedOrder(order, markets));

    const ordersToSettle = unsettledOrders?.filter((order) => isPartiallyFilled(order)) ?? [];
    const ordersToClose = unsettledOrders?.filter((order) => isClosableOrder(order)) ?? [];

    const cancelOpenOrdersTxs = (
      await Promise.all(
        (openOrders ?? []).map((order) =>
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
        (openOrders ?? []).concat(ordersToSettle).map((order) => {
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
        (openOrders ?? [])
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
      setIsClosing(false);
    }
  }, [openOrders, markets, proposal, sender, wallet.publicKey, cancelOrderTransactions]);

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
  }, [sender, redeemTokensTransactions]);

  const router = useRouter();
  const { proposals } = useAutocrat();

  const [pendingProposals, setPendingProposals] = useState<Proposal[] | null>(null);

  useEffect(() => {
    if (proposals) {
      setPendingProposals(proposals?.filter((p) => p.account.state.pending));
    }
  }, [proposals]);

  const handleProposalChange = (title: string | null) => {
    const proposalId = pendingProposals?.filter((p) => p?.title === title)[0]?.account.number;

    if (proposalId) {
      router.replace(
        `/program/proposal?programKey=${
          programKey || programVersion?.programId.toString()
        }&proposalNumber=${proposalId}`,
      );
    }
  };

  return !daoTokens ||
    !daoState ||
    !proposal ||
    !markets ||
    !programVersion ||
    (!programVersion?.programId.toString() && programKey) ? (
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
            {isMedium ? (
              isSmall ? (
                <ActionIcon
                  my="auto"
                  className={classes.colorschemebutton}
                  href={`/program?programKey=${programKey || programVersion.programId.toString()}`}
                  component="a"
                  style={{ textDecoration: 'none', width: 'fit-content', zIndex: '40' }}
                >
                  <IconChevronLeft />
                </ActionIcon>
              ) : (
                <Button
                  className={classes.colorschemebutton}
                  leftSection={<IconChevronLeft />}
                  href={`/program?programKey=${programKey || programVersion.programId.toString()}`}
                  component="a"
                  style={{ textDecoration: 'none', width: 'fit-content', zIndex: '40' }}
                >
                  Back to Proposals
                </Button>
              )
            ) : (
              <Button
                className={classes.colorschemebutton}
                leftSection={<IconChevronLeft />}
                href={`/program?programKey=${programKey || programVersion.programId.toString()}`}
                component="a"
                style={{ textDecoration: 'none', width: 'fit-content', zIndex: '40' }}
              >
                Back to Proposals
              </Button>
            )}

            {proposal.account.state.pending && pendingProposals && pendingProposals.length > 1 ? (
              <Select
                data={pendingProposals?.map((el) => el.title)}
                defaultValue={proposal.title}
                onChange={handleProposalChange}
                value={proposal.title}
                size="md"
                fw={800}
              />
            ) : (
              <Title order={2}>{proposal.title}</Title>
            )}
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
          <Text>
            Account:{' '}
            <a href={generateExplorerLink(proposal.publicKey.toString(), 'account')} target="blank">
              {shortKey(proposal.publicKey)}
            </a>
          </Text>
          {proposal.account.instruction.data && <ProposalInstructionCard proposal={proposal} />}
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
              disabled={(openOrders?.length || 0) === 0}
              onClick={handleCloseOrders}
            >
              Close remaining orders
            </Button>
            {(openOrders?.length || 0) === 0 ? (
              <Button color="green" loading={isRedeeming} onClick={handleRedeem}>
                Redeem
              </Button>
            ) : (
              <Tooltip label="You have open orders left!">
                <Button
                  color="green"
                  loading={isRedeeming}
                  variant="outline"
                  onClick={handleRedeem}
                >
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
            <>
              {/* <ConditionalMarketTable passTwap={passTwapStructure} failTwap={failTwapStructure} /> */}
              <Group gap="md" justify="space-around" mt="xl" p="0">
                <ConditionalMarketCard
                  asks={passAsks ?? []}
                  bids={passBids ?? []}
                  lastSlotUpdated={lastPassSlotUpdated}
                  spreadString={passSpreadString}
                  isPassMarket
                  isWinning={winningMarket === 'pass'}
                  twapData={passTwapStructure}
                  twapDescription={twapDescription}
                />
                <ConditionalMarketCard
                  asks={failAsks ?? []}
                  bids={failBids ?? []}
                  lastSlotUpdated={lastFailSlotUpdated}
                  spreadString={failSpreadString}
                  isPassMarket={false}
                  isWinning={winningMarket === 'fail'}
                  twapData={failTwapStructure}
                  twapDescription={twapDescription}
                />
              </Group>
            </>
          ) : null}
          <ProposalOrdersCard />
        </Stack>
      </Container>
    </Flex>
  );
}
