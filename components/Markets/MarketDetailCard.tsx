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
import { useOpenbookMarket } from '@/contexts/OpenbookMarketContext';
import { OrderBookCard } from '../OrderBook/OrderBookCard';
import { OrderConfigurationCard } from '../OrderBook/OrderConfigurationCard';
import DisableNumberInputScroll from '../Utilities/DisableNumberInputScroll';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { shortKey } from '@/lib/utils';
import { MarketOrdersCard } from './MarketOrdersCard';

export function MarketDetailCard() {
  const openbookMarket = useOpenbookMarket();
  const { generateExplorerLink } = useExplorerConfiguration();
  const [price, setPrice] = useState<string>('');

  const setPriceFromOrderBook = (value: string) => {
    setPrice(value);
  };

  return openbookMarket.loading || !openbookMarket.market ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <>
      <Stack>
        <Title>
          {utf8.decode(new Uint8Array(openbookMarket.market.market.name)).split('\x00')[0]}
        </Title>
        <Text>Event Heap Size: {openbookMarket.eventHeapCount}</Text>
        <Text>Event Heap Account:
          <a
            href={generateExplorerLink(openbookMarket.market.market.eventHeap.toString(), 'account')}
          >
            {shortKey(openbookMarket.market.market.eventHeap.toString())}
          </a>
        </Text>
        <Text>Taker Fee: {openbookMarket.market.market.takerFee.toString()}</Text>
        <Text>Maker Fee: {openbookMarket.market.market.makerFee.toString()}</Text>
      </Stack>
      <Divider p={10} />
      <Group justify="space-between">
        <Stack>
          <Title order={3}>Base</Title>
          <Text>Mint:
            <a
              href={generateExplorerLink(openbookMarket.market.market.baseMint.toString(), 'account')}
            >
              {shortKey(openbookMarket.market.market.baseMint.toString())}
            </a>
          </Text>
          <Text>Decimals: {openbookMarket.market.market.baseDecimals.toString()}</Text>
          <Text>Lot Size: {openbookMarket.market.market.baseLotSize.toString()}</Text>
          <Text>Deposit Total: {openbookMarket.market.market.baseDepositTotal.toString()}</Text>
          <Text>Market Vault:
            <a
              href={generateExplorerLink(openbookMarket.market.market.marketBaseVault.toString(), 'account')}
            >
              {shortKey(openbookMarket.market.market.marketBaseVault.toString())}
            </a>
          </Text>
        </Stack>
        <Divider orientation="vertical" p={10} />
        <Stack>
          <Title order={3}>Quote</Title>
          <Text> Mint:
            <a
              href={generateExplorerLink(openbookMarket.market.market.quoteMint.toString(), 'account')}
            >
              {shortKey(openbookMarket.market.market.quoteMint.toString())}
            </a>
          </Text>
          <Text>Decimals: {openbookMarket.market.market.quoteDecimals.toString()}</Text>
          <Text>Lot Size: {openbookMarket.market.market.quoteLotSize.toString()}</Text>
          <Text>Deposit Total: {openbookMarket.market.market.quoteDepositTotal.toString()}</Text>
          <Text>Market Vault:
            <a
              href={generateExplorerLink(openbookMarket.market.market.marketQuoteVault.toString(), 'account')}
            >
              {shortKey(openbookMarket.market.market.marketQuoteVault.toString())}
            </a>
          </Text>
        </Stack>
      </Group>
      <Divider p={10} />
      <Card>
        <DisableNumberInputScroll />
        <OrderBookCard
          orderBookObject={openbookMarket.orderBookObject}
          setPriceFromOrderBook={setPriceFromOrderBook}
          market={openbookMarket.market}
        />
        <OrderConfigurationCard
          orderBookObject={openbookMarket.orderBookObject}
          market={openbookMarket.market}
          setPrice={setPrice}
          price={price}
        />
      </Card>
      <MarketOrdersCard
        market={openbookMarket.market}
      />
    </>
  );
}
