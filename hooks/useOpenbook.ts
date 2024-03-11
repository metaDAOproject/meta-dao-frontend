import { useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  //Keypair,
} from '@solana/web3.js';
import { OPENBOOK_PROGRAM_ID, OpenBookV2Client, uiPriceToLots, uiQuoteToLots, uiBaseToLots } from '@openbook-dex/openbook-v2';
import { PlaceOrderArgs } from '@openbook-dex/openbook-v2/dist/types/client';
import { BN } from '@coral-xyz/anchor';
import {
  SelfTradeBehavior,
  OrderType,
  SideUtils,
} from '@openbook-dex/openbook-v2/dist/cjs/utils/utils';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  MarketAccountWithKey,
} from '@/lib/types';
import { useProvider } from '@/hooks/useProvider';
import {
  createOpenOrdersIndexerInstruction,
  createOpenOrdersInstruction,
  findOpenOrders,
  findOpenOrdersIndexer,
} from '../lib/openbook';
import { shortKey } from '@/lib/utils';

const SYSTEM_PROGRAM: PublicKey = new PublicKey('11111111111111111111111111111111');

export function useOpenbook() {
  const wallet = useWallet();
  const provider = useProvider();
  const openbook = useMemo(() => new OpenBookV2Client(provider, OPENBOOK_PROGRAM_ID), [provider]);

  const createPlaceOrderArgs = (market: any, {
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
    const priceLots = uiPriceToLots(market, price);
    const maxBaseLots = uiBaseToLots(market, amount);
    const maxQuoteLotsIncludingFees = uiQuoteToLots(market, priceLots.mul(maxBaseLots));

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
      indexOffset?: number,
    ) => {
      if (!wallet || !wallet.publicKey || !wallet.wallet || !openbook || !market) {
        return;
      }

      const pubkey = wallet.publicKey;

      const mint = ask ? market.account.baseMint : market.account.quoteMint;
      const openOrdersIndexer = findOpenOrdersIndexer(pubkey);
      const [accountIndex, openTx] = await findOpenOrdersIndex({
        indexOffset,
        signer: pubkey,
      });
      const [ixs, openOrdersAccount] = await createOpenOrdersInstruction(
        openbook.program,
        market.publicKey,
        accountIndex,
        `${shortKey(pubkey)}-${accountIndex.toString()}`,
        pubkey,
        openOrdersIndexer,
      );
      openTx.add(...ixs);
      const _market = await openbook.deserializeMarketAccount(market.publicKey);
      const args = createPlaceOrderArgs(_market, { amount, price, limitOrder, ask, accountIndex });

      const placeTx = await openbook.program.methods
        .placeOrder(args)
        .accounts({
          openOrdersAccount,
          market: market.publicKey,
          asks: market.account.asks,
          bids: market.account.bids,
          userTokenAccount: getAssociatedTokenAddressSync(mint, pubkey, true),
          eventHeap: market.account.eventHeap,
          oracleA: null,
          oracleB: null,
          openOrdersAdmin: null,
          marketVault: ask ? market.account.marketBaseVault : market.account.marketQuoteVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(openTx.instructions)
        .transaction();

      return [placeTx];
    },
    [wallet, openbook],
  );

  const settleFundsTransactions = useCallback(
    async (
      orderId: BN | number,
      market: MarketAccountWithKey,
    ) => {
      if (!wallet.publicKey || !openbook) {
        throw new Error('Some variables are not initialized yet...');
      }

      const openOrdersAccount = findOpenOrders(new BN(orderId), wallet.publicKey);

      const userBase = getAssociatedTokenAddressSync(
        market.account.baseMint,
        wallet.publicKey,
        true
      );
      const userQuote = getAssociatedTokenAddressSync(
        market.account.quoteMint,
        wallet.publicKey,
        true
      );

      const userBaseAccount = userBase;
      const userQuoteAccount = userQuote;

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
      if (!wallet.publicKey || !openbook) {
        throw new Error('Some variables are not initialized yet...');
      }

      const openOrdersAccount = findOpenOrders(orderId, wallet.publicKey);
      const placeTx = await openbook.program.methods
        .cancelOrderByClientOrderId(orderId)
        .accounts({
          openOrdersAccount,
          asks: market.account.asks,
          bids: market.account.bids,
          market: market.publicKey,
        })
        .transaction();

      return [placeTx];
    },
    [wallet, openbook],
  );

  const cancelAndSettleFundsTransactions = useCallback(
    async (
      orderId: BN | number,
      market: MarketAccountWithKey,
    ) => {
      if (!wallet.publicKey || !openbook) {
        throw new Error('Some variables are not initialized yet...');
      }

      const openOrdersAccount = findOpenOrders(new BN(orderId), wallet.publicKey);

      const userBase = getAssociatedTokenAddressSync(
        market.account.baseMint,
        wallet.publicKey,
        true
      );
      const userQuote = getAssociatedTokenAddressSync(
        market.account.quoteMint,
        wallet.publicKey,
        true
      );

      const userBaseAccount = userBase;
      const userQuoteAccount = userQuote;

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
          await openbook.program.methods
            .cancelOrderByClientOrderId(orderId)
            .accounts({
              openOrdersAccount,
              asks: market.account.asks,
              bids: market.account.bids,
              market: market.publicKey,
            })
            .instruction(),
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

  return {
    placeOrderTransactions,
    cancelOrderTransactions,
    closeOpenOrdersAccountTransactions,
    cancelAndSettleFundsTransactions,
    settleFundsTransactions,
    program: openbook,
  };
}
