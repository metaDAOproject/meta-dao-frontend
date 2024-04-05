import { ActionIcon, Button, Divider, Group, Text, Title, TextInput } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { IconArrowsDownUp, IconWallet } from '@tabler/icons-react';
import { VersionedTransaction } from '@solana/web3.js';
import { createJupiterApiClient } from '@jup-ag/api';
import { useProvider } from '@/hooks/useProvider';
import poweredByJup from '../../public/poweredbyjupiter-grayscale.svg';
import { useTransactionSender } from '@/hooks/useTransactionSender';
import { useBalance } from '@/hooks/useBalance';
import { type Token, useTokens } from '@/hooks/useTokens';

export function JupSwapCard() {
  const provider = useProvider();
  const [inAmount, setInAmount] = useState<number>(1);
  const [outAmount, setOutAmount] = useState<number>();
  const [isSwapping, setIsSwapping] = useState(false);
  const jupiterQuoteApi = createJupiterApiClient();
  const sender = useTransactionSender();
  // TODO: Have this work with PROPOSAL
  const [base, setBase] = useState<string>('META');
  const [quote, setQuote] = useState<string>('USDC');

  const baseToken = Object.fromEntries(
    Object.entries(tokens) as Entry<T>[]).filter((token: Token) => token.symbol === base
  );

  const quoteToken = Object.fromEntries(
    Object.entries(tokens) as Entry<T>[]).filter((token: Token) => token.symbol === quote
  );

  const { amount: { data: balance } } = useBalance(baseToken.publicKey);

  const fetchQuote = async (amount: number, slippage: number) => {
    const baseMint = baseToken.publicKey;
    const quoteMint = quoteToken.publicKey;

    const quoteResponse = await jupiterQuoteApi.quoteGet({
      inputMint: baseMint,
      outputMint: quoteMint,
      amount,
      slippageBps: slippage,
      swapMode: 'ExactIn',
      onlyDirectRoutes: false,
      maxAccounts: 64,
    });

    if (!quote) {
      console.error('unable to quote');
      return;
    }

    return quoteResponse;
  };

  const buildTransaction = async (_quote: any) => {
    const swapResult = await jupiterQuoteApi.swapPost({
      swapRequest: {
        quoteResponse: _quote,
        userPublicKey: provider.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      },
    });
    return swapResult;
  };

  const convertFromJup = (amount: number, isBase: boolean): number =>
    isBase ? amount / (10 ** baseToken.decimals) : amount / (10 ** quoteToken.decimals);

  const convertToJup = (amount: number, isBase: boolean): number =>
    isBase ? amount * (10 ** baseToken.decimals) : amount * (10 ** quoteToken.decimals);

  const updateAndFetchQuote = async (amount: number) => {
    setInAmount((_amount) => (_amount === amount ? _amount : amount));
    const jupAmount = convertToJup(amount, true);
    try {
      const quoteResponse = await fetchQuote(jupAmount, 50);
      if (!quoteResponse) return;
      const readableAmount = convertFromJup(Number(quoteResponse.outAmount), false);
      setOutAmount((_outAmount) => (_outAmount === readableAmount ? _outAmount : readableAmount));
      return quoteResponse;
    } catch (err) {
      // console.error(err);
    }
    return null;
  };

  const handleSwap = useCallback(async () => {
    const quoteResponse = await updateAndFetchQuote(inAmount);
    if (!quoteResponse) return;
    const jupTransaction = await buildTransaction(quoteResponse);
    try {
      setIsSwapping(true);
      const swapTransactionBuf = Buffer.from(jupTransaction.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      await sender.send([transaction]);
    } catch (err) {
      // console.error(err);
    } finally {
      setIsSwapping(false);
    }
    return null;
  }, [updateAndFetchQuote, buildTransaction, inAmount]);

  const swapBase = () => {
    setBase((_base) => (_base === 'meta' ? 'usdc' : 'meta'));
    setQuote((_quote) => (_quote === 'usdc' ? 'meta' : 'usdc'));
  };

  useEffect(() => {
    updateAndFetchQuote(inAmount);
  }, [base]);

  return (
    <>
      <Divider />
      <Title order={5}>Swap</Title>
      <Group justify="space-between">
        <Image priority src={poweredByJup} alt="Powered By Jupiter" />
        {balance && balance.amount && (
          <Group p={0} m={0}>
            <Text ml={0} size="xs">
              <IconWallet height={12} />
              {balance.uiAmount}
            </Text>
          </Group>
        )}
      </Group>
      <TextInput
        value={inAmount}
        onChange={(e) => updateAndFetchQuote(Number(e.target.value))}
        rightSectionWidth={100}
        rightSection={
          <>
            <Divider orientation="vertical" />
            <Text pl={10}>{base.toLocaleUpperCase()}</Text>
          </>
        }
      />
      <Divider
        labelPosition="right"
        label={
          <ActionIcon variant="outline" onClick={swapBase}>
            <IconArrowsDownUp stroke={1.5} size={18} />
          </ActionIcon>
        }
      />
      <TextInput
        value={outAmount}
        disabled
        rightSectionWidth={100}
        rightSection={
          <>
            <Divider orientation="vertical" />
            <Text pl={10}>{quote.toLocaleUpperCase()}</Text>
          </>
        }
      />
      <Button
        variant="outline"
        loading={isSwapping}
        disabled={!provider.publicKey}
        onClick={handleSwap}
      >
        Swap
      </Button>
    </>
  );
}
