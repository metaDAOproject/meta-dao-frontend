import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Program } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getTokenMetadata } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { useLocalStorage } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';
import { useProvider } from '@/hooks/useProvider';
import { AUTOCRAT_VERSIONS, staticTokens, devnetTokens, mainnetTokens, DAOS } from '@/lib/constants';
import { AutocratProgram, DaoState, ProgramVersion, Proposal, TokensDict, Token } from '../lib/types';
import { Networks, useNetworkConfiguration } from '../hooks/useNetworkConfiguration';

export interface AutocratContext {
  daoKey?: PublicKey;
  daoTreasuryKey?: PublicKey;
  daoState?: DaoState;
  daoTokens?: TokensDict;
  proposals?: Proposal[];
  autocratProgram?: Program<AutocratProgram>;
  programVersion?: ProgramVersion;
  setProgramVersion: (e: number) => void;
}
export const contextAutocrat = createContext<AutocratContext>({
  setProgramVersion: () => { },
});
export const useAutocrat = () => {
  const context = useContext<AutocratContext>(contextAutocrat);
  return context;
};

export function AutocratProvider({ children }: { children: ReactNode; }) {
  const { network } = useNetworkConfiguration();
  const { connection } = useConnection();
  const provider = useProvider();
  const [programVersion, setProgramVersion] = useLocalStorage<ProgramVersion>({
    key: 'program_version',
    defaultValue: AUTOCRAT_VERSIONS[1],
    serialize: (value) => String(AUTOCRAT_VERSIONS.indexOf(value)),
    deserialize: (value) => AUTOCRAT_VERSIONS[Number(value)],
  });

  const { programId, idl } = programVersion!;

  // TOOD: Use memo? Or?
  const autocratProgram = new Program<AutocratProgram>(idl as AutocratProgram, programId, provider);

  // TODO: We need to surface an option to select a DAO, so there's
  // some point of reference from the user to allow us to sort on this.
  // I've setup a list of DAOs hard coded, but this is still missing a
  // selection given you may have many starting at v0.3
  const daosQueryKey = `${programVersion.label}DaoList`;
  const { data: daos } = useQuery({
    queryKey: [daosQueryKey],
    queryFn: () => autocratProgram.account.dao.all(),
    staleTime: 30_000,
    refetchOnMount: true,
  });

  // TODO: THIS NEEDS TO BE HANDLED WHEN MULTI DAO
  // Filter against our list of DAOs
  let selectedDao = daos?.find(
    (dao) => dao.publicKey.toString() === DAOS[0].publicKey.toString()
  );

  // Need to use any DAO even if we didn't get a match from our list
  if (!selectedDao && daos) {
    [selectedDao] = daos;
  }

  const daoKey = selectedDao?.publicKey;

  const daoTreasuryKey = selectedDao?.account.treasury;

  const daoState = selectedDao?.account;

  const [proposals, setProposals] = useState<Proposal[]>();

  const proposalsQueryKey = `${programVersion.label}Proposals`;
  const { data: allProposals } = useQuery({
    queryKey: [proposalsQueryKey],
    queryFn: () => autocratProgram?.account.proposal?.all(),
    staleTime: 30_000,
    refetchOnMount: true,
  });

  // Moved token stuff into the Autocrat, given this is where we reference core tokens
  const defaultTokens: TokensDict = useMemo(() => {
    switch (network) {
      case Networks.Devnet:
        return { ...staticTokens, ...devnetTokens };
      case Networks.Mainnet:
        return { ...staticTokens, ...mainnetTokens };
      case Networks.Custom:
        // TODO: What if custom is devnet?
        return { ...staticTokens, ...mainnetTokens, ...devnetTokens };
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

  // TODO: The goal here is the fetch the token data to enrich it.
  // all we need is a URI for display within the application
  // NOTE: This is not working.
  const { data: tokenMetaData } = useQuery({
    queryKey: [`token-${daoTokens.baseToken?.publicKey}`],
    queryFn: () => getTokenMetadata(
      connection,
      daoTokens.baseToken?.publicKey!,
      undefined,
      TOKEN_PROGRAM_ID
    ),
    staleTime: 10,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (tokenMetaData) {
      console.log(tokenMetaData.uri);
    }
  }, [selectedDao, programVersion]);

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
    // NOTE: Stub this "selectedDao" for use in a future version.
  }, [selectedDao, programVersion]);

  useEffect(() => {
    const props = ((allProposals) || []).sort((a, b) =>
      a.account.number < b.account.number ? 1 : -1,
    );

    const _proposals: Proposal[] = props.map((prop) => ({
      title: `Proposal ${prop.account.number}`,
      description: '',
      ...prop,
    }));
    setProposals(_proposals);
  }, [allProposals, programVersion]);

  return (
    <contextAutocrat.Provider
      value={{
        daoKey,
        daoTreasuryKey,
        daoState,
        daoTokens,
        proposals,
        autocratProgram,
        programVersion,
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
