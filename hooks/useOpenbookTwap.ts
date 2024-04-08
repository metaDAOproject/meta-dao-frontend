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
import { PlaceOrderArgs, uiPriceToLots, uiQuoteToLots, uiBaseToLots } from '@openbook-dex/openbook-v2';
import {
  SelfTradeBehavior,
  OrderType,
  SideUtils,
} from '@openbook-dex/openbook-v2/dist/cjs/utils/utils';
import { OpenbookTwapV0_1 } from '@/lib/idl/openbook_twap_v0.1';
import { OpenbookTwapV0_2 } from '@/lib/idl/openbook_twap_v0.2';
import { OPENBOOK_PROGRAM_ID, OPENBOOK_TWAP_PROGRAM_IDV0_1, OPENBOOK_TWAP_PROGRAM_IDV0_2 } from '@/lib/constants';
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

const OPENBOOK_TWAP_IDLV0_1: OpenbookTwapV0_1 = require('@/lib/idl/openbook_twap_v0.1.json');
const OPENBOOK_TWAP_IDLV0_2: OpenbookTwapV0_2 = require('@/lib/idl/openbook_twap_v0.2.json');

const SYSTEM_PROGRAM: PublicKey = new PublicKey('11111111111111111111111111111111');

export function useOpenbookTwap() {
  const wallet = useWallet();
  const provider = useProvider();
  const sender = useTransactionSender();
  const { getVaultMint } = useConditionalVault();
  const { program: openbook } = useOpenbook();

  const OPENBOOK_TWAP_PROGRAM_ID = OPENBOOK_TWAP_PROGRAM_IDV0_2;
  const openbookTwap = useMemo(() => {
    if (!provider) {
      return;
    }
    // TODO: Check for program version...
    if (true) {
      return new Program<OpenbookTwapV0_2>(
        OPENBOOK_TWAP_IDLV0_2,
        OPENBOOK_TWAP_PROGRAM_IDV0_2,
        provider
      );
    }
    return new Program<OpenbookTwapV0_1>(
      OPENBOOK_TWAP_IDLV0_1,
      OPENBOOK_TWAP_PROGRAM_IDV0_1,
      provider
    );
  }, [provider]);

  const createPlaceOrderArgs = ({
    amount,
    price,
    isLimitOrder,
    isPostOnlyOrder,
    isAsk,
    accountIndex,
    market,
  }: {
    amount: number;
    price: number;
    isLimitOrder?: boolean;
    isPostOnlyOrder?: boolean;
    isAsk?: boolean;
    accountIndex: number;
    market: MarketAccountWithKey;
  }): PlaceOrderArgs | string => {
    let priceLots = uiPriceToLots(market.account, price);
    const _priceLots = uiPriceToLots(market.account, price);
    const maxBaseLots = uiBaseToLots(market.account, amount);
    let maxQuoteLotsIncludingFees = uiQuoteToLots(market.account, priceLots.mul(maxBaseLots));

    if (!isLimitOrder) {
      if (!isAsk) {
        // TODO: Want to setup max price
        priceLots = new BN(1_000_000_000_000_000);
        maxQuoteLotsIncludingFees = priceLots.mul(maxBaseLots);
      } else {
        priceLots = market.account.quoteLotSize;
        maxQuoteLotsIncludingFees = priceLots.mul(maxBaseLots);
      }
    }
    if (_priceLots === priceLots) {
      return 'error price';
    }
    // Setup our order type
    // eslint-disable-next-line max-len
    const orderType = isPostOnlyOrder ? OrderType.PostOnly : isLimitOrder ? OrderType.Limit : OrderType.Market;

    return {
      side: isAsk ? SideUtils.Ask : SideUtils.Bid,
      priceLots,
      maxBaseLots,
      maxQuoteLotsIncludingFees,
      clientOrderId: accountIndex,
      orderType,
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
      const indexer = await openbook.account.openOrdersIndexer.fetch(openOrdersIndexer);
      accountIndex = new BN((indexer?.createdCounter || 0) + 1 + (indexOffset || 0));
    } catch {
      if (!indexOffset) {
        openTx.add(
          await createOpenOrdersIndexerInstruction(openbook, openOrdersIndexer, signer),
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
      isLimitOrder?: boolean,
      isPostOnlyOrder?: boolean,
      isAsk?: boolean,
      indexOffset?: number,
    ) => {
      if (!wallet.publicKey || !openbook || !openbookTwap) {
        return;
      }

      const mint = isAsk ? market.account.baseMint : market.account.quoteMint;
      const openOrdersIndexer = findOpenOrdersIndexer(wallet.publicKey);
      const marketVault = isAsk ? market.account.marketBaseVault : market.account.marketQuoteVault;
      const [accountIndex, openTx] = await findOpenOrdersIndex({
        indexOffset,
        signer: wallet.publicKey,
      });
      const [ixs, openOrdersAccount] = await createOpenOrdersInstruction(
        openbook,
        market.publicKey,
        accountIndex,
        `${shortKey(wallet.publicKey)}-${accountIndex.toString()}`,
        wallet.publicKey,
        openOrdersIndexer,
      );
      openTx.add(...ixs);

      const args = createPlaceOrderArgs({
        amount,
        price,
        isLimitOrder,
        isPostOnlyOrder,
        isAsk,
        accountIndex,
        market,
      });
      if (typeof args === 'string') {
        console.error('Error matching price');
        return;
      }

      const placeTx = await openbookTwap.methods
        .placeOrder(args)
        .accounts({
          openOrdersAccount,
          asks: market.account.asks,
          bids: market.account.bids,
          eventHeap: market.account.eventHeap,
          market: market.publicKey,
          marketVault,
          twapMarket: getTwapMarketKey(market.publicKey, OPENBOOK_TWAP_PROGRAM_ID),
          userTokenAccount: getAssociatedTokenAddressSync(mint, wallet.publicKey, true),
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
      const _eventHeap = await openbook.account.eventHeap.fetch(eventHeap);
      // TODO: If null we should bail...
      if (!individualEvent) {
        if (_eventHeap != null) {
          // eslint-disable-next-line no-restricted-syntax
          for (const node of _eventHeap.nodes) {
            if (node.event.eventType === 0) {
              const fillEvent: FillEvent = openbook.coder.types.decode(
                'FillEvent',
                Buffer.from([0, ...node.event.padding]),
              );
              accounts = accounts.filter((a) => a !== fillEvent.maker).concat([fillEvent.maker]);
            } else {
              const outEvent: OutEvent = openbook.coder.types.decode(
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
            const fillEvent: FillEvent = openbook.coder.types.decode(
              'FillEvent',
              Buffer.from([0, ...node.event.padding]),
            );
            accounts = accounts.filter((a) => a !== fillEvent.maker).concat([fillEvent.maker]);
          } else {
            const outEvent: OutEvent = openbook.coder.types.decode(
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
      const crankIx = await openbook.methods
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
        true,
      );
      const userQuotePass = getAssociatedTokenAddressSync(
        quoteVault.conditionalOnFinalizeTokenMint,
        wallet.publicKey,
        true,
      );
      const userBaseFail = getAssociatedTokenAddressSync(
        baseVault.conditionalOnRevertTokenMint,
        wallet.publicKey,
        true,
      );
      const userQuoteFail = getAssociatedTokenAddressSync(
        quoteVault.conditionalOnRevertTokenMint,
        wallet.publicKey,
        true,
      );
      let userBaseAccount = userBaseFail;
      let userQuoteAccount = userQuoteFail;
      if (passMarket) {
        userBaseAccount = userBasePass;
        userQuoteAccount = userQuotePass;
      }
      // TODO: 2x Txns for each side..
      const placeTx = await openbook.methods
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
          //TODO Add this
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

  const cancelAndSettleFundsTransactions = useCallback(
    async (
      orderId: BN | number,
      passMarket: boolean,
      proposal: ProposalAccountWithKey,
      market: MarketAccountWithKey,
    ) => {
      if (!wallet.publicKey || !openbook || !openbookTwap) {
        throw new Error('Some variables are not initialized yet...');
      }

      const quoteVault = await getVaultMint(proposal.account.quoteVault);
      const baseVault = await getVaultMint(proposal.account.baseVault);
      const openOrdersAccount = findOpenOrders(new BN(orderId), wallet.publicKey);
      // TODO: Determine if order is on pass or fail market?
      const userBasePass = getAssociatedTokenAddressSync(
        baseVault.conditionalOnFinalizeTokenMint,
        wallet.publicKey,
        true,
      );
      const userQuotePass = getAssociatedTokenAddressSync(
        quoteVault.conditionalOnFinalizeTokenMint,
        wallet.publicKey,
        true,
      );
      const userBaseFail = getAssociatedTokenAddressSync(
        baseVault.conditionalOnRevertTokenMint,
        wallet.publicKey,
        true,
      );
      const userQuoteFail = getAssociatedTokenAddressSync(
        quoteVault.conditionalOnRevertTokenMint,
        wallet.publicKey,
        true,
      );
      let userBaseAccount = userBaseFail;
      let userQuoteAccount = userQuoteFail;
      if (passMarket) {
        userBaseAccount = userBasePass;
        userQuoteAccount = userQuotePass;
      }
      // TODO: 2x Txns for each side..
      const placeTx = await openbook.methods
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
          await openbookTwap.methods
            .cancelOrderByClientId(new BN(orderId))
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

  const closeOpenOrdersAccountTransactions = useCallback(
    async (orderId: BN) => {
      if (!wallet.publicKey || !openbook) {
        throw new Error('Some variables are not initialized yet...');
      }

      const openOrdersIndexer = findOpenOrdersIndexer(wallet.publicKey);
      const openOrdersAccount = findOpenOrders(orderId, wallet.publicKey);
      const closeTx = await openbook.methods
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
      isLimitOrder,
      isPostOnlyOrder,
      isAsk,
      market,
    }: {
      orderId: BN;
      amount: number;
      price: number;
      isLimitOrder: boolean;
      isPostOnlyOrder: boolean;
      isAsk: boolean;
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
        true,
      );
      const userQuoteAccount = getAssociatedTokenAddressSync(
        market.account.quoteMint,
        wallet.publicKey,
        true,
      );
      const args = createPlaceOrderArgs({
        amount,
        price,
        isLimitOrder,
        isPostOnlyOrder,
        isAsk,
        accountIndex: orderId,
        market,
      });
      if (typeof args === 'string') {
        console.log('error with order');
        return;
      }
      const editTx = await openbookTwap.methods
        .cancelAndPlaceOrders([orderId], [args])
        .accounts({
          market: market.publicKey,
          asks: market.account.asks,
          bids: market.account.bids,
          eventHeap: market.account.eventHeap,
          marketBaseVault: market.account.marketBaseVault,
          marketQuoteVault: market.account.marketQuoteVault,
          twapMarket: getTwapMarketKey(market.publicKey, OPENBOOK_TWAP_PROGRAM_ID),
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
      isLimitOrder,
      isPostOnlyOrder,
      isAsk,
      market,
    }: {
      order: OpenOrdersAccountWithKey;
      accountIndex: BN;
      amount: number;
      price: number;
      isLimitOrder: boolean;
      isPostOnlyOrder: boolean;
      isAsk: boolean;
      market: MarketAccountWithKey;
    }) => {
      if (!wallet.publicKey || !openbookTwap) {
        return;
      }

      const openOrdersAccount = findOpenOrders(new BN(order.account.accountNum), wallet.publicKey);
      const args = createPlaceOrderArgs({
        amount,
        price,
        isLimitOrder,
        isPostOnlyOrder,
        isAsk,
        accountIndex,
        market,
      });
      if (typeof args === 'string') {
        console.log('error with order');
        return;
      }
      const expectedCancelSize = isAsk
        ? order.account.position.asksBaseLots.sub(new BN(amount)).abs()
        : new BN(amount).sub(order.account.position.bidsBaseLots).abs();
      const mint = isAsk ? market.account.baseMint : market.account.quoteMint;
      const marketVault = isAsk ? market.account.marketBaseVault : market.account.marketQuoteVault;
      const userTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey, true);
      const editTx = await openbookTwap.methods
        .editOrder(new BN(order.account.accountNum), expectedCancelSize, args)
        .accounts({
          market: market.publicKey,
          asks: market.account.asks,
          bids: market.account.bids,
          eventHeap: market.account.eventHeap,
          marketVault,
          twapMarket: getTwapMarketKey(market.publicKey, OPENBOOK_TWAP_PROGRAM_ID),
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
    cancelAndSettleFundsTransactions,
    closeOpenOrdersAccountTransactions,
    cancelAndPlaceOrdersTransactions,
    editOrderTransactions,
    settleFundsTransactions,
    crankMarket,
    crankMarketTransactions,
    program: openbookTwap,
  };
}
