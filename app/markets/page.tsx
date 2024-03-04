'use client';

import { Container, Stack } from '@mantine/core';
import { Layout } from '@/components/Layout/Layout';
import MarketsList from '@/components/Markets/MarketsList';
import { OpenbookProvider } from '@/contexts/OpenbookContext';

export default function MarketsPage() {
  return (
    <Layout>
      <Container p="0">
        <Stack gap="15">
          <OpenbookProvider>
            <MarketsList />
          </OpenbookProvider>
        </Stack>
      </Container>
    </Layout>
  );
}
