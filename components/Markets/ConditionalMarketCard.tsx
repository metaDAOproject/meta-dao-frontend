import { useState } from 'react';
import {
  ActionIcon,
  Card,
  Stack,
  Text,
  SegmentedControl,
  TextInput,
  Grid,
  GridCol,
  Flex,
  Button,
  Tooltip,
  NativeSelect,
  HoverCard,
  Group,
  InputLabel,
} from '@mantine/core';
import numeral from 'numeral';
import { PublicKey } from '@solana/web3.js';
import { Icon12Hours, IconQuestionMark, IconWallet } from '@tabler/icons-react';
import { ConditionalMarketOrderBook } from './ConditionalMarketOrderBook';
import { Markets, OrderBook } from '@/lib/types';
import { useAutocrat } from '../../contexts/AutocratContext';
import { calculateTWAP } from '../../lib/openbookTwap';
import { BASE_FORMAT, NUMERAL_FORMAT } from '../../lib/constants';

export function ConditionalMarketCard({
  isPassMarket,
  orderBookObject,
  markets,
  placeOrder,
  handleCrank,
  quoteBalance,
  baseBalance,
  isCranking,
}: {
  isPassMarket: boolean;
  orderBookObject: OrderBook;
  markets: Markets;
  placeOrder: (
    amount: number,
    price: number,
    limitOrder?: boolean,
    ask?: boolean,
    pass?: boolean,
  ) => void;
  handleCrank: (isPassMarket: boolean, individualEvent?: PublicKey) => void;
  quoteBalance: string | undefined;
  baseBalance: string | undefined;
  isCranking: boolean
}) {
  const { daoState } = useAutocrat();
  const [orderType, setOrderType] = useState<string>('Limit');
  const [orderSide, setOrderSide] = useState<string>('Buy');
  const [amount, setAmount] = useState<number>(0);
  const [price, setPrice] = useState<string>('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const passTwap = calculateTWAP(markets.passTwap.twapOracle);
  const failTwap = calculateTWAP(markets.failTwap.twapOracle);
  const twap = isPassMarket ? passTwap : failTwap;
  const isAskSide = orderSide === 'Sell';
  const isLimitOrder = orderType === 'Limit';

  // TODO: Review this as anything less than this fails to work
  const minMarketPrice = 10;
  // TODO: Review this number as max safe doesn't work
  const maxMarketPrice = 10000000000;

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

  const priceValidator = (value: string) => {
    if (isLimitOrder) {
      if (Number(value) > 0) {
        if (isAskSide) {
          if (isPassMarket) {
            if (Number(value) <= Number(orderBookObject?.passToB.topBid)) {
              setPriceError('You will cross the books with a taker order');
              return;
            }
            setPriceError(null);
            return;
          }
          if (Number(value) <= Number(orderBookObject?.failToB.topBid)) {
            setPriceError('You will cross the books with a taker order');
            return;
          }
          setPriceError(null);
          return;
        }
        if (isPassMarket) {
          if (Number(value) >= Number(orderBookObject?.passToB.topAsk)) {
            setPriceError('You will cross the books with a taker order');
            return;
          }
          setPriceError(null);
          return;
        }
        if (Number(value) >= Number(orderBookObject?.failToB.topAsk)) {
          setPriceError('You will cross the books with a taker order');
          return;
        }
        setPriceError(null);
      } else {
        setPriceError('Enter a value greater than 0');
      }
    }
  };

  const failMidPrice = (
    Number(orderBookObject?.failToB.topAsk) + Number(orderBookObject?.failToB.topBid)
  ) / 2;
  const passMidPrice = (
    Number(orderBookObject?.passToB.topAsk) + Number(orderBookObject?.passToB.topBid)
  ) / 2;

  const setPriceFromOrderBook = (value: string) => {
    priceValidator(value);
    setPrice(value);
  };

  const maxOrderAmount = () => {
    if (isAskSide) {
      if (Number(baseBalance) > 0) {
        return Number(baseBalance);
      }
      return 0;
    } if (quoteBalance && price) {
      const _maxAmountRatio = Math.floor((Number(quoteBalance) / Number(price)));
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

  const isOrderAmountNan = () => {
    const _orderAmount = numeral(maxOrderAmount()).format(isAskSide ? BASE_FORMAT : NUMERAL_FORMAT);
    return Number.isNaN(Number(_orderAmount));
  };

  return (
    <Stack p={0} m={0} gap={0}>
      <Card withBorder radius="md" style={{ width: '22rem' }}>
        <Flex justify="space-between" align="flex-start" direction="row" wrap="wrap">
          <Group align="center">
            <Text fw="bolder" size="lg" pb="1rem">
              {isPassMarket ? 'Pass' : 'Fail'} market{' '}
            </Text>
            {twap ? (
              <HoverCard>
                <HoverCard.Target>
                  <Group justify="center" align="flex-start">
                    <Stack gap={0} pb="1rem">
                      <Group gap={3} justify="center" align="center">
                        <Text fw="bold" size="md">
                          ${numeral(twap).format(NUMERAL_FORMAT)}
                        </Text>
                        <Text size="sm">
                          TWAP
                        </Text>
                      </Group>
                      <Text size="xs">
                        ${numeral(
                          isPassMarket ? passMidPrice : failMidPrice
                          ).format(NUMERAL_FORMAT)} (mid)
                      </Text>
                    </Stack>
                    <ActionIcon variant="transparent">
                      <IconQuestionMark />
                    </ActionIcon>
                  </Group>
                </HoverCard.Target>
                <HoverCard.Dropdown w="22rem">
                  <Text>
                    The Time Weighted Average Price (TWAP) is the measure used to decide if the
                    proposal passses: if the TWAP of the pass market is{' '}
                    {daoState
                      ? `${numeral(daoState.passThresholdBps / 100).format(NUMERAL_FORMAT)}%`
                      : '???'}{' '}
                    above the fail market{' '}
                    {daoState && failTwap
                      ? `(> ${numeral(
                          (failTwap * (10000 + daoState.passThresholdBps)) / 10000,
                        ).format(NUMERAL_FORMAT)})`
                      : null}
                    , the proposal will pass once the countdown ends.
                  </Text>
                </HoverCard.Dropdown>
              </HoverCard>
            ) : null}
          </Group>
          <Tooltip label="Crank the market 🐷">
            <ActionIcon variant="subtle" loading={isCranking} onClick={() => handleCrank(isPassMarket)}>
              <Icon12Hours />
            </ActionIcon>
          </Tooltip>
        </Flex>
        {/* <Text fw="bold">Book</Text> */}
        <Card withBorder style={{ backgroundColor: 'rgb(250, 250, 250)' }}>
          <ConditionalMarketOrderBook
            orderBookObject={orderBookObject}
            isPassMarket={isPassMarket}
            setPriceFromOrderBook={setPriceFromOrderBook}
          />
        </Card>
        <Stack>
          <style dangerouslySetInnerHTML={{ __html: '.label {&[data-active] {color: #FFFFFF;}}' }} />
          <SegmentedControl
            style={{ marginTop: '10px' }}
            styles={{
              indicator: {
                backgroundColor: isAskSide ? 'red' : 'green',
              },
            }}
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
          <TextInput
            label="Price"
            placeholder="Enter price..."
            type="number"
            value={!isLimitOrder ? '' : price}
            disabled={!isLimitOrder}
            error={priceError}
            onChange={(e) => {
              setPrice(e.target.value);
              priceValidator(e.target.value);
            }}
          />
          <TextInput
            label={
              <>
              <Flex justify="space-between" align="center" direction="row" wrap="wrap">
                <InputLabel pr={50} mr="sm">
                  Amount of META
                </InputLabel>
                <Group justify="flex-start" align="center" ml="auto" gap={0}>
                  {baseBalance || quoteBalance ? (
                    <>
                    <IconWallet height={12} />
                    <Text size="xs">
                      {
                        isAskSide ?
                          (`${isPassMarket ? 'p' : 'f'}META ${numeral(baseBalance).format(BASE_FORMAT) || ''}`)
                        :
                          (`${isPassMarket ? 'p' : 'f'}USDC $${numeral(quoteBalance).format(NUMERAL_FORMAT) || ''}`)
                      }
                    </Text>
                    </>) : (<Text>{' '}</Text>)}
                </Group>
              </Flex>
              </>
            }
            placeholder="Enter amount..."
            type="number"
            value={amount || ''}
            rightSectionWidth={100}
            rightSection={
              <ActionIcon
                size={20}
                radius="md"
                w={80}
                color="grey"
                onClick={() => {
                  setAmount(maxOrderAmount()! ? maxOrderAmount()! : 0);
                  amountValidator(maxOrderAmount()! ? maxOrderAmount()! : 0);
                }}
                disabled={!isLimitOrder ? (!!isOrderAmountNan()) : !price}
              >
                <Text size="xs">
                  Max{' '}{
                    maxOrderAmount()
                    ? (!isOrderAmountNan()
                      ? numeral(maxOrderAmount()).format(BASE_FORMAT)
                      : '')
                    : ''
                  }
                </Text>
              </ActionIcon>
            }
            error={amountError}
            onChange={(e) => {
              setAmount(Number(e.target.value));
              amountValidator(Number(e.target.value));
            }}
          />
          <Grid>
            <GridCol span={12}>
              <Button
                fullWidth
                color={isAskSide ? 'red' : 'green'}
                onClick={() =>
                  placeOrder(
                    amount,
                    _orderPrice(),
                    isLimitOrder,
                    isAskSide,
                    isPassMarket,
                  )
                }
                variant="light"
                disabled={!amount || (isLimitOrder ? !price : false)}
              >
                {orderSide} {isPassMarket ? 'p' : 'f'}META
              </Button>
            </GridCol>
          </Grid>
        </Stack>
      </Card>
    </Stack>
  );
}
