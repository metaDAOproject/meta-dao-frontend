import { useRouter } from 'next/navigation';
// import Markdown from 'react-markdown';
import { Card, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { StateBadge } from './StateBadge';
import { Proposal } from '@/lib/types';
import ExternalLink from '../ExternalLink';
import { shortKey } from '@/lib/utils';

export type ProposalPreviewProps = {
  proposal: Proposal;
  programIdKey: string;
  proposalNumber: number;
};

export function ProposalPreview(props: ProposalPreviewProps) {
  const { proposal, programIdKey, proposalNumber } = props;
  const router = useRouter();
  const { generateExplorerLink } = useExplorerConfiguration();

  return (
    <UnstyledButton
      onClick={(e) => {
        e.preventDefault();
        router.push(`/program/proposal?programKey=${programIdKey}&proposalNumber=${proposalNumber}`);
      }}
    >
      <Card
        key={proposal.publicKey.toString()}
        shadow="sm"
        radius="md"
        withBorder
        m="0"
        px="24"
        py="12"
      >
        <Stack>
          <Group justify="space-between">
            <Text size="xl" fw={500}>
              {proposal.title}
            </Text>
            <StateBadge proposal={proposal} />
          </Group>
          <Group justify="space-between">
            <ExternalLink href={proposal.account.descriptionUrl} text="See more" />
            <Text opacity={0.6}>
              Proposed by{' '}
              <a
                href={generateExplorerLink(proposal.account.proposer.toString(), 'account')}
                target="blank"
                onClick={(e) => e.stopPropagation()}
              >
                {shortKey(proposal.account.proposer)}
              </a>
            </Text>
          </Group>
        </Stack>
      </Card>
    </UnstyledButton>
  );
}
