'use client';

import { Container, Stack } from '@mantine/core';
import { Layout } from '@/components/Layout/Layout';
import CreateTestTokensCard from '../../components/ManageDao/CreateTestTokensCard';
import CreateDaoButton from '../../components/ManageDao/CreateDaoButton';

export default function AnalyticsPage() {
  return (
    <Layout>
      <Container>
        <Stack gap="15">
          <CreateTestTokensCard />
          <CreateDaoButton />
        </Stack>
      </Container>
    </Layout>
  );
}
