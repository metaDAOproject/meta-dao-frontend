import useSWR, { SWRResponse } from 'swr';
import { VersionedTransaction } from '@solana/web3.js';
import { useProvider } from '@/hooks/useProvider';

function getTokenPrice(data: any) {
  const price = Math.round((Number(data.outAmount) / Number(data.inAmount)) * 1000000) / 1000;
  return price;
}

export function getJupPrice(amount: number, slippage: number = 50) {
  const url =
    'https://quote-api.jup.ag/v6/quote?inputMint=METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr&' +
    'outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&' +
    `amount=${amount.toString()}&` +
    `slippageBps=${slippage.toString()}&` +
    'swapMode=ExactIn&' +
    'onlyDirectRoutes=false&' +
    'maxAccounts=64&' +
    'experimentalDexes=Jupiter%20LO';

  const getRoute = () =>
    fetch(url)
      .then((res) => res.json());

  const { data, error, isLoading } = useSWR('metaSpotPrice', getRoute);
  return {
    data,
    error,
    isLoading,
  };
}

export function swapThroughJup(amount: number, slippage: number) {
  // TODO: Add in params passed in
  // https://station.jup.ag/docs/apis/swap-api
  const provider = useProvider();

  const { data, error, isLoading } = getJupPrice(amount, slippage);

  const url = 'https://quote-api.jup.ag/v6/swap';

  const swapTokenTxn = () => fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        userPublicKey: provider.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true, // allow dynamic compute limit instead of max 1,400,000
        // custom priority fee
        prioritizationFeeLamports: 'auto', // or custom lamports: 1000
      }),
    })
      .then((res) => res.json());

  const { data, error, isLoading } = useSWR('jupSwapTxn', swapTokenTxn);

  const swapTransactionBuf = Buffer.from(data, 'base64');

  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  console.log(transaction);

  provider.wallet.signTransaction(transaction);

  const txId = provider.sendAndConfirm(transaction);
  console.log(txId);
  return {
    txId,
    error,
    isLoading,
  };
}

export function useJupTokenPrice() {
  const { data, error, isLoading } = getJupPrice(100000000, 50) as SWRResponse;
  const price = getTokenPrice(data.data);

  return {
    price,
    error,
    isLoading,
  };
}
