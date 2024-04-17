import useSWR from 'swr';
import { convertTokenPrice } from '@/lib/utils';

export type FetchSpotPriceProps = {
  programKey: string | null;
};

export function useFetchSpotPrice(props: FetchSpotPriceProps) {
  const { programKey } = props;
  let inputMint = 'METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr';
  let tokenBase = 100_000_000;
  let decimals = 3;
  let tokenName = 'META';
  if (programKey
    && programKey === 'fut5MzSUFcmxaEHMvo9qQThrAL4nAv5FQ52McqhniSt'
  ) {
    inputMint = 'FUTURETnhzFApq2TiZiNbWLQDXMx4nWNpFtmvTf11pMy';
    tokenBase = 100_000_000;
    decimals = 5;
    tokenName = 'FUTURE';
  }
  const url =
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&` +
    'outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&' +
    `amount=${tokenBase.toString()}&` +
    'slippageBps=50&' +
    'swapMode=ExactIn&' +
    'onlyDirectRoutes=false&' +
    'maxAccounts=64&' +
    'experimentalDexes=Jupiter%20LO';
  const tokenPriceFetcher = () =>
    fetch(url)
      .then((res) => res.json())
      .then((data) => convertTokenPrice(data, decimals));
  const { data, error, isLoading } = useSWR(`${tokenName}SpotPrice`, tokenPriceFetcher);
  return {
    token: tokenName,
    price: data,
    isLoading,
    isError: error,
  };
}
