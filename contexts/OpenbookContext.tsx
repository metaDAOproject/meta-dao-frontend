import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, type Message } from '@solana/web3.js';
import { Program, utils } from '@coral-xyz/anchor';
import { useProvider } from '@/hooks/useProvider';
import { OPENBOOK_PROGRAM_ID } from '@/lib/constants';
import { IDL as OPENBOOK_IDL, OpenbookV2 } from '@/lib/idl/openbook_v2';

interface Market {
  market: string;
  baseMint: string;
  quoteMint: string;
  name: string;
  timestamp: number | null | undefined;
}

export interface OpenbookInterface {
  markets: Market[] | undefined;
}

const BATCH_TX_SIZE = 50;
export const openbookContext = createContext<OpenbookInterface | undefined>(undefined);

export const useOpenbook = () => {
    const context = useContext(openbookContext);
    if (!context) {
      throw new Error('useOpenBook must be used within a OpenBookContextProvider');
    }
    return context;
  };

export function OpenbookProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connection } = useConnection();
  const provider = useProvider();
  const [markets, setMarkets] = useState<Market[]>();

  const findAllMarkets = useCallback(
    async () => {
      if (provider == null) {
        return;
      }
      const program = new Program<OpenbookV2>(OPENBOOK_IDL, OPENBOOK_PROGRAM_ID, provider);

      const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        OPENBOOK_PROGRAM_ID,
      );
      const marketsAll: Market[] = [];

      const signatures = (
        await connection.getSignaturesForAddress(eventAuthority)
      ).map((x) => x.signature);
      const batchSignatures: [string[]] = [[]];
      for (let i = 0; i < signatures.length; i += BATCH_TX_SIZE) {
        batchSignatures.push(signatures.slice(0, BATCH_TX_SIZE));
      }
      // eslint-disable-next-line no-restricted-syntax
      for (const batch of batchSignatures) {
        // eslint-disable-next-line no-await-in-loop
        const allTxs = await connection.getTransactions(batch, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        // eslint-disable-next-line no-restricted-syntax
        for (const tx of allTxs) {
          if (
            tx?.meta?.innerInstructions !== null &&
            tx?.meta?.innerInstructions !== undefined
          ) {
            // eslint-disable-next-line no-restricted-syntax
            for (const innerIns of tx.meta.innerInstructions) {
              const innerIx = innerIns.instructions?.[11];
              if (innerIx?.accounts?.[0] !== undefined) {
                // validate key and program key
                const eventAuthorityKey = innerIx.accounts[0];
                const programKey = innerIx.programIdIndex;
                if (
                  (tx.transaction.message as Message).staticAccountKeys[
                    eventAuthorityKey
                  ]?.toString() !== eventAuthority.toString() ||
                  (tx.transaction.message as Message).staticAccountKeys[
                    programKey
                  ]?.toString() !== OPENBOOK_PROGRAM_ID.toString()
                ) {
                  // eslint-disable-next-line no-continue
                  continue;
                } else {
                  const ixData = utils.bytes.bs58.decode(innerIx.data);
                  const eventData = utils.bytes.base64.encode(ixData.slice(8));
                  const event = program.coder.events.decode(eventData);

                  if (event != null) {
                    // eslint-disable-next-line @typescript-eslint/no-shadow
                    const market: Market = {
                      market: (event.data.market as PublicKey).toString(),
                      baseMint: (event.data.baseMint as PublicKey).toString(),
                      quoteMint: (event.data.quoteMint as PublicKey).toString(),
                      name: event.data.name as string,
                      timestamp: tx.blockTime,
                    };
                    marketsAll.push(market);
                  }
                }
              }
            }
          }
        }
      }
      setMarkets(marketsAll);
    }, [connection, provider]
  );

  useEffect(() => {
    if (!markets) {
      findAllMarkets();
    }
  });

  return (
    <openbookContext.Provider
      value={{
        markets,
      }}
    >
      {children}
    </openbookContext.Provider>
  );
}
