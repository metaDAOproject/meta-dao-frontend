'use client';

import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout/Layout';
import { OpenBookMarketProvider } from '../../contexts/OpenBookMarketContext';
import { MarketDetailCard } from '@/components/Markets/MarketDetailCard';

export default function ProposalsPage() {
  const params = useSearchParams();
  const marketId = params.get('id');

  return (
    <Layout>
      <OpenBookMarketProvider marketId={marketId}>
        <MarketDetailCard />
      </OpenBookMarketProvider>
    </Layout>
  );
}
