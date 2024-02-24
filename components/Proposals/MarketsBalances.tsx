import { Fieldset, Group, Stack, Indicator, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
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
          <Text fw={600}>
            {balance} {market.charAt(0)}
            {token.symbol}
          </Text>
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
  const { metaToken, usdcToken } = useConditionalTokens();

  return (
    <Stack align="center" justify="center" pos="relative" pt="lg" w="100%">
      {metaToken && usdcToken && (
        <Group gap={24} w="100%">
          <Fieldset legend="Pass market" flex={1}>
            <Stack>
              <Balance token={metaToken} market="pass" imageSrc="/metaToken.png" />
              <Balance
                token={usdcToken}
                market="pass"
                imageSrc="https://s3.coinmarketcap.com/static-gravity/image/5a8229787b5e4c809b5914eef709b59a.png"
              />
            </Stack>
          </Fieldset>
          <Fieldset legend="Fail market" flex={1}>
            <Stack>
              <Balance token={metaToken} market="fail" imageSrc="/metaToken.png" />
              <Balance
                token={usdcToken}
                market="fail"
                imageSrc="https://s3.coinmarketcap.com/static-gravity/image/5a8229787b5e4c809b5914eef709b59a.png"
              />
            </Stack>
          </Fieldset>
        </Group>
      )}
    </Stack>
  );
}
