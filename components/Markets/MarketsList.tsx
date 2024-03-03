'use client';

import { useRouter } from 'next/navigation';
//import { useMemo } from 'react';
import { Group, Loader, Stack, Text, UnstyledButton } from '@mantine/core';
import { useOpenBook } from '@/contexts/OpenBookContext';

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
            <UnstyledButton onClick={() => router.push(`/market?id=${market.market}`)}>
            <Text opacity={0.6}>
                {market.name} {market.market}
            </Text>
            </UnstyledButton>
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
