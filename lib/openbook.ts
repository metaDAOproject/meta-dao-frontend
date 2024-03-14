import { Program, BN } from '@coral-xyz/anchor';
import { OpenbookV2, OpenBookV2Client } from '@openbook-dex/openbook-v2';
import {
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import numeral from 'numeral';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  AnyNode,
  BookSideAccount,
  LeafNode,
  Markets,
  OpenOrdersAccountWithKey,
  OracleConfigParams,
  ProposalAccountWithKey,
  OpenbookMarket,
} from './types';
import { BASE_FORMAT, BN_0, NUMERAL_FORMAT, OPENBOOK_PROGRAM_ID } from './constants';

export type Order = {
  price: number;
  size: number;
};

const BooksideSpace = 90944 + 8;
const EventHeapSpace = 91280 + 8;

export const createProgramAccount = async (
  program: Program<OpenbookV2>,
  authority: PublicKey,
  size: number,
) => {
  const lamports = await program.provider.connection.getMinimumBalanceForRentExemption(size);
  const address = Keypair.generate();
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority,
      newAccountPubkey: address.publicKey,
      lamports,
      space: size,
      programId: program.programId,
    }),
  );
  return { tx, signers: [address] };
};

export const createOpenbookMarket = async (
  program: Program<OpenbookV2>,
  creator: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  name: string,
  quoteLotSize: BN,
  baseLotSize: BN,
  makerFee: BN,
  takerFee: BN,
  timeExpiry: BN,
  oracleA: PublicKey | null,
  oracleB: PublicKey | null,
  openOrdersAdmin: PublicKey | null,
  consumeEventsAdmin: PublicKey | null,
  closeMarketAdmin: PublicKey | null,
  oracleConfigParams: OracleConfigParams = { confFilter: 0.1, maxStalenessSlots: 100 },
  market: Keypair = Keypair.generate(),
  collectFeeAdmin?: PublicKey,
): Promise<{ signers: Signer[]; instructions: (Transaction | TransactionInstruction)[] }> => {
  const bids = await createProgramAccount(program, creator, BooksideSpace);
  const asks = await createProgramAccount(program, creator, BooksideSpace);
  const eventHeap = await createProgramAccount(program, creator, EventHeapSpace);
  const [marketAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('Market'), market.publicKey.toBuffer()],
    program.programId,
  );
  const baseVault = getAssociatedTokenAddressSync(baseMint, marketAuthority, true);
  const quoteVault = getAssociatedTokenAddressSync(quoteMint, marketAuthority, true);
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    program.programId,
  );

  return {
    signers: [...bids.signers, ...asks.signers, ...eventHeap.signers, market],
    instructions: [
      bids.tx,
      asks.tx,
      eventHeap.tx,
      await program.methods
        .createMarket(
          name,
          oracleConfigParams,
          quoteLotSize,
          baseLotSize,
          makerFee,
          takerFee,
          timeExpiry,
        )
        .accounts({
          market: market.publicKey,
          marketAuthority,
          bids: bids.signers[0].publicKey,
          asks: asks.signers[0].publicKey,
          eventHeap: eventHeap.signers[0].publicKey,
          payer: creator,
          marketBaseVault: baseVault,
          marketQuoteVault: quoteVault,
          baseMint,
          quoteMint,
          oracleA,
          oracleB,
          collectFeeAdmin: collectFeeAdmin != null ? collectFeeAdmin : creator,
          openOrdersAdmin,
          consumeEventsAdmin,
          closeMarketAdmin,
          eventAuthority,
          program: program.programId,
        })
        .instruction(),
    ],
  };
};

export const findOpenOrdersIndexer = (owner: PublicKey): PublicKey => {
  const [openOrdersIndexer] = PublicKey.findProgramAddressSync(
    [Buffer.from('OpenOrdersIndexer'), owner.toBuffer()],
    OPENBOOK_PROGRAM_ID,
  );
  return openOrdersIndexer;
};

export const createOpenOrdersIndexerInstruction = async (
  program: Program<OpenbookV2>,
  openOrdersIndexer: PublicKey,
  owner: PublicKey,
): Promise<TransactionInstruction> =>
  program.methods
    .createOpenOrdersIndexer()
    .accounts({
      openOrdersIndexer,
      owner,
      payer: owner,
    })
    .instruction();

