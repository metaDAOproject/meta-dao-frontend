import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Group,
  Stack,
  Table,
  Text,
  useMantineTheme,
  Tooltip,
  Loader,
} from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import numeral from 'numeral';
import {
  IconTrash,
  Icon3dRotate,
  IconWriting,
} from '@tabler/icons-react';
import { priceLotsToUi, baseLotsToUi } from '@openbook-dex/openbook-v2';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { BASE_FORMAT } from '@/lib/constants';
import { isBid, isPartiallyFilled } from '@/lib/openbook';
import { useOpenbook } from '@/hooks/useOpenbook';
import { useOpenbookMarket } from '@/contexts/OpenbookMarketContext';

export function OpenOrderRow({ order }: { order: OpenOrdersAccountWithKey }) {
  const theme = useMantineTheme();
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { generateExplorerLink } = useExplorerConfiguration();
  const { market, marketPubkey, fetchOpenOrders, cancelAndSettleOrder } = useOpenbookMarket();
  const { settleFundsTransactions } = useOpenbook();

  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const handleCancel = useCallback(async () => {
    if (!market || !marketPubkey || !wallet.publicKey || !order) return;

    try {
      setIsCanceling(true);
      const txsSent = await cancelAndSettleOrder(
        order,
      );
      if (txsSent && txsSent.length > 0) {
        await fetchOpenOrders(wallet.publicKey!);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCanceling(false);
    }
  }, [
    order,
    market,
    marketPubkey,
    wallet.publicKey,
    cancelAndSettleOrder,
    fetchOpenOrders,
    sender,
  ]);

  const handleSettleFunds = useCallback(async () => {
    if (!market || !marketPubkey) return;

    setIsSettling(true);
    try {
      const txs = await settleFundsTransactions(
        order.account.accountNum,
        { account: market?.market, publicKey: marketPubkey }
      );

      if (!txs) return;
      await sender.send(txs);
    } finally {
      setIsSettling(false);
    }
  }, [order, market, marketPubkey, settleFundsTransactions]);

  return (!market ? (<Loader />) :
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
            color={theme.colors.green[9]}
            scale="xs"
          />
          <Stack gap={0} justify="flex-start" align="flex-start">
            <Text size="xs" c={isBid(order) ? theme.colors.green[9] : theme.colors.red[9]}>
              {isBid(order) ? 'Bid' : 'Ask'}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td>{isPartiallyFilled(order) ? 'Partial Fill' : 'Open'}</Table.Td>
      <Table.Td>
        {/* Size */}
        {
          numeral(
            isBid(order)
              ? baseLotsToUi(market.market, order.account.position.bidsBaseLots)
              : baseLotsToUi(market.market, order.account.position.asksBaseLots),
          ).format(BASE_FORMAT)
        }
      </Table.Td>
      <Table.Td>
        {/* Price */}
        {
          `$${priceLotsToUi(market.market, order.account.openOrders[0].lockedPrice)}`
        }
      </Table.Td>
      <Table.Td>
        {/* Notional */}$
        {isBid(order)
          ? baseLotsToUi(market.market, order.account.position.bidsBaseLots) *
          priceLotsToUi(market.market, order.account.openOrders[0].lockedPrice)
          : baseLotsToUi(market.market, order.account.position.asksBaseLots) *
          priceLotsToUi(market.market, order.account.openOrders[0].lockedPrice)
        }
      </Table.Td>
      <Table.Td>
        {isPartiallyFilled(order) && (
          <Tooltip label="Settle funds">
            <ActionIcon variant="outline" loading={isSettling} onClick={() => handleSettleFunds()}>
              <Icon3dRotate />
            </ActionIcon>
          </Tooltip>
        )}
        <Group gap="sm">
          <Tooltip label="Cancel order" events={{ hover: true, focus: true, touch: false }}>
            <ActionIcon variant="outline" loading={isCanceling} onClick={() => handleCancel()}>
              <IconTrash />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
