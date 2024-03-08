import { useCallback, useMemo, useState } from 'react';
import { Stack, Table, Button, Group, Text } from '@mantine/core';
import { Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { isClosableOrder, isPartiallyFilled } from '@/lib/openbook';
import { UnsettledOrderRow } from './UnsettledOrderRow';
import { useBalances } from '../../contexts/BalancesContext';
import { useOpenbook } from '@/hooks/useOpenbook';
import { useOpenbookMarket } from '@/contexts/OpenbookMarketContext';

const headers = ['Order ID', 'Market', 'Claimable', 'Actions'];

export function UnsettledOrdersTab({ orders }: { orders: OpenOrdersAccountWithKey[] }) {
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { fetchBalanceByMint } = useBalances();
  const { market, marketPubkey, fetchOpenOrders } = useOpenbookMarket();
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbook();

  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const ordersToSettle = useMemo(
    () => orders.filter((order) => isPartiallyFilled(order)),
    [orders],
  );
  const ordersToClose = useMemo(() => orders.filter((order) => isClosableOrder(order)), [orders]);

  const handleSettleAllFunds = useCallback(async () => {
    if (!market || !marketPubkey || !wallet?.publicKey) return;

    setIsSettling(true);
    try {
      const txs = (
        await Promise.all(
          ordersToSettle.map((order) =>
            settleFundsTransactions(order.account.accountNum, {
              account: market.market,
              publicKey: marketPubkey,
            }),
          ),
        )
      )
        .flat()
        .filter(Boolean);

      if (!txs) return;
      await sender.send(txs as Transaction[]);
      fetchOpenOrders(wallet.publicKey);
      fetchBalanceByMint(market.market.baseMint);
      fetchBalanceByMint(market.market.quoteMint);
    } finally {
      setIsSettling(false);
    }
  }, [
    ordersToSettle,
    market,
    marketPubkey,
    sender,
    settleFundsTransactions,
    fetchOpenOrders,
    fetchBalanceByMint,
  ]);

  const handleCloseAllOrders = useCallback(async () => {
    if (!market || !marketPubkey || !wallet?.publicKey) return;

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
  }, [ordersToClose, market, marketPubkey, sender, settleFundsTransactions, fetchOpenOrders]);

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
          variant="outline"
          loading={isSettling}
          onClick={handleSettleAllFunds}
          disabled={ordersToSettle.length === 0}
        >
          Settle {ordersToSettle.length} Orders
        </Button>
        <Button
          variant="outline"
          loading={isClosing}
          onClick={handleCloseAllOrders}
          disabled={ordersToClose.length === 0}
        >
          Close {ordersToClose.length} Orders
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
              <UnsettledOrderRow key={order.publicKey.toString()} order={order} />
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text py="sm">No Orders Found</Text>
      )}
    </Stack>
  );
}
