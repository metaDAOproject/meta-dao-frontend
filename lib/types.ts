import { IdlAccounts, IdlTypes } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { AutocratV0 } from './idl/autocrat_v0';
import { OpenbookTwap } from './idl/openbook_twap';
import { OpenbookV2 } from './idl/openbook_v2';
import { ConditionalVault } from './idl/conditional_vault';

export type AccountWithKey<T> = { publicKey: PublicKey; account: T };

export type ProposalAccount = IdlAccounts<AutocratV0>['proposal'];
export type ProposalAccountWithKey = AccountWithKey<ProposalAccount>;
export type VaultAccount = IdlAccounts<ConditionalVault>['conditionalVault'];
export type VaultAccountWithKey = AccountWithKey<VaultAccount>;
export type DaoState = IdlAccounts<AutocratV0>['dao'];
export type TwapMarketAccount = IdlAccounts<OpenbookTwap>['twapMarket'];
export type TWAPOracle = IdlTypes<OpenbookTwap>['TWAPOracle'];
export type ProposalInstruction = IdlTypes<AutocratV0>['ProposalInstruction'];
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
  label: string;
  description: string;
  deserialize: (value: string) => any;
};
export type InstructionAction = {
  label: string;
  fields: InstructionFieldType[];
  instruction: (params: any[]) => ProposalInstruction;
};
export type InstructionSet = {
  name: string;
  actions: InstructionAction[];
};
