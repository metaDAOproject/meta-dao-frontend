import { ActionIcon, Button, Flex, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { Transaction, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { BN } from '@coral-xyz/anchor';
import { notifications } from '@mantine/notifications';
import numeral from 'numeral';
import { OpenOrdersAccountWithKey, ProposalAccountWithKey, Markets } from '@/lib/types';
import { NUMERAL_FORMAT, BASE_FORMAT } from '@/lib/constants';
import { useProposal } from '@/hooks/useProposal';
import { ProposalOrdersTable } from './ProposalOrdersTable';
import { NotificationLink } from '../Layout/NotificationLink';
import { useOpenbookTwap } from '../../hooks/useOpenbookTwap';
import { useTransactionSender } from '../../hooks/useTransactionSender';

export function ProposalOrdersCard({
  markets,
  orders,
  proposal,
  handleCrank,
  isCranking,
}: {
  markets: Markets;
  orders: OpenOrdersAccountWithKey[];
  proposal: ProposalAccountWithKey;
  handleCrank: (isPassMarket: boolean, individualEvent?: PublicKey) => void;
  isCranking: boolean;
}) {
  const wallet = useWallet();
  const sender = useTransactionSender();
  const { metaDisabled, usdcDisabled, fetchOpenOrders, createTokenAccounts } = useProposal({
    fromNumber: proposal.account.number,
  });
  const { settleFundsTransactions, closeOpenOrdersAccountTransactions } = useOpenbookTwap();
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const genericOrdersHeaders = [
    'Order ID',
    'Market',
    'Status',
    'Size',
    'Price',
    'Notional',
    'Actions',
  ];

  const unsettledOrdersHeaders = [
    'Order ID',
    'Market',
    'Claimable',
    'Actions',
  ];

  const handleSettleFunds = useCallback(
    async (
      ordersToSettle: OpenOrdersAccountWithKey[],
      passMarket: boolean,
      dontClose: boolean = false
      ) => {
      if (!proposal || !markets) return;
      let txs;
      if (!dontClose) {
        txs = (
          await Promise.all(
            ordersToSettle.map((order) =>
              settleFundsTransactions(
                new BN(order.account.accountNum),
                passMarket,
                proposal,
                proposal.account.openbookPassMarket.equals(order.account.market)
                  ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
                  : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
              ),
            ),
          )
        )
          .flat()
          .filter(Boolean)
          .concat(
            (
              await Promise.all(
                ordersToSettle.map((order) =>
                  closeOpenOrdersAccountTransactions(new BN(order.account.accountNum)),
                ),
              )
            )
              .flat()
              .filter(Boolean),
          );
      } else {
        txs = (
          await Promise.all(
            ordersToSettle.map((order) =>
              settleFundsTransactions(
                new BN(order.account.accountNum),
                passMarket,
                proposal,
                proposal.account.openbookPassMarket.equals(order.account.market)
                  ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
                  : { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
              ),
            ),
          )
        )
          .flat()
          .filter(Boolean);
      }

      if (!wallet.publicKey || !txs) return;

      try {
        setIsSettling(true);
        const txSignatures = await sender.send(txs as Transaction[]);
        txSignatures.map((sig) =>
          notifications.show({
            title: 'Transaction Submitted',
            message: <NotificationLink signature={sig} />,
            autoClose: 5000,
          }),
        );
        await fetchOpenOrders(proposal, wallet.publicKey!);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSettling(false);
      }
    },
    [proposal, settleFundsTransactions, fetchOpenOrders, sender],
  );

  const filterEmptyOrders = (): OpenOrdersAccountWithKey[] =>
    orders.filter((order) => {
      if (order.account.openOrders[0].isFree === 1) {
        return order;
      }
      return null;
    });

  const unsettledOrdersDescription = () => (
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
        <br />
        <br />
        If you&apos;re unable to settle your account, you may not have a token account for the
        respective pass / fail tokens. Use the buttons below to create the conditional token
        accounts.
      </Text>
      <Group>
        <Button disabled={metaDisabled} onClick={() => createTokenAccounts(true)}>
          Conditional META
        </Button>
        <Button disabled={usdcDisabled} onClick={() => createTokenAccounts(false)}>
          Conditional USDC
        </Button>
      </Group>
      <Group justify="flex-end">
        <Button
          loading={isSettling}
          onClick={() =>
            handleSettleFunds(
              filterEmptyOrders(),
              proposal.account.openbookFailMarket.equals(markets.passTwap.market),
            )
          }
          disabled={filterEmptyOrders().length === 0 || false}
        >
          Settle And Close All Orders
        </Button>
      </Group>
    </Stack>
  );

  // const filterPartiallyFilledOrders = (): OpenOrdersAccountWithKey[] =>
  //   orders.filter((order) => {
  //     if (order.account.openOrders[0].isFree === 0) {
  //       if (order.account.position.baseFreeNative.toNumber() > 0) {
  //         return order;
  //       }
  //       if (order.account.position.quoteFreeNative.toNumber() > 0) {
  //         return order;
  //       }
  //       return null;
  //     }
  //     return null;
  //   });

  const filterOpenOrders = (): OpenOrdersAccountWithKey[] =>
    orders.filter((order) => {
      if (order.account.openOrders[0].isFree === 0) {
        const passAsksFilter = markets.passAsks.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        const passBidsFilter = markets.passBids.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        const failAsksFilter = markets.failAsks.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        const failBidsFilter = markets.failBids.filter(
          (_order) => _order.owner.toString() === order.publicKey.toString(),
        );
        let _order = null;
        if (failAsksFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = failAsksFilter[0];
        }
        if (failBidsFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = failBidsFilter[0];
        }
        if (passAsksFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = passAsksFilter[0];
        }
        if (passBidsFilter.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          _order = passBidsFilter[0];
        }
        if (_order !== null) {
          return order;
        }
        return null;
      }
      return null;
    });

  const filterCompletedOrders = (): OpenOrdersAccountWithKey[] => {
    const openOrders = filterOpenOrders();
    const emptyAccounts = filterEmptyOrders();
    let filteredOrders = orders;
    if (openOrders.length > 0) {
      const openOrderKeys = openOrders.map((_order) => _order.publicKey.toString());
      filteredOrders = orders.filter(
        (order) => !openOrderKeys.includes(order.publicKey.toString()),
      );
    }
    if (emptyAccounts.length > 0) {
      const emptyAccountKeys = emptyAccounts.map((_order) => _order.publicKey.toString());
      filteredOrders = filteredOrders.filter(
        (order) => !emptyAccountKeys.includes(order.publicKey.toString()),
      );
    }
    if (emptyAccounts.length > 0 || openOrders.length > 0) {
      return filteredOrders.filter((elem, index, self) => index === self.indexOf(elem));
    }
    return [];
  };

  const isBidOrAsk = (order: OpenOrdersAccountWithKey) => {
    const isBidSide = order.account.position.bidsBaseLots.gt(order.account.position.asksBaseLots);
    if (isBidSide) {
      return true;
    }
    return false;
  };

  const totalInOrder = () => {
    let sumOrders = [];
    sumOrders = orders?.map(
      (order) =>
        (order.account.position.bidsBaseLots.toNumber() / 10_000 +
          order.account.position.asksBaseLots.toNumber() / 10_000) *
        order.account.openOrders[0].lockedPrice.toNumber(),
    );
    const totalValueLocked = sumOrders.reduce((partialSum, amount) => partialSum + amount, 0);
    return numeral(totalValueLocked).format(NUMERAL_FORMAT);
  };

  const totalUsdcInOrder = () => {
    let sumOrders = [];
    sumOrders = orders?.map((order) => {
      if (isBidOrAsk(order)) {
        return (
          order.account.position.bidsBaseLots.toNumber() +
          order.account.position.asksBaseLots.toNumber()
        );
      }
      return 0;
    });

    const totalValueLocked = sumOrders.reduce((partialSum, amount) => partialSum + amount, 0);
    return numeral(totalValueLocked).format(NUMERAL_FORMAT);
  };

  const totalMetaInOrder = () => {
    let sumOrders = [];
    sumOrders = orders?.map((order) => {
      if (!isBidOrAsk(order)) {
        return (
          order.account.position.bidsBaseLots.toNumber() +
          order.account.position.asksBaseLots.toNumber()
        );
      }
      return 0;
    });

    const totalValueLocked = sumOrders.reduce((partialSum, amount) => partialSum + amount, 0);
    return numeral(totalValueLocked).format(BASE_FORMAT);
  };

  return !proposal || !markets || !orders ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <>
    <Group justify="space-between" align="center">
      <Group>
        <Text fw="bolder" size="xl">Orders</Text>
        <ActionIcon
          variant="subtle"
            // @ts-ignore
          onClick={() => fetchOpenOrders(proposal, wallet.publicKey)}
        >
          <IconRefresh />
        </ActionIcon>
      </Group>
      <Flex justify="flex-end" align="flex-end" direction="row" wrap="wrap">
        <Stack gap={0} align="center" justify="flex-end">
          <Group>
            <Text size="xl" fw="bold">
              ${totalUsdcInOrder()}
            </Text>
            <Text size="md">condUSDC</Text>|
            <Text size="xl" fw="bold">
              {totalMetaInOrder()}
            </Text>
            <Text size="md">condMETA</Text>

          </Group>
          <Text fw="bolder" size="xl">
              (${totalInOrder()}) Total
          </Text>
        </Stack>
      </Flex>
    </Group>
    <Tabs defaultValue="open">

      <Tabs.List>
        <Tabs.Tab value="open">Open</Tabs.Tab>
        <Tabs.Tab value="uncranked">Uncranked</Tabs.Tab>
        <Tabs.Tab value="unsettled">Unsettled</Tabs.Tab>

      </Tabs.List>
      <Tabs.Panel value="open">
        <ProposalOrdersTable
          description="If you see orders here with a settle button, you can settle them to redeem the partial fill amount. These exist
            when there is a balance available within the Open Orders Account."
          headers={genericOrdersHeaders}
          orders={filterOpenOrders()}
          proposal={proposal}
          orderStatus="open"
          markets={markets}
          settleOrders={handleSettleFunds}
          handleCrank={handleCrank}
          isCranking={isCranking}
        />
      </Tabs.Panel>
      <Tabs.Panel value="uncranked">
        <ProposalOrdersTable
          description=" If you see orders here, you can use the cycle icon with the 12 on it next to the
            respective market which will crank it and push the orders into the Unsettled, Open
            Accounts below."
          headers={genericOrdersHeaders}
          orders={filterCompletedOrders()}
          proposal={proposal}
          orderStatus="uncranked"
          markets={markets}
          settleOrders={handleSettleFunds}
          handleCrank={handleCrank}
          isCranking={isCranking}
        />
      </Tabs.Panel>
      <Tabs.Panel value="unsettled">
        <ProposalOrdersTable
          description={unsettledOrdersDescription()}
          headers={unsettledOrdersHeaders}
          orders={filterEmptyOrders()}
          proposal={proposal}
          orderStatus="closed"
          markets={markets}
          settleOrders={handleSettleFunds}
          handleCrank={handleCrank}
          isCranking={isCranking}
        />
      </Tabs.Panel>
    </Tabs>
    </>
  );
}