export const findOpenOrders = (accountIndex: BN, owner: PublicKey): PublicKey => {
  const [openOrders] = PublicKey.findProgramAddressSync(
    [Buffer.from('OpenOrders'), owner.toBuffer(), accountIndex.toArrayLike(Buffer, 'le', 4)],
    OPENBOOK_PROGRAM_ID,
  );
  return openOrders;
};

export const createOpenOrdersInstruction = async (
  program: Program<OpenbookV2>,
  market: PublicKey,
  accountIndex: BN,
  name: string,
  owner: PublicKey,
  openOrdersIndexer: PublicKey,
): Promise<[TransactionInstruction[], PublicKey]> => {
  const ixs: TransactionInstruction[] = [];

  if (accountIndex.toNumber() === 0) {
    throw Object.assign(new Error('accountIndex can not be 0'), {
      code: 403,
    });
  }
  const openOrdersAccount = findOpenOrders(accountIndex, owner);

  ixs.push(
    await program.methods
      .createOpenOrdersAccount(name)
      .accounts({
        openOrdersIndexer,
        openOrdersAccount,
        market,
        owner,
        delegateAccount: null,
      })
      .instruction(),
  );

  return [ixs, openOrdersAccount];
};

export function getLeafNodes(bookside: BookSideAccount, program: Program<OpenbookV2>): LeafNode[] {
  const leafNodesData = bookside.nodes.nodes.filter((x: AnyNode) => x.tag === 2);
  return leafNodesData.map((e) =>
    program.coder.types.decode('LeafNode', Buffer.from([0, ...e.data])),
  );
}

export function getParsedOrders(side: LeafNode[], isBidSide: boolean): Order[] {
  if (side.length === 0) {
    return [];
  }

  const parsed = side
    .map((e) => ({
      price: e.key.shrn(64).toNumber(),
      size: e.quantity.toNumber(),
    }))
    .sort((a, b) => a.price - b.price);

  const sorted = isBidSide
    ? parsed.sort((a, b) => b.price - a.price)
    : parsed.sort((a, b) => a.price - b.price);

  // const deduped = new Map();
  // sorted.forEach((order) => {
  //   if (deduped.get(order.price) === undefined) {
  //     deduped.set(order.price, order.size);
  //   } else {
  //     deduped.set(order.price, deduped.get(order.price) + order.size);
  //   }
  // });

  return sorted;
}

export const isPass = (order: OpenOrdersAccountWithKey, proposal?: ProposalAccountWithKey) =>
  proposal?.account.openbookPassMarket.equals(order.account.market)!!;

export const isBid = (order: OpenOrdersAccountWithKey) => {
  const isBidSide = order.account.position.bidsBaseLots.gt(order.account.position.asksBaseLots);
  if (isBidSide) {
    return true;
  }
  return false;
};

export const isPartiallyFilled = (order: OpenOrdersAccountWithKey): boolean => {
  const orderPosition = order.account.position;
  if (orderPosition.baseFreeNative > BN_0 || orderPosition.quoteFreeNative > BN_0) {
    return true;
  }
  return false;
};

export const isEmptyOrder = (order: OpenOrdersAccountWithKey): boolean =>
  order.account.openOrders[0].isFree === 1;

export const isClosableOrder = (order: OpenOrdersAccountWithKey): boolean =>
  order.account.position.asksBaseLots.eq(BN_0) &&
  order.account.position.bidsBaseLots.eq(BN_0) &&
  order.account.position.baseFreeNative.eq(BN_0) &&
  order.account.position.quoteFreeNative.eq(BN_0);

export const _isOpenOrder = (order: OpenOrdersAccountWithKey, market: OpenbookMarket): boolean => {
  if (order.account.openOrders[0].isFree === 0) {
    const asksFilter = market.asks.filter(
      (_order: any) => _order.owner.toString() === order.publicKey.toString(),
    );
    const bidsFilter = market.bids.filter(
      (_order: any) => _order.owner.toString() === order.publicKey.toString(),
    );
    let _order = null;
    if (asksFilter.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      _order = asksFilter[0];
    }
    if (bidsFilter.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      _order = bidsFilter[0];
    }
    if (_order !== null) {
      return true;
    }
    return false;
  }
  return false;
};

