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
import { useLocalStorage } from '@mantine/hooks';
import { OpenbookV2, IDL as OPENBOOK_IDL } from '@openbook-dex/openbook-v2';
import { useQuery } from '@tanstack/react-query';
import { useProvider } from '@/hooks/useProvider';
import { AUTOCRAT_VERSIONS, OPENBOOK_PROGRAM_ID, staticTokens, devnetTokens, mainnetTokens } from '@/lib/constants';
import { AutocratProgram, DaoState, ProgramVersion, Proposal, TokensDict, Token } from '../lib/types';
import { Networks, useNetworkConfiguration } from '../hooks/useNetworkConfiguration';

export interface AutocratContext {
  dao?: PublicKey;
  daoTreasury?: PublicKey;
  daoState?: DaoState;
  daoTokens?: TokensDict;
  openbook?: Program<OpenbookV2>;
  proposals?: Proposal[];
  autocratProgram?: Program<AutocratProgram>;
  programVersion?: ProgramVersion;
  fetchProposals: () => Promise<void>;
  setProgramVersion: (e: number) => void;
}
export const contextAutocrat = createContext<AutocratContext>({
  fetchProposals: () => new Promise(() => { }),
  setProgramVersion: () => { },
});
export const useAutocrat = () => {
  const context = useContext<AutocratContext>(contextAutocrat);
  return context;
};

export function AutocratProvider({ children }: { children: ReactNode; }) {
  const { endpoint, network } = useNetworkConfiguration();
  const provider = useProvider();
  const [programVersion, setProgramVersion] = useLocalStorage<ProgramVersion>({
    key: 'program_version',
    defaultValue: AUTOCRAT_VERSIONS[1],
    serialize: (value) => String(AUTOCRAT_VERSIONS.indexOf(value)),
    deserialize: (value) => AUTOCRAT_VERSIONS[Number(value)],
  });
  const { programId, idl } = programVersion!;
  let dao = useMemo(
    () =>
      PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode('WWCACOTMICMIBMHAFTTWYGHMB')],
        programId,
      )[0],
    [programId],
  );
  // TODO: For v3 onwards we need to NOT do this...
  if (programVersion.label === 'V0.3') {
    // We need to get public key for the DAOs and somehow sort which one..
    // const programAccounts = await provider.connection.getProgramAccounts(programId);

    // const keysWeCareAbout = programAccounts.map((account) => account.pubkey)

    // need to setup DAO as the KP
    dao = new PublicKey('8tanoHEyJEQgaasEkv1DxN6umYNWDotbaEpuzstcEufb');
  }

  const daoTreasury = useMemo(
    () => PublicKey.findProgramAddressSync([dao.toBuffer()], programId)[0],
    [dao, programId],
  );

  const autocratProgram = useMemo(
    () => new Program<AutocratProgram>(idl as AutocratProgram, programId, provider),
    [provider, programId, idl],
  );
  const openbook = useMemo(() => {
    if (!provider) {
      return;
    }
    return new Program<OpenbookV2>(OPENBOOK_IDL, OPENBOOK_PROGRAM_ID, provider);
  }, [provider]);

  let queryKey = 'getDao';
  if (programVersion.label === 'V0.3') {
    queryKey = 'getDaoV3';
  }
  const { data: daoStateData } = useQuery({
    queryKey: [queryKey],
    queryFn: () => autocratProgram.account.dao.fetch(dao),
    staleTime: 30_000,
    refetchOnMount: false,
  });
  const daoState = daoStateData;

  const [proposals, setProposals] = useState<Proposal[]>();

  const fetchProposals = useCallback(async () => {
    const props = ((await autocratProgram?.account.proposal?.all()) || []).sort((a, b) =>
      a.account.number < b.account.number ? 1 : -1,
    );

    const _proposals: Proposal[] = props.map((prop) => ({
      title: `Proposal ${prop.account.number}`,
      description: '',
      ...prop,
    }));
    setProposals(_proposals);
  }, [endpoint, autocratProgram]);

  // Moved token stuff into the Autocrat, given this is where we reference core tokens
  // NOTE: This doesn't handle conditional tokens.
  const defaultTokens: TokensDict = useMemo(() => {
    switch (network) {
      case Networks.Devnet:
        return { ...staticTokens, ...devnetTokens };
      case Networks.Mainnet:
        return { ...staticTokens, ...mainnetTokens };
      case Networks.Custom:
        // TODO: What if custom is devnet?
        return { ...staticTokens, ...mainnetTokens };
      default:
        return staticTokens;
    }
  }, [network]);

  const [daoTokens, setDaoTokens] = useLocalStorage<TokensDict>({
    key: 'futarchy-tokens',
    defaultValue: defaultTokens,
    getInitialValueInEffect: true,
    serialize: JSON.stringify,
    deserialize: (s) => {
      if (!s) return {};
      const o: TokensDict = JSON.parse(s);
      return Object.fromEntries(
        Object.entries(o).map(([k, v]: [string, Token]) => [
          k,
          { ...v, publicKey: new PublicKey(v.publicKey) },
        ]),
      );
    },
  });

  // We need to wait for the DAO state to be updated and fetched to pull from it
  // and build our actually used tokens.
  useEffect(() => {
    if (daoState) {
      let daoTokenPublicKey = daoState?.metaMint!;
      if (programVersion?.label === 'V0.3') {
        // Stub in to pull instead of metaMint, tokenMint
        daoTokenPublicKey = daoState?.tokenMint!;
      }

      // This fetches and compares across the token list we maintain
      const daoToken = Object.entries(defaultTokens).filter(
        (token) => token[1].publicKey.toString() === daoTokenPublicKey.toString()
      );

      // Our "base" token which historically was called META, and in other version TOKEN
      const baseToken = { baseToken: daoToken[0][1] };

      // Our "quote" token, so far this is and is only planned to be USDC
      let quoteToken = { quoteToken: defaultTokens.usdc };

      // Needed as we want to start using real USDC on devnet from here on out
      if (programVersion?.label !== 'V0.3' && network === 'devnet') {
        quoteToken = { quoteToken: defaultTokens.musdc };
      }

      // Combine our tokens we want to use vs defaults
      const usedTokens: TokensDict = { ...staticTokens, ...baseToken, ...quoteToken };

      // Simple optimization to prevent unnecessary updates
      const mergedTokens = { ...daoTokens, ...usedTokens };
      if (JSON.stringify(mergedTokens) !== JSON.stringify(usedTokens)) {
        setDaoTokens(mergedTokens);
      }
    }
  }, [daoState]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return (
    <contextAutocrat.Provider
      value={{
        dao,
        daoTreasury,
        daoState,
        daoTokens,
        openbook,
        proposals,
        autocratProgram,
        programVersion,
        fetchProposals,
        setProgramVersion: (n) =>
          setProgramVersion(
            n < AUTOCRAT_VERSIONS.length ? AUTOCRAT_VERSIONS[n] : AUTOCRAT_VERSIONS[0],
          ),
      }}
    >
      {children}
    </contextAutocrat.Provider>
  );
}
