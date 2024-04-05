import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { useLocalStorage } from '@mantine/hooks';
import { useMemo } from 'react';
import { Networks, useNetworkConfiguration } from './useNetworkConfiguration';
import { DaoState, ProgramVersion, TokensDict, Token } from '@/lib/types';
import { staticTokens } from '@/lib/constants';

export const META_BASE_LOTS = 1_000_000_000;
export const USDC_BASE_LOTS = 1_000_000;

// type Entry<T> = {
//   [K in keyof T]: [K, T[K]]
// }[keyof T];

export function useTokens(daoState: DaoState, programVersion: ProgramVersion) {
  const { network } = useNetworkConfiguration();
  let daoTokenPublicKey = daoState?.metaMint!;
  if (programVersion?.label === 'V0.3') {
    // Stub in to pull instead of metaMint, tokenMint
    daoTokenPublicKey = daoState?.tokenMint;
  }

  const defaultTokens: TokensDict = useMemo(() => {
    switch (network) {
      case Networks.Devnet:
        return { ...staticTokens, ...devnetTokens };
      case Networks.Mainnet:
        return { ...staticTokens, ...mainnetTokens };
      case Networks.Custom:
        // TODO: What if custom is devnet?
        return { ...staticTokens, ...mainnetTokens };
      default:
        return staticTokens;
    }
  }, [network]);

  const daoToken = Object.entries(defaultTokens).filter(
    (token) => {
      if (token[1].publicKey === daoTokenPublicKey) {
        //console.log(token[0]);
        console.log(token);
        return token;
      }
      console.log(token[1].publicKey);
      console.log('dao');
      console.log(daoTokenPublicKey);
      //console.log(index);
      return null;
    }
  );
  //console.log(daoToken);
  //defaultTokens[daoTokenMint]
  //daoToken.token = daoToken[1];
  let quoteToken = defaultTokens.usdc;
  if (programVersion?.label !== 'V0.3') {
    quoteToken = defaultTokens.musdc;
  }

  const usedTokens: TokensDict = useMemo(() => (
    { ...staticTokens, daoToken, quoteToken }
  ), [network]);
  //console.log(usedTokens);
  const [tokens, setTokens] = useLocalStorage<TokensDict>({
    key: 'futarchy-tokens',
    defaultValue: usedTokens,
    getInitialValueInEffect: true,
    serialize: JSON.stringify,
    deserialize: (s) => {
      if (!s) return {};
      const o: TokensDict = JSON.parse(s);
      return Object.fromEntries(
        Object.entries(o).map(([k, v]: [string, Token]) => [
          k,
          { ...v, publicKey: new PublicKey(v.publicKey) },
        ]),
      );
    },
  });

  return {
    tokens,
    setTokens: (newTokens: TokensDict) => {
      // Simple optimization to prevent unnecessary updates
      const mergedTokens = { ...tokens, ...newTokens };
      if (JSON.stringify(mergedTokens) !== JSON.stringify(tokens)) {
        setTokens(mergedTokens);
      }
    },
  };
}
