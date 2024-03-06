import { useEffect, useMemo, useState } from 'react';

import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useBalance } from './useBalance';
import { Token, useTokens } from './useTokens';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';

export interface ConditionalToken {
  token: Token;
  symbol: string;
  balanceSpot: BN;
  balancePass: BN;
  balanceFail: BN;
  finalize: PublicKey;
  revert: PublicKey;
}

export default function useConditionalTokens() {
  const { markets } = useProposalMarkets();
  if (!markets) {
    return {
      usdcToken: undefined,
      metaToken: undefined,
      usdcBalance: undefined,
      metaBalance: undefined,
      pUsdcBalance: undefined,
      pMetaBalance: undefined,
      fUsdcBalance: undefined,
      fMetaBalance: undefined,
    };
  }
  const { tokens } = useTokens();
  const { base, quote } = useMemo(() => (
    { base: markets.baseVault, quote: markets.quoteVault }
  ), [markets]);

  const {
    amount: usdcBalance,
  } = useBalance(quote.underlyingTokenMint);
  const {
    amount: metaBalance,
  } = useBalance(base.underlyingTokenMint);
  const {
    amount: pMetaBalance,
  } = useBalance(base.conditionalOnFinalizeTokenMint);
  const {
    amount: fMetaBalance,
  } = useBalance(base.conditionalOnRevertTokenMint);

  const {
    amount: pUsdcBalance,
  } = useBalance(quote.conditionalOnFinalizeTokenMint);
  const {
    amount: fUsdcBalance,
  } = useBalance(quote.conditionalOnRevertTokenMint);

  const [metaToken, setMetaToken] = useState<ConditionalToken | undefined>();
  const [usdcToken, setUsdcToken] = useState<ConditionalToken | undefined>();

  useEffect(() => {
    if (tokens && base && quote) {
      setMetaToken({
        token: tokens.meta as unknown as Token,
        symbol: tokens.meta?.symbol as unknown as string,
        balanceSpot: metaBalance,
        balancePass: pMetaBalance,
        balanceFail: fMetaBalance,
        finalize: base.conditionalOnFinalizeTokenMint,
        revert: base.conditionalOnRevertTokenMint,
      });
      setUsdcToken({
        token: tokens.usdc as unknown as Token,
        symbol: tokens.usdc?.symbol as unknown as string,
        balanceSpot: usdcBalance,
        balancePass: pUsdcBalance,
        balanceFail: fUsdcBalance,
        finalize: quote.conditionalOnFinalizeTokenMint,
        revert: quote.conditionalOnRevertTokenMint,
      });
    }
  }, [
    tokens, base, quote, metaBalance, fMetaBalance,
    pMetaBalance, usdcBalance, fUsdcBalance, pUsdcBalance,
  ]);

  return ({ usdcToken, metaToken, usdcBalance, metaBalance });
}
