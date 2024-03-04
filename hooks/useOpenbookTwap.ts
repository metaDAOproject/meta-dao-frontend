import { useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  AccountMeta,
  PublicKey,
  Transaction,
  VersionedTransaction,
  MessageV0,
} from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PlaceOrderArgs } from '@openbook-dex/openbook-v2/dist/types/client';
import {
  SelfTradeBehavior,
  OrderType,
  SideUtils,
} from '@openbook-dex/openbook-v2/dist/cjs/utils/utils';
import { OpenbookTwap } from '@/lib/idl/openbook_twap';
import { OPENBOOK_PROGRAM_ID, OPENBOOK_TWAP_PROGRAM_ID, QUOTE_LOTS } from '@/lib/constants';
import {
  FillEvent,
  MarketAccountWithKey,
  OpenOrdersAccountWithKey,
  OutEvent,
  ProposalAccountWithKey,
} from '@/lib/types';
import { shortKey } from '@/lib/utils';
import { useProvider } from '@/hooks/useProvider';
import {
  createOpenOrdersIndexerInstruction,
  createOpenOrdersInstruction,
  findOpenOrders,
  findOpenOrdersIndexer,
} from '../lib/openbook';
import { useConditionalVault } from './useConditionalVault';
import { useOpenbook } from './useOpenbook';
import { useTransactionSender } from './useTransactionSender';
import { getTwapMarketKey } from '../lib/openbookTwap';

const OPENBOOK_TWAP_IDL: OpenbookTwap = require('@/lib/idl/openbook_twap.json');

const SYSTEM_PROGRAM: PublicKey = new PublicKey('11111111111111111111111111111111');

