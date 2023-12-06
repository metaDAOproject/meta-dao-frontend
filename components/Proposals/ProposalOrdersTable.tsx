import { ReactNode, useCallback, useState } from 'react';
import {
  ActionIcon,
  Group,
  Stack,
  Table,
  Text,
  Tooltip,
  useMantineTheme,
  Space,
  Input,
} from '@mantine/core';
import { useWallet } from '@solana/wallet-adapter-react';
import numeral from 'numeral';
import {
  IconTrash,
  Icon3dRotate,
  IconAssemblyOff,
  IconWriting,
  Icon12Hours,
  IconEdit,
  IconPencilCancel,
  IconCheck,
} from '@tabler/icons-react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { Markets, OpenOrdersAccountWithKey, ProposalAccountWithKey } from '@/lib/types';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { NUMERAL_FORMAT, BASE_FORMAT, QUOTE_LOTS, BN_0 } from '@/lib/constants';
import { useProposal } from '@/hooks/useProposal';

export function ProposalOrdersTable({
  description,
  headers,
  orders,
  proposal,
  orderStatus,
  markets,
  settleOrders,
  handleCrank,
  isCranking,
}: {
  description: ReactNode;
  headers: string[];
  orders: OpenOrdersAccountWithKey[];
  proposal: ProposalAccountWithKey;
  orderStatus: string;
  markets: Markets;
  settleOrders: (
    orders: OpenOrdersAccountWithKey[],
    passMarket: boolean,
    dontClose?: boolean,
  ) => Promise<void>;
  handleCrank: (isPassMarket: boolean, individualEvent?: PublicKey) => void;
  isCranking: boolean;
}) {
  const theme = useMantineTheme();
  const sender = useTransactionSender();
  const wallet = useWallet();

  const { generateExplorerLink } = useExplorerConfiguration();
  const {
    cancelOrderTransactions,
    closeOpenOrdersAccountTransactions,
    cancelAndPlaceOrdersTransactions,
  } = useOpenbookTwap();
  const { fetchOpenOrders } = useProposal({
    fromNumber: proposal.account.number,
  });

  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<OpenOrdersAccountWithKey | undefined>();
  const [editedSize, setEditedSize] = useState<number>();
  const [editedPrice, setEditedPrice] = useState<number>();
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const handleCancel = useCallback(
    async (ordersToCancel: OpenOrdersAccountWithKey[]) => {
      if (!proposal || !markets) return;

      const txs = (
        await Promise.all(
          ordersToCancel.map((order) =>
            cancelOrderTransactions(
              new BN(order.account.accountNum),
              proposal.account.openbookPassMarket.equals(order.account.market)
                ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
                : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
            ),
          ),
        )
      )
        .flat()
        .filter(Boolean);

      if (!wallet.publicKey || !txs) return;

      try {
        setIsCanceling(true);
        // Filtered undefined already
        await sender.send(txs as Transaction[]);
        // We already return above if the wallet doesn't have a public key
        await fetchOpenOrders(proposal, wallet.publicKey!);
      } catch (err) {
        console.error(err);
      } finally {
        setIsCanceling(false);
      }
    },
    [proposal, markets, wallet.publicKey, cancelOrderTransactions, fetchOpenOrders, sender],
  );

  const handleEdit = useCallback(async () => {
    if (!proposal || !markets || !editingOrder) return;
    // const txs = (
    //   await cancelAndPlaceOrdersTransactions(
    //     new BN(order.account.accountNum),
    //     proposal.account.openbookPassMarket.equals(order.account.market)
    //       ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
    //       : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
    //   )
    // )
    //   .flat()
    //   .filter(Boolean);
    // if (!wallet.publicKey || !txs) return;
    console.log(editedSize, editedPrice);
    try {
      setIsEditing(true);
      //   // Filtered undefined already
      //   await sender.send(txs as Transaction[]);
      //   // We already return above if the wallet doesn't have a public key
      //   await fetchOpenOrders(proposal, wallet.publicKey!);
      // } catch (err) {
      //   console.error(err);
    } finally {
      setIsEditing(false);
    }
  }, [
    proposal,
    markets,
    wallet.publicKey,
    editedSize,
    editedPrice,
    cancelAndPlaceOrdersTransactions,
    fetchOpenOrders,
    sender,
  ]);

  const handleSettleFunds = useCallback(
    async (order: OpenOrdersAccountWithKey, passMarket: boolean, dontClose?: boolean) => {
      setIsSettling(true);
      try {
        await settleOrders([order], passMarket, dontClose);
      } finally {
        setIsSettling(false);
      }
    },
    [settleOrders],
  );

  const handleCloseAccount = useCallback(
    async (order: OpenOrdersAccountWithKey) => {
      if (!proposal || !markets) return;

      const txs = await closeOpenOrdersAccountTransactions(new BN(order.account.accountNum));

      if (!wallet.publicKey || !txs) return;

      try {
        await sender.send(txs);
      } catch (err) {
        console.error(err);
      }
    },
    [proposal, sender],
  );

  const isPass = (order: OpenOrdersAccountWithKey) => {
    if (!proposal) return false;
    const isPassMarket = order.account.market.equals(proposal.account.openbookPassMarket);
    if (isPassMarket) {
      return true;
    }
    return false;
  };

  const isBid = (order: OpenOrdersAccountWithKey) => {
    const isBidSide = order.account.position.bidsBaseLots.gt(order.account.position.asksBaseLots);
    if (isBidSide) {
      return true;
    }
    return false;
  };

  const isPartiallyFilled = (order: OpenOrdersAccountWithKey): boolean => {
    const orderPosition = order.account.position;
    if (orderPosition.baseFreeNative > BN_0 || orderPosition.quoteFreeNative > BN_0) {
      return true;
    }
    return false;
  };

  return (
    <>
      <Group justify="flex-end">{description}</Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            {headers.map((header) => (
              <Table.Th>{header}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {orders.length > 0 ? (
            orders.map((order) => (
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
                      color={isPass(order) ? theme.colors.green[9] : theme.colors.red[9]}
                      scale="xs"
                    />
                    <Stack gap={0} justify="flex-start" align="flex-start">
                      <Text>{isPass(order) ? 'PASS' : 'FAIL'}</Text>

                      {orderStatus !== 'closed' ? (
                        <Text
                          size="xs"
                          c={isBid(order) ? theme.colors.green[9] : theme.colors.red[9]}
                        >
                          {isBid(order) ? 'Bid' : 'Ask'}
                        </Text>
                      ) : null}
                    </Stack>
                  </Group>
                </Table.Td>
                {orderStatus === 'open' || orderStatus === 'uncranked' ? (
                  <>
                    <Table.Td>
                      {orderStatus === 'uncranked'
                        ? 'Pending Crank'
                        : isPartiallyFilled(order)
                        ? 'Partial Fill'
                        : 'Open'}
                    </Table.Td>
                    <Table.Td>
                      {/* Size */}
                      {editingOrder === order ? (
                        <Input
                          w="5rem"
                          variant="filled"
                          defaultValue={numeral(
                            isBid(order)
                              ? order.account.position.bidsBaseLots
                              : order.account.position.asksBaseLots,
                          ).format(BASE_FORMAT)}
                          onChange={(e) => setEditedSize(Number(e.target.value))}
                        />
                      ) : (
                        numeral(
                          isBid(order)
                            ? order.account.position.bidsBaseLots
                            : order.account.position.asksBaseLots,
                        ).format(BASE_FORMAT)
                      )}
                    </Table.Td>
                    <Table.Td>
                      {/* Price */}
                      {editingOrder === order ? (
                        <Input
                          w="5rem"
                          variant="filled"
                          defaultValue={numeral(
                            order.account.openOrders[0].lockedPrice * QUOTE_LOTS,
                          ).format(NUMERAL_FORMAT)}
                          onChange={(e) => setEditedPrice(Number(e.target.value))}
                        />
                      ) : (
                        `$${numeral(order.account.openOrders[0].lockedPrice * QUOTE_LOTS).format(
                          NUMERAL_FORMAT,
                        )}`
                      )}
                    </Table.Td>
                    <Table.Td>
                      $
                      {numeral(
                        isBid(order)
                          ? order.account.position.bidsBaseLots *
                              order.account.openOrders[0].lockedPrice *
                              QUOTE_LOTS
                          : order.account.position.asksBaseLots *
                              order.account.openOrders[0].lockedPrice *
                              QUOTE_LOTS,
                      ).format(NUMERAL_FORMAT)}
                    </Table.Td>
                    <Table.Td>
                      {isPartiallyFilled(order) ? (
                        <>
                          <ActionIcon
                            variant="light"
                            loading={isSettling}
                            onClick={() => handleSettleFunds(order, isPass(order), true)}
                          >
                            <Icon3dRotate />
                          </ActionIcon>
                        </>
                      ) : null}
                      {orderStatus === 'uncranked' &&
                      (order.account.position.asksBaseLots > BN_0 ||
                        order.account.position.bidsBaseLots > BN_0) ? (
                        <Tooltip label="Crank the market 🐷">
                          <ActionIcon
                            variant="light"
                            loading={isCranking}
                            onClick={() => handleCrank(isPass(order), order.publicKey)}
                          >
                            <Icon12Hours />
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
                      <Group gap="sm">
                        <ActionIcon
                          variant="light"
                          loading={isCanceling}
                          onClick={() => handleCancel([order])}
                        >
                          <IconTrash />
                        </ActionIcon>
                        {editingOrder === order ? (
                          <Group gap="0.1rem">
                            <ActionIcon
                              c="green"
                              variant="light"
                              loading={isEditing}
                              onClick={handleEdit}
                            >
                              <IconCheck />
                            </ActionIcon>
                            <ActionIcon
                              c="red"
                              variant="light"
                              onClick={() => setEditingOrder(() => undefined)}
                            >
                              <IconPencilCancel />
                            </ActionIcon>
                          </Group>
                        ) : (
                          <ActionIcon variant="light" onClick={() => setEditingOrder(() => order)}>
                            <IconEdit />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </>
                ) : (
                  <>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text>
                          {`${order.account.position.baseFreeNative.toNumber() / 1_000_000_000} ${
                            isPass(order) ? 'pMETA' : 'fMETA'
                          }`}
                        </Text>
                        <Text>
                          {`${order.account.position.quoteFreeNative / 1_000_000} ${
                            isPass(order) ? 'pUSDC' : 'fUSDC'
                          }`}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group>
                        {order.account.position.asksBaseLots > BN_0 ||
                        order.account.position.bidsBaseLots > BN_0 ? (
                          <Tooltip label="Crank the market 🐷">
                            <ActionIcon
                              variant="light"
                              loading={isCranking}
                              onClick={() => handleCrank(isPass(order), order.publicKey)}
                            >
                              <Icon12Hours />
                            </ActionIcon>
                          </Tooltip>
                        ) : null}
                        <ActionIcon
                          variant="light"
                          loading={isSettling}
                          onClick={() => handleSettleFunds(order, isPass(order), true)}
                        >
                          <Icon3dRotate />
                        </ActionIcon>
                        <Space />
                        <ActionIcon
                          disabled={
                            order.account.position.asksBaseLots > BN_0 ||
                            order.account.position.bidsBaseLots > BN_0 ||
                            order.account.position.baseFreeNative > BN_0 ||
                            order.account.position.quoteFreeNative > BN_0
                          }
                          variant="light"
                          loading={isSettling}
                          onClick={() => handleCloseAccount(order)}
                        >
                          <IconAssemblyOff />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </>
                )}
              </Table.Tr>
            ))
          ) : (
            <Table.Tr>No Orders Found</Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}
