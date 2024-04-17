'use client';

import { Layout } from '@/components/Layout/Layout';
import { CreateProposalCard } from '../../components/Proposals/CreateProposalCard';

export default function CreateProposalPage() {
  return (
    <Layout programKey={null}>
      <CreateProposalCard />
    </Layout>
  );
}
