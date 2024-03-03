'use client';

import { useRouter } from 'next/navigation';
//import { useMemo } from 'react';
import { Group, Badge, Loader, Stack, Text, UnstyledButton } from '@mantine/core';
import { useOpenBook } from '@/contexts/OpenBookContext';
import { shortKey } from '@/lib/utils';

export default function MarketsList() {
  const router = useRouter();
  const openbook = useOpenBook();
  const { markets } = openbook;

  if (markets === undefined) {
    return (
      <Group justify="center">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack>
      {markets.length > 0 ? (
        <Stack gap="xl">
          {markets?.map((market) => (
            <Group>
              <UnstyledButton onClick={() => router.push(`/market?id=${market.market}`)}>
                <Badge>
                    {market.name}
                </Badge>
              </UnstyledButton>
              <Text opacity={0.6}>{shortKey(market.market)}</Text>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="lg" ta="center" fw="bold">
          There are no markets yet
        </Text>
      )}
    </Stack>
  );
}
