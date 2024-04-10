'use client';

import { Container, Stack } from '@mantine/core';
import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout/Layout';
import ProposalList from '@/components/Proposals/ProposalList';

export default function DaoPage() {
  const params = useSearchParams();
  const programKey = params.get('programKey');
  return (
    <Layout>
      <Container p="0">
        <Stack gap="15">
          <ProposalList programKey={programKey} />
        </Stack>
      </Container>
    </Layout>
  );
}
