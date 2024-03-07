import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Group,
  Stack,
  Table,
  Text,
  useMantineTheme,
  Input,
  Tooltip,
} from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import numeral from 'numeral';
import {
  IconTrash,
  Icon3dRotate,
  IconWriting,
  IconEdit,
  IconPencilCancel,
  IconCheck,
} from '@tabler/icons-react';
import { OpenOrdersAccountWithKey } from '@/lib/types';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { NUMERAL_FORMAT, BASE_FORMAT, QUOTE_LOTS } from '@/lib/constants';
import { useProposal } from '@/contexts/ProposalContext';
import { isBid, isPartiallyFilled, isPass } from '@/lib/openbook';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';
import { useBalances } from '@/contexts/BalancesContext';

export function ProposalOpenOrderRow({ order }: { order: OpenOrdersAccountWithKey }) {
  const theme = useMantineTheme();
  const sender = useTransactionSender();
  const wallet = useWallet();
  const { generateExplorerLink } = useExplorerConfiguration();
  const { proposal } = useProposal();
  const { markets, fetchOpenOrders, cancelAndSettleOrder } = useProposalMarkets();
  const { settleFundsTransactions, editOrderTransactions } = useOpenbookTwap();
  const { setBalanceByMint } = useBalances();
  const isBidSide = isBid(order);
  const balance = isBidSide
    ? order.account.position.bidsBaseLots
    : order.account.position.asksBaseLots;

  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<OpenOrdersAccountWithKey | undefined>();
  const [editedSize, setEditedSize] = useState<number>();
  const [editedPrice, setEditedPrice] = useState<number>();
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const handleCancel = useCallback(async () => {
    if (!markets || !proposal) return;

    const marketAccount = proposal.account.openbookPassMarket.equals(order.account.market)
      ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
      : { publicKey: proposal.account.openbookFailMarket, account: markets.fail };

    try {
      setIsCanceling(true);
      await cancelAndSettleOrder(order, marketAccount.publicKey);
      const relevantMint = isBidSide
        ? marketAccount.account.quoteMint
        : marketAccount.account.baseMint;
      setBalanceByMint(relevantMint, (oldBalance) => {
        const newAmount = oldBalance.uiAmount + balance.toNumber();
        return {
          ...oldBalance,
          amount: newAmount.toString(),
          uiAmount: newAmount,
          uiAmountString: newAmount.toString(),
        };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsCanceling(false);
    }
  }, [order, proposal, markets, wallet.publicKey, cancelAndSettleOrder, fetchOpenOrders, sender]);

  const handleEdit = useCallback(async () => {
    if (!proposal || !markets || !editingOrder) return;

    const price =
      editedPrice ||
      numeral(order.account.openOrders[0].lockedPrice.toString()).multiply(QUOTE_LOTS).value()!;
    const size =
      editedSize ||
      (isBidSide
        ? order.account.position.bidsBaseLots
        : order.account.position.asksBaseLots
      ).toNumber();
    const txs = (
      await editOrderTransactions({
        order,
        accountIndex: order.account.openOrders[0].clientId,
        amount: size,
        price,
        limitOrder: true,
        ask: !isBidSide,
        market: isPass(order, proposal)
          ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
          : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
      })
    )
      ?.flat()
      .filter(Boolean);
    if (!wallet.publicKey || !txs) return;
    try {
      setIsEditing(true);
      await sender.send(txs);
      await fetchOpenOrders(wallet.publicKey);
      setEditingOrder(undefined);
    } finally {
      setIsEditing(false);
    }
  }, [
    order,
    proposal,
    markets,
    wallet.publicKey,
    editedSize,
    editedPrice,
    editOrderTransactions,
    fetchOpenOrders,
    sender,
  ]);

  const handleSettleFunds = useCallback(async () => {
    if (!proposal || !markets) return;

    setIsSettling(true);
    try {
      const pass = order.account.market.equals(proposal.account.openbookPassMarket);
      const txs = await settleFundsTransactions(
        order.account.accountNum,
        pass,
        proposal,
        pass
          ? { account: markets.pass, publicKey: proposal.account.openbookPassMarket }
          : { account: markets.fail, publicKey: proposal.account.openbookFailMarket },
      );

      if (!txs) return;
      await sender.send(txs);
    } finally {
      setIsSettling(false);
    }
  }, [order, proposal, settleFundsTransactions]);

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
            <Text size="xs" c={isBidSide ? theme.colors.green[9] : theme.colors.red[9]}>
              {isBidSide ? 'Bid' : 'Ask'}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td>{isPartiallyFilled(order) ? 'Partial Fill' : 'Open'}</Table.Td>
      <Table.Td>
        {/* Size */}
        {editingOrder === order ? (
          <Input
            w="5rem"
            variant="filled"
            defaultValue={numeral(
              isBidSide ? order.account.position.bidsBaseLots : order.account.position.asksBaseLots,
            ).format(BASE_FORMAT)}
            onChange={(e) => setEditedSize(Number(e.target.value))}
          />
        ) : (
          numeral(
            isBidSide ? order.account.position.bidsBaseLots : order.account.position.asksBaseLots,
          ).format(BASE_FORMAT)
        )}
      </Table.Td>
      <Table.Td>
        {/* Price */}
        {editingOrder === order ? (
          <Input
            w="5rem"
            variant="filled"
            defaultValue={numeral(order.account.openOrders[0].lockedPrice * QUOTE_LOTS).format(
              NUMERAL_FORMAT,
            )}
            onChange={(e) => setEditedPrice(Number(e.target.value))}
          />
        ) : (
          `$${numeral(order.account.openOrders[0].lockedPrice * QUOTE_LOTS).format(NUMERAL_FORMAT)}`
        )}
      </Table.Td>
      <Table.Td>
        {/* Notional */}$
        {editingOrder === order
          ? numeral(
              (editedPrice || order.account.openOrders[0].lockedPrice * QUOTE_LOTS) *
                (editedSize ||
                  (isBidSide
                    ? order.account.position.bidsBaseLots
                    : order.account.position.asksBaseLots)),
            ).format(NUMERAL_FORMAT)
          : numeral(
              isBidSide
                ? order.account.position.bidsBaseLots *
                    order.account.openOrders[0].lockedPrice *
                    QUOTE_LOTS
                : order.account.position.asksBaseLots *
                    order.account.openOrders[0].lockedPrice *
                    QUOTE_LOTS,
            ).format(NUMERAL_FORMAT)}
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
          {editingOrder === order ? (
            <Group gap="0.1rem">
              <Tooltip label="Submit" events={{ hover: true, focus: true, touch: false }}>
                <ActionIcon
                  c="green"
                  variant="outline"
                  loading={isEditing}
                  onClick={() => handleEdit()}
                >
                  <IconCheck />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Cancel" events={{ hover: true, focus: true, touch: false }}>
                <ActionIcon
                  c="red"
                  variant="outline"
                  onClick={() => setEditingOrder(() => undefined)}
                >
                  <IconPencilCancel />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : (
            <Tooltip label="Edit order" events={{ hover: true, focus: true, touch: false }}>
              <ActionIcon variant="outline" onClick={() => setEditingOrder(() => order)}>
                <IconEdit />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
