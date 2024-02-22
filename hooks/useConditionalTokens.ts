import { useEffect, useMemo, useState } from "react";


import { useProposal } from "@/contexts/ProposalContext";
import { useBalance } from "./useBalance";
import { Token, useTokens } from "./useTokens";
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export interface ConditionalToken {
    token: Token;
    symbol: string;
    balanceSpot: BN;
    balancePass: BN;
    balanceFail: BN;
    fetchUnderlying: () => Promise<void>
    fetchPass: () => Promise<void>,
    fetchFail: () => Promise<void>
    finalize: PublicKey;
    revert: PublicKey;
}

export default function useConditionalTokens() {
    const { markets } = useProposal();
    if (!markets)
        return { usdcToken: undefined, metaToken: undefined, usdcBalance: undefined, metaBalance: undefined, pUsdcBalance: undefined, pMetaBalance: undefined, fUsdcBalance: undefined, fMetaBalance: undefined }
    const { tokens } = useTokens()
    const { base, quote } = useMemo(() => ({ base: markets.baseVault, quote: markets.quoteVault }), [markets]);

    const { amount: usdcBalance, fetchAmount: fetchUnderlyingUsdc } = useBalance(quote.underlyingTokenMint);
    const { amount: metaBalance, fetchAmount: fetchUnderlyingMeta } = useBalance(base.underlyingTokenMint);
    const {
        amount: pMetaBalance,
        fetchAmount: fetchPassMeta,
    } = useBalance(base.conditionalOnFinalizeTokenMint);
    const {
        amount: fMetaBalance,
        fetchAmount: fetchFailMeta,
    } = useBalance(base.conditionalOnRevertTokenMint);

    const {
        amount: pUsdcBalance,
        fetchAmount: fetchPassUsdc,
    } = useBalance(quote.conditionalOnFinalizeTokenMint);
    const {
        amount: fUsdcBalance,
        fetchAmount: fetchFailUsdc,
    } = useBalance(quote.conditionalOnRevertTokenMint);


    const [metaToken, setMetaToken] = useState<ConditionalToken | undefined>()
    const [usdcToken, setUsdcToken] = useState<ConditionalToken | undefined>()

    useEffect(() => {
        if (tokens && base && quote) {
            setMetaToken({
                token: tokens.meta as unknown as Token,
                symbol: tokens.meta?.symbol as unknown as string,
                balanceSpot: metaBalance,
                balancePass: pMetaBalance,
                balanceFail: fMetaBalance,
                fetchUnderlying: fetchUnderlyingMeta,
                fetchPass: fetchPassMeta,
                fetchFail: fetchFailMeta,
                finalize: base.conditionalOnFinalizeTokenMint,
                revert: base.conditionalOnRevertTokenMint,
            })
            setUsdcToken({
                token: tokens.usdc as unknown as Token,
                symbol: tokens.usdc?.symbol as unknown as string,
                balanceSpot: usdcBalance,
                balancePass: pUsdcBalance,
                balanceFail: fUsdcBalance,
                fetchUnderlying: fetchUnderlyingUsdc,
                fetchPass: fetchPassUsdc,
                fetchFail: fetchFailUsdc,
                finalize: quote.conditionalOnFinalizeTokenMint,
                revert: quote.conditionalOnRevertTokenMint,
            })
        }

    }, [tokens, base, quote, metaBalance, fMetaBalance, pMetaBalance, usdcBalance, fUsdcBalance, pUsdcBalance])

    return ({ usdcToken, metaToken, usdcBalance, metaBalance })
}