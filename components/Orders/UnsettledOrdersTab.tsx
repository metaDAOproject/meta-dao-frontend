import { useCallback, useState } from 'react';
import { Stack, Table, Button, Group, Text } from '@mantine/core';
import { Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useProposal } from '@/contexts/ProposalContext';
import { isEmptyOrder, isPartiallyFilled } from '@/lib/openbook';
import { UnsettledOrderRow } from './UnsettledOrderRow';

const headers = ['Order ID', 'Market', 'Claimable', 'Actions'];

export function UnsettledOrdersTab({ orders }: { orders: OpenOrdersAccountWithKey[] }) {
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { proposal, markets, fetchOpenOrders } = useProposal();
  const { settleFundsTransactions } = useOpenbookTwap();

  const [isSettling, setIsSettling] = useState<boolean>(false);

  const handleSettleAllFunds = useCallback(async () => {
    if (!proposal || !markets || !wallet?.publicKey) return;

    setIsSettling(true);
    try {
      const txs = (
        await Promise.all(
          orders
            .filter((order) => isPartiallyFilled(order))
            .map((order) => {
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
  }, [orders, markets, proposal, sender, settleFundsTransactions, fetchOpenOrders]);

  return (
    <Stack>
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
      <Group justify="flex-end">
        <Button
          loading={isSettling}
          onClick={() => proposal && handleSettleAllFunds()}
          disabled={orders.filter((order) => isEmptyOrder(order)).length === 0 || false}
        >
          Settle And Close All Orders
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
            orders.map((order) => <UnsettledOrderRow order={order} />)
          ) : (
            <Table.Tr>No Orders Found</Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
