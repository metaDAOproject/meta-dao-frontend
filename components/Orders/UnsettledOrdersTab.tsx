import { useCallback, useMemo, useState } from 'react';
import { Stack, Table, Button, Group, Text } from '@mantine/core';
import { Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useProposal } from '@/contexts/ProposalContext';
import { isClosableOrder, isEmptyOrder } from '@/lib/openbook';
import { UnsettledOrderRow } from './UnsettledOrderRow';

const headers = ['Order ID', 'Market', 'Claimable', 'Actions'];

export function UnsettledOrdersTab({ orders }: { orders: OpenOrdersAccountWithKey[] }) {
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { proposal, markets, fetchOpenOrders } = useProposal();
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbookTwap();

  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const ordersToSettle = useMemo(() => orders.filter((order) => !isEmptyOrder(order)), [orders]);
  const ordersToClose = useMemo(() => orders.filter((order) => isClosableOrder(order)), [orders]);

  const handleSettleAllFunds = useCallback(async () => {
    if (!proposal || !markets || !wallet?.publicKey) return;

    setIsSettling(true);
    try {
      const txs = (
        await Promise.all(
          ordersToSettle.map((order) => {
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
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      await sender.send(txs as Transaction[]);
      fetchOpenOrders(wallet.publicKey);
    } finally {
      setIsSettling(false);
    }
  }, [ordersToSettle, markets, proposal, sender, settleFundsTransactions, fetchOpenOrders]);

  const handleCloseAllOrders = useCallback(async () => {
    if (!proposal || !markets || !wallet?.publicKey) return;

    setIsClosing(true);

    try {
      const txs = (
        await Promise.all(
          ordersToClose.map((order) =>
            closeOpenOrdersAccountTransactions(new BN(order.account.accountNum)),
          ),
        )
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      await sender.send(txs as Transaction[]);
    } finally {
      fetchOpenOrders(wallet.publicKey);
      setIsClosing(false);
    }
  }, [ordersToClose, markets, proposal, sender, settleFundsTransactions, fetchOpenOrders]);

  return (
    <Stack py="md">
      <Text size="sm">
        These are your Order Accounts (OpenBook uses a{' '}
        <a
          href="https://twitter.com/openbookdex/status/1727309884159299929?s=61&t=Wv1hCdAly84RMB_iLO0iIQ"
          target="_blank"
          rel="noreferrer"
        >
          crank
        </a>{' '}
        and to do that when you place an order you create an account for that order). If you see a
        balance here you can settle the balance (to have it returned to your wallet for futher use
        while the proposal is active). Once settled, you can close the account to reclaim the SOL.
      </Text>
      <Group>
        <Button
          variant="light"
          loading={isSettling}
          onClick={handleSettleAllFunds}
          disabled={ordersToSettle.length === 0}
        >
          Settle {ordersToSettle.length} Orders
        </Button>
        <Button
          variant="light"
          loading={isClosing}
          onClick={handleCloseAllOrders}
          disabled={ordersToClose.length === 0}
        >
          Close {ordersToClose.length} Orders
        </Button>
      </Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            {headers.map((header) => (
              <Table.Th key={header}>{header}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {orders && orders.length > 0 ? (
            orders.map((order) => (
              <UnsettledOrderRow key={order.publicKey.toString()} order={order} />
            ))
          ) : (
            <Text py="sm">No Orders Found</Text>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
