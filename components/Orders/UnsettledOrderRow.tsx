import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Group,
  Stack,
  Table,
  Text,
  useMantineTheme,
  Tooltip,
  Space,
  Loader,
} from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import { Icon3dRotate, IconWriting, IconAssemblyOff } from '@tabler/icons-react';
import { BN } from '@coral-xyz/anchor';
import { baseLotsToUi, quoteLotsToUi } from '@openbook-dex/openbook-v2';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { BN_0 } from '@/lib/constants';
import { isBid, isPartiallyFilled } from '@/lib/openbook';
import { useBalances } from '../../contexts/BalancesContext';
import { useOpenbook } from '@/hooks/useOpenbook';
import { useOpenbookMarket } from '@/contexts/OpenbookMarketContext';

export function UnsettledOrderRow({ order }: { order: OpenOrdersAccountWithKey }) {
  const theme = useMantineTheme();
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { market, marketPubkey, fetchOpenOrders } = useOpenbookMarket();
  const { fetchBalanceByMint } = useBalances();
  const { generateExplorerLink } = useExplorerConfiguration();
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbook();

  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const handleSettleFunds = useCallback(async () => {
    if (!market || !marketPubkey || !wallet?.publicKey) return;

    setIsSettling(true);
    try {
      const txs = await settleFundsTransactions(order.account.accountNum, {
        account: market.market,
        publicKey: marketPubkey,
      });

      if (!txs) return;

      await sender.send(txs);
      await fetchOpenOrders(wallet.publicKey);
      fetchBalanceByMint(market.market.baseMint);
      fetchBalanceByMint(market.market.quoteMint);
    } finally {
      setIsSettling(false);
    }
  }, [
    order,
    market,
    marketPubkey,
    settleFundsTransactions,
    wallet,
    fetchOpenOrders,
    fetchBalanceByMint,
  ]);

  const handleCloseAccount = useCallback(async () => {
    if (!market || !marketPubkey) return;

    const txs = await closeOpenOrdersAccountTransactions(new BN(order.account.accountNum));

    if (!wallet.publicKey || !txs) return;

    setIsClosing(true);
    try {
      await sender.send(txs);
      fetchOpenOrders(wallet.publicKey);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClosing(false);
    }
  }, [market, marketPubkey, sender, order, wallet]);

  return !market ? (
    <Loader />
  ) : (
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
          <IconWriting color={theme.colors.green[9]} scale="xs" />
          <Stack gap={0} justify="flex-start" align="flex-start">
            <Text size="xs" c={isBid(order) ? theme.colors.green[9] : theme.colors.red[9]}>
              {isBid(order) ? 'Bid' : 'Ask'}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td>
        <Stack gap={0}>
          <Text>{`${baseLotsToUi(market.market, order.account.position.baseFreeNative) / 100_000}`}</Text>
          <Text>{`${quoteLotsToUi(market.market, order.account.position.quoteFreeNative)}`}</Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Group>
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
