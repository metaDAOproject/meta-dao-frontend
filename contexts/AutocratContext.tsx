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
import { useProvider } from '@/hooks/useProvider';
import { AUTOCRAT_VERSIONS, OPENBOOK_PROGRAM_ID } from '@/lib/constants';
import { AutocratProgram, DaoState, ProgramVersion, Proposal } from '../lib/types';
import { useNetworkConfiguration } from '../hooks/useNetworkConfiguration';
import { useOpenbookTwap } from '../hooks/useOpenbookTwap';
import { useQuery } from '@tanstack/react-query';

export interface AutocratContext {
  dao?: PublicKey;
  daoTreasury?: PublicKey;
  daoState?: DaoState;
  openbook?: Program<OpenbookV2>;
  openbookTwap?: Program<any>;
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
  const { endpoint } = useNetworkConfiguration();
  const provider = useProvider();
  const [programVersion, setProgramVersion] = useLocalStorage<ProgramVersion>({
    key: 'program_version',
    defaultValue: AUTOCRAT_VERSIONS[0],
    serialize: (value) => String(AUTOCRAT_VERSIONS.indexOf(value)),
    deserialize: (value) => AUTOCRAT_VERSIONS[Number(value)],
  });
  const { programId, idl } = programVersion!;
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

  const { program: openbookTwap } = useOpenbookTwap();
  const { data: daoStateData } = useQuery({
    queryKey: ['getDao'],
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

    let _proposals: Proposal[] = props.map((prop) => ({
      title: `Proposal ${prop.account.number}`,
      description: '',
      ...prop,
    }));
    setProposals(_proposals);
    _proposals = await Promise.all(
      props.map(async (prop) => {
        let resp;
        if (prop.account.descriptionUrl.includes('hackmd.io')) {
          resp = await fetch(`/api/hackmd?url=${prop.account.descriptionUrl}`, { method: 'GET' })
            .then((r) => r.json())
            .catch((e) => console.error(e));
        }
        return {
          title: resp?.title || `Proposal ${prop.account.number}`,
          description: resp?.description || '',
          ...prop,
        };
      }),
    );
    setProposals(_proposals);
  }, [endpoint, autocratProgram]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return (
    <contextAutocrat.Provider
      value={{
        dao,
        daoTreasury,
        daoState,
        openbook,
        openbookTwap,
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
