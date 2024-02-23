import { useEffect, useState } from 'react';
import { OrderBook } from '@lab49/react-order-book';
import { AnyNode, LeafNode, OpenbookV2, IDL as OPENBOOK_IDL, OPENBOOK_PROGRAM_ID } from '@openbook-dex/openbook-v2';
import { Program } from '@coral-xyz/anchor';
import { Card, Text, useMantineColorScheme } from '@mantine/core';
import { OrderBook as _OrderBook } from '@/lib/types';
import { useProvider } from '@/hooks/useProvider';
import { useProposal } from '@/contexts/ProposalContext';

export function ConditionalMarketOrderBook({
  isPassMarket,
  orderBookObject,
  setPriceFromOrderBook,
}: {
  isPassMarket: boolean;
  orderBookObject: _OrderBook;
  setPriceFromOrderBook: (price: string) => void;
}) {
  if (!orderBookObject) return null;
  const { colorScheme } = useMantineColorScheme();
  const provider = useProvider();
  const proposal = useProposal();
  const [bids, setBids] = useState<any[][]>();
  const [asks, setAsks] = useState<any[][]>();
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [spreadString, setSpreadString] = useState<string>();
  const [lastSlotUpdated, setLastSlotUpdated] = useState<number>(0);

  // On initialization
  if (isPassMarket) {
    if (!bids) {
      setBids(orderBookObject.passBidsArray);
    }
    if (!asks) {
      setAsks(orderBookObject.passAsksArray);
    }
    if (!spreadString) {
      setSpreadString(orderBookObject.passSpreadString);
    }
  } else {
    if (!bids) {
      setBids(orderBookObject.failBidsArray);
    }
    if (!asks) {
      setAsks(orderBookObject.failAsksArray);
    }
    if (!spreadString) {
      setSpreadString(orderBookObject.failSpreadString);
    }
  }

  const listenOrderBook = async () => {
    const openBookProgram = new Program<OpenbookV2>(OPENBOOK_IDL, OPENBOOK_PROGRAM_ID, provider);

    if (!proposal.proposal) return;
    // Setup for pass and fail markets
    for (let i = 0; i < 1; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      let market = await openBookProgram.account.market.fetch(
        proposal.proposal?.account.openbookFailMarket
      );
      if (i === 1) {
        // eslint-disable-next-line no-await-in-loop
        market = await openBookProgram.account.market.fetch(
          proposal.proposal?.account.openbookPassMarket
        );
      }
      if (!wsConnected) {
        const markets = [
          {
            pubKey: market.asks,
            side: 'asks',
          },
          {
            pubKey: market.bids,
            side: 'bids',
          },
        ];
        // Setup Websocket subscription for the two sides
        try {
          markets.map((side) => provider.connection.onAccountChange(
              side.pubKey,
              (updatedAccountInfo, ctx) => {
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

                  if (side.side === 'asks') {
                    // Ask side sort
                    sortedSide = _side.sort((
                      a: { price: number, size: number },
                      b: { price: number, size: number }) => a.price - b.price);
                  } else {
                    // Bid side sort
                    sortedSide = _side.sort((
                      a: { price: number, size: number },
                      b: { price: number, size: number }) => b.price - a.price);
                  }

                  // Aggregate the price levels into sum(size)
                  const _aggreateSide = new Map();
                  sortedSide.forEach((order: { price: number, size: number }) => {
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
                  if (side.side === 'asks') {
                    setAsks(__side);
                  } else {
                    setBids(__side);
                  }
                  setLastSlotUpdated(ctx.slot);
                  // Check that we have books

                  let tobAsk: number;
                  let tobBid: number;

                  // Get top of books
                  if (side.side === 'asks') {
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
                  setSpreadString(_spreadString);

                  setWsConnected(true);
                } catch (err) {
                  // console.error(err);
                  // TODO: Add in call to analytics / reporting
                }
              },
              'processed'
            )
          );
        } catch (err) {
          setWsConnected(false);
        }
      }
    }
  };

  useEffect(() => {
    if (!wsConnected) {
      listenOrderBook();
    }
  }, [wsConnected]);
  return (
    <>
      <Card withBorder bg={colorScheme === 'dark' ? '' : '#F9F9F9'}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          .MakeItNice {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 15px;
            font-variant-numeric: tabular-nums;
            width: 100%;
            display: inline-block;
          }
          .MakeItNice__side--bids, .MakeItNice__side--asks {
            min-height:130px;
            width: 100%;
            display: flex;
          }

          .MakeItNice__side--bids ol, .MakeItNice__side--asks ol {
            width: 100%;
          }

          .MakeItNice__list {
            list-style-type: none;
            padding: 0;
            margin: 0;
          }

          .MakeItNice__list-item {
            cursor: pointer;
            padding: 1px 20px 1px 20px;
            display: flex;
          }

          .MakeItNice__list-item:hover {
            background: rgba(200, 200, 200, 0.2);
          }

          .MakeItNice__list-item span {
            flex: 1;
          }

          .MakeItNice__price {
            flex: 0 0 70px;
            color: var(--row-color);
            text-align: right;
            display: inline-block;
            margin-right: 15px;
          }

          .MakeItNice__size {
            flex: 0 0 70px;
          }

          .MakeItNice__spread {
            border-width: 1px 0;
            border-style: solid;
            border-color: rgba(150, 150, 150, 0.2);
            padding: 5px 20px;
            text-align: center;
            display: flex;
          }


          .MakeItNice__spread-header {
            margin: 0 15px 0 0;
            flex: 0 0 70px;
            text-align: right;
            flex: 1;
          }

          .MakeItNice__spread-value {
            width: 100%;
            text-align: left;
            overflow: hidden;
            flex: 1;
          }
        `,
          }}
        />
        <OrderBook
          book={{
            bids: bids || [[0, 0]],
            asks: asks || [[Number.MAX_SAFE_INTEGER, 0]],
          }}
          fullOpacity
          onClickFunction={setPriceFromOrderBook}
          spread={spreadString}
          interpolateColor={(color) => color}
          listLength={5}
          stylePrefix="MakeItNice"
        />
      </Card>
      <Text size="xs">Streaming books last updated {lastSlotUpdated}</Text>
    </>
  );
}
