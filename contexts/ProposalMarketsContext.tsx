import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountInfo, AccountMeta, Context, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { notifications } from '@mantine/notifications';
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
import { Program } from '@coral-xyz/anchor';
import { AnyNode, LeafNode, OpenbookV2, IDL as OPENBOOK_IDL, OPENBOOK_PROGRAM_ID } from '@openbook-dex/openbook-v2';
import { useProvider } from '@/hooks/useProvider';

export interface ProposalInterface {
    markets?: Markets;
    orders?: OpenOrdersAccountWithKey[];
    orderBookObject?: OrderBook;
    loading?: boolean;
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
    const { placeOrderTransactions } = useOpenbookTwap();
    const {
        program: vaultProgram,
    } = useConditionalVault();
    const [loading, setLoading] = useState(false);
    const [markets, setMarkets] = useState<Markets>();
    const [orders, setOrders] = useState<OpenOrdersAccountWithKey[]>([]);
    const [bids, setBids] = useState<any[][]>();
    const [asks, setAsks] = useState<any[][]>();
    const [wsConnected, setWsConnected] = useState<boolean>(false);
    const [spreadString, setSpreadString] = useState<string>();
    const [lastSlotUpdated, setLastSlotUpdated] = useState<number>();
    const isPassMarket = true;

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

    const fetchOpenOrders = useCallback(
        debounce<[PublicKey]>(async (owner: PublicKey) => {
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
        }, 1000),
        [openbook, proposal],
    );

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


    const consumeOrderBookSide = (
        side: string,
        updatedAccountInfo: AccountInfo<Buffer>,
        ctx: Context
    ) => {
        try {
            const leafNodes = openBookProgram.coder.accounts.decode('bookSide', updatedAccountInfo.data);
            const leafNodesData = leafNodes.nodes.nodes.filter(
                (x: AnyNode) => x.tag === 2,
            );
            const _side: {
                price: number;
                size: number;
            }[] = leafNodesData
                .map((x: any) => {
                    const leafNode: LeafNode = openBookProgram.coder.types.decode(
                        'LeafNode',
                        Buffer.from([0, ...x.data]),
                    );
                    const size = leafNode.quantity.toNumber();
                    const price = leafNode.key.shrn(64).toNumber() / 10_000;
                    return {
                        price,
                        size,
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
            // Update our values for the orderbook
            if (side === 'asks') {
                setAsks(__side);
            } else {
                setBids(__side);
            }
            setLastSlotUpdated(ctx.slot);
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
            const spread: number = tobAsk - tobBid;
            // Calculate spread percent
            const spreadPercent: string = ((spread / tobBid) * 100).toFixed(2);
            let _spreadString: string;
            // Create our string for output into the orderbook object
            if (spread === tobAsk) {
                _spreadString = '∞';
            } else {
                _spreadString = `${spread.toFixed(2).toString()} (${spreadPercent}%)`;
            }
            setSpreadString(
                (curSpreadString) => curSpreadString === _spreadString ? curSpreadString : _spreadString
            );

            setWsConnected((curConnected) => curConnected === false);
        } catch (err) {
            // console.error(err);
            // TODO: Add in call to analytics / reporting
        }
    };

    useEffect(() => {
        if (isPassMarket) {
            if (!bids) {
                setBids(orderBookObject?.passBidsArray);
            }
            if (!asks) {
                setAsks(orderBookObject?.passAsksArray);
            }
            if (!spreadString) {
                setSpreadString(orderBookObject?.passSpreadString);
            }
        } else {
            if (!bids) {
                setBids(orderBookObject?.failBidsArray);
            }
            if (!asks) {
                setAsks(orderBookObject?.failAsksArray);
            }
            if (!spreadString) {
                setSpreadString(orderBookObject?.failSpreadString);
            }
        }
    });

    const listenOrderBook = async () => {
        if (!proposal) return;

        let markets = [];

        if (!isPassMarket) {
            markets = [proposal?.account.openbookFailMarket];
        } else {
            markets = [proposal?.account.openbookPassMarket];
        }

        // Setup for pass and fail markets
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
                            consumeOrderBookSide(side.side, updatedAccountInfo, ctx);
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

    useEffect(() => {
        if (!wsConnected) {
            listenOrderBook();
        }
    }, [wsConnected]);
    useEffect(() => {
        fetchMarketsInfo();
    }, [proposal]);

    const memoValue = useMemo(() => {
        return {
            markets,
            orders,
            orderBookObject,
            loading,
            fetchOpenOrders,
            fetchMarketsInfo,
            placeOrderTransactions,
            placeOrder,
        };
    }, [orders.length, loading]);

    return (
        <ProposalMarketsContext.Provider
            value={memoValue}
        >
            {children}
        </ProposalMarketsContext.Provider>
    );
}