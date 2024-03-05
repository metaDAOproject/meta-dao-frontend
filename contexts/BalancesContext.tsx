import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, LAMPORTS_PER_SOL, PublicKey, TokenAmount } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useQueryClient } from '@tanstack/react-query';
import { BN } from '@coral-xyz/anchor';

export const defaultAmount: TokenAmount = {
    amount: '0.0',
    decimals: 0.0,
    uiAmount: 0.0,
};

type Balances = { [token: string]: TokenAmount };

export interface BalancesInterface {
    balances: Balances;
    fetchBalance: (mint: PublicKey) => Promise<TokenAmount>;
    getBalance: (mint: PublicKey) => Promise<TokenAmount>;
}

export const balancesContext = createContext<BalancesInterface>({
    balances: {},
    fetchBalance: () => new Promise(() => {}),
    getBalance: () => new Promise(() => {}),
});

export const useBalances = () => {
    const context = useContext(balancesContext);
    if (!context) {
        throw new Error('useBalances must be used within a BalancesContextProvider');
    }
    return context;
};

export function BalancesProvider({
    children,
    owner,
}: {
    children: React.ReactNode;
    owner?: PublicKey;
}) {
    const client = useQueryClient();
    const { connection } = useConnection();
    const [balances, setBalances] = useState<{ [ata: string]: TokenAmount }>({});
    const [websocketConnected, setWebsocketConnected] = useState<boolean>(false);

    const fetchBalance = useCallback(
        async (mint: PublicKey | string) => {
            if (connection && owner) {
                const ata = getAssociatedTokenAddressSync(
                    new PublicKey(mint.toString()),
                    owner,
                    true,
                );
                try {
                    const amount = await client.fetchQuery({
                        queryKey: [`getTokenAccountBalance-${ata.toString()}-undefined`],
                        queryFn: () => connection.getTokenAccountBalance(ata),
                        staleTime: 10_000,
                    });
                    setBalances((old) => ({
                        ...old,
                        [ata.toString()]: amount.value,
                    }));
                    return amount.value;
                } catch (err) {
                    console.error(
                        `Error with this account fetch ${ata.toString()} (owner: ${owner.toString()}, mint: ${mint?.toString()}), please review issue and solve.`,
                    );
                    return defaultAmount;
                }
            } else {
                return defaultAmount;
            }
        },
        [connection, owner],
    );

    async function findTokenAccountsByOwner(walletPublicKey: PublicKey): Promise<PublicKey[]> {
        const { value } = await connection.getTokenAccountsByOwner(walletPublicKey, {
            programId: new PublicKey(TOKEN_PROGRAM_ID),
        });

        return value.map(({ pubkey }) => pubkey);
    }

    async function subscribeToTokenBalances() {
        if (!owner) return;
        const tokenAccountPubkeys = await findTokenAccountsByOwner(owner);

        for (const pubkey of tokenAccountPubkeys) {
            connection.onAccountChange(pubkey, (accountInfo: AccountInfo<Buffer>) => {
                const accountData = AccountLayout.decode(accountInfo.data);

                const dividedTokenAmount = new BN(accountData.amount) / new BN(LAMPORTS_PER_SOL);
                const tokenVal: TokenAmount = {
                    amount: dividedTokenAmount.toString(),
                    decimals: 9,
                    uiAmount: dividedTokenAmount,
                    uiAmountString: dividedTokenAmount.toString(),
                };

                setBalances((old) => ({
                    ...old,
                    [pubkey.toString()]: tokenVal,
                }));
            });
        }

        setWebsocketConnected(true);
    }

    useEffect(() => {
        if (!websocketConnected && owner) {
            subscribeToTokenBalances();
        }
    }, [owner]);

    const getBalance = useCallback(
        async (mint: PublicKey | string) => {
            if (Object.prototype.hasOwnProperty.call(balances, mint.toString())) {
                return balances[mint.toString()];
            }
            return fetchBalance(mint);
        },
        [balances, fetchBalance],
    );

    return (
        <balancesContext.Provider
            value={{
                balances,
                fetchBalance,
                getBalance,
            }}
        >
            {children}
        </balancesContext.Provider>
    );
}
