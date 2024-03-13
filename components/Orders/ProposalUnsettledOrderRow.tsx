import { useCallback, useRef, useState } from 'react';
import {
  ActionIcon,
  Group,
  Stack,
  Table,
  Text,
  useMantineTheme,
  Tooltip,
  Space,
} from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { Icon3dRotate, IconWriting, Icon12Hours, IconAssemblyOff } from '@tabler/icons-react';
import { BN } from '@coral-xyz/anchor';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { BN_0 } from '@/lib/constants';
import { useProposal } from '@/contexts/ProposalContext';
import { isBid, isPartiallyFilled, isPass } from '@/lib/openbook';
import { useBalances } from '../../contexts/BalancesContext';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';
import { useQueryClient } from '@tanstack/react-query';

export function ProposalUnsettledOrderRow({ order }: { order: OpenOrdersAccountWithKey }) {
  const queryClient = useQueryClient();
  const { markets } = useProposalMarkets();
  const theme = useMantineTheme();
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { setBalanceByMint } = useBalances();
  const { generateExplorerLink } = useExplorerConfiguration();
  const { proposal, crankMarkets, isCranking } = useProposal();
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbookTwap();
  const isBidSide = isBid(order);
  const balance = isBidSide
    ? order.account.position.bidsBaseLots
    : order.account.position.asksBaseLots;
  const originalBalance = useRef(balance);

  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const handleSettleFunds = useCallback(async () => {
    if (!proposal || !markets || !wallet?.publicKey) return;

    setIsSettling(true);
    try {
      const pass = order.account.market.equals(proposal.account.openbookPassMarket);
      const marketAccount = pass
        ? { account: markets.pass, publicKey: proposal.account.openbookPassMarket }
        : { account: markets.fail, publicKey: proposal.account.openbookFailMarket };
      const txs = await settleFundsTransactions(
        order.account.accountNum,
        pass,
        proposal,
        marketAccount,
      );

      if (!txs) return;

      await sender.send(txs);
      const relevantMint = isBidSide
        ? marketAccount.account.quoteMint
        : marketAccount.account.baseMint;
      setBalanceByMint(relevantMint, (oldBalance) => {
        const newAmount = oldBalance.uiAmount + originalBalance.current.toNumber();
        return {
          ...oldBalance,
          amount: newAmount.toString(),
          uiAmount: newAmount,
          uiAmountString: newAmount.toString(),
        };
      });
      await queryClient.refetchQueries({
        queryKey: [
          `fetchProposalClosedOrders-${proposal?.publicKey}-${wallet.publicKey.toString()}`,
        ],
        exact: true,
      });
    } finally {
      setIsSettling(false);
    }
  }, [order, proposal, settleFundsTransactions, wallet]);

  const handleCloseAccount = useCallback(async () => {
    if (!proposal || !markets) return;

    const txs = await closeOpenOrdersAccountTransactions(new BN(order.account.accountNum));

    if (!wallet.publicKey || !txs) return;

    setIsClosing(true);
    try {
      await sender.send(txs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClosing(false);
    }
  }, [proposal, sender, order, wallet]);

  return (
    <Table.Tr key={order.publicKey.toString()}>
      <Table.Td>
        <a
          href={generateExplorerLink(order.publicKey.toString(), 'account')}
          target="_blank"
          rel="noreferrer"
        >
          {order.account.accountNum}
        </a>
      </Table.Td>
      <Table.Td>
        <Group justify="flex-start" align="center" gap={10}>
          <IconWriting
            color={isPass(order, proposal) ? theme.colors.green[9] : theme.colors.red[9]}
            scale="xs"
          />
          <Stack gap={0} justify="flex-start" align="flex-start">
            <Text>{isPass(order, proposal) ? 'PASS' : 'FAIL'}</Text>
            <Text size="xs" c={isBid(order) ? theme.colors.green[9] : theme.colors.red[9]}>
              {isBid(order) ? 'Bid' : 'Ask'}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td>
        <Stack gap={0}>
          <Text>
            {`${order.account.position.baseFreeNative.toNumber() / 1_000_000_000} ${
              isPass(order, proposal) ? 'pMETA' : 'fMETA'
            }`}
          </Text>
          <Text>
            {`${order.account.position.quoteFreeNative / 1_000_000} ${
              isPass(order, proposal) ? 'pUSDC' : 'fUSDC'
            }`}
          </Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Group>
          {order.account.position.asksBaseLots.gt(BN_0) ||
          order.account.position.bidsBaseLots.gt(BN_0) ? (
            <Tooltip label="Crank the market 🐷">
              <ActionIcon
                variant="outline"
                loading={isCranking}
                onClick={() => crankMarkets(order.publicKey)}
              >
                <Icon12Hours />
              </ActionIcon>
            </Tooltip>
          ) : null}
          <Tooltip label="Settle Funds" events={{ hover: true, focus: true, touch: false }}>
            <ActionIcon
              variant="outline"
              disabled={!isPartiallyFilled(order)}
              loading={isSettling}
              onClick={() => handleSettleFunds()}
            >
              <Icon3dRotate />
            </ActionIcon>
          </Tooltip>
          <Space />
          <Tooltip label="Close Account" events={{ hover: true, focus: true, touch: false }}>
            <ActionIcon
              disabled={
                order.account.position.asksBaseLots > BN_0 ||
                order.account.position.bidsBaseLots > BN_0 ||
                order.account.position.baseFreeNative > BN_0 ||
                order.account.position.quoteFreeNative > BN_0
              }
              variant="outline"
              loading={isClosing}
              onClick={handleCloseAccount}
            >
              <IconAssemblyOff />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
