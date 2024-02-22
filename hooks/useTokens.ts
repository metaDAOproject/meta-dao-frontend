import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { useLocalStorage } from '@mantine/hooks';
import { Networks, useNetworkConfiguration } from './useNetworkConfiguration';
import { useCallback, useMemo } from 'react';

export interface Token {
  name: string;
  symbol: string;
  icon?: string;
  publicKey: PublicKey;
  decimals: number;
  tokenProgram: PublicKey;
}

const staticTokens = {
  wsol: {
    name: 'Solana',
    symbol: 'SOL',
    icon: '',
    publicKey: new PublicKey('So11111111111111111111111111111111111111112'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
};

const mainnetTokens: TokensDict = {
  meta: {
    name: 'Meta',
    symbol: 'META',
    icon: '',
    publicKey: new PublicKey('METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  usdc: {
    name: 'USD Coin',
    symbol: 'USDC',
    icon: '',
    publicKey: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    decimals: 6,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
};

const devnetTokens: TokensDict = {
  meta: {
    name: 'Meta',
    symbol: 'META',
    icon: '',
    publicKey: new PublicKey('METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr'),
    decimals: 9,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  usdc: {
    name: 'USD Coin',
    symbol: 'USDC',
    icon: '',
    publicKey: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    decimals: 6,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
};

type TokenKeys = 'meta' | 'usdc' | keyof typeof staticTokens;
type TokensDict = Partial<{ [key in TokenKeys]: Token }>;

export function useTokens() {
  const { network } = useNetworkConfiguration();
  
  const defaultTokens = useMemo(() => {
    switch (network) {
      case Networks.Devnet:
        return { ...staticTokens, ...devnetTokens };
      case Networks.Mainnet:
        return { ...staticTokens, ...mainnetTokens };
      case Networks.Custom:
        return { ...staticTokens, ...mainnetTokens };
      default:
        return staticTokens;
    }
  }, [network])

  const [tokens, setTokens] = useLocalStorage<TokensDict>({
    key: 'futarchy-tokens',
    defaultValue: defaultTokens,
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
    tokens: tokens,
    setTokens: (newTokens: TokensDict) => {
      // Simple optimization to prevent unnecessary updates
      const mergedTokens = { ...tokens, ...newTokens };
      if (JSON.stringify(mergedTokens) !== JSON.stringify(tokens)) {
        setTokens(mergedTokens);
      }
    },
  };
}
