import { OrderBook } from '@lab49/react-order-book';
import { Card, Text, useMantineColorScheme } from '@mantine/core';
import { OrderBook as _OrderBook } from '@/lib/types';
import { useEffect, useRef } from 'react';

export function ConditionalMarketOrderBook({
  asks = [],
  bids = [],
  spreadString = '',
  lastSlotUpdated = 0,
  orderBookObject,
  setPriceFromOrderBook,
}: {
  asks: any[][];
  bids: any[][];
  spreadString: string;
  lastSlotUpdated: number;
  orderBookObject: _OrderBook;
  setPriceFromOrderBook: (price: number) => void;
}) {
  if (!orderBookObject) return null;
  const { colorScheme } = useMantineColorScheme();
  const orderBookRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const listItem = target.closest('.MakeItNice__list-item');
      if (listItem) {
        const priceElement = listItem.querySelector('.MakeItNice__price');
        if (priceElement) {
          const price = parseFloat(priceElement.textContent || '0');
          setPriceFromOrderBook(price);
        }
      }
    };

    const orderBookElement = orderBookRef.current;
    if (orderBookElement) {
      orderBookElement.addEventListener('click', handleClick);
    }

    return () => {
      if (orderBookElement) {
        orderBookElement.removeEventListener('click', handleClick);
      }
    };
  }, [setPriceFromOrderBook]);

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
        <div ref={orderBookRef}>
          <OrderBook
            book={{
              bids: bids.length ? bids : [[0, 0]],
              asks: asks.length ? asks : [[Number.MAX_SAFE_INTEGER, 0]],
            }}
            fullOpacity
            spread={spreadString}
            interpolateColor={(color) => color}
            listLength={5}
            stylePrefix="MakeItNice"
          />
        </div>
      </Card>
      {lastSlotUpdated !== 0 ? (
        <Text size="xs">Book last updated {lastSlotUpdated} (slot)</Text>
      ) : (
        <Text> </Text>
      )}
    </>
  );
}
