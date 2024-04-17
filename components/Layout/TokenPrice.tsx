import { Group } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';
import { useFetchSpotPrice } from '@/hooks/useFetchSpotPrice';

export function TokenPrice() {
  const tokenPrice = useFetchSpotPrice();

  const tokenPriceStatus = () => {
    let tokenPriceString = '';
    if (tokenPrice.isLoading) {
      tokenPriceString = 'loading...';
    }
    if (!tokenPrice.isError) {
      tokenPriceString = `1 ${tokenPrice.token} ≈ $${tokenPrice.price}`;
    }
    return tokenPriceString;
  };

  return (
    <Group gap="0" justify="center" ta="center">
      <div style={{ fontSize: 'small' }}>
        {tokenPriceStatus()}
        <Link
          target="_blank"
          href="https://birdeye.so/token/METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr?chain=solana"
        >
          <IconExternalLink height=".7rem" width="1rem" />
        </Link>
      </div>
    </Group>
  );
}
