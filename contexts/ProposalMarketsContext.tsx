import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountInfo, Context, PublicKey } from '@solana/web3.js';
import {
  MarketAccountWithKey,
  Markets,
  OpenOrdersAccountWithKey,
  OrderBook,
  Proposal,
  ProposalAccountWithKey,
} from '@/lib/types';
import { useAutocrat } from '@/contexts/AutocratContext';
import { useConditionalVault } from '@/hooks/useConditionalVault';
import { useOpenbookTwap } from '@/hooks/useOpenbookTwap';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { getLeafNodes } from '../lib/openbook';
import { debounce } from '../lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { BN, Program } from '@coral-xyz/anchor';
import { AnyNode, LeafNode, OpenbookV2, IDL as OPENBOOK_IDL, OPENBOOK_PROGRAM_ID, MarketAccount } from '@openbook-dex/openbook-v2';
import { useProvider } from '@/hooks/useProvider';

export interface ProposalInterface {
  markets?: Markets;
  orders?: OpenOrdersAccountWithKey[];
  passAsks?: any[][];
  passBids?: any[][];
  failAsks?: any[][];
  failBids?: any[][];
  orderBookObject?: OrderBook;
  loading?: boolean;
  passSpreadString: string;
  failSpreadString: string;
  lastPassSlotUpdated: number;
  lastFailSlotUpdated: number;
  fetchOpenOrders: (owner: PublicKey) => Promise<void>;
  fetchMarketsInfo: () => Promise<void>;
  placeOrderTransactions: (
    amount: number,
    price: number,
    market: MarketAccountWithKey,
    limitOrder?: boolean | undefined,
    ask?: boolean | undefined,
    pass?: boolean | undefined,
    indexOffset?: number | undefined,
  ) => Promise<any>;
  placeOrder: (
    amount: number,
    price: number,
    limitOrder?: boolean,
    ask?: boolean,
    pass?: boolean,
  ) => Promise<void>;
  cancelOrder: (order: OpenOrdersAccountWithKey, marketKey: PublicKey) => Promise<void>;
}

export const ProposalMarketsContext = createContext<ProposalInterface | undefined>(undefined);

export const useProposalMarkets = () => {
  const context = useContext(ProposalMarketsContext);
  if (!context) {
    throw new Error('useProposalMarkets must be used within a ProposalMarketsContextProvider');
  }
  return context;
};



