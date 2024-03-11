'use client';

import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout/Layout';
import { OpenbookMarketProvider } from '@/contexts/OpenbookMarketContext';
import { MarketDetailCard } from '@/components/Markets/MarketDetailCard';
import { BalancesProvider } from '@/contexts/BalancesContext';

export default function MarketPage() {
  const params = useSearchParams();
  const marketId = params.get('id');

  return (
    <Layout>
      <OpenbookMarketProvider marketId={marketId}>
        <BalancesProvider>
          <MarketDetailCard />
        </BalancesProvider>
      </OpenbookMarketProvider>
    </Layout>
  );
}
