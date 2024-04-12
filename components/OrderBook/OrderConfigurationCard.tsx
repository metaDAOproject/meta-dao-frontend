import { useState, useEffect, useCallback } from 'react';
import {
  ActionIcon,
  Stack,
  Text,
  SegmentedControl,
  TextInput,
  Grid,
  GridCol,
  Button,
  NativeSelect,
  Group,
} from '@mantine/core';
import { IconWallet } from '@tabler/icons-react';
import numeral from 'numeral';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { OpenbookMarket, OpenbookOrderBook as _OrderBook } from '@/lib/types';
import { BASE_FORMAT, NUMERAL_FORMAT } from '../../lib/constants';
import { useOpenbookMarket } from '@/contexts/OpenbookMarketContext';
import { useBalance } from '../../hooks/useBalance';

export function OrderConfigurationCard({
  orderBookObject,
  market,
  price,
  setPrice,
}: {
  orderBookObject: _OrderBook;
  market: OpenbookMarket;
  price: string;
  setPrice: (price: string) => void;
}) {
  const openbookMarket = useOpenbookMarket();
  // TODO: Review this as anything less than this fails to work
  const minMarketPrice = market.market.quoteLotSize.toNumber();
  // TODO: Review this number as max safe doesn't work
  const maxMarketPrice = 10_000_000_000;
  const [orderType, setOrderType] = useState<string>('Limit');
  const [orderSide, setOrderSide] = useState<string>('Buy');
  const [amount, setAmount] = useState<number>(0);
  const [orderValue, setOrderValue] = useState<string>('0');

  const isAskSide = orderSide === 'Sell';
  const isLimitOrder = orderType === 'Limit';
  const [priceError, setPriceError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const marketInstrument = utf8.decode(new Uint8Array(market.market.name)).split('\x00')[0];
  const _marketInstrument = marketInstrument.split('-');

  const base = _marketInstrument[0];
  const quote = _marketInstrument[1];

  const { amount: baseBalance } = useBalance(market.market.baseMint);

  const { amount: quoteBalance } = useBalance(market.market.quoteMint);

  const _orderPrice = () => {
    if (isLimitOrder) {
      if (Number(price) > 0) {
        return Number(price);
      }
      // TODO: This is not a great value or expected behavior.. We need to throw error..
      return 0;
    }
    if (orderSide === 'Sell') {
      return minMarketPrice;
    }
    return maxMarketPrice;
  };

  const updateOrderValue = () => {
    if (!Number.isNaN(amount) && !Number.isNaN(+price)) {
      const _price = parseFloat((+price * amount).toString()).toFixed(2);
      setOrderValue(_price);
    } else {
      setOrderValue('0');
    }
  };

  const changeOrderSide = (side: string) => {
    // Clear out our errors
    setPriceError(null);
    setAmountError(null);
    // Reset amount
    setAmount(0);
    // Check and change values to match order type
    if (isLimitOrder) {
      // We can safely reset our price to nothing
      setPrice('');
    } else if (side === 'Buy') {
      // Sets up the market order for the largest value
      setPrice(maxMarketPrice.toString());
    } else {
      // Sets up the market order for the smallest value
      setPrice(minMarketPrice.toString());
    }
  };

  const priceValidator = (value: string) => {
    if (isLimitOrder) {
      if (Number(value) > 0) {
        if (isAskSide) {
          if (Number(value) <= Number(orderBookObject?.toB.topBid)) {
            setPriceError('You will cross the books with a taker order');
            return;
          }
          setPriceError(null);
          return;
        }
        if (Number(value) >= Number(orderBookObject?.toB.topAsk)) {
          setPriceError('You will cross the books with a taker order');
          return;
        }
        setPriceError(null);
      } else {
        setPriceError('Enter a value greater than 0');
      }
    }
  };

  const maxOrderAmount = () => {
    if (isAskSide) {
      if (Number(baseBalance.data?.uiAmount) > 0) {
        return Number(baseBalance.data?.uiAmount);
      }
      return 0;
    }
    if (quoteBalance.data?.uiAmount && price) {
      const _maxAmountRatio = Math.floor(Number(quoteBalance.data?.uiAmount) / Number(price));
      return _maxAmountRatio;
    }
    return 0;
  };

  const amountValidator = (value: number) => {
    if (value > 0) {
      if (!isLimitOrder) {
        setAmountError(`A market order may execute at an 
        extremely ${isAskSide ? 'low' : 'high'} price
        be sure you know what you're doing`);
        return;
      }
      if (value > maxOrderAmount()) {
        setAmountError("You don't have enough funds");
      } else {
        setAmountError(null);
      }
    } else {
      setAmountError('You must enter a whole number');
    }
  };

  const isOrderAmountNan = () => {
    const _orderAmount = numeral(maxOrderAmount()).format(isAskSide ? BASE_FORMAT : NUMERAL_FORMAT);
    return Number.isNaN(Number(_orderAmount));
  };

  const handlePlaceOrder = useCallback(async () => {
    if (!openbookMarket) return;
    try {
      setIsPlacingOrder(true);
      await openbookMarket.placeOrder(amount, _orderPrice(), isLimitOrder, isAskSide);
    } catch (err) {
      // TODO: Stub for app reporting
    } finally {
      setIsPlacingOrder(false);
    }
  }, [openbookMarket, amount, _orderPrice(), isLimitOrder, isAskSide]);

  useEffect(() => {
    updateOrderValue();
    if (amount !== 0) amountValidator(amount);
  }, [amount]);

  useEffect(() => {
    updateOrderValue();
    if (price !== '') priceValidator(price);
  }, [price]);

  return (
    <Stack>
      <SegmentedControl
        style={{ marginTop: '10px' }}
        color={isAskSide ? 'red' : 'green'}
        classNames={{
          label: 'label',
        }}
        data={['Buy', 'Sell']}
        value={orderSide}
        onChange={(e) => {
          setOrderSide(e);
          changeOrderSide(e);
        }}
        fullWidth
      />
      <NativeSelect
        style={{ marginTop: '10px' }}
        data={['Limit', 'Market']}
        value={orderType}
        onChange={(e) => {
          setOrderType(e.target.value);
          if (e.target.value === 'Market') {
            if (isAskSide) {
              setPrice(minMarketPrice.toString());
            } else {
              setPrice(maxMarketPrice.toString());
            }
          } else {
            setPrice('');
          }
          setPriceError(null);
          setAmountError(null);
        }}
      />
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Price"
            placeholder="Enter price..."
            type="number"
            w="100%"
            value={!isLimitOrder ? '' : price}
            disabled={!isLimitOrder}
            error={priceError}
            onChange={(e) => {
              setPrice(e.target.value);
            }}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label={
              <Group justify="space-between" align="center">
                <Text size="sm">Amount of {base}</Text>
              </Group>
            }
            placeholder="Enter amount..."
            type="number"
            value={amount || ''}
            defaultValue={amount || ''}
            rightSectionWidth={70}
            rightSection={
              <ActionIcon
                w="80%"
                radius="sm"
                color="grey"
                onClick={() => {
                  setAmount(maxOrderAmount()! ? maxOrderAmount()! : 0);
                  amountValidator(maxOrderAmount()! ? maxOrderAmount()! : 0);
                }}
                disabled={!isLimitOrder ? !!isOrderAmountNan() : !price}
              >
                <Text size="xs">
                  Max{' '}
                  {maxOrderAmount() && maxOrderAmount() < 1000
                    ? !isOrderAmountNan()
                      ? numeral(maxOrderAmount()).format(BASE_FORMAT)
                      : ''
                    : ''}
                </Text>
              </ActionIcon>
            }
            error={amountError}
            onChange={(e) => {
              setAmount(Number(e.target.value));
            }}
          />
        </Grid.Col>
      </Grid>
      <Group align="center" justify="space-between">
        {baseBalance?.data?.uiAmountString || quoteBalance?.data?.uiAmountString ? (
          <Group gap={0}>
            <IconWallet height={12} />
            <Text size="xs">
              {isAskSide
                ? `${base} ${
                    numeral(baseBalance?.data?.uiAmountString || 0).format(BASE_FORMAT) || ''
                  }`
                : `${quote} ${
                    numeral(quoteBalance?.data?.uiAmountString || 0).format(NUMERAL_FORMAT) || ''
                  }`}
            </Text>
          </Group>
        ) : (
          <Text> </Text>
        )}
        <>
          <Text size="xs">Total Order Value ${orderValue}</Text>
        </>
      </Group>
      <Grid>
        <GridCol span={12}>
          <Button
            fullWidth
            color={isAskSide ? 'red' : 'green'}
            onClick={handlePlaceOrder}
            variant="outline"
            disabled={!amount || (isLimitOrder ? !price : false)}
            loading={isPlacingOrder}
          >
            {orderSide} {base}
          </Button>
        </GridCol>
      </Grid>
    </Stack>
  );
}
