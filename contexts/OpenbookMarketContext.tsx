import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, AccountMeta } from '@solana/web3.js';
import { priceLotsToUi, baseLotsToUi } from '@openbook-dex/openbook-v2';
import { BN } from '@coral-xyz/anchor';
import {
  OpenOrdersAccountWithKey,
  LeafNode,
  OpenbookMarket,
  OpenbookOrderBook,
  OutEvent,
  FillEvent,
} from '@/lib/types';
import { getLeafNodes } from '../lib/openbook';
import { debounce } from '../lib/utils';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useOpenbook } from '@/hooks/useOpenbook';

export interface OpenbookMarketInterface {
  market?: OpenbookMarket;
  marketPubkey: PublicKey;
  orders?: OpenOrdersAccountWithKey[];
  orderBookObject?: OpenbookOrderBook;
  loading: boolean;
  fetchOpenOrders: (owner: PublicKey) => Promise<void>;
  fetchMarketInfo: () => Promise<void>;
  placeOrder: (
    amount: number,
    price: number,
    limitOrder?: boolean,
    ask?: boolean,
  ) => Promise<void>;
  cancelAndSettleOrder: (
    order: OpenOrdersAccountWithKey,
  ) => Promise<string[] | void>;
  eventHeapCount: number | undefined;
}

export const openbookMarketContext = createContext<OpenbookMarketInterface | undefined>(undefined);

export const useOpenbookMarket = () => {
  const context = useContext(openbookMarketContext);
  if (!context) {
    throw new Error('useOpenBook must be used within a OpenbookContextProvider');
  }
  return context;
};