export function ProposalMarketsProvider({
  children,
  proposalNumber,
  fromProposal,
}: {
  children: React.ReactNode;
  proposalNumber?: number | undefined;
  fromProposal?: ProposalAccountWithKey;
}) {
  const provider = useProvider();
  const openBookProgram = new Program<OpenbookV2>(OPENBOOK_IDL, OPENBOOK_PROGRAM_ID, provider);
  const client = useQueryClient();
  const { openbook, openbookTwap, proposals } =
    useAutocrat();
  const { connection } = useConnection();
  const wallet = useWallet();
  const sender = useTransactionSender();
  const { placeOrderTransactions, settleFundsTransactions,
    cancelOrderTransactions } = useOpenbookTwap();
  const {
    program: vaultProgram,
  } = useConditionalVault();
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<Markets>();
  const [orders, setOrders] = useState<OpenOrdersAccountWithKey[]>([]);
  const [passBids, setPassBids] = useState<any[][]>([]);
  const [passAsks, setPassAsks] = useState<any[][]>([]);
  const [failBids, setFailBids] = useState<any[][]>([]);
  const [failAsks, setFailAsks] = useState<any[][]>([]);
  const [passSpreadString, setPassSpreadString] = useState<string>("");
  const [failSpreadString, setFailSpreadString] = useState<string>("");
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastPassSlotUpdated, setLastPassSlotUpdated] = useState<number>(0);
  const [lastFailSlotUpdated, setLastFailSlotUpdated] = useState<number>(0);

  const proposal = useMemo<Proposal | undefined>(
    () =>
      proposals?.filter(
        (t) =>
          t.account.number === proposalNumber ||
          t.publicKey.toString() === fromProposal?.publicKey.toString(),
      )[0],
    [proposals, fromProposal, proposalNumber],
  );

  const fetchMarketsInfo = useCallback(
    debounce(async () => {
      const fetchProposalMarketsInfo = async () => {
        setLoading(true);
        if (!proposal || !openbook || !openbookTwap || !openbookTwap.views || !connection) {
          return;
        }
        const accountInfos = await connection.getMultipleAccountsInfo([
          proposal.account.openbookPassMarket,
          proposal.account.openbookFailMarket,
          proposal.account.openbookTwapPassMarket,
          proposal.account.openbookTwapFailMarket,
          proposal.account.baseVault,
          proposal.account.quoteVault,
        ]);
        if (!accountInfos || accountInfos.indexOf(null) >= 0) return;

        const pass = await openbook.coder.accounts.decode('market', accountInfos[0]!.data);
        const fail = await openbook.coder.accounts.decode('market', accountInfos[1]!.data);
        const passTwap = await openbookTwap.coder.accounts.decodeUnchecked(
          'TWAPMarket',
          accountInfos[2]!.data,
        );
        const failTwap = await openbookTwap.coder.accounts.decodeUnchecked(
          'TWAPMarket',
          accountInfos[3]!.data,
        );
        const baseVault = await vaultProgram.coder.accounts.decode(
          'conditionalVault',
          accountInfos[4]!.data,
        );
        const quoteVault = await vaultProgram.coder.accounts.decode(
          'conditionalVault',
          accountInfos[5]!.data,
        );

        const bookAccountInfos = await connection.getMultipleAccountsInfo([
          pass.asks,
          pass.bids,
          fail.asks,
          fail.bids,
        ]);
        const passAsks = getLeafNodes(
          await openbook.coder.accounts.decode('bookSide', bookAccountInfos[0]!.data),
          openbook,
        );
        const passBids = getLeafNodes(
          await openbook.coder.accounts.decode('bookSide', bookAccountInfos[1]!.data),
          openbook,
        );
        const failAsks = getLeafNodes(
          await openbook.coder.accounts.decode('bookSide', bookAccountInfos[2]!.data),
          openbook,
        );
        const failBids = getLeafNodes(
          await openbook.coder.accounts.decode('bookSide', bookAccountInfos[3]!.data),
          openbook,
        );

        return {
          pass,
          passAsks,
          passBids,
          fail,
          failAsks,
          failBids,
          passTwap,
          failTwap,
          baseVault,
          quoteVault,
        };
      };

      const marketsInfo = await client.fetchQuery({
        queryKey: [`fetchProposalMarketsInfo-${proposal?.publicKey}`],
        queryFn: () => fetchProposalMarketsInfo(),
        staleTime: 10_000,
      });
      setMarkets(marketsInfo);
      setLoading(false);
    }, 1000),
    [vaultProgram, openbook, openbookTwap, proposal, connection],
  );

  useEffect(() => {
    setMarkets(undefined);
    fetchMarketsInfo();
  }, [proposal]);

  const fetchOpenOrders = useCallback(async (owner: PublicKey) => {
    const fetchProposalOpenOrders = async () => {
      if (!openbook || !proposal) {
        return;
      }
      const passOrders = await openbook.account.openOrdersAccount.all([
        { memcmp: { offset: 8, bytes: owner.toBase58() } },
        { memcmp: { offset: 40, bytes: proposal.account.openbookPassMarket.toBase58() } },
      ]);
      const failOrders = await openbook.account.openOrdersAccount.all([
        { memcmp: { offset: 8, bytes: owner.toBase58() } },
        { memcmp: { offset: 40, bytes: proposal.account.openbookFailMarket.toBase58() } },
      ]);
      return passOrders
        .concat(failOrders)
        .sort((a, b) => (a.account.accountNum < b.account.accountNum ? 1 : -1));
    };

    const orders = await client.fetchQuery({
      queryKey: [`fetchProposalOpenOrders-${proposal?.publicKey}`],
      queryFn: () => fetchProposalOpenOrders(),
      staleTime: 1_000,
    });
    setOrders(orders ?? []);
  }, [openbook, proposal]);

  useEffect(() => {
    if (proposal && wallet.publicKey) {
      fetchOpenOrders(wallet.publicKey);
    }
  }, [markets, fetchOpenOrders, proposal]);

  useEffect(() => {
    if (!markets && proposal) {
      fetchMarketsInfo();
    }
  }, [markets, fetchMarketsInfo, proposal]);

  const orderBookObject = useMemo(() => {
    const getSide = (side: LeafNode[], isBidSide?: boolean) => {
      if (side.length === 0) {
        return null;
      }
      const parsed = side
        .map((e) => ({
          price: e.key.shrn(64).toNumber(),
          size: e.quantity.toNumber(),
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
            (side[0] / 10_000).toFixed(4),
            side[1],
          ]);
        }
      }
      if (isBidSide) {
        return [[0, 0]];
      }
      return [[69, 0]];
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
      const spreadPercent: string = ((spread / topBid) * 100).toFixed(2);

      return spread === topAsk
        ? '∞ (100.00%)'
        : `${spread.toFixed(2).toString()} (${spreadPercent}%)`;
    };

    if (markets) {
      return {
        passBidsProcessed: getSide(markets.passBids, true),
        passAsksProcessed: getSide(markets.passAsks),
        passBidsArray: orderBookSide(markets.passBids, true),
        passAsksArray: orderBookSide(markets.passAsks),
        failBidsProcessed: getSide(markets.failBids, true),
        failAsksProcessed: getSide(markets.failAsks),
        failBidsArray: orderBookSide(markets.failBids, true),
        failAsksArray: orderBookSide(markets.failAsks),
        passToB: getToB(markets.passBids, markets.passAsks),
        failToB: getToB(markets.failBids, markets.failAsks),
        passSpreadString: getSpreadString(markets.passBids, markets.passAsks),
        failSpreadString: getSpreadString(markets.failBids, markets.failAsks),
      };
    }
    return undefined;
  }, [markets]);

  const placeOrder = useCallback(
    async (amount: number, price: number, limitOrder?: boolean, ask?: boolean, pass?: boolean) => {
      if (!proposal || !markets) return;
      const market = pass
        ? { publicKey: proposal?.account.openbookPassMarket, account: markets?.pass }
        : { publicKey: proposal?.account.openbookFailMarket, account: markets?.fail };
      const placeTxs = await placeOrderTransactions(amount, price, market, limitOrder, ask, pass);

      if (!placeTxs || !wallet.publicKey) {
        return;
      }

      try {
        setLoading(true);

        await sender.send(placeTxs);
        await fetchMarketsInfo();
        await fetchOpenOrders(wallet.publicKey);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [
      wallet,
      proposal,
      markets,
      connection,
      sender,
      placeOrderTransactions,
      fetchMarketsInfo,
      fetchOpenOrders,
    ],
  );

  /**
   * `consumeOrderBookSide` is our reactive consumer of OpenBook WS updates that will populate our proposal market's 
   * orderbook state for ask and bid sides. We will also use this to update the user orders(soon).
   * 
   */
  const consumeOrderBookSide = (
    side: string,
    updatedAccountInfo: AccountInfo<Buffer>,
    market: PublicKey,
    ctx: Context,
  ): number[][] | undefined => {
    try {
      const isPassMarket = market == proposal?.account.openbookPassMarket;
      const leafNodes = openBookProgram.coder.accounts.decode('bookSide', updatedAccountInfo.data);
      const leafNodesData: AnyNode[] = leafNodes.nodes.nodes.filter(
        (x: AnyNode) => x.tag === 2,
      );

      const _side = leafNodesData
        .map((x) => {
          const leafNode: LeafNode = openBookProgram.coder.types.decode(
            'LeafNode',
            Buffer.from([0, ...x.data]),
          );
          const size = leafNode.quantity.toNumber();
          const price = leafNode.key.shrn(64).toNumber() / 10_000;
          return {
            price,
            size,
            market: market,
            owner: leafNode.owner,
            ownerSlot: leafNode.ownerSlot,
            side: side === "asks" ? "asks" : "bids",
            timestamp: leafNode.timestamp,
            clientOrderId: leafNode.clientOrderId,
          };
        });

      let sortedSide;

      if (side === 'asks') {
        // Ask side sort
        sortedSide = _side.sort((
          a: { price: number, size: number; },
          b: { price: number, size: number; }) => a.price - b.price);
      } else {
        // Bid side sort
        sortedSide = _side.sort((
          a: { price: number, size: number; },
          b: { price: number, size: number; }) => b.price - a.price);
      }

      // Aggregate the price levels into sum(size)
      const _aggreateSide = new Map();
      sortedSide.forEach((order: { price: number, size: number; }) => {
        if (_aggreateSide.get(order.price) === undefined) {
          _aggreateSide.set(order.price, order.size);
        } else {
          _aggreateSide.set(order.price, _aggreateSide.get(order.price) + order.size);
        }
      });
      // Construct array for our orderbook system
      let __side: any[][];
      if (_aggreateSide) {
        __side = Array.from(_aggreateSide.entries()).map((_side_) => [
          (_side_[0].toFixed(4)),
          _side_[1],
        ]);
      } else {
        // Return default values of 0
        return [[0, 0]];
      }
      // Update our values for the orderbook and order list
      if (isPassMarket) {
        if (side === 'asks') {
          setPassAsks(__side);
        } else {
          setPassBids(__side);
        }
        setLastPassSlotUpdated(ctx.slot);
      } else {
        if (side === 'asks') {
          setFailAsks(__side);
        } else {
          setFailBids(__side);
        }
        setLastFailSlotUpdated(ctx.slot);
      }

      // Check that we have books

      let tobAsk: number;
      let tobBid: number;

      // Get top of books
      if (side === 'asks') {
        tobAsk = Number(__side[0][0]);
        // @ts-ignore
        tobBid = Number(bids[0][0]);
      } else {
        // @ts-ignore
        tobAsk = Number(asks[0][0]);
        tobBid = Number(__side[0][0]);
      }
      // Calculate spread
      const spread: number = Math.abs(tobAsk - tobBid);
      // Calculate spread percent
      const spreadPercent: string = ((spread / tobBid) * 100).toFixed(2);
      let _spreadString: string;
      // Create our string for output into the orderbook object
      if (spread === tobAsk) {
        _spreadString = '∞';
      } else {
        _spreadString = `${spread.toFixed(2).toString()} (${spreadPercent}%)`;
      }
      if (isPassMarket) {
        setPassSpreadString(
          (curSpreadString) => curSpreadString === _spreadString ? curSpreadString : _spreadString
        );
      } else {
        setFailSpreadString(
          (curSpreadString) => curSpreadString === _spreadString ? curSpreadString : _spreadString
        );
      }

      setWsConnected((curConnected) => curConnected === false);
    } catch (err) {
      // console.error(err);
      // TODO: Add in call to analytics / reporting
    }
  };

  // this is our initial fetching of orderbook data to set the order book state on page load
  // subsequent updates are handled by the WS
  useEffect(() => {
    if (passBids.length === 0 && !!orderBookObject?.passBidsArray) {
      setPassBids(orderBookObject.passBidsArray);
    }
    if (failBids.length === 0 && !!orderBookObject?.failBidsArray?.length) {
      setFailBids(orderBookObject.failBidsArray);
    }
    if (passAsks.length === 0 && !!orderBookObject?.passAsksArray?.length) {
      setPassAsks(orderBookObject.passAsksArray);
    }
    if (failAsks.length === 0 && !!orderBookObject?.failAsksArray?.length) {
      setFailAsks(orderBookObject.failAsksArray);
    }

    if (!passSpreadString && !!orderBookObject?.passSpreadString) {
      setPassSpreadString(orderBookObject.passSpreadString);
    }
    if (!failSpreadString && !!orderBookObject?.failSpreadString) {
      setFailSpreadString(orderBookObject.failSpreadString);
    }
  }, [orderBookObject]);

  const listenOrderBooks = async () => {
    if (!proposal) return;

    let markets = [proposal?.account.openbookFailMarket, proposal?.account.openbookPassMarket];

    // Setup for pass and fail markets
    // bubble down what the market is you are getting the update for
    markets.forEach(async (market: PublicKey) => {
      if (!wsConnected) {
        // Fetch via RPC for the openbook market
        const _market = await openBookProgram.account.market.fetch(
          market
        );
        const sides = [
          {
            pubKey: _market.asks,
            side: 'asks',
          },
          {
            pubKey: _market.bids,
            side: 'bids',
          },
        ];
        // Setup Websocket subscription for the two sides
        try {
          const subscriptionId = sides.map((side) => provider.connection.onAccountChange(
            side.pubKey,
            (updatedAccountInfo, ctx) => {
              consumeOrderBookSide(side.side, updatedAccountInfo, market, ctx);
            },
            'processed'
          )
          );
          return subscriptionId;
        } catch (err) {
          setWsConnected(false);
        }
      }
      // For map handling
      return null;
    });
  };

  const cancelOrder = useCallback(async (order: OpenOrdersAccountWithKey, marketAddress: PublicKey) => {
    if (!proposal || !markets) return;

    const isPassMarket = marketAddress === proposal?.account.openbookPassMarket;
    const marketAccount = isPassMarket
      ? { publicKey: proposal.account.openbookPassMarket, account: markets.pass }
      : { publicKey: proposal.account.openbookFailMarket, account: markets.fail };

    try {
      const txs = await cancelOrderTransactions(
        new BN(order.account.accountNum),
        marketAccount,
      );
      //settle it right away
      const settleTxs = await settleFundsTransactions(
        order.account.accountNum,
        isPassMarket,
        proposal,
        marketAccount
      );

      if (!txs || !settleTxs) return;

      const txsSent = await sender.send([...txs, ...settleTxs]);
      if (txsSent.length !== 0) {
        //update order in state
        const cancelledOrderIndex = orders.findIndex(o => o.account.accountNum == order.account.accountNum);
        orders[cancelledOrderIndex].account.openOrders[0].isFree = 1;
        orders[cancelledOrderIndex].account.position.baseFreeNative = new BN(0);
        orders[cancelledOrderIndex].account.position.quoteFreeNative = new BN(0);
        const newOrders = [...orders];
        setOrders(newOrders);
      }
    } catch (err) {
      console.error(err);
    }
  }, [markets, proposal]);

  useEffect(() => {
    if (!wsConnected && proposal) {
      // connect for both pass and fail market order books
      listenOrderBooks();
    }
  }, [wsConnected, !!proposal]);
  useEffect(() => {
    fetchMarketsInfo();
  }, [proposal]);

  const memoValue = useMemo(() => {
    return {
      markets,
      orders,
      orderBookObject,
      loading,
      passAsks,
      passBids,
      failAsks,
      failBids,
      lastPassSlotUpdated,
      lastFailSlotUpdated,
      passSpreadString,
      failSpreadString,
      fetchOpenOrders,
      fetchMarketsInfo,
      placeOrderTransactions,
      placeOrder,
      cancelOrder,
    };
  }, [markets, orders, loading, passAsks.length, passBids.length, failAsks.length, failBids.length, passSpreadString, failSpreadString]);

  return (
    <ProposalMarketsContext.Provider
      value={memoValue}
    >
      {children}
    </ProposalMarketsContext.Provider>
  );
}