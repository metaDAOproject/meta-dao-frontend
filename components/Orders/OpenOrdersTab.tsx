import { useCallback, useState } from 'react';
import { Stack, Table, Button, Group, Text } from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { OpenOrdersAccountWithKey } from '@themetadao/futarchy-ts/lib/types';
import { isPartiallyFilled } from '@themetadao/futarchy-ts/lib/openbook';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useProposal } from '@/contexts/ProposalContext';
import { OpenOrderRow } from './OpenOrderRow';

const headers = ['Order ID', 'Market', 'Status', 'Size', 'Price', 'Notional', 'Actions'];

export function OpenOrdersTab({ orders }: { orders: OpenOrdersAccountWithKey[] }) {
  const { markets, isCranking, crankMarkets } = useProposal();
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { fetchOpenOrders, proposal } = useProposal();
  const { cancelOrderTransactions, settleFundsTransactions } = useOpenbookTwap();

  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const handleCancelAll = useCallback(async () => {
    if (!proposal || !markets) return;

    const txs = (
      await Promise.all(
        orders.map((order) =>
          cancelOrderTransactions(
            new BN(order.account.accountNum),
            proposal.account.openbookPassMarket.equals(order.account.market)
              ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
              : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
          ),
        ),
      )
    ).flat();

    if (!wallet.publicKey || !txs) return;

    try {
      setIsCanceling(true);
      // Filtered undefined already
      await sender.send(txs);
      // We already return above if the wallet doesn't have a public key
      await fetchOpenOrders(wallet.publicKey!);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCanceling(false);
    }
  }, [proposal, markets, wallet.publicKey, cancelOrderTransactions, fetchOpenOrders, sender]);

  const handleSettleAllFunds = useCallback(async () => {
    if (!proposal || !markets) return;

    setIsSettling(true);
    try {
      // HACK: Assumes all orders are for the same market
      const pass = orders[0].account.market.equals(proposal.account.openbookPassMarket);
      const txs = (
        await Promise.all(
          orders
            .filter((order) => isPartiallyFilled(order))
            .map((order) =>
              settleFundsTransactions(
                order.account.accountNum,
                pass,
                proposal,
                pass
                  ? { account: markets.pass, publicKey: proposal.account.openbookPassMarket }
                  : { account: markets.fail, publicKey: proposal.account.openbookFailMarket },
              ),
            ),
        )
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      sender.send(txs as Transaction[]);
    } finally {
      setIsSettling(false);
    }
  }, [orders, proposal, settleFundsTransactions]);

  return (
    <Stack py="md">
      <Text size="sm">
        If you see orders here with a settle button, you can settle them to redeem the partial fill
        amount. These exist when there is a balance available within the Open Orders Account.
      </Text>
      <Group justify="space-around">
        <Button loading={isCranking} color="blue" onClick={() => crankMarkets()}>
          Crank 🐷
        </Button>
        <Button loading={isCanceling} onClick={handleCancelAll}>
          Cancel all orders
        </Button>
        <Button
          loading={isSettling}
          color="blue"
          onClick={handleSettleAllFunds}
          disabled={!orders.filter((order) => isPartiallyFilled(order)).length}
        >
          Settle {orders.filter((order) => isPartiallyFilled(order)).length} orders
        </Button>
      </Group>
      {orders && orders.length > 0 ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              {headers.map((header) => (
                <Table.Th key={header}>{header}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order) => (
              <OpenOrderRow key={order.publicKey.toString()} order={order} />
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text py="sm">No Orders Found</Text>
      )}
    </Stack>
  );
}
