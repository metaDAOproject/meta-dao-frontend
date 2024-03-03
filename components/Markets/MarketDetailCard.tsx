import { useState } from 'react';
import {
  Text,
  Group,
  Loader,
  Title,
  Stack,
  Card,
  Divider,
} from '@mantine/core';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { useOpenBookMarket } from '@/contexts/OpenBookMarketContext';
import { OrderBookCard } from '../OrderBook/OrderBookCard';
import { OrderConfigurationCard } from '../OrderBook/OrderConfigurationCard';
import DisableNumberInputScroll from '../Utilities/DisableNumberInputScroll';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { shortKey } from '@/lib/utils';
import { MarketOrdersCard } from './MarketOrdersCard';

export function MarketDetailCard() {
  const openBookMarket = useOpenBookMarket();
  const { generateExplorerLink } = useExplorerConfiguration();
  const [price, setPrice] = useState<string>('');

  const setPriceFromOrderBook = (value: string) => {
    setPrice(value);
  };

  return openBookMarket.loading || !openBookMarket.market ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <>
      <Text>
        {utf8.decode(new Uint8Array(openBookMarket.market.market.name)).split('\x00')[0]}
      </Text>
      <Group>
        <Stack>
          <Title order={2}>Base</Title>
          <Text>Mint:
            <a
              href={generateExplorerLink(openBookMarket.market.market.baseMint.toString(), 'account')}
            >
              {shortKey(openBookMarket.market.market.baseMint.toString())}
            </a>
          </Text>
          <Text>Decimals: {openBookMarket.market.market.baseDecimals.toString()}</Text>
          <Text>Lot Size: {openBookMarket.market.market.baseLotSize.toString()}</Text>
          <Text>Deposit Total: {openBookMarket.market.market.baseDepositTotal.toString()}</Text>
          <Text>Market Vault:
            <a
              href={generateExplorerLink(openBookMarket.market.market.marketBaseVault.toString(), 'account')}
            >
              {shortKey(openBookMarket.market.market.marketBaseVault.toString())}
            </a>
          </Text>
        </Stack>
        <Divider orientation="vertical" p={10} />
        <Stack>
          <Title order={2}>Quote</Title>
          <Text> Mint:
            <a
              href={generateExplorerLink(openBookMarket.market.market.quoteMint.toString(), 'account')}
            >
              {shortKey(openBookMarket.market.market.quoteMint.toString())}
            </a>
          </Text>
          <Text>Decimals: {openBookMarket.market.market.quoteDecimals.toString()}</Text>
          <Text>Lot Size: {openBookMarket.market.market.quoteLotSize.toString()}</Text>
          <Text>Deposit Total: {openBookMarket.market.market.quoteDepositTotal.toString()}</Text>
          <Text>Market Vault:
            <a
              href={generateExplorerLink(openBookMarket.market.market.marketQuoteVault.toString(), 'account')}
            >
              {shortKey(openBookMarket.market.market.marketQuoteVault.toString())}
            </a>
          </Text>
        </Stack>
      </Group>
      <Divider p={10} />
      <Stack>
        <Text>Event Heap Account:
          <a
            href={generateExplorerLink(openBookMarket.market.market.eventHeap.toString(), 'account')}
          >
            {shortKey(openBookMarket.market.market.eventHeap.toString())}
          </a>
        </Text>
        <Text>Taker Fee: {openBookMarket.market.market.takerFee.toString()}</Text>
        <Text>Maker Fee: {openBookMarket.market.market.makerFee.toString()}</Text>
      </Stack>
      <Group>
      <Text>Event Heap Size: {openBookMarket.eventHeapCount}</Text>
      </Group>
      <Card>
        <DisableNumberInputScroll />
        <OrderBookCard
          orderBookObject={openBookMarket.orderBookObject}
          setPriceFromOrderBook={setPriceFromOrderBook}
          market={openBookMarket.market}
        />
        <OrderConfigurationCard
          orderBookObject={openBookMarket.orderBookObject}
          market={openBookMarket.market}
          setPrice={setPrice}
          price={price}
        />
      </Card>
      <MarketOrdersCard
        market={openBookMarket.market}
      />
    </>
  );
}
