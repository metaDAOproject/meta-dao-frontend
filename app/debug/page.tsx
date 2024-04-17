'use client';

import { Button, Container, Stack } from '@mantine/core';
import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { notifications } from '@mantine/notifications';
import { Layout } from '@/components/Layout/Layout';
import CreateTestTokensCard from '../../components/ManageDao/CreateTestTokensCard';
import CreateDaoButton from '../../components/ManageDao/CreateDaoButton';
import TransferTokensButton from '../../components/ManageDao/TransferTokensButton';

export default function DebugPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const handleAirdrop = useCallback(async () => {
    if (!wallet.publicKey) return;
    await connection.confirmTransaction(
      await connection.requestAirdrop(wallet.publicKey, 10 * LAMPORTS_PER_SOL),
    );

    notifications.show({
      title: 'Airdrop successful',
      message: 'Airdropped 10 SOL',
    });
  }, [wallet.publicKey, connection]);

  return (
    <Layout programKey={null}>
      <Container>
        <Stack gap="15">
          <Button onClick={handleAirdrop}>Airdrop</Button>
          <CreateTestTokensCard />
          <CreateDaoButton />
          <TransferTokensButton />
        </Stack>
      </Container>
    </Layout>
  );
}
