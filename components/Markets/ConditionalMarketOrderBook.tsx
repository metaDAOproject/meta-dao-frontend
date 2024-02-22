import { useEffect, useState } from 'react';
import { OrderBook } from '@lab49/react-order-book';
import { AnyNode, LeafNode, OpenbookV2, IDL as OPENBOOK_IDL, OPENBOOK_PROGRAM_ID } from '@openbook-dex/openbook-v2';
import { Program } from '@coral-xyz/anchor';
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
  const provider = useProvider();
  const proposal = useProposal();
  const [bids, setBids] = useState<any[][]>();
  const [asks, setAsks] = useState<any[][]>();
  const [spreadString, setSpreadString] = useState<string>();
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
    provider.connection.onAccountChange(
      market.asks,
      (updatedAccountInfo, ctx) => {
        try {
          const leafNodes = openBookProgram.coder.accounts.decode('bookSide', updatedAccountInfo.data);
          const leafNodesData = leafNodes.nodes.nodes.filter(
            (x: AnyNode) => x.tag === 2,
          );
          const _asks: {
            price: number;
            size: number;
          }[] = leafNodesData
            .map((x: any) => {
              const leafNode: LeafNode = openBookProgram.coder.types.decode(
                'LeafNode',
                Buffer.from([0, ...x.data]),
              );
              // const owner = leafNode.owner.toString();
              const size = leafNode.quantity.toNumber();
              const price = leafNode.key.shrn(64).toNumber() / 10_000;
              // console.log(`\x1b[31mAsk\x1b[0m on ${account.market} proposal ${account.proposalId} by ${owner} on slot ${ctx.slot} for ${size} @ $${price}`);
              return {
                price,
                size,
              };
            })
            .sort((
              a: { price: number, size: number },
              b: { price: number, size: number }) => a.price - b.price);

          const _aggreateAsks = new Map();
          _asks.forEach((order: { price: number, size: number }) => {
            if (_aggreateAsks.get(order.price) === undefined) {
              _aggreateAsks.set(order.price, order.size);
            } else {
              _aggreateAsks.set(order.price, _aggreateAsks.get(order.price) + order.size);
            }
          });
          let __asks: any[][];
          if (_aggreateAsks) {
            __asks = Array.from(_aggreateAsks.entries()).map((side) => [
              (side[0].toFixed(4)),
              side[1],
            ]);
          } else {
            return [[69, 0]];
          }
          console.log(ctx.slot);
          setAsks(__asks);
        } catch (err) {
          console.error(err);
        }
      },
      'processed'
    );
    provider.connection.onAccountChange(
      market.bids,
      (updatedAccountInfo, ctx) => {
        try {
          const leafNodes = openBookProgram.coder.accounts.decode('bookSide', updatedAccountInfo.data);
          const leafNodesData = leafNodes.nodes.nodes.filter(
            (x: AnyNode) => x.tag === 2,
          );
          const _bids: {
            price: number;
            size: number;
          }[] = leafNodesData
            .map((x: any) => {
              const leafNode: LeafNode = openBookProgram.coder.types.decode(
                'LeafNode',
                Buffer.from([0, ...x.data]),
              );
              // const owner = leafNode.owner.toString();
              const size = leafNode.quantity.toNumber();
              const price = leafNode.key.shrn(64).toNumber() / 10_000;
              // console.log(`\x1b[31mAsk\x1b[0m on ${account.market} proposal ${account.proposalId} by ${owner} on slot ${ctx.slot} for ${size} @ $${price}`);
              return {
                price,
                size,
              };
            })
            .sort((
              a: { price: number, size: number },
              b: { price: number, size: number }) => b.price - a.price);

          const _aggreateBids = new Map();
          _bids.forEach((order: { price: number, size: number }) => {
            if (_aggreateBids.get(order.price) === undefined) {
              _aggreateBids.set(order.price, order.size);
            } else {
              _aggreateBids.set(order.price, _aggreateBids.get(order.price) + order.size);
            }
          });
          let __bids: any[][];
          if (_aggreateBids) {
            __bids = Array.from(_aggreateBids.entries()).map((side) => [
              (side[0].toFixed(4)),
              side[1],
            ]);
          } else {
            return [[69, 0]];
          }
          console.log(ctx.slot);
          setBids(__bids);
        } catch (err) {
          console.error(err);
        }
      },
      'processed'
    );
    }
  };

  useEffect(() => {
    listenOrderBook();
  });
  return (
    <>
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
    </>
  );
}
