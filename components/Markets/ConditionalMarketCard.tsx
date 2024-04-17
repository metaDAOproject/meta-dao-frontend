import { useCallback, useState, useMemo, useEffect } from 'react';
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
  Loader,
} from '@mantine/core';
import numeral from 'numeral';
import { Icon12Hours, IconWallet } from '@tabler/icons-react';
import { BN } from '@coral-xyz/anchor';
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
import { useAutocrat } from '@/contexts/AutocratContext';

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
  const { daoTokens } = useAutocrat();
  const { proposal, isCranking, crankMarkets } = useProposal();
  const { orderBookObject, markets, placeOrder } = useProposalMarkets();
  const { setBalanceByMint } = useBalances();
  const [orderType, setOrderType] = useState<string>('Limit');
  const [orderSide, setOrderSide] = useState<string>('Buy');
  const [amount, setAmount] = useState<number>(0);
  const [price, setPrice] = useState<number | undefined>(0);
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

  if (!markets) return <Loader />;
  const isAskSide = orderSide === 'Sell';
  const isLimitOrder = orderType === 'Limit';

  // https://github.com/openbook-dex/openbook-v2/blob/d7d909c876e161d0a2bed9678c3dc5b9d0d430fb/ts/client/src/accounts/market.ts#L50
  const minMarketPriceIncrement = useMemo(() => ((10 ** (
    markets.fail.baseDecimals - markets.fail.quoteDecimals
  )) * markets.fail.quoteLotSize.toNumber()) / markets.fail.baseLotSize.toNumber(),
  [markets.fail.baseLotSize]);

  // https://github.com/openbook-dex/openbook-v2/blob/d7d909c876e161d0a2bed9678c3dc5b9d0d430fb/ts/client/src/accounts/market.ts#L44
  const minMarketBaseIncrement = useMemo(() => markets.fail.baseLotSize.toNumber() / (
    10 ** markets.fail.baseDecimals
  ), [markets.fail.baseLotSize]);

  const maxDecimalsAmount = useMemo(() => (minMarketBaseIncrement
  ? splitDecimals(minMarketBaseIncrement) - 1 : minMarketBaseIncrement),
  [minMarketBaseIncrement]);

  const lotsToUI: number = useMemo(() => markets.fail.baseLotSize
    .div(new BN(10)
      .pow(new BN(markets.fail.baseDecimals.toString()))
    )
    .toNumber(), [markets.fail.baseLotSize]);
  // TODO: Review this number as max safe doesn't work
  const maxMarketPrice = 10_000_000_000;

  const updateOrderValue = () => {
    if (price && !Number.isNaN(amount) && !Number.isNaN(+price)) {
      const formatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const _price = `$${formatter.format(parseFloat((+price * amount).toString()))}`;
      setOrderValue(_price);
    } else {
      setOrderValue('$0');
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
      return minMarketPriceIncrement;
    }
    return maxMarketPrice;
  };

  const priceValidator = (value: number) => {
    if (isLimitOrder) {
      if (Number(value) > 0) {
        const valueAsFloat = parseFloat(value.toString());
        const minPriceAsFloat = parseFloat(minMarketPriceIncrement.toString());
        const priceDecimals = splitDecimals(value);
        if (priceDecimals && (priceDecimals > maxDecimalsPrice)) {
          setPriceError(`You can only use ${maxDecimalsPrice} decimals`);
          return;
        }
        if (valueAsFloat <= minPriceAsFloat) {
          setPriceError('You must set a higher price');
          return;
        }
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

  const setPriceFromOrderBook = (value: number) => {
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
        Number(quoteBalance.data?.uiAmountString) / Number(price),
      );
      return _maxAmountRatio;
    }
    return 0;
  };

  const minOrderAmount = () => lotsToUI > 0 ? lotsToUI : minMarketBaseIncrement;

  const minOrderByStepSize = (value: number) => {
    const unitFactor = lotsToUI > 0 ? lotsToUI : minMarketBaseIncrement;
    if (value > 0 && value !== unitFactor) {
      if (value % unitFactor === 0) {
        return value;
      }
      // TODO: Dunno if we should ceil
      const _minAmountRatio = Math.round(value / unitFactor) * unitFactor;
      return _minAmountRatio;
    }
    return unitFactor;
  };

  const amountValidator = (value: number) => {
    if (value > 0) {
      const unitFactor = lotsToUI > 0 ? lotsToUI : minMarketBaseIncrement;
      const valueAsFloat = parseFloat(value.toString());
      const maxOrderAmountAsFloat = parseFloat(maxOrderAmount().toString());
      const minOrderAmountAsFloat = parseFloat(minOrderAmount().toString());
      const minRoundedAmountAsFloat = parseFloat(minOrderByStepSize(value).toString());
      const amountDecimals = splitDecimals(value);
      if (!isLimitOrder) {
        setAmountError(`A market order may execute at an 
        extremely ${isAskSide ? 'low' : 'high'} price
        be sure you know what you're doing`);
        return;
      }
      if (amountDecimals > maxDecimalsAmount) {
        setAmountError(`You can only use ${maxDecimalsAmount} decimals`);
      } else if (valueAsFloat > maxOrderAmountAsFloat) {
        setAmountError("You don't have enough funds");
      } else if (valueAsFloat < minOrderAmountAsFloat) {
        setAmountError(`You must trade at least ${unitFactor}`);
      } else if (valueAsFloat < minRoundedAmountAsFloat || value > minRoundedAmountAsFloat) {
        setAmountError(`You must trade whole increments of ${unitFactor}. Suggested ${minRoundedAmountAsFloat.toString()}`);
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
      setPrice(undefined);
    } else if (side === 'Buy') {
      // Sets up the market order for the largest value
      setPrice(maxMarketPrice);
    } else {
      // Sets up the market order for the smallest value
      setPrice(minMarketPriceIncrement);
    }
  };

  const isOrderAmountNan = () => {
    const _orderAmount = numeral(maxOrderAmount()).format(isAskSide ? BASE_FORMAT : NUMERAL_FORMAT);
    return Number.isNaN(Number(_orderAmount));
  };

  const handlePlaceOrder = useCallback(async () => {
    try {
      const isPostOnly = false;
      setIsPlacingOrder(true);
      const txsSent = await placeOrder(
        amount,
        _orderPrice(),
        isLimitOrder,
        isPostOnly,
        isAskSide,
        isPassMarket,
      );
      if (txsSent && txsSent.length > 0) {
        // TODO: We're assessing market in multiple places, we should be doing this in one
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
    if (amount && amount !== 0) amountValidator(amount);
  }, [amount]);

  useEffect(() => {
    updateOrderValue();
    if (price && price !== 0) priceValidator(price);
  }, [price]);

  const winningMarket = () => {
    if (isPassMarket) {
      if (isWinning) {
        return 'pass';
      }
      return 'fail';
    }
    if (isWinning) {
      return 'fail';
    }
    return 'pass';
  };

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
              : proposal!.account.openbookTwapFailMarket
          }
          lastObservationValue={lastObservationValue ?? 0}
          lastObservedSlot={lastObservedSlot}
          marketColor=""
          marketType={isPassMarket ? 'pass' : 'fail'}
          midPrice={isPassMarket ? passMidPrice : failMidPrice}
          twap={twap ?? 0}
          winningMarket={winningMarket()}
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
                  setPrice(minMarketPriceIncrement);
                } else {
                  setPrice(maxMarketPrice);
                }
              } else {
                setPrice(undefined);
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
                value={!isLimitOrder ? undefined : (price || undefined)}
                disabled={!isLimitOrder}
                error={priceError}
                onChange={(e) => {
                  setPrice(Number(e.target.value));
                }}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label={
                  <Group justify="space-between" align="center">
                    <Text size="sm">Amount of {daoTokens?.baseToken?.symbol}</Text>
                  </Group>
                }
                placeholder="Enter amount..."
                type="number"
                value={amount || undefined}
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
                    ? `${isPassMarket ? 'p' : 'f'}${daoTokens?.baseToken?.symbol} ${
                        numeral(baseBalance?.data?.uiAmountString || 0).format(BASE_FORMAT) || ''
                      }`
                    : `${isPassMarket ? 'p' : 'f'}${daoTokens?.quoteToken?.symbol} $${
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
                {orderSide} {isPassMarket ? 'p' : 'f'}{daoTokens?.baseToken?.symbol}
              </Button>
            </GridCol>
          </Grid>
        </Stack>
      </Stack>
    </Card>
  );
}
