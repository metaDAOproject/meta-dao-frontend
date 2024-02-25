import { Badge } from '@mantine/core';
import { ProposalAccountWithKey } from '@themetadao/futarchy-ts/lib/types';

export function StateBadge({ proposal }: { proposal: ProposalAccountWithKey }) {
  if (!proposal) return null;
  if (proposal.account.state.pending) {
    return (
      <Badge color="yellow" my="auto">
        Pending
      </Badge>
    );
  }
  if (proposal.account.state.passed) {
    return (
      <Badge color="green" my="auto">
        Passed
      </Badge>
    );
  }
  return (
    <Badge color="red" my="auto">
      Failed
    </Badge>
  );
}
