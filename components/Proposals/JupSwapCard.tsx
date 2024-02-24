import {
  ActionIcon,
  Button,
  Center,
  Text,
  TextInput,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconArrowsDownUp } from '@tabler/icons-react';
// import { debounce } from '@/lib/utils';
import { VersionedTransaction } from '@solana/web3.js';
import { useProvider } from '@/hooks/useProvider';

const META_BASE_LOTS = 1_000_000_000;
const USDC_BASE_LOTS = 1_000_000;

export function JupSwapCard() {
  const provider = useProvider();
  const [inAmount, setInAmount] = useState<number>(1);
  const [outAmount, setOutAmount] = useState<number>(0);
  const [base, setBase] = useState<string>('meta');
  const [quote, setQuote] = useState<string>('usdc');

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
    const url =
      `https://quote-api.jup.ag/v6/quote?inputMint=${baseMint.mintAddress}&` +
      `outputMint=${quoteMint.mintAddress}&` +
      `amount=${amount.toString()}&` +
      `slippageBps=${slippage.toString()}&` +
      'swapMode=ExactIn&' +
      'onlyDirectRoutes=false&' +
      'maxAccounts=64&' +
      'experimentalDexes=Jupiter%20LO';

    const getRoute = () =>
      fetch(url)
        .then((res) => res.json());

    // debounce(async () => {
    const quoteResponse = await getRoute();

    return quoteResponse;
    // }, 100);
  };

  const buildTransaction = async (quoteResponse: any) => {
    const url = 'https://quote-api.jup.ag/v6/swap';
    const swapTokenTxn = () => fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quoteResponse.data,
        userPublicKey: provider.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true, // allow dynamic compute limit instead of max 1,400,000
        // custom priority fee
        prioritizationFeeLamports: 'auto', // or custom lamports: 1000
      }),
    })
      .then((res) => res.json());
    return swapTokenTxn();
  };

  const convertFromJup = (amount: number, token: string) => token === 'meta' ? amount / META_BASE_LOTS : amount / USDC_BASE_LOTS;

  const convertToJup = (amount: number, token: string) => token === 'meta' ? amount * META_BASE_LOTS : amount * USDC_BASE_LOTS;

  const updateAndFetchQuote = async (amount: number) => {
    setInAmount((_amount) => _amount === amount ? _amount : amount);
    const jupAmount = convertToJup(amount, base);
    try {
      const quoteResponse = await fetchQuote(jupAmount, 50);
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
      const swapTransactionBuf = Buffer.from(jupTransaction, 'base64');

      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      console.log(transaction);

      await provider.wallet.signTransaction(transaction);

      const txId = await provider.sendAndConfirm(transaction);
      console.log(txId);
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
      <Text size="md">Swap with Jupiter</Text>
      <TextInput
        value={inAmount}
        onChange={(e) => updateAndFetchQuote(Number(e.target.value))}
        rightSectionWidth={120}
        rightSection={
          <>
          <Text>{base.toLocaleUpperCase()}</Text>
          </>
        }
      />
      <Center>
        <ActionIcon
          variant="outline"
          onClick={swapBase}
        >
          <IconArrowsDownUp />
        </ActionIcon>
      </Center>
      <TextInput
        value={outAmount}
        disabled
        rightSectionWidth={120}
        rightSection={
          <>
          <Text>{quote.toLocaleUpperCase()}</Text>
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
