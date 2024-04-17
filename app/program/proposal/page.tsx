'use client';

import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout/Layout';
import { ProposalDetailCard } from '@/components/Proposals/ProposalDetailCard';
import { ProposalProvider } from '@/contexts/ProposalContext';
import { ProposalMarketsProvider } from '@/contexts/ProposalMarketsContext';

export default function DaoProposalPage() {
  const params = useSearchParams();
  const proposalNumber = Number(params.get('proposalNumber'));
  const programKey = params.get('programKey');

  return (
    <Layout programKey={programKey}>
      <ProposalMarketsProvider proposalNumber={proposalNumber}>
        <ProposalProvider proposalNumber={proposalNumber}>
          <ProposalDetailCard proposalNumber={proposalNumber} programKey={programKey} />
        </ProposalProvider>
      </ProposalMarketsProvider>
    </Layout>
  );
}
