'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    const router = useRouter();
    router.push('/proposals');
  }, []);
  return <></>;
}
