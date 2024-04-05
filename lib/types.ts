import { Idl, IdlAccounts, IdlTypes } from '@coral-xyz/anchor';
import { Connection, PublicKey, Signer, Transaction } from '@solana/web3.js';
import { AutocratV0 } from './idl/autocrat_v0';
import { AutocratV0 as AutocratV0_1 } from './idl/autocrat_v0.1';
import { AutocratV0 as AutocratV0_2 } from './idl/autocrat_v0.2';
import { AutocratV0 as AutocratV0_3 } from './idl/autocrat_v0.3';
import { OpenbookTwap } from './idl/openbook_twap';
import { OpenbookV2 } from './idl/openbook_v2';
import { ConditionalVault } from './idl/conditional_vault';

type MergeWithOptionalFields<T, U> = {
  [K in keyof (T | U)]: U[K];
} & {
  [K in keyof Omit<U, keyof T>]?: NonNullable<U[K]>;
} & {
  [K in keyof Omit<T, keyof U>]?: NonNullable<T[K]>;
};
export type AccountWithKey<T> = { publicKey: PublicKey; account: T };
export type ProgramVersion = { label: string; programId: PublicKey; idl: Idl };
export type AutocratProgram = AutocratV0 | AutocratV0_1 | AutocratV0_2 | AutocratV0_3;
export type DaoStateV0_1 = MergeWithOptionalFields<
  IdlAccounts<AutocratV0>['dao'],
  IdlAccounts<AutocratV0_1>['dao']
>;
export type DaoStateV0_2 = MergeWithOptionalFields<
  DaoStateV0_1,
  IdlAccounts<AutocratV0_2>['dao']
>;
export type DaoState = MergeWithOptionalFields<
  DaoStateV0_2,
  IdlAccounts<AutocratV0_3>['dao']
>;
export type ProposalAccount = MergeWithOptionalFields<
  IdlAccounts<AutocratV0>['proposal'],
  IdlAccounts<AutocratV0_1>['proposal']
>;
export type ProposalInstruction = MergeWithOptionalFields<
  IdlTypes<AutocratV0>['ProposalInstruction'],
  IdlTypes<AutocratV0_1>['ProposalInstruction']
>;
export type ProposalAccountWithKey = AccountWithKey<ProposalAccount>;
export type VaultAccount = IdlAccounts<ConditionalVault>['conditionalVault'];
export type VaultAccountWithKey = AccountWithKey<VaultAccount>;
export type TwapMarketAccount = IdlAccounts<OpenbookTwap>['twapMarket'];
export type TWAPOracle = IdlTypes<OpenbookTwap>['TWAPOracle'];
export type OrderBookSide = {
  parsed: {
    price: any;
    size: any;
  }[];
  total: {
    price: any;
    size: any;
  };
  deduped: Map<any, any>;
};
export type OpenbookOrderBook =
  | {
      bidsProcessed: OrderBookSide | null;
      asksProcessed: OrderBookSide | null;
      bidsArray: any[][];
      asksArray: any[][];
      toB: {
        topAsk: number;
        topBid: number;
      };
      spreadString: string;
    }
  | undefined;
export type OrderBook =
  | {
      passBidsProcessed: OrderBookSide | null;
      passAsksProcessed: OrderBookSide | null;
      failBidsProcessed: OrderBookSide | null;
      failAsksProcessed: OrderBookSide | null;
      passBidsArray: any[][];
      passAsksArray: any[][];
      failBidsArray: any[][];
      failAsksArray: any[][];
      passToB: {
        topAsk: number;
        topBid: number;
      };
      failToB: {
        topAsk: number;
        topBid: number;
      };
      passSpreadString: string;
      failSpreadString: string;
    }
  | undefined;
export type OpenbookMarket = {
  market: MarketAccount;
  asks: LeafNode[];
  bids: LeafNode[];
};
export type Markets = {
  pass: MarketAccount;
  passAsks: LeafNode[];
  passBids: LeafNode[];
  fail: MarketAccount;
  failAsks: LeafNode[];
  failBids: LeafNode[];
  passTwap: TwapMarketAccount;
  failTwap: TwapMarketAccount;
  baseVault: VaultAccount;
  quoteVault: VaultAccount;
};
export type AllMarketsInfo = { [proposalKey: string]: Markets | undefined };
export interface InitializedVault {
  tx?: Transaction;
  signers: Signer[];
  vault: PublicKey;
  finalizeMint: PublicKey;
  revertMint: PublicKey;
}
export type Proposal = ProposalAccountWithKey & {
  title: string;
  description: string;
};

/// Avoid importing Openbook because it uses a NodeWallet
export type PlaceOrderArgs = IdlTypes<OpenbookV2>['PlaceOrderArgs'];
export type PlaceOrderPeggedArgs = IdlTypes<OpenbookV2>['PlaceOrderPeggedArgs'];
export type OracleConfigParams = IdlTypes<OpenbookV2>['OracleConfigParams'];
export type OracleConfig = IdlTypes<OpenbookV2>['OracleConfig'];
export type MarketAccount = IdlAccounts<OpenbookV2>['market'];
export type MarketAccountWithKey = AccountWithKey<MarketAccount>;
export type OpenOrdersAccount = IdlAccounts<OpenbookV2>['openOrdersAccount'];
export type OpenOrdersAccountWithKey = AccountWithKey<OpenOrdersAccount>;
export type AllOrders = { [proposalKey: string]: OpenOrdersAccountWithKey[] };
export type OpenOrdersIndexerAccount = IdlAccounts<OpenbookV2>['openOrdersIndexer'];
export type EventHeapAccount = IdlAccounts<OpenbookV2>['eventHeap'];
export type BookSideAccount = IdlAccounts<OpenbookV2>['bookSide'];
export type LeafNode = IdlTypes<OpenbookV2>['LeafNode'];
export type AnyNode = IdlTypes<OpenbookV2>['AnyNode'];
export type FillEvent = IdlTypes<OpenbookV2>['FillEvent'];
export type OutEvent = IdlTypes<OpenbookV2>['OutEvent'];

export enum InstructionFieldTypes {
  Text,
  Number,
  BigNumber,
  Key,
}
export type InstructionFieldType = {
  type: InstructionFieldTypes;
  required: boolean;
  label: string;
  description: string;
};
export type InstructionAction = {
  label: string;
  fields: InstructionFieldType[];
  instruction: (
    params: any[],
    options?: { connection?: Connection },
  ) => Promise<ProposalInstruction>;
};
export type InstructionSet = {
  name: string;
  actions: InstructionAction[];
};

export interface Token {
  name: string;
  symbol: string;
  icon?: string;
  publicKey: PublicKey;
  decimals: number;
  tokenProgram: PublicKey;
}
export type TokenKeys = 'meta' | 'usdc' | 'future' | 'musdc' | 'wsol' | 'baseToken' | 'quoteToken';
export type TokensDict = Partial<{ [key in TokenKeys]: Token }>;
