import { useCallback, useState, useEffect } from 'react';
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
  Group,
} from '@mantine/core';
import numeral from 'numeral';
import { Icon12Hours, IconWallet } from '@tabler/icons-react';
import { ConditionalMarketOrderBook } from './ConditionalMarketOrderBook';
import { BASE_FORMAT, NUMERAL_FORMAT } from '../../lib/constants';
import { useProposal } from '@/contexts/ProposalContext';
import MarketTitle from './MarketTitle';
import DisableNumberInputScroll from '../Utilities/DisableNumberInputScroll';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';
import { useBalances } from '@/contexts/BalancesContext';
import { useBalance } from '@/hooks/useBalance';
import TwapDisplay from './TwapDisplay';

import { TwapSubscriptionRes } from '@/hooks/useTwapSubscription';

type Props = {
  asks: any[][];
  bids: any[][];
  spreadString: string;
  lastSlotUpdated: number;
  isPassMarket: boolean;
  twapData: TwapSubscriptionRes;
  isWinning: boolean;
  twapDescription: string;
};

export function ConditionalMarketCard({
  asks,
  bids,
  spreadString,
  lastSlotUpdated,
  isPassMarket,
  twapData,
  isWinning,
  twapDescription,
}: Props) {
  const { proposal, isCranking, crankMarkets } = useProposal();
  const { orderBookObject, markets, placeOrder } = useProposalMarkets();
  const { setBalanceByMint } = useBalances();
  const [orderType, setOrderType] = useState<string>('Limit');
  const [orderSide, setOrderSide] = useState<string>('Buy');
  const [amount, setAmount] = useState<number>(0);
  const [price, setPrice] = useState<string>('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [orderValue, setOrderValue] = useState<string>('0');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [borderColor, setBorderColor] = useState<'inherit' | 'red' | '#67BD63'>('inherit');

  const { twap, lastObservationValue, lastObservedSlot } = twapData;

  const getMarketBorderColor = () => {
    if (isPassMarket) return isWinning ? '#67BD63' : 'inherit';
    return isWinning ? 'red' : 'inherit';
  };
  useEffect(() => {
    setBorderColor(getMarketBorderColor());
  }, [isWinning, isPassMarket]);

  const failMidPrice =
    (Number(orderBookObject?.failToB.topAsk) + Number(orderBookObject?.failToB.topBid)) / 2;
  const passMidPrice =
    (Number(orderBookObject?.passToB.topAsk) + Number(orderBookObject?.passToB.topBid)) / 2;

  const { amount: baseBalance } = useBalance(
    isPassMarket
      ? markets?.baseVault.conditionalOnFinalizeTokenMint
      : markets?.baseVault.conditionalOnRevertTokenMint,
  );

  const { amount: quoteBalance } = useBalance(
    isPassMarket
      ? markets?.quoteVault.conditionalOnFinalizeTokenMint
      : markets?.quoteVault.conditionalOnRevertTokenMint,
  );

  if (!markets) return <></>;
  const isAskSide = orderSide === 'Sell';
  const isLimitOrder = orderType === 'Limit';

  // TODO: Review this as anything less than this fails to work
  const minMarketPrice = 10;
  // TODO: Review this number as max safe doesn't work
  const maxMarketPrice = 10000000000;

  const updateOrderValue = () => {
    if (!Number.isNaN(amount) && !Number.isNaN(+price)) {
      const formatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const _price = formatter.format(parseFloat((+price * amount).toString()));
      setOrderValue(_price);
    } else {
      setOrderValue('0');
    }
  };

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

  const setPriceFromOrderBook = (value: string) => {
    priceValidator(value);
    setPrice(value);
  };

  const maxOrderAmount = () => {
    if (isAskSide) {
      if (Number(baseBalance?.data?.uiAmountString || 0) > 0) {
        return Number(baseBalance?.data?.uiAmountString || 0);
      }
      return 0;
    }
    if (quoteBalance && price) {
      const _maxAmountRatio = Math.floor(
        Number(quoteBalance?.data?.uiAmountString) / Number(price),
      );
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
    setOrderValue('0');
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

  const handlePlaceOrder = useCallback(async () => {
    try {
      setIsPlacingOrder(true);
      const txsSent = await placeOrder(
        amount,
        _orderPrice(),
        isLimitOrder,
        isAskSide,
        isPassMarket,
      );
      if (txsSent && txsSent.length > 0) {
        const marketAccount = isPassMarket
          ? { account: markets.pass, publicKey: proposal?.account.openbookPassMarket }
          : { account: markets.fail, publicKey: proposal?.account.openbookFailMarket };
        const relevantMint = isAskSide
          ? marketAccount.account.baseMint
          : marketAccount.account.quoteMint;
        const balanceChange = isAskSide ? amount : _orderPrice();
        setBalanceByMint(relevantMint, (oldBalance) => {
          const newAmount = (oldBalance.uiAmount ?? 0) - balanceChange;
          return {
            ...oldBalance,
            amount: newAmount.toString(),
            uiAmount: newAmount,
            uiAmountString: newAmount.toString(),
          };
        });
      }
    } finally {
      setIsPlacingOrder(false);
    }
  }, [placeOrder, amount, isLimitOrder, isPassMarket, isAskSide, price]);

  useEffect(() => {
    updateOrderValue();
    if (amount !== 0) amountValidator(amount);
  }, [amount]);

  useEffect(() => {
    updateOrderValue();
    if (price !== '') priceValidator(price);
  }, [price]);

  return (
    <Card
      withBorder
      radius="md"
      maw="26rem"
      style={{ border: `1px solid ${borderColor}` }}
      bg="transparent"
    >
      <DisableNumberInputScroll />
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <MarketTitle isPassMarket={isPassMarket} />
          <Tooltip label="Crank the market 🐷" events={{ hover: true, focus: true, touch: false }}>
            <ActionIcon variant="subtle" loading={isCranking} onClick={() => crankMarkets()}>
              <Icon12Hours />
            </ActionIcon>
          </Tooltip>
        </Group>
        <TwapDisplay
          countdownEndConditions={twapDescription}
          totalImpact={twapData.totalImpact}
          twapMarket={
            isPassMarket
              ? proposal!.account.openbookTwapPassMarket
              : proposal!.account.openbookTwapPassMarket
          }
          lastObservationValue={lastObservationValue ?? 0}
          lastObservedSlot={lastObservedSlot}
          marketColor=""
          marketType={isPassMarket ? 'pass' : 'fail'}
          midPrice={isPassMarket ? passMidPrice : failMidPrice}
          twap={twap ?? 0}
          winningMarket="fail"
        />
        <ConditionalMarketOrderBook
          orderBookObject={orderBookObject}
          setPriceFromOrderBook={setPriceFromOrderBook}
          asks={asks}
          bids={bids}
          spreadString={spreadString}
          lastSlotUpdated={lastSlotUpdated}
        />
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
                    <Text size="sm">Amount of META</Text>
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
                    ? `${isPassMarket ? 'p' : 'f'}META ${
                        numeral(baseBalance?.data?.uiAmountString || 0).format(BASE_FORMAT) || ''
                      }`
                    : `${isPassMarket ? 'p' : 'f'}USDC $${
                        numeral(quoteBalance?.data?.uiAmountString || 0).format(NUMERAL_FORMAT) ||
                        ''
                      }`}
                </Text>
              </Group>
            ) : (
              <Text> </Text>
            )}
            <>
              <Text size="xs">Total Order Value {orderValue}</Text>
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
                {orderSide} {isPassMarket ? 'p' : 'f'}META
              </Button>
            </GridCol>
          </Grid>
        </Stack>
      </Stack>
    </Card>
  );
}
