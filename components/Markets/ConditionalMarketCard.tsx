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
  Button,
  Tooltip,
  NativeSelect,
  HoverCard,
  Group,
  useMantineColorScheme,
} from '@mantine/core';
import numeral from 'numeral';
import { Icon12Hours, IconWallet, IconTrendingUp, IconInfoCircle } from '@tabler/icons-react';
import { ConditionalMarketOrderBook } from './ConditionalMarketOrderBook';
import { useAutocrat } from '../../contexts/AutocratContext';
import { calculateTWAP } from '../../lib/openbookTwap';
import { BASE_FORMAT, NUMERAL_FORMAT } from '../../lib/constants';
import { useProposal } from '@/contexts/ProposalContext';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';

export function ConditionalMarketCard({
  isPassMarket,
  placeOrder,
  quoteBalance,
  baseBalance,
}: {
  isPassMarket: boolean;
  placeOrder: (
    amount: number,
    price: number,
    limitOrder?: boolean,
    ask?: boolean,
    pass?: boolean,
  ) => void;
  quoteBalance: string | undefined;
  baseBalance: string | undefined;
}) {
  const { daoState } = useAutocrat();
  const { proposal, orderBookObject, markets, isCranking, handleCrank } = useProposal();
  const [orderType, setOrderType] = useState<string>('Limit');
  const [orderSide, setOrderSide] = useState<string>('Buy');
  const [amount, setAmount] = useState<number>(0);
  const [price, setPrice] = useState<string>('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { generateExplorerLink } = useExplorerConfiguration();
  const { colorScheme } = useMantineColorScheme();

  if (!markets) return <></>;
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

  const failMidPrice =
    (Number(orderBookObject?.failToB.topAsk) + Number(orderBookObject?.failToB.topBid)) / 2;
  const passMidPrice =
    (Number(orderBookObject?.passToB.topAsk) + Number(orderBookObject?.passToB.topBid)) / 2;

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
    }
    if (quoteBalance && price) {
      const _maxAmountRatio = Math.floor(Number(quoteBalance) / Number(price));
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

  const isWinning = () => {
    if (passTwap && failTwap && daoState) {
      const fail = (failTwap * (10000 + daoState.passThresholdBps)) / 10000;
      const passWin = passTwap > fail;
      if (isPassMarket) return passWin || proposal?.account.state.passed ? '#67BD63' : 'inherit';
      return !passWin || proposal?.account.state.failed ? 'red' : 'inherit';
    }
    return 'inherit';
  };

  return (
    <Card
      withBorder
      radius="md"
      style={{ width: '26rem', border: `1px solid ${isWinning()}` }}
      bg="transparent"
    >
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <Stack>
            {isPassMarket ? (
              <Group align="center" justify="center">
                <IconTrendingUp color="green" />
                <Text size="lg" c="green">
                  <a
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    href={generateExplorerLink(
                      proposal?.account.openbookPassMarket.toString()!,
                      'account',
                    )}
                    target="blank"
                  >
                    Pass market
                  </a>
                </Text>
              </Group>
            ) : (
              <Group align="center" justify="center">
                <IconTrendingUp color="red" />
                <Text size="lg" c="red">
                  <a
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    href={generateExplorerLink(
                      proposal?.account.openbookFailMarket.toString()!,
                      'account',
                    )}
                    target="blank"
                  >
                    Fail market
                  </a>
                </Text>
              </Group>
            )}
          </Stack>
          <Tooltip label="Crank the market 🐷" events={{ hover: true, focus: true, touch: false }}>
            <ActionIcon
              variant="subtle"
              loading={isCranking}
              onClick={() => handleCrank(isPassMarket)}
            >
              <Icon12Hours />
            </ActionIcon>
          </Tooltip>
        </Group>
        {twap ? (
          <Group justify="center" align="center">
            <Stack gap={0} pb="1rem" align="center">
              <Group gap={3} justify="center" align="center">
                <Text fw="bold" size="md">
                  ${numeral(twap).format(NUMERAL_FORMAT)}
                </Text>
                <Text size="sm">TWAP</Text>
              </Group>
              <Text size="xs">
                ${numeral(isPassMarket ? passMidPrice : failMidPrice).format(NUMERAL_FORMAT)} (mid)
              </Text>
            </Stack>
            <HoverCard position="top">
              <HoverCard.Target>
                <IconInfoCircle strokeWidth={1.3} />
              </HoverCard.Target>
              <HoverCard.Dropdown w="22rem">
                <Stack>
                  <Text>
                    The Time Weighted Average Price (TWAP) is the measure used to decide if the
                    proposal passes: if the TWAP of the pass market is{' '}
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
                  <Text c={isWinning()}>
                    Currently the{' '}
                    {passTwap! > (failTwap! * (10000 + daoState!.passThresholdBps)) / 10000
                      ? 'Pass'
                      : 'Fail'}{' '}
                    Market wins
                  </Text>
                  <Text size="xs">
                    <a
                      href={generateExplorerLink(
                        proposal?.account.openbookTwapPassMarket.toString()!,
                        'account',
                      )}
                      target="blank"
                    >
                      {`See ${isPassMarket ? 'Pass' : 'Fail'} TWAP Market in explorer.`}
                    </a>
                  </Text>
                </Stack>
              </HoverCard.Dropdown>
            </HoverCard>
          </Group>
        ) : null}
        <Card withBorder bg={colorScheme === 'dark' ? '' : '#F9F9F9'}>
          <ConditionalMarketOrderBook
            orderBookObject={orderBookObject}
            isPassMarket={isPassMarket}
            setPriceFromOrderBook={setPriceFromOrderBook}
          />
        </Card>
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
              <Group justify="space-between" align="center">
                <Text>Amount of META </Text>
                <Group align="center" gap={0}>
                  {baseBalance || quoteBalance ? (
                    <>
                      <IconWallet height={12} />
                      <Text size="xs">
                        {isAskSide
                          ? `${isPassMarket ? 'p' : 'f'}META ${
                              numeral(baseBalance).format(BASE_FORMAT) || ''
                            }`
                          : `${isPassMarket ? 'p' : 'f'}USDC $${
                              numeral(quoteBalance).format(NUMERAL_FORMAT) || ''
                            }`}
                      </Text>
                    </>
                  ) : (
                    <Text> </Text>
                  )}
                </Group>
              </Group>
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
                disabled={!isLimitOrder ? !!isOrderAmountNan() : !price}
              >
                <Text size="xs">
                  Max{' '}
                  {maxOrderAmount()
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
              amountValidator(Number(e.target.value));
            }}
          />
          <Grid>
            <GridCol span={12}>
              <Button
                fullWidth
                color={isAskSide ? 'red' : 'green'}
                onClick={() =>
                  placeOrder(amount, _orderPrice(), isLimitOrder, isAskSide, isPassMarket)
                }
                disabled={!amount || (isLimitOrder ? !price : false)}
              >
                {orderSide} {isPassMarket ? 'p' : 'f'}META
              </Button>
            </GridCol>
          </Grid>
        </Stack>
      </Stack>
    </Card>
  );
}
