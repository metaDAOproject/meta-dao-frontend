'use client';

import { useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { Layout } from '@/components/Layout/Layout';
import { ProposalDetailCard } from '@/components/Proposals/ProposalDetailCard';
import { ProposalProvider } from '@/contexts/ProposalContext';
import { BalancesProvider } from '../../contexts/BalancesContext';

export default function ProposalsPage() {
  const params = useSearchParams();
  const proposalNumber = Number(params.get('id'));
  const { publicKey } = useWallet();

  return (
    <Layout>
      <ProposalProvider proposalNumber={proposalNumber}>
        <BalancesProvider owner={publicKey || undefined}>
          <ProposalDetailCard />
        </BalancesProvider>
      </ProposalProvider>
    </Layout>
  );
}
