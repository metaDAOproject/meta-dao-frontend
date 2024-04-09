'use client';

import { useMemo } from 'react';
import { Divider, Group, Loader, Stack, Text, Title, NativeSelect, Code, Menu, Button, Image, UnstyledButton } from '@mantine/core';
import { IconSwitchVertical } from '@tabler/icons-react';
import { useNetworkConfiguration } from '@/hooks/useNetworkConfiguration';
import { useAutocrat } from '@/contexts/AutocratContext';
import { ProposalPreview } from './ProposalPreview';
import { AUTOCRAT_VERSIONS, DAOS } from '@/lib/constants';

const programVersions = AUTOCRAT_VERSIONS.map((version, i) => ({
  label: `${version.label}-${version.dao}`,
  value: i.toString(),
}));

export default function ProposalList() {
  const { proposals, programVersion, setProgramVersion } = useAutocrat();
  const { network } = useNetworkConfiguration();
  const pendingProposals = useMemo(
    () => proposals?.filter((proposal) => proposal.account.state.pending),
    [proposals],
  );
  const otherProposals = useMemo(
    () => proposals?.filter((proposal) => !proposal.account.state.pending),
    [proposals],
  );

  if (proposals === undefined) {
    return (
      <Group justify="center">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        {programVersion !== null && (
          <>
          <Menu>
            <Menu.Target>
              <Button variant="secondary"><IconSwitchVertical strokeWidth={0.85} /></Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Stack p="md" align="center">
                <NativeSelect
                  label="Program version"
                  // NOTE: A slice for removing this from render given devnet
                  data={Array.prototype.slice.call(programVersions, network === 'devnet' ? 0 : 1)}
                  value={AUTOCRAT_VERSIONS.indexOf(programVersion!)}
                  onChange={(e) => setProgramVersion(Number(e.target.value))}
                />
              </Stack>
            </Menu.Dropdown>
          </Menu>
          <Group>
            <Text>Autocrat Program</Text>
            <Code>{programVersion?.label}-{programVersion?.dao}</Code>
          </Group>
          </>
        )}
      </Group>
      {(network === 'devnet' && programVersion !== null && programVersion?.label === 'V0.3') && (
        <Group justify="space-between" p={20}>
        {DAOS.map((dao, i) => (
          // TODO: Need to setup something here once we go live for v0.3
          // so select from one of the DAOs and like setting program version
          // set the DAO public key and that's what we'll use as reference
          // THIS IS A STUB TO TEST SOME IDEAS
          <UnstyledButton style={{ width: 120, height: 120 }}>
            <Text key={`dao name-${i}`}>{dao.name}</Text>
            <Image key={`dao icon-${i}`} src={`/${dao.icon}`} width={90} height={90} />
          </UnstyledButton>
        ))}
        <UnstyledButton style={{ width: 120, height: 120 }}>
          <Text key="YOURDAO">YOUR DAO</Text>
          <Image key="YOURDAO Icon" src="/" width={90} height={90} />
        </UnstyledButton>
        </Group>
      )}
      {proposals.length > 0 ? (
        <Stack gap="xl">
          {pendingProposals?.map((proposal, i) => (
            <ProposalPreview proposal={proposal} key={`pending proposal-${i}`} />
          ))}
          {pendingProposals?.length !== 0 && otherProposals?.length !== 0 && <Divider />}
          {otherProposals && otherProposals?.length !== 0 && (
            <Stack gap="md">
              <Title order={2}>Archived</Title>
              {otherProposals.map((proposal, i) => (
                <ProposalPreview proposal={proposal} key={`archived proposal-${i}`} />
              ))}
            </Stack>
          )}
        </Stack>
      ) : (
        <Text size="lg" ta="center" fw="bold">
          There are no proposals yet
        </Text>
      )}
    </Stack>
  );
}
