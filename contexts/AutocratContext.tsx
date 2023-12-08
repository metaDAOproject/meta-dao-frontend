import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Program, utils } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { AutocratV0 } from '../lib/idl/autocrat_v0';
import { useProvider } from '@/hooks/useProvider';
import { AUTOCRAT_PROGRAM_ID, OPENBOOK_PROGRAM_ID } from '@/lib/constants';
import {
  AllMarketsInfo,
  AllOrders,
  DaoState,
  OrderBook,
  ProposalAccountWithKey,
} from '../lib/types';
import { useNetworkConfiguration } from '../hooks/useNetworkConfiguration';
import { useConditionalVault } from '../hooks/useConditionalVault';
import { useOpenbookTwap } from '../hooks/useOpenbookTwap';
import { IDL as OPENBOOK_IDL, OpenbookV2 } from '@/lib/idl/openbook_v2';
import { getLeafNodes } from '../lib/openbook';
import { debounce } from '../lib/utils';
import { LeafNode } from '@/lib/types';

const AUTOCRAT_IDL: AutocratV0 = require('@/lib/idl/autocrat_v0.json');

export interface AutocratContext {
  dao?: PublicKey;
  daoTreasury?: PublicKey;
  daoState?: DaoState;
  proposals?: ProposalAccountWithKey[];
  allMarketsInfo: AllMarketsInfo;
  orderBookObject?: OrderBook;
  allOrders: AllOrders;
  autocratProgram?: Program<AutocratV0>;
  fetchState: () => Promise<void>;
  fetchProposals: () => Promise<void>;
  fetchMarketsInfo: (proposal: ProposalAccountWithKey) => Promise<void>;
  fetchOpenOrders: (proposal: ProposalAccountWithKey, owner: PublicKey) => Promise<void>;
}
export const contextAutocrat = createContext<AutocratContext>({
  allMarketsInfo: {},
  allOrders: {},
  orderBookObject: undefined,
  fetchState: () => new Promise(() => {}),
  fetchProposals: () => new Promise(() => {}),
  fetchMarketsInfo: () => new Promise(() => {}),
  fetchOpenOrders: () => new Promise(() => {}),
});
export const useAutocrat = () => {
  const context = useContext<AutocratContext>(contextAutocrat);
  return context;
};
export function AutocratProvider({ children }: { children: ReactNode }) {
  const { network } = useNetworkConfiguration();
  const { connection } = useConnection();
  const provider = useProvider();
  const programId = AUTOCRAT_PROGRAM_ID;
  const dao = useMemo(
    () =>
      PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode('WWCACOTMICMIBMHAFTTWYGHMB')],
        programId,
      )[0],
    [programId],
  );
  const daoTreasury = useMemo(
    () => PublicKey.findProgramAddressSync([dao.toBuffer()], programId)[0],
    [programId],
  );
  const autocratProgram = useMemo(
    () => new Program<AutocratV0>(AUTOCRAT_IDL, programId, provider),
    [provider, programId],
  );
  const openbook = useMemo(() => {
    if (!provider) {
      return;
    }
    return new Program<OpenbookV2>(OPENBOOK_IDL, OPENBOOK_PROGRAM_ID, provider);
  }, [provider]);
  const { program: openbookTwap } = useOpenbookTwap();
  const { program: vaultProgram } = useConditionalVault();
  const [daoState, setDaoState] = useState<DaoState>();
  const [proposals, setProposals] = useState<ProposalAccountWithKey[]>();
  const [allMarketsInfo, setAllMarketsInfo] = useState<AllMarketsInfo>({});
  const [allOrders, setAllOrders] = useState<AllOrders>({});

  const fetchState = useCallback(async () => {
    setDaoState(await autocratProgram.account.dao.fetch(dao));
  }, [autocratProgram, dao]);

  const fetchProposals = useCallback(async () => {
    const props = ((await autocratProgram?.account.proposal.all()) || []).sort((a, b) =>
      a.account.number < b.account.number ? 1 : -1,
    );
    setProposals(props);
  }, [autocratProgram]);

  const orderBookObject = useMemo(() => {
    const getSide = (side: LeafNode[], isBidSide?: boolean) => {
      if (side.length === 0) {
        return null;
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

      const deduped = new Map();
      sorted.forEach((order) => {
        if (deduped.get(order.price) === undefined) {
          deduped.set(order.price, order.size);
        } else {
          deduped.set(order.price, deduped.get(order.price) + order.size);
        }
      });

      const total = parsed.reduce((a, b) => ({
        price: a.price + b.price,
        size: a.size + b.size,
      }));
      return { parsed, total, deduped };
    };

    const orderBookSide = (orderBookForSide: LeafNode[], isBidSide?: boolean) => {
      if (orderBookForSide) {
        const _orderBookSide = getSide(orderBookForSide, isBidSide);
        if (_orderBookSide) {
          return Array.from(_orderBookSide.deduped?.entries()).map((side) => [
            (side[0] / 10_000).toFixed(4),
            side[1],
          ]);
        }
      }
      if (isBidSide) {
        return [[0, 0]];
      }
      return [[Number.MAX_SAFE_INTEGER, 0]];
    };

    const getToB = (bids: LeafNode[], asks: LeafNode[]) => {
      const _bids = orderBookSide(bids, true);
      const _asks = orderBookSide(asks);
      const tobAsk: number = Number(_asks[0][0]);
      const tobBid: number = Number(_bids[0][0]);
      return {
        topAsk: tobAsk,
        topBid: tobBid,
      };
    };

    const getSpreadString = (bids: LeafNode[], asks: LeafNode[]) => {
      const { topAsk, topBid } = getToB(bids, asks);
      const spread: number = topAsk - topBid;
      const spreadPercent: string = ((spread / topAsk) * 100).toFixed(2);

      return spread === topAsk
        ? '∞ (100.00%)'
        : `${spread.toFixed(2).toString()} (${spreadPercent}%)`;
    };
    if (Object.keys(allMarketsInfo).length > 0) {
      const proposalInfo = allMarketsInfo[Object.keys(allMarketsInfo)[0]];
      if (proposalInfo) {
        return {
          passBidsProcessed: getSide(proposalInfo.passBids, true),
          passAsksProcessed: getSide(proposalInfo.passAsks),
          passBidsArray: orderBookSide(proposalInfo.passBids, true),
          passAsksArray: orderBookSide(proposalInfo.passAsks),
          failBidsProcessed: getSide(proposalInfo.failBids, true),
          failAsksProcessed: getSide(proposalInfo.failAsks),
          failBidsArray: orderBookSide(proposalInfo.failBids, true),
          failAsksArray: orderBookSide(proposalInfo.failAsks),
          passToB: getToB(proposalInfo.passBids, proposalInfo.passAsks),
          failToB: getToB(proposalInfo.failBids, proposalInfo.failAsks),
          passSpreadString: getSpreadString(proposalInfo.passBids, proposalInfo.passAsks),
          failSpreadString: getSpreadString(proposalInfo.failBids, proposalInfo.failAsks),
        };
      }
      return undefined;
    }
    return undefined;
  }, [allMarketsInfo]);

  const fetchMarketsInfo = useCallback(
    debounce(async (proposal: ProposalAccountWithKey) => {
      if (!proposal || !openbook || !openbookTwap || !openbookTwap.views || !connection) {
        return;
      }
      const accountInfos = await connection.getMultipleAccountsInfo([
        proposal.account.openbookPassMarket,
        proposal.account.openbookFailMarket,
        proposal.account.openbookTwapPassMarket,
        proposal.account.openbookTwapFailMarket,
        proposal.account.baseVault,
        proposal.account.quoteVault,
      ]);
      if (!accountInfos || accountInfos.indexOf(null) >= 0) return;

      const pass = await openbook.coder.accounts.decode('market', accountInfos[0]!.data);
      const fail = await openbook.coder.accounts.decode('market', accountInfos[1]!.data);
      const passTwap = await openbookTwap.coder.accounts.decodeUnchecked(
        'TWAPMarket',
        accountInfos[2]!.data,
      );
      const failTwap = await openbookTwap.coder.accounts.decodeUnchecked(
        'TWAPMarket',
        accountInfos[3]!.data,
      );
      const baseVault = await vaultProgram.coder.accounts.decode(
        'conditionalVault',
        accountInfos[4]!.data,
      );
      const quoteVault = await vaultProgram.coder.accounts.decode(
        'conditionalVault',
        accountInfos[5]!.data,
      );

      const bookAccountInfos = await connection.getMultipleAccountsInfo([
        pass.asks,
        pass.bids,
        fail.asks,
        fail.bids,
      ]);
      const passAsks = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[0]!.data),
        openbook,
      );
      const passBids = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[1]!.data),
        openbook,
      );
      const failAsks = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[2]!.data),
        openbook,
      );
      const failBids = getLeafNodes(
        await openbook.coder.accounts.decode('bookSide', bookAccountInfos[3]!.data),
        openbook,
      );

      setAllMarketsInfo({
        ...allMarketsInfo,
        [proposal.publicKey.toString()]: {
          pass,
          passAsks,
          passBids,
          fail,
          failAsks,
          failBids,
          passTwap,
          failTwap,
          baseVault,
          quoteVault,
        },
      });
    }, 1000),
    [allMarketsInfo, vaultProgram, openbook, openbookTwap],
  );
  const fetchOpenOrders = useCallback(
    debounce<[ProposalAccountWithKey, PublicKey]>(
      async (proposal: ProposalAccountWithKey, owner: PublicKey) => {
        if (!openbook) {
          return;
        }
        const passOrders = await openbook.account.openOrdersAccount.all([
          { memcmp: { offset: 8, bytes: owner.toBase58() } },
          { memcmp: { offset: 40, bytes: proposal.account.openbookPassMarket.toBase58() } },
        ]);
        const failOrders = await openbook.account.openOrdersAccount.all([
          { memcmp: { offset: 8, bytes: owner.toBase58() } },
          { memcmp: { offset: 40, bytes: proposal.account.openbookFailMarket.toBase58() } },
        ]);
        setAllOrders({
          [proposal.publicKey.toString()]: passOrders
            .concat(failOrders)
            .sort((a, b) => (a.account.accountNum < b.account.accountNum ? 1 : -1)),
        });
      },
      1000,
    ),
    [openbook],
  );

  useEffect(() => {
    if (!proposals) {
      fetchProposals();
    }
  }, [proposals]);

  useEffect(() => {
    if (!daoState) {
      fetchState();
    }
  }, [daoState]);

  // Reset on network change
  useEffect(() => {
    setProposals(undefined);
    setDaoState(undefined);
  }, [network]);

  return (
    <contextAutocrat.Provider
      value={{
        dao,
        daoTreasury,
        daoState,
        proposals,
        allMarketsInfo,
        orderBookObject,
        allOrders,
        autocratProgram,
        fetchState,
        fetchProposals,
        fetchMarketsInfo,
        fetchOpenOrders,
      }}
    >
      {children}
    </contextAutocrat.Provider>
  );
}
