'use client';

import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout/Layout';
import { OpenbookMarketProvider } from '../../contexts/OpenbookMarketContext';
import { MarketDetailCard } from '@/components/Markets/MarketDetailCard';

export default function ProposalsPage() {
  const params = useSearchParams();
  const marketId = params.get('id');

  return (
    <Layout>
      <OpenbookMarketProvider marketId={marketId}>
        <MarketDetailCard />
      </OpenbookMarketProvider>
    </Layout>
  );
}
