import { Group, HoverCard, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useTokens } from '@/hooks/useTokens';
import { MintConditionalTokenCard } from './MintConditionalTokenCard';

export default function MarketsBalances() {
  const { tokens } = useTokens();

  return (
    <Group align="center" justify="center" pos="relative" pt="lg" wrap="wrap" grow>
      <HoverCard position="top">
        <HoverCard.Target>
          <Group pos="absolute" top="0" left="0" justify="center" align="flex-start">
            <IconInfoCircle strokeWidth={1.3} />
          </Group>
        </HoverCard.Target>
        <HoverCard.Dropdown w="22rem">
          <Stack>
            <Text>
              Conditional tokens are the tokens used to trade on conditional markets. You can mint
              some by depositing $META or $USDC. These tokens will be locked up until the proposal
              is finalized.
            </Text>
            <Text size="sm">
              <Text span fw="bold">
                Pass tokens (pTokens){' '}
              </Text>
              are used to trade on the Pass Market
            </Text>
            <Text size="sm">
              <Text span fw="bold">
                Fail tokens (fTokens){' '}
              </Text>
              are used to trade on the Fail Market.
            </Text>
          </Stack>
        </HoverCard.Dropdown>
      </HoverCard>
      {tokens?.meta ? <MintConditionalTokenCard token={tokens.meta} /> : null}
      {tokens?.usdc ? <MintConditionalTokenCard token={tokens.usdc} /> : null}
    </Group>
  );
}
