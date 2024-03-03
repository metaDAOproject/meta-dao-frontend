'use client';

import { useRouter } from 'next/navigation';
//import { useMemo } from 'react';
import { Group, Badge, Loader, Stack, Text, UnstyledButton, Pill, Divider } from '@mantine/core';
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
        <Stack p={0} m={0} gap={0}>
          {markets?.map((market) => (
            <>
            <Group>
              <UnstyledButton onClick={() => router.push(`/market?id=${market.market}`)}>
                <Badge color="gray">
                    {market.name}
                </Badge>
              </UnstyledButton>
              <Text opacity={0.6}>{shortKey(market.market)}</Text>
            </Group>
            <Divider p={10} mt={0} />
            </>
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
