'use client';

import { Button, Card, Group, Loader, Stack, Text } from '@mantine/core';
import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { notifications } from '@mantine/notifications';
import * as token from '@solana/spl-token';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { useProvider } from '@/hooks/useProvider';
import { useAutocrat } from '@/contexts/AutocratContext';

export default function CreateTestTokensCard() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { daoTokens } = useAutocrat();
  const provider = useProvider();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tokens, setTokens] = useState<any>();

  if (!daoTokens || !daoTokens.baseToken || !daoTokens.quoteToken) return <Loader />;

  const { baseToken } = daoTokens;
  const { quoteToken } = daoTokens;

  const handleCreateDao = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return;

    const txMeta = new Transaction();
    const metaKeypair = Keypair.generate();
    const quoteKeypair = Keypair.generate();
    txMeta.add(
      SystemProgram.createAccount({
        programId: token.TOKEN_PROGRAM_ID,
        fromPubkey: wallet.publicKey,
        newAccountPubkey: metaKeypair.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(token.MINT_SIZE),
        space: token.MINT_SIZE,
      }),
    );
    txMeta.add(
      token.createInitializeMintInstruction(metaKeypair.publicKey, 9, wallet.publicKey, null),
    );
    const metaAccount = token.getAssociatedTokenAddressSync(
      metaKeypair.publicKey,
      wallet.publicKey,
      true,
    );
    txMeta.add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        metaAccount,
        wallet.publicKey,
        metaKeypair.publicKey,
      ),
    );
    txMeta.add(
      token.createMintToInstruction(
        metaKeypair.publicKey,
        metaAccount,
        wallet.publicKey,
        100000n * BigInt(LAMPORTS_PER_SOL),
      ),
    );

    const txUsdc = new Transaction();
    txUsdc.add(
      SystemProgram.createAccount({
        programId: token.TOKEN_PROGRAM_ID,
        fromPubkey: wallet.publicKey,
        newAccountPubkey: quoteKeypair.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(token.MINT_SIZE),
        space: token.MINT_SIZE,
      }),
    );
    txUsdc.add(
      token.createInitializeMintInstruction(quoteKeypair.publicKey, 6, wallet.publicKey, null),
    );
    const quoteAccount = token.getAssociatedTokenAddressSync(
      quoteKeypair.publicKey,
      wallet.publicKey,
      true,
    );
    txUsdc.add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        quoteAccount,
        wallet.publicKey,
        quoteKeypair.publicKey,
      ),
    );
    txUsdc.add(
      token.createMintToInstruction(
        quoteKeypair.publicKey,
        quoteAccount,
        wallet.publicKey,
        100000n * BigInt(LAMPORTS_PER_SOL),
      ),
    );

    const blockhash = await provider.connection.getLatestBlockhash('confirmed');
    txMeta.recentBlockhash = blockhash.blockhash;
    txMeta.lastValidBlockHeight = blockhash.lastValidBlockHeight;
    txMeta.feePayer = wallet.publicKey;
    txMeta.sign(metaKeypair);

    txUsdc.recentBlockhash = blockhash.blockhash;
    txUsdc.lastValidBlockHeight = blockhash.lastValidBlockHeight;
    txUsdc.feePayer = wallet.publicKey;
    txUsdc.sign(quoteKeypair);

    const signedTxs = await wallet.signAllTransactions([txMeta, txUsdc]);
    await Promise.all(signedTxs.map((tx) => connection.sendRawTransaction(tx.serialize())));

    notifications.show({
      message: 'Created Test $META and Test $USDC',
      title: 'Successfully minted',
      color: 'green',
    });
    setTokens({
      meta: {
        publicKey: metaKeypair.publicKey,
        symbol: 'META',
        name: 'Meta',
        decimals: 9,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      },
      usdc: {
        publicKey: quoteKeypair.publicKey,
        symbol: 'USDC',
        name: 'Circle USD',
        decimals: 6,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      },
    });
  }, [provider, wallet, connection]);

  return (
    <Card shadow="sm" radius="md" withBorder>
      <Card.Section>
        <Stack gap="15" p="xs">
          {baseToken ? (
            <Text>Meta mint: {baseToken.publicKey.toString()}</Text>
          ) : (
            <Text>No meta token yet</Text>
          )}
          {quoteToken ? (
            <Text>Usdc mint: {quoteToken.publicKey.toString()}</Text>
          ) : (
            <Text>No usdc token yet</Text>
          )}
        </Stack>
      </Card.Section>
      <Card.Section>
        <Group p="sm">
          <Button fullWidth onClick={() => handleCreateDao()}>
            Create test tokens
          </Button>
        </Group>
      </Card.Section>
    </Card>
  );
}
