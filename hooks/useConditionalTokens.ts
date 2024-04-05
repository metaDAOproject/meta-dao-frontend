import { useMemo } from 'react';

import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';
import { useBalance } from './useBalance';
import { useAutocrat } from '@/contexts/AutocratContext';
import { Token } from '@/lib/types';

export interface ConditionalToken {
  token: Token;
  symbol: string;
  balanceSpot: BN;
  balancePass: BN;
  balanceFail: BN;
  finalize: PublicKey;
  revert: PublicKey;
  loading?: boolean;
}

export default function useConditionalTokens() {
  const { daoTokens } = useAutocrat();
  const tokens = daoTokens;
  const { markets } = useProposalMarkets();
  if (!markets) {
    return {
      quoteToken: undefined,
      baseToken: undefined,
      quoteBalance: undefined,
      baseBalance: undefined,
      pquoteBalance: undefined,
      pBaseBalance: undefined,
      fquoteBalance: undefined,
      fBaseBalance: undefined,
    };
  }
  const { base, quote } = useMemo(
    () => ({ base: markets.baseVault, quote: markets.quoteVault }),
    [markets],
  );

  const {
    amount: { data: quoteBalance, isLoading: isQuoteLoading },
  } = useBalance(quote.underlyingTokenMint);
  const {
    amount: { data: baseBalance, isLoading: isBaseLoading },
  } = useBalance(base.underlyingTokenMint);
  const {
    amount: { data: pBaseBalance, isLoading: isPbaseLoading },
  } = useBalance(base.conditionalOnFinalizeTokenMint);
  const {
    amount: { data: fBaseBalance, isLoading: isFbaseLoading },
  } = useBalance(base.conditionalOnRevertTokenMint);

  const {
    amount: { data: pQuoteBalance, isLoading: isPquoteLoading },
  } = useBalance(quote.conditionalOnFinalizeTokenMint);
  const {
    amount: { data: fQuoteBalance, isLoading: isFquoteLoading },
  } = useBalance(quote.conditionalOnRevertTokenMint);

  const baseToken: ConditionalToken | undefined = {
    token: tokens?.baseToken as unknown as Token,
    symbol: tokens?.baseToken?.symbol as unknown as string,
    balanceSpot: baseBalance,
    balancePass: pBaseBalance,
    balanceFail: fBaseBalance,
    loading: isBaseLoading || isFbaseLoading || isPbaseLoading,
    finalize: base.conditionalOnFinalizeTokenMint,
    revert: base.conditionalOnRevertTokenMint,
  };
  const quoteToken: ConditionalToken | undefined = {
    token: tokens?.quoteToken as unknown as Token,
    symbol: tokens?.quoteToken?.symbol as unknown as string,
    balanceSpot: quoteBalance,
    balancePass: pQuoteBalance,
    balanceFail: fQuoteBalance,
    loading: isQuoteLoading || isFquoteLoading || isPquoteLoading,
    finalize: quote.conditionalOnFinalizeTokenMint,
    revert: quote.conditionalOnRevertTokenMint,
  };

  return { quoteToken, baseToken, quoteBalance, baseBalance };
}
