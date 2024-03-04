'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { Layout } from '@/components/Layout/Layout';
import { CreateProposalCard } from '../../components/Proposals/CreateProposalCard';
import { BalancesProvider } from '../../contexts/BalancesContext';

export default function CreateProposalPage() {
  const { publicKey } = useWallet();

  return (
    <Layout>
      <BalancesProvider owner={publicKey || undefined}>
        <CreateProposalCard />
      </BalancesProvider>
    </Layout>
  );
}
