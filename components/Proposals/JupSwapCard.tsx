import {
  ActionIcon,
  Button,
  Center,
  Text,
  Title,
  TextInput,
  Divider,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { IconArrowsDownUp } from '@tabler/icons-react';
// import { debounce } from '@/lib/utils';
import { VersionedTransaction } from '@solana/web3.js';
import { createJupiterApiClient } from '@jup-ag/api';
import { useProvider } from '@/hooks/useProvider';
import poweredByJup from '../../public/poweredbyjupiter-grayscale.svg';

const META_BASE_LOTS = 1_000_000_000;
const USDC_BASE_LOTS = 1_000_000;

export function JupSwapCard() {
  const provider = useProvider();
  const [inAmount, setInAmount] = useState<number>(1);
  const [outAmount, setOutAmount] = useState<number>(0);
  const [base, setBase] = useState<string>('meta');
  const [quote, setQuote] = useState<string>('usdc');
  const jupiterQuoteApi = createJupiterApiClient();

  const tokens = [
    {
      mintAddress: 'METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr',
      name: 'meta',
    },
    {
      mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      name: 'usdc',
    },
  ];

  const fetchQuote = async (amount: number, slippage: number) => {
    const baseMint: {
      mintAddress: string,
      name: string
    } = tokens.filter((token) => token.name === base)[0];
    const quoteMint: {
      mintAddress: string,
      name: string
    } = tokens.filter((token) => token.name === quote)[0];

    // debounce(async () => {
    const quoteResponse = await jupiterQuoteApi.quoteGet({
      inputMint: baseMint.mintAddress,
      outputMint: quoteMint.mintAddress,
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
    // }, 100);
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

  const convertFromJup = (amount: number, token: string) => token === 'meta' ? amount / META_BASE_LOTS : amount / USDC_BASE_LOTS;

  const convertToJup = (amount: number, token: string) => token === 'meta' ? amount * META_BASE_LOTS : amount * USDC_BASE_LOTS;

  const updateAndFetchQuote = async (amount: number) => {
    setInAmount((_amount) => _amount === amount ? _amount : amount);
    const jupAmount = convertToJup(amount, base);
    try {
      const quoteResponse = await fetchQuote(jupAmount, 50);
      if (!quoteResponse) return;
      const readableAmount = convertFromJup(Number(quoteResponse.outAmount), quote);
      setOutAmount(
        (_outAmount) => _outAmount === readableAmount ? _outAmount : readableAmount
      );
      return quoteResponse;
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  const handleSwap = async () => {
    const quoteResponse = await updateAndFetchQuote(inAmount);
    if (!quoteResponse) return;
    const jupTransaction = await buildTransaction(quoteResponse);
    try {
      const swapTransactionBuf = Buffer.from(jupTransaction.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      const _transaction = await provider.wallet.signTransaction(transaction);

      const txId = await provider.sendAndConfirm(_transaction);
      return txId;
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  const swapBase = () => {
    setBase((_base) => _base === 'meta' ? 'usdc' : 'meta');
    setQuote((_quote) => _quote === 'usdc' ? 'meta' : 'usdc');
  };

  useEffect(() => {
    updateAndFetchQuote(inAmount);
    // swapBase();
  }, [inAmount, base]);

  return (
    <>
      <Divider />
      <Title order={5}>Swap</Title>
      <Image
        priority
        src={poweredByJup}
        alt="Powered By Jupiter"
      />
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
      <Center>
        <ActionIcon
          variant="outline"
          onClick={swapBase}
        >
          <IconArrowsDownUp stroke={1.5} size={18} />
        </ActionIcon>
      </Center>
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
        disabled={!provider.publicKey}
        onClick={handleSwap}
      >Swap
      </Button>
    </>
  );
}
