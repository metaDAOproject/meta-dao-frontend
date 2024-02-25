import { useRouter } from 'next/navigation';
// import Markdown from 'react-markdown';
import { Card, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { Proposal } from '@themetadao/futarchy-ts/lib/types';
import { shortKey } from '@themetadao/futarchy-ts/lib/utils';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { StateBadge } from './StateBadge';
import ExternalLink from '../ExternalLink';

export function ProposalPreview({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const { generateExplorerLink } = useExplorerConfiguration();

  return (
    <UnstyledButton onClick={() => router.push(`/proposal?id=${proposal.account.number}`)}>
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
          {proposal.description && (
            <Group mt="-20px" h="120" style={{ overflow: 'hidden' }}>
              {/* <Markdown>{proposal.description.replaceAll('\n', '')}</Markdown> */}
            </Group>
          )}
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