export const isOpenOrder = (order: OpenOrdersAccountWithKey, markets: Markets): boolean => {
  if (order.account.openOrders[0].isFree === 0) {
    const passAsksFilter = markets.passAsks.filter(
      (_order) => _order.owner.toString() === order.publicKey.toString(),
    );
    const passBidsFilter = markets.passBids.filter(
      (_order) => _order.owner.toString() === order.publicKey.toString(),
    );
    const failAsksFilter = markets.failAsks.filter(
      (_order) => _order.owner.toString() === order.publicKey.toString(),
    );
    const failBidsFilter = markets.failBids.filter(
      (_order) => _order.owner.toString() === order.publicKey.toString(),
    );
    let _order = null;
    if (failAsksFilter.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      _order = failAsksFilter[0];
    }
    if (failBidsFilter.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      _order = failBidsFilter[0];
    }
    if (passAsksFilter.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      _order = passAsksFilter[0];
    }
    if (passBidsFilter.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      _order = passBidsFilter[0];
    }
    if (_order !== null) {
      return true;
    }
    return false;
  }
  return false;
};

export const _isCompletedOrder = (
  order: OpenOrdersAccountWithKey,
  market: OpenbookMarket,
): boolean => {
  const isOpen = _isOpenOrder(order, market);
  const isEmpty =
    isEmptyOrder(order) &&
    (order.account.position.asksBaseLots.gt(BN_0) || order.account.position.bidsBaseLots.gt(BN_0));
  return isEmpty && !isOpen;
};

export const isCompletedOrder = (order: OpenOrdersAccountWithKey, markets: Markets): boolean => {
  const isOpen = isOpenOrder(order, markets);
  const isEmpty =
    isEmptyOrder(order) &&
    (order.account.position.asksBaseLots.gt(BN_0) || order.account.position.bidsBaseLots.gt(BN_0));
  return isEmpty && !isOpen;
};

export const isBidOrAsk = (order: OpenOrdersAccountWithKey) => {
  const isBidSide = order.account.position.bidsBaseLots.gt(order.account.position.asksBaseLots);
  if (isBidSide) {
    return true;
  }
  return false;
};

export const totalInOrder = (orders: OpenOrdersAccountWithKey[]) => {
  let sumOrders = [];
  sumOrders = orders?.map(
    (order) =>
      (order.account.position.bidsBaseLots.toNumber() / 10_000 +
        order.account.position.asksBaseLots.toNumber() / 10_000) *
      order.account.openOrders[0].lockedPrice.toNumber(),
  );
  const totalValueLocked = sumOrders.reduce((partialSum, amount) => partialSum + amount, 0);
  return numeral(totalValueLocked).format(NUMERAL_FORMAT);
};

export const totalUsdcInOrder = (orders: OpenOrdersAccountWithKey[]) => {
  let sumOrders = [];
  sumOrders = orders.map((order) => {
    if (isBidOrAsk(order)) {
      return (
        (order.account.position.bidsBaseLots.toNumber() * order.account.openOrders[0].lockedPrice) /
          10_000 +
        (order.account.position.asksBaseLots.toNumber() * order.account.openOrders[0].lockedPrice) /
          10_000
      );
    }
    return 0;
  });

  const totalValueLocked = sumOrders.reduce((partialSum, amount) => partialSum + amount, 0);
  return numeral(totalValueLocked).format(NUMERAL_FORMAT);
};

export const totalMetaInOrder = (orders: OpenOrdersAccountWithKey[]) => {
  let sumOrders = [];
  sumOrders = orders.map((order) => {
    if (isBidOrAsk(order)) {
      return (
        order.account.position.bidsBaseLots.toNumber() +
        order.account.position.asksBaseLots.toNumber()
      );
    }
    return 0;
  });

  const totalValueLocked = sumOrders.reduce((partialSum, amount) => partialSum + amount, 0);
  return numeral(totalValueLocked).format(BASE_FORMAT);
};

export const getUsersOpenOrderPks = async (
  client: OpenBookV2Client,
  userWalletPk: PublicKey,
): Promise<PublicKey[]> => {
  const indexerPk = client.findOpenOrdersIndexer(userWalletPk);
  const indexerAcc = await client.deserializeOpenOrdersIndexerAccount(indexerPk);
  const openOrdersPks = indexerAcc?.addresses;
  return openOrdersPks ?? [];
};
