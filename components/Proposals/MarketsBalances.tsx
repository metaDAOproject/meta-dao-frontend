import { Fieldset, Group, Stack, Indicator, Text, Loader } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { MintConditionalTokenCard } from './MintConditionalTokenCard';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import useConditionalTokens, { ConditionalToken } from '@/hooks/useConditionalTokens';

function Balance({
  token,
  market,
  imageSrc,
}: {
  token: ConditionalToken;
  market: 'pass' | 'fail';
  imageSrc: string;
}) {
  const { explorer, generateExplorerLink } = useExplorerConfiguration();

  const { balance, address } = useMemo(() => {
    if (market === 'pass') {
      return {
        balance: token.balancePass?.uiAmountString || 0,
        address: token.finalize.toString(),
      };
    }
    return { balance: token.balanceFail?.uiAmountString || 0, address: token.revert.toString() };
  }, [market, token]);

  return (
    <Group gap={12}>
      <Indicator
        label={market.charAt(0).toUpperCase()}
        size={16}
        offset={10}
        position="bottom-end"
        color={market === 'pass' ? '#F1F3F5' : '#1F1F1F'}
        withBorder
        autoContrast
      >
        <Image
          src={imageSrc}
          alt={`${token.symbol} logo`}
          width={40}
          height={40}
          style={{ marginTop: 4 }}
        />
      </Indicator>
      <Stack gap={0}>
        <Group gap={4}>
          {token.loading ? (
            <Loader />
          ) : (
            <>
              <Text fw={600}>
                {balance} {market.charAt(0)}
                {token.symbol}
              </Text>
            </>
          )}
        </Group>
        <Link target="_blank" href={generateExplorerLink(address, 'account')}>
          <Group gap="4" justify="center" ta="center" opacity={0.5}>
            <Text size="xs" fw="lighter">
              see on {explorer}
            </Text>
            <IconExternalLink height="1rem" width="1rem" stroke="1px" />
          </Group>
        </Link>
      </Stack>
    </Group>
  );
}

export default function MarketsBalances() {
  const { baseToken, quoteToken } = useConditionalTokens();

  return (
    <Stack align="center" justify="center" pos="relative" pt="lg" w="100%">
      <MintConditionalTokenCard />
      {baseToken && quoteToken && (
        <Group gap={24} w="100%">
          <Fieldset legend="Pass market" flex={1}>
            <Stack>
              <Balance
                token={baseToken}
                market="pass"
                imageSrc={`/${baseToken.symbol.toLowerCase()}Token.png`}
              />
              <Balance
                token={quoteToken}
                market="pass"
                imageSrc={`/${quoteToken.symbol.toLowerCase()}Token.png`}
              />
            </Stack>
          </Fieldset>
          <Fieldset legend="Fail market" flex={1}>
            <Stack>
              <Balance
                token={baseToken}
                market="fail"
                imageSrc={`/${baseToken.symbol.toLowerCase()}Token.png`}
              />
              <Balance
                token={quoteToken}
                market="fail"
                imageSrc={`/${quoteToken.symbol.toLowerCase()}Token.png`}
              />
            </Stack>
          </Fieldset>
        </Group>
      )}
    </Stack>
  );
}
