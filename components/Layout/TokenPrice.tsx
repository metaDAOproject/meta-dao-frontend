import { Group, Skeleton, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';
import { useFetchSpotPrice } from '@/hooks/useFetchSpotPrice';

export function TokenPrice() {
  const tokenPrice = useFetchSpotPrice();

  const tokenPriceStatus = tokenPrice.isLoading
    ? null
    : tokenPrice.isError
    ? 'Error fetching price'
    : `1 ${tokenPrice.token} ≈ $${tokenPrice.price}`;

  return (
    <Skeleton visible={!tokenPriceStatus} width="14rem">
      <Group gap={2} justify="center">
        <Text size="xs">{tokenPriceStatus}</Text>
        <Link
          target="_blank"
          href="https://birdeye.so/token/METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr?chain=solana"
        >
          <IconExternalLink height=".7rem" width="1rem" />
        </Link>
      </Group>
    </Skeleton>
  );
}
