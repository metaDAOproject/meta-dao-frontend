import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, Table, Button, Group, Text } from '@mantine/core';
import { Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useProposal } from '@/contexts/ProposalContext';
import { isClosableOrder, isPartiallyFilled } from '@/lib/openbook';
import { ProposalUnsettledOrderRow } from './ProposalUnsettledOrderRow';
import { useBalances } from '../../contexts/BalancesContext';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';
import { useOpenbook } from '@/hooks/useOpenbook';

const headers = ['Order ID', 'Market', 'Claimable', 'Actions'];

export function ProposalUnsettledOrdersTab({ orders }: { orders: OpenOrdersAccountWithKey[] }) {
  const sender = useTransactionSender();
  const { program: openbook } = useOpenbook();
  const wallet = useWallet();
  const { proposal } = useProposal();
  const { markets, fetchNonOpenOrders } = useProposalMarkets();
  const { fetchBalanceByMint } = useBalances();
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbookTwap();

  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const ordersToSettle = useMemo(
    () => orders.filter((order) => isPartiallyFilled(order)),
    [orders],
  );
  const ordersToClose = useMemo(() => orders.filter((order) => isClosableOrder(order)), [orders]);

  useEffect(() => {
    if (wallet.publicKey) {
      fetchNonOpenOrders(wallet.publicKey, openbook, proposal, markets);
    }
  }, [wallet.publicKey?.toString(), openbook, proposal, markets]);

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
      fetchBalanceByMint(markets.pass.baseMint);
      fetchBalanceByMint(markets.pass.quoteMint);
      fetchBalanceByMint(markets.fail.baseMint);
      fetchBalanceByMint(markets.fail.quoteMint);
    } finally {
      setIsSettling(false);
    }
  }, [ordersToSettle, markets, proposal, sender, settleFundsTransactions, fetchBalanceByMint]);

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
      setIsClosing(false);
    }
  }, [ordersToClose, markets, proposal, sender, settleFundsTransactions]);

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
              <ProposalUnsettledOrderRow key={order.publicKey.toString()} order={order} />
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text py="sm">No Orders Found</Text>
      )}
    </Stack>
  );
}