export function OpenbookMarketProvider({
  children,
  marketId,
}: {
  children: React.ReactNode;
  marketId: string | undefined | null;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const sender = useTransactionSender();
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState<OpenbookMarket>();
  const [orders, setOrders] = useState<OpenOrdersAccountWithKey[]>([]);
  const [eventHeapCount, setEventHeapCount] = useState<number>();
  const {
    program: _openbook,
    placeOrderTransactions,
    cancelAndSettleFundsTransactions,
  } = useOpenbook();

  // @ts-ignore
  const marketPubkey = new PublicKey(marketId);

  const findEventHeapCount = useCallback(
    async () => {
      if (!_openbook || !market) return;
      let accounts: PublicKey[] = new Array<PublicKey>();
      const _eventHeap = await _openbook.program.account.eventHeap.fetch(
        market?.market.eventHeap
      );
      if (_eventHeap != null) {
        // eslint-disable-next-line no-restricted-syntax
        for (const node of _eventHeap.nodes) {
          if (node.event.eventType === 0) {
            const fillEvent: FillEvent = _openbook.program.coder.types.decode(
              'FillEvent',
              Buffer.from([0, ...node.event.padding]),
            );
            accounts = accounts.filter((a) => a !== fillEvent.maker).concat([fillEvent.maker]);
          } else {
            const outEvent: OutEvent = _openbook.program.coder.types.decode(
              'OutEvent',
              Buffer.from([0, ...node.event.padding]),
            );
            accounts = accounts.filter((a) => a !== outEvent.owner).concat([outEvent.owner]);
          }
        }
        const accountsMeta: AccountMeta[] = accounts.map((remaining) => ({
          pubkey: remaining,
          isSigner: false,
          isWritable: true,
        }));
        setEventHeapCount(accountsMeta.length);
      } else {
        setEventHeapCount(0);
      }
    }, [_openbook, market]
  );

  const fetchMarketInfo = useCallback(
    debounce(async () => {
      if (!marketId || !_openbook || !connection) {
        return;
      }
      const accountInfos = await connection.getMultipleAccountsInfo([
        new PublicKey(marketId),
      ]);
      if (!accountInfos || accountInfos.indexOf(null) >= 0) return;

      const _market = await _openbook.program.coder.accounts.decode('market', accountInfos[0]!.data);

      const bookAccountInfos = await connection.getMultipleAccountsInfo([
        _market.asks,
        _market.bids,
      ]);
      const asks = getLeafNodes(
        await _openbook.program.coder.accounts.decode('bookSide', bookAccountInfos[0]!.data),
        _openbook.program,
      );
      const bids = getLeafNodes(
        await _openbook.program.coder.accounts.decode('bookSide', bookAccountInfos[1]!.data),
        _openbook.program,
      );

      setMarket({
        asks,
        bids,
        market: _market,
      });
    }, 1000),
    [marketId, _openbook, connection],
  );
  const fetchOpenOrders = useCallback(
    debounce<[PublicKey]>(async (owner: PublicKey) => {
      if (!_openbook || !marketId) {
        return;
      }
      const _orders = await _openbook.program.account.openOrdersAccount.all([
        { memcmp: { offset: 8, bytes: owner.toBase58() } },
        { memcmp: { offset: 40, bytes: new PublicKey(marketId).toBase58() } },
      ]);
      setOrders(
        _orders
          .sort((a, b) => (a.account.accountNum < b.account.accountNum ? 1 : -1)),
      );
    }, 1000),
    [_openbook, marketId],
  );

  useEffect(() => {
    if (wallet.publicKey) {
      fetchOpenOrders(wallet.publicKey);
    }
  }, [market, fetchOpenOrders]);

  useEffect(() => {
    if (!market) {
      fetchMarketInfo();
    }
  }, [market, fetchMarketInfo]);

  useEffect(() => {
    if (!eventHeapCount) {
      findEventHeapCount();
    }
  }, [market, findEventHeapCount]);

  const orderBookObject = useMemo(() => {
    const getSide = (side: LeafNode[], isBidSide?: boolean) => {
      if (side.length === 0) {
        return null;
      }
      const parsed = side
        .map((e) => ({
          // @ts-ignore
          price: priceLotsToUi(market?.market, e.key.shrn(64)),
          // @ts-ignore
          size: baseLotsToUi(market?.market, e.quantity),
        }))
        .sort((a, b) => a.price - b.price);

      const sorted = isBidSide
        ? parsed.sort((a, b) => b.price - a.price)
        : parsed.sort((a, b) => a.price - b.price);

      const deduped = new Map();
      sorted.forEach((order) => {
        if (deduped.get(order.price) === undefined) {
          deduped.set(order.price, order.size);
        } else {
          deduped.set(order.price, deduped.get(order.price) + order.size);
        }
      });

      const total = parsed.reduce((a, b) => ({
        price: a.price + b.price,
        size: a.size + b.size,
      }));
      return { parsed, total, deduped };
    };

    const orderBookSide = (orderBookForSide: LeafNode[], isBidSide?: boolean) => {
      if (orderBookForSide) {
        const _orderBookSide = getSide(orderBookForSide, isBidSide);
        if (_orderBookSide) {
          return Array.from(_orderBookSide.deduped?.entries()).map((side) => [
            (side[0]).toFixed(4),
            (side[1]).toFixed(4),
          ]);
        }
      }
      if (isBidSide) {
        return [[0, 0]];
      }
      return [[0, 0]];
    };

    const getToB = (bids: LeafNode[], asks: LeafNode[]) => {
      const _bids = orderBookSide(bids, true);
      const _asks = orderBookSide(asks);
      const tobAsk: number = Number(_asks[0][0]);
      const tobBid: number = Number(_bids[0][0]);
      return {
        topAsk: tobAsk,
        topBid: tobBid,
      };
    };

    const getSpreadString = (bids: LeafNode[], asks: LeafNode[]) => {
      const { topAsk, topBid } = getToB(bids, asks);
      const spread: number = topAsk - topBid;
      const spreadPercent: string = ((spread / topAsk) * 100).toFixed(2);

      return spread === topAsk
        ? '∞ (100.00%)'
        : `${spread.toFixed(2).toString()} (${spreadPercent}%)`;
    };

    if (market) {
      return {
        bidsProcessed: getSide(market.bids, true),
        asksProcessed: getSide(market.asks),
        bidsArray: orderBookSide(market.bids, true),
        asksArray: orderBookSide(market.asks),
        toB: getToB(market.bids, market.asks),
        spreadString: getSpreadString(market.bids, market.asks),
      };
    }
    return undefined;
  }, [market]);

  const placeOrder = useCallback(
    async (amount: number, price: number, limitOrder?: boolean, ask?: boolean) => {
      if (!marketId || !market) return;
      const _market = { publicKey: new PublicKey(marketId), account: market.market };
      const placeTxs = await placeOrderTransactions(
        amount,
        price,
        _market,
        limitOrder,
        ask,
      );

      if (!placeTxs || !wallet.publicKey) {
        return;
      }

      try {
        setLoading(true);

        await sender.send(placeTxs);
        await fetchMarketInfo();
        await fetchOpenOrders(wallet.publicKey);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [
      wallet,
      marketId,
      connection,
      sender,
      placeOrderTransactions,
      fetchMarketInfo,
      fetchOpenOrders,
    ],
  );

  const cancelAndSettleOrder = useCallback(
    async (order: OpenOrdersAccountWithKey) => {
      if (!marketId || !market || !order) return;

      const _market = { publicKey: new PublicKey(marketId), account: market.market };

      try {
        //settle it right away
        const cancelAndSettleTxs = await cancelAndSettleFundsTransactions(
          new BN(order.account.accountNum),
          _market,
        );

        if (!cancelAndSettleTxs) return;

        const txsSent = await sender.send([...cancelAndSettleTxs]);
        if (txsSent.length !== 0) {
          //update order in state
          const cancelledOrderIndex = orders.findIndex(
            (o) => o.account.accountNum === order.account.accountNum,
          );
          orders[cancelledOrderIndex].account.openOrders[0].isFree = 1;
          orders[cancelledOrderIndex].account.position.baseFreeNative = new BN(0);
          orders[cancelledOrderIndex].account.position.quoteFreeNative = new BN(0);
          const newOrders = [...orders];
          setOrders(newOrders);
        }
        return txsSent;
      } catch (err) {
        console.error(err);
      }
    },
    [market, marketId],
  );

  const memoValue = useMemo(
    () => ({
      market,
      marketPubkey,
      orders,
      orderBookObject,
      loading,
      fetchOpenOrders,
      fetchMarketInfo,
      placeOrder,
      cancelAndSettleOrder,
      eventHeapCount,
    }),
    [
      market,
      marketPubkey,
      orders,
      orderBookObject,
      loading,
      fetchOpenOrders,
      fetchMarketInfo,
      placeOrder,
      cancelAndSettleOrder,
      eventHeapCount,
    ],
  );

  return (
    <openbookMarketContext.Provider
      value={memoValue}
    >
      {children}
    </openbookMarketContext.Provider>
  );
}
