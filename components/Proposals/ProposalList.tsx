'use client';

import { useMemo } from 'react';
import { Divider, Group, Loader, Stack, Text, Title, NativeSelect } from '@mantine/core';
import { AUTOCRAT_VERSIONS } from '@themetadao/futarchy-ts/lib/constants';
import { useAutocrat } from '../../contexts/AutocratContext';
import { ProposalPreview } from './ProposalPreview';

const programVersions = AUTOCRAT_VERSIONS.map((version, i) => ({
  label: version.label,
  value: i.toString(),
}));

export default function ProposalList() {
  const { proposals, programVersion, setProgramVersion } = useAutocrat();
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
      {programVersion !== null && (
        <NativeSelect
          label="Program version"
          data={programVersions}
          value={AUTOCRAT_VERSIONS.indexOf(programVersion!)}
          onChange={(e) => setProgramVersion(Number(e.target.value))}
        />
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