export function useOpenbookTwap() {
  const wallet = useWallet();
  const provider = useProvider();
  const sender = useTransactionSender();
  const { getVaultMint } = useConditionalVault();
  const openbook = useOpenbook().program;
  const openbookTwap = useMemo(() => {
    if (!provider) {
      return;
    }
    return new Program<OpenbookTwap>(OPENBOOK_TWAP_IDL, OPENBOOK_TWAP_PROGRAM_ID, provider);
  }, [provider]);

  const createPlaceOrderArgs = ({
    amount,
    price,
    limitOrder,
    ask,
    accountIndex,
  }: {
    amount: number;
    price: number;
    accountIndex: number;
    limitOrder?: boolean;
    ask?: boolean;
  }): PlaceOrderArgs => {
    let priceLots = new BN(Math.floor(price / QUOTE_LOTS));
    const maxBaseLots = new BN(Math.floor(amount));
    let maxQuoteLotsIncludingFees = priceLots.mul(maxBaseLots);
    if (!limitOrder) {
      priceLots = new BN(1_000_000_000_000_000);
      maxQuoteLotsIncludingFees = priceLots.mul(maxBaseLots);
    }
    return {
      side: ask ? SideUtils.Ask : SideUtils.Bid,
      priceLots,
      maxBaseLots,
      maxQuoteLotsIncludingFees,
      clientOrderId: accountIndex,
      orderType: limitOrder ? OrderType.Limit : OrderType.Market,
      expiryTimestamp: new BN(0),
      selfTradeBehavior: SelfTradeBehavior.AbortTransaction,
      limit: 255,
    };
  };

  const findOpenOrdersIndex = async ({
    signer,
    indexOffset,
  }: {
    signer: PublicKey;
    indexOffset?: number;
  }) => {
    const openTx = new Transaction();
    const openOrdersIndexer = findOpenOrdersIndexer(signer);
    let accountIndex = new BN(1);
    try {
      const indexer = await openbook.program.account.openOrdersIndexer.fetch(openOrdersIndexer);
      accountIndex = new BN((indexer?.createdCounter || 0) + 1 + (indexOffset || 0));
    } catch {
      if (!indexOffset) {
        openTx.add(
          await createOpenOrdersIndexerInstruction(openbook.program, openOrdersIndexer, signer),
        );
      } else {
        accountIndex = new BN(1 + (indexOffset || 0));
      }
    }

    return [accountIndex, openTx];
  };

  const placeOrderTransactions = useCallback(
    async (
      amount: number,
      price: number,
      market: MarketAccountWithKey,
      limitOrder?: boolean,
      ask?: boolean,
      pass?: boolean,
      indexOffset?: number,
    ) => {
      if (!wallet.publicKey || !openbook || !openbookTwap) {
        return;
      }

      const mint = ask ? market.account.baseMint : market.account.quoteMint;
      const openOrdersIndexer = findOpenOrdersIndexer(wallet.publicKey);
      const [accountIndex, openTx] = await findOpenOrdersIndex({
        indexOffset,
        signer: wallet.publicKey,
      });
      const [ixs, openOrdersAccount] = await createOpenOrdersInstruction(
        openbook.program,
        market.publicKey,
        accountIndex,
        `${shortKey(wallet.publicKey)}-${accountIndex.toString()}`,
        wallet.publicKey,
        openOrdersIndexer,
      );
      openTx.add(...ixs);

      const args = createPlaceOrderArgs({ amount, price, limitOrder, ask, accountIndex });

      const placeTx = await openbookTwap.methods
        .placeOrder(args)
        .accounts({
          openOrdersAccount,
          asks: market.account.asks,
          bids: market.account.bids,
          eventHeap: market.account.eventHeap,
          market: market.publicKey,
          marketVault: ask ? market.account.marketBaseVault : market.account.marketQuoteVault,
          twapMarket: getTwapMarketKey(market.publicKey),
          userTokenAccount: getAssociatedTokenAddressSync(mint, wallet.publicKey),
          openbookProgram: openbook.programId,
        })
        .preInstructions(openTx.instructions)
        .transaction();

      return [placeTx];
    },
    [wallet, openbookTwap],
  );

  const crankMarketTransactions = useCallback(
    async (market: MarketAccountWithKey, eventHeap: PublicKey, individualEvent?: PublicKey) => {
      if (!wallet.publicKey || !openbook || !openbookTwap) {
        return;
      }
      let accounts: PublicKey[] = new Array<PublicKey>();
      const _eventHeap = await openbook.program.account.eventHeap.fetch(eventHeap);
      // TODO: If null we should bail...
      if (!individualEvent) {
        if (_eventHeap != null) {
          // eslint-disable-next-line no-restricted-syntax
          for (const node of _eventHeap.nodes) {
            if (node.event.eventType === 0) {
              const fillEvent: FillEvent = openbook.program.coder.types.decode(
                'FillEvent',
                Buffer.from([0, ...node.event.padding]),
              );
              accounts = accounts.filter((a) => a !== fillEvent.maker).concat([fillEvent.maker]);
            } else {
              const outEvent: OutEvent = openbook.program.coder.types.decode(
                'OutEvent',
                Buffer.from([0, ...node.event.padding]),
              );
              accounts = accounts.filter((a) => a !== outEvent.owner).concat([outEvent.owner]);
            }
            // Tx would be too big, do not add more accounts
            if (accounts.length > 20) {
              break;
            }
          }
        }
      } else if (_eventHeap != null) {
        // eslint-disable-next-line no-restricted-syntax
        for (const node of _eventHeap.nodes) {
          if (node.event.eventType === 0) {
            const fillEvent: FillEvent = openbook.program.coder.types.decode(
              'FillEvent',
              Buffer.from([0, ...node.event.padding]),
            );
            accounts = accounts.filter((a) => a !== fillEvent.maker).concat([fillEvent.maker]);
          } else {
            const outEvent: OutEvent = openbook.program.coder.types.decode(
              'OutEvent',
              Buffer.from([0, ...node.event.padding]),
            );
            accounts = accounts.filter((a) => a !== outEvent.owner).concat([outEvent.owner]);
          }
        }
      }

      const accountsMeta: AccountMeta[] = accounts.map((remaining) => ({
        pubkey: remaining,
        isSigner: false,
        isWritable: true,
      }));
      let filteredAccounts = accountsMeta;
      if (individualEvent) {
        filteredAccounts = accountsMeta.filter(
          (order) => order.pubkey.toString() === individualEvent.toString(),
        );
      }
      const crankIx = await openbook.program.methods
        .consumeEvents(new BN(filteredAccounts.length))
        .accounts({
          consumeEventsAdmin: openbook.programId,
          market: market.publicKey,
          eventHeap: market.account.eventHeap,
        })
        .remainingAccounts(filteredAccounts)
        .instruction();

      const latestBlockhash = await provider.connection.getLatestBlockhash();

      const message = MessageV0.compile({
        payerKey: provider.wallet.publicKey,
        instructions: [crankIx],
        recentBlockhash: latestBlockhash.blockhash,
        addressLookupTableAccounts: undefined,
      });

      const vtx = new VersionedTransaction(message);

      return [vtx];
    },
    [wallet, openbook, provider],
  );

  const crankMarket = useCallback(
    async (market: MarketAccountWithKey, eventHeap: PublicKey, individualEvent?: PublicKey) => {
      const txs = await crankMarketTransactions(market, eventHeap, individualEvent);
      if (!txs) {
        return;
      }

      return sender.send(txs);
    },
    [crankMarketTransactions, sender],
  );

  const settleFundsTransactions = useCallback(
    async (
      orderId: BN | number,
      passMarket: boolean,
      proposal: ProposalAccountWithKey,
      market: MarketAccountWithKey,
    ) => {
      if (!wallet.publicKey || !openbook) {
        throw new Error('Some variables are not initialized yet...');
      }

      const quoteVault = await getVaultMint(proposal.account.quoteVault);
      const baseVault = await getVaultMint(proposal.account.baseVault);
      const openOrdersAccount = findOpenOrders(new BN(orderId), wallet.publicKey);
      // TODO: Determine if order is on pass or fail market?
      const userBasePass = getAssociatedTokenAddressSync(
        baseVault.conditionalOnFinalizeTokenMint,
        wallet.publicKey,
      );
      const userQuotePass = getAssociatedTokenAddressSync(
        quoteVault.conditionalOnFinalizeTokenMint,
        wallet.publicKey,
      );
      const userBaseFail = getAssociatedTokenAddressSync(
        baseVault.conditionalOnRevertTokenMint,
        wallet.publicKey,
      );
      const userQuoteFail = getAssociatedTokenAddressSync(
        quoteVault.conditionalOnRevertTokenMint,
        wallet.publicKey,
      );
      let userBaseAccount = userBaseFail;
      let userQuoteAccount = userQuoteFail;
      if (passMarket) {
        userBaseAccount = userBasePass;
        userQuoteAccount = userQuotePass;
      }
      // TODO: 2x Txns for each side..
      const placeTx = await openbook.program.methods
        .settleFunds()
        .accounts({
          owner: wallet.publicKey,
          penaltyPayer: wallet.publicKey,
          openOrdersAccount,
          market: market.publicKey,
          marketAuthority: market.account.marketAuthority,
          marketBaseVault: market.account.marketBaseVault,
          marketQuoteVault: market.account.marketQuoteVault,
          userBaseAccount,
          userQuoteAccount,
          referrerAccount: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM,
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            userBaseAccount,
            wallet.publicKey,
            market.account.baseMint,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            userQuoteAccount,
            wallet.publicKey,
            market.account.quoteMint,
          ),
        ])
        .transaction();
      return [placeTx];
    },
    [wallet, openbook],
  );

  const closeOpenOrdersAccountTransactions = useCallback(
    async (orderId: BN) => {
      if (!wallet.publicKey || !openbook) {
        throw new Error('Some variables are not initialized yet...');
      }

      const openOrdersIndexer = findOpenOrdersIndexer(wallet.publicKey);
      const openOrdersAccount = findOpenOrders(orderId, wallet.publicKey);
      const closeTx = await openbook.program.methods
        .closeOpenOrdersAccount()
        .accounts({
          owner: wallet.publicKey,
          openOrdersIndexer,
          openOrdersAccount,
          solDestination: wallet.publicKey,
        })
        .transaction();

      return [closeTx];
    },
    [wallet, openbook],
  );

  const cancelOrderTransactions = useCallback(
    async (orderId: BN, market: MarketAccountWithKey) => {
      if (!wallet.publicKey || !openbook || !openbookTwap) {
        throw new Error('Some variables are not initialized yet...');
      }

      const openOrdersAccount = findOpenOrders(orderId, wallet.publicKey);
      const placeTx = await openbookTwap.methods
        .cancelOrderByClientId(orderId)
        .accounts({
          openOrdersAccount,
          asks: market.account.asks,
          bids: market.account.bids,
          market: market.publicKey,
          twapMarket: PublicKey.findProgramAddressSync(
            [Buffer.from('twap_market'), market.publicKey.toBuffer()],
            OPENBOOK_TWAP_PROGRAM_ID,
          )[0],
          openbookProgram: openbook.programId,
        })
        .transaction();

      return [placeTx];
    },
    [wallet, openbook, openbookTwap],
  );

  const cancelAndPlaceOrdersTransactions = useCallback(
    async ({
      orderId,
      amount,
      price,
      limitOrder,
      ask,
      market,
    }: {
      orderId: BN;
      amount: number;
      price: number;
      limitOrder: boolean;
      ask: boolean;
      market: MarketAccountWithKey;
    }) => {
      if (!wallet.publicKey || !openbookTwap) {
        return;
      }

      // This can only affect orders stored in the same open orders account (OOA)
      // We derive this OOA from the first passed ID
      const openOrdersAccount = findOpenOrders(orderId, wallet.publicKey);
      const userBaseAccount = getAssociatedTokenAddressSync(
        market.account.baseMint,
        wallet.publicKey,
      );
      const userQuoteAccount = getAssociatedTokenAddressSync(
        market.account.quoteMint,
        wallet.publicKey,
      );
      const args = createPlaceOrderArgs({ amount, price, limitOrder, ask, accountIndex: orderId });
      const editTx = await openbookTwap.methods
        .cancelAndPlaceOrders([orderId], [args])
        .accounts({
          market: market.publicKey,
          asks: market.account.asks,
          bids: market.account.bids,
          eventHeap: market.account.eventHeap,
          marketBaseVault: market.account.marketBaseVault,
          marketQuoteVault: market.account.marketQuoteVault,
          twapMarket: getTwapMarketKey(market.publicKey),
          openOrdersAccount,
          userBaseAccount,
          userQuoteAccount,
          openbookProgram: OPENBOOK_PROGRAM_ID,
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            userBaseAccount,
            wallet.publicKey,
            market.account.baseMint,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            userQuoteAccount,
            wallet.publicKey,
            market.account.quoteMint,
          ),
        ])
        .transaction();

      return [editTx];
    },
    [wallet, openbookTwap],
  );

  const editOrderTransactions = useCallback(
    async ({
      order,
      accountIndex,
      amount,
      price,
      limitOrder,
      ask,
      market,
    }: {
      order: OpenOrdersAccountWithKey;
      accountIndex: BN;
      amount: number;
      price: number;
      limitOrder: boolean;
      ask: boolean;
      market: MarketAccountWithKey;
    }) => {
      if (!wallet.publicKey || !openbookTwap) {
        return;
      }

      const openOrdersAccount = findOpenOrders(new BN(order.account.accountNum), wallet.publicKey);
      const args = createPlaceOrderArgs({
        amount,
        price,
        limitOrder,
        ask,
        accountIndex,
      });
      const expectedCancelSize = ask
        ? order.account.position.asksBaseLots.sub(new BN(amount)).abs()
        : new BN(amount).sub(order.account.position.bidsBaseLots).abs();
      const mint = ask ? market.account.baseMint : market.account.quoteMint;
      const marketVault = ask ? market.account.marketBaseVault : market.account.marketQuoteVault;
      const userTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const editTx = await openbookTwap.methods
        .editOrder(new BN(order.account.accountNum), expectedCancelSize, args)
        .accounts({
          market: market.publicKey,
          asks: market.account.asks,
          bids: market.account.bids,
          eventHeap: market.account.eventHeap,
          marketVault,
          twapMarket: getTwapMarketKey(market.publicKey),
          openOrdersAccount,
          userTokenAccount,
          openbookProgram: OPENBOOK_PROGRAM_ID,
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            userTokenAccount,
            wallet.publicKey,
            mint,
          ),
        ])
        .transaction();

      return [editTx];
    },
    [wallet, openbookTwap],
  );

  return {
    placeOrderTransactions,
    cancelOrderTransactions,
    closeOpenOrdersAccountTransactions,
    cancelAndPlaceOrdersTransactions,
    editOrderTransactions,
    settleFundsTransactions,
    crankMarket,
    crankMarketTransactions,
    program: openbookTwap,
  };
}
