import { Group, Text } from '@mantine/core';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { useProposal } from '@/contexts/ProposalContext';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';

export default function MarketTitle({ isPassMarket = false }: { isPassMarket: boolean }) {
  const { proposal } = useProposal();
  const { generateExplorerLink } = useExplorerConfiguration();

  if (isPassMarket) {
    return (
      <Group align="center" justify="center">
        <IconTrendingUp color="green" />
        <Text size="lg" c="green">
          <a
            style={{ textDecoration: 'none', color: 'inherit' }}
            href={generateExplorerLink(proposal?.account.openbookPassMarket.toString()!, 'account')}
            target="blank"
          >
            Pass market
          </a>
        </Text>
      </Group>
    );
  }
  return (
    <Group align="center" justify="center">
      <IconTrendingDown color="red" />
      <Text size="lg" c="red">
        <a
          style={{ textDecoration: 'none', color: 'inherit' }}
          href={generateExplorerLink(proposal?.account.openbookFailMarket.toString()!, 'account')}
          target="blank"
        >
          Fail market
        </a>
      </Text>
    </Group>
  );
}
