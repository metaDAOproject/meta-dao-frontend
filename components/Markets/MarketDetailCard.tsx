import { useState } from 'react';
import {
  Text,
  Group,
  Loader,
  Title,
  Stack,
  Card,
} from '@mantine/core';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { useOpenBookMarket } from '@/contexts/OpenBookMarketContext';
import { OrderBookCard } from '../OrderBook/OrderBookCard';
import { OrderConfigurationCard } from '../OrderBook/OrderConfigurationCard';

export function MarketDetailCard() {
  const openBookMarket = useOpenBookMarket();
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
        <Stack>
          <Title order={2}>Base</Title>
          <Text>Mint: {openBookMarket.market.market.baseMint.toString()}</Text>
          <Text>Decimals: {openBookMarket.market.market.baseDecimals.toString()}</Text>
          <Text>Lot Size: {openBookMarket.market.market.baseLotSize.toString()}</Text>
          <Text>Deposit Total: {openBookMarket.market.market.baseDepositTotal.toString()}</Text>
          <Text>Market Vault: {openBookMarket.market.market.marketBaseVault.toString()}</Text>
        </Stack>
        <Stack>
          <Title order={2}>Quote</Title>
          <Text> Mint: {openBookMarket.market.market.quoteMint.toString()}</Text>
          <Text>Decimals: {openBookMarket.market.market.quoteDecimals.toString()}</Text>
          <Text>Lot Size: {openBookMarket.market.market.quoteLotSize.toString()}</Text>
          <Text>Deposit Total: {openBookMarket.market.market.quoteDepositTotal.toString()}</Text>
          <Text>Market Vault: {openBookMarket.market.market.marketQuoteVault.toString()}</Text>
        </Stack>
        <Stack>
          <Text>Event Heap Account: {openBookMarket.market.market.eventHeap.toString()}</Text>
          <Text>Taker Fee: {openBookMarket.market.market.takerFee.toString()}</Text>
          <Text>Maker Fee: {openBookMarket.market.market.makerFee.toString()}</Text>
          <Text>OracleA: {openBookMarket.market.market.oracleA.key.toString()}</Text>
          <Text>OracleB: {openBookMarket.market.market.oracleB.key.toString()}</Text>
        </Stack>
        <Group>
        <Text>Event Heap Size: {openBookMarket.eventHeapCount}</Text>
        </Group>
        <Card>
          <OrderBookCard
            orderBookObject={openBookMarket.orderBookObject}
            setPriceFromOrderBook={setPriceFromOrderBook}
          />
          <OrderConfigurationCard
            orderBookObject={openBookMarket.orderBookObject}
          />
        </Card>
    </>
  );
}
