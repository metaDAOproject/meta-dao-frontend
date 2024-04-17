'use client';

import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout/Layout';
import { ProposalDetailCard } from '@/components/Proposals/ProposalDetailCard';
import { ProposalProvider } from '@/contexts/ProposalContext';
import { ProposalMarketsProvider } from '@/contexts/ProposalMarketsContext';

export default function ProposalsPage() {
  const params = useSearchParams();
  const proposalNumber = Number(params.get('id'));

  return (
    <Layout>
      <ProposalMarketsProvider proposalNumber={proposalNumber}>
        <ProposalProvider proposalNumber={proposalNumber}>
          <ProposalDetailCard programKey={null} proposalNumber={proposalNumber} />
        </ProposalProvider>
      </ProposalMarketsProvider>
    </Layout>
  );
}
