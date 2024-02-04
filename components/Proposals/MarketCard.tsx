import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Container,
  Fieldset,
  Grid,
  Group,
  HoverCard,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import numeral from 'numeral';
import { IconQuestionMark } from '@tabler/icons-react';
import { NUMERAL_FORMAT } from '@/lib/constants';
import { Token, useTokens } from '../../hooks/useTokens';
import { useTokenAmount } from '../../hooks/useTokenAmount';
import { useTokenMint } from '../../hooks/useTokenMint';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { useAutocrat } from '../../contexts/AutocratContext';
import { getParsedOrders } from '@/lib/openbook';
import { useProposal } from '@/contexts/ProposalContext';

export function MarketCard() {
  const { daoTreasury } = useAutocrat();
  const { proposal, markets, mintTokensTransactions, placeOrderTransactions, fetchMarketsInfo } =
    useProposal();
  const { amount: baseBalance } = useTokenAmount(markets?.baseVault.underlyingTokenMint);
  const { amount: quoteBalance } = useTokenAmount(markets?.quoteVault.underlyingTokenMint);
  const { tokens } = useTokens();
  const { amount: treasuryBalance } = useTokenAmount(tokens?.meta?.publicKey, daoTreasury);
  const { mint } = useTokenMint(tokens?.meta?.publicKey);
  const sender = useTransactionSender();
  const [passPrice, setPassPrice] = useState<number>(0);
  const [failPrice, setFailPrice] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [selectedToken, setSelectedToken] = useState<Token | undefined>(tokens?.meta);
  const [isBetting, setIsBetting] = useState<boolean>(false);
  const isBeneficial = passPrice > failPrice;
  const usedToken = (selectedToken !== tokens?.usdc ? tokens?.meta : tokens?.usdc) || tokens?.meta;
  const usingBaseToken = usedToken === tokens?.meta;
  const payoutToken = selectedToken === tokens?.usdc ? tokens?.meta : tokens?.usdc;
  const passPayoutAmount = usingBaseToken ? passPrice * amount : amount / passPrice;
  const failPayoutAmount = usingBaseToken ? failPrice * amount : amount / failPrice;

  useEffect(() => {
    if (!selectedToken) {
      setSelectedToken(tokens?.meta);
    }
  }, [selectedToken, tokens]);

  const totalSupply =
    numeral(mint?.supply || 0)
      .divide(10 ** (mint?.decimals || 0))
      .value() || 0;
  const circulatingSupply =
    numeral(totalSupply)
      .subtract(treasuryBalance?.uiAmount || 0)
      .value() || 0;

  const [marketPassPrice, marketFailPrice] = useMemo(() => {
    const passBids = getParsedOrders(markets?.passBids || [], true);
    const passAsks = getParsedOrders(markets?.passAsks || [], false);
    const failBids = getParsedOrders(markets?.failBids || [], true);
    const failAsks = getParsedOrders(markets?.failAsks || [], false);

    const pPrice =
      passBids.length > 0 && passAsks.length > 0 ? (passAsks[0].price + passBids[0].price) / 2 : 0;
    const fPrice =
      failBids.length > 0 && failAsks.length > 0 ? (failAsks[0].price + failBids[0].price) / 2 : 0;

    // handle usdc rounding
    return [pPrice / 10_000, fPrice / 10_000];
  }, [markets]);

  const circulatingMarketPassValue = circulatingSupply * marketPassPrice;
  const circulatingMarketFailValue = circulatingSupply * marketFailPrice;
  const totalMarketPassValue = totalSupply * marketPassPrice;
  const totalMarketFailValue = totalSupply * marketFailPrice;
  const circulatingBeliefPassValue = passPrice * circulatingSupply;
  const circulatingBeliefFailValue = failPrice * circulatingSupply;
  const totalBeliefPassValue = passPrice * totalSupply;
  const totalBeliefFailValue = failPrice * totalSupply;

  const handleBet = useCallback(async () => {
    if (!markets || !proposal) return;

    const mintTxs = await mintTokensTransactions(amount, usingBaseToken);
    const placePassTxs = await placeOrderTransactions(
      amount / passPrice,
      passPrice,
      { publicKey: proposal.account.openbookPassMarket, account: markets.pass },
      true,
      usingBaseToken,
      true,
    );
    const placeFailTxs = await placeOrderTransactions(
      amount / failPrice,
      failPrice,
      { publicKey: proposal.account.openbookFailMarket, account: markets.fail },
      true,
      usingBaseToken,
      false,
      1,
    );
    if (!mintTxs || !placePassTxs || !placeFailTxs) return;

    try {
      setIsBetting(true);
      await sender.send(
        [...mintTxs, ...placePassTxs, ...placeFailTxs].filter(Boolean).map((e) => [e]),
      );
    } finally {
      setIsBetting(false);
    }

    setTimeout(() => fetchMarketsInfo(), 1000);
  }, [
    amount,
    passPrice,
    failPrice,
    mintTokensTransactions,
    placeOrderTransactions,
    sender,
    fetchMarketsInfo,
  ]);

  return !proposal || !markets ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <Stack align="center" gap="xs" p="lg" pt="xl">
      <Group>
        <Fieldset p="sm">
          <Stack align="center" gap="0">
            <Title order={3} c="green">
              On PASS
            </Title>
            <Text ta="center">The market thinks it will change the value of the DAO to</Text>
            <Title>{numeral(circulatingMarketPassValue).format(NUMERAL_FORMAT)}$</Title>
            <Text ta="center" fw="lighter" size="sm">
              {numeral(totalMarketPassValue).format(NUMERAL_FORMAT)}$ FDV
            </Text>
          </Stack>
        </Fieldset>
        {/* <Container size="3xs" p="0"> */}
        <Fieldset p="sm" w="fit-content">
          <Stack align="center" gap="0">
            <Title order={3} c="red">
              On FAIL
            </Title>
            <Text ta="center">The market thinks it will change the value of the DAO to</Text>
            <Title>{numeral(circulatingMarketFailValue).format(NUMERAL_FORMAT)}$</Title>
            <Text ta="center" fw="lighter" size="sm">
              {numeral(totalMarketFailValue).format(NUMERAL_FORMAT)}$ FDV
            </Text>
          </Stack>
        </Fieldset>
        {/* </Container> */}
      </Group>
      <Group justify="center">
        <Container size="xs" p="0">
          <Stack align="center">
            <Stack align="center" gap="0">
              <TextInput
                type="number"
                label={`${tokens?.meta?.symbol} price if proposal passes`}
                placeholder="Enter price..."
                defaultValue={0}
                w="100%"
                onChange={(e) => setPassPrice(Number(e.target.value))}
              />
              <Text fw="lighter" size="sm">
                You believe that if it passes, this proposal will change the value of the DAO to{' '}
                <Text fw="bolder" ff="monospace" size="md" span>
                  {numeral(circulatingBeliefPassValue).format(NUMERAL_FORMAT)}$
                </Text>{' '}
                ({numeral(totalBeliefPassValue).format(NUMERAL_FORMAT)}$ FDV)
              </Text>
            </Stack>
            <Stack align="center" gap="0">
              <TextInput
                type="number"
                label={`${tokens?.meta?.symbol} price if proposal fails`}
                placeholder="Enter price..."
                defaultValue={0}
                w="100%"
                onChange={(e) => setFailPrice(Number(e.target.value))}
              />
              <Text fw="lighter" size="sm">
                You believe that if it fails, this proposal will change the value of the DAO to{' '}
                <Text fw="bolder" ff="monospace" size="md" span>
                  {numeral(circulatingBeliefFailValue).format(NUMERAL_FORMAT)}$
                </Text>{' '}
                ({numeral(totalBeliefFailValue).format(NUMERAL_FORMAT)}$ FDV)
              </Text>
            </Stack>
            <Text size="sm" fw="bold" c={isBeneficial ? 'green' : 'red'}>
              This proposal is {isBeneficial ? 'BULLISH' : 'BEARISH'} for MetaDAO
            </Text>
            <Stack gap="0">
              <SegmentedControl
                data={['META', 'USDC']}
                onChange={(e) => setSelectedToken(e === 'META' ? tokens?.meta : tokens?.usdc)}
              />
              <TextInput
                type="number"
                label={`${usedToken?.symbol} amount to bet`}
                placeholder="Enter amount..."
                defaultValue={0}
                w="100%"
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <Text fw="lighter" size="sm">
                Balance: {numeral(baseBalance?.uiAmountString || 0).format(NUMERAL_FORMAT)} $
                {tokens?.meta?.symbol}
              </Text>
              <Text fw="lighter" size="sm">
                Balance: {numeral(quoteBalance?.uiAmountString || 0).format(NUMERAL_FORMAT)} $
                {tokens?.usdc?.symbol}
              </Text>
            </Stack>
            <Grid w="100%" align="center">
              <Grid.Col span={10}>
                <Button
                  onClick={handleBet}
                  loading={isBetting}
                  fullWidth
                  disabled={
                    (selectedToken?.publicKey.toString() === tokens?.meta?.publicKey.toString() &&
                      amount > (baseBalance?.uiAmount || 0)) ||
                    (selectedToken?.publicKey.toString() === tokens?.usdc?.publicKey.toString() &&
                      amount > (quoteBalance?.uiAmount || 0))
                  }
                >
                  Bet
                </Button>
              </Grid.Col>
              <Grid.Col span={2}>
                <HoverCard>
                  <HoverCard.Target>
                    <ActionIcon size="lg" variant="outline">
                      <IconQuestionMark />
                    </ActionIcon>
                  </HoverCard.Target>
                  <HoverCard.Dropdown>
                    <Container size="sm">
                      <Stack gap={3} maw="100%">
                        <Text>
                          If PASS market goes {usingBaseToken ? 'above' : 'below'}{' '}
                          {numeral(passPrice).format(NUMERAL_FORMAT)}$ and the proposal passes,
                          {' you will receive '}
                          {numeral(passPayoutAmount).format(NUMERAL_FORMAT)}
                          {' $'}
                          {payoutToken?.symbol}
                        </Text>
                        <Text>
                          If FAIL market goes {usingBaseToken ? 'above' : 'below'}{' '}
                          {numeral(failPrice).format(NUMERAL_FORMAT)}$ and the proposal fails,
                          {' you will receive '}
                          {numeral(failPayoutAmount).format(NUMERAL_FORMAT)}
                          {' $'}
                          {payoutToken?.symbol}
                        </Text>
                        <Text>
                          Otherwise you get back your {numeral(amount).format(NUMERAL_FORMAT)} $
                          {usedToken?.symbol}
                        </Text>
                        <Text size="sm" fw="lighter">
                          Places two {usingBaseToken ? 'asks' : 'bids'} at the defined prices
                        </Text>
                      </Stack>
                    </Container>
                  </HoverCard.Dropdown>
                </HoverCard>
              </Grid.Col>
            </Grid>
          </Stack>
        </Container>
      </Group>
    </Stack>
  );
}
