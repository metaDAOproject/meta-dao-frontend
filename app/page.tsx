'use client';

import { Container, Stack } from '@mantine/core';
import { Layout } from '@/components/Layout/Layout';
// import ProposalList from '@/components/Proposals/ProposalList';
// import { CreateProposalCard } from '../components/Proposals/CreateProposalCard';
import MarketsList from '@/components/Markets/MarketsList';
import { OpenBookProvider } from '@/contexts/OpenBookContext';

export default function ProposalsPage() {
  return (
    <Layout>
      <Container p="0">
        <Stack gap="15">
          <OpenBookProvider>
            <MarketsList />
          </OpenBookProvider>
        </Stack>
      </Container>
    </Layout>
  );
}
