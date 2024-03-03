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

      if (wallet.wallet?.adapter.name === 'SquadsX') {
        // If the connected wallet is "SquadsX", get the ephemeral signer Public Key, else return undefined.
        // const ephemeralSignerAddress =
        //   wallet.wallet?.adapter &&
        //   'standard' in wallet.wallet.adapter &&
        //   'fuse:getEphemeralSigners' in wallet.wallet.adapter.wallet.features &&
        //   // @ts-ignore
        //   (
        //     // @ts-ignore
        //     // eslint-disable-next-line no-unsafe-optional-chaining
        //     await wallet.wallet?.adapter.wallet.features[
        //       'fuse:getEphemeralSigners'
        //     ].getEphemeralSigners(1)
        //   )[0];
        // pubkey = new PublicKey(ephemeralSignerAddress);
      }

      // // Create an ephemeral Keypair if the connected wallet is not "SquadsX".
      // const ephemeralKeypair = Keypair.generate();

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

  return {
    placeOrderTransactions,
    cancelOrderTransactions,
    program: openbook,
  };
}
