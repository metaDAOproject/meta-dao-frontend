'use client';

import { Button, Loader } from '@mantine/core';
import { useCallback } from 'react';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useAutocrat } from '../../contexts/AutocratContext';
import { useTransactionSender } from '../../hooks/useTransactionSender';

export default function TransferTokensButton() {
  const wallet = useWallet();
  const { autocratProgram, daoTreasury, daoTokens } = useAutocrat();
  if (!daoTokens) return <Loader />;
  const tokens = daoTokens;
  const sender = useTransactionSender();

  const handleTransfer = useCallback(async () => {
    if (!daoTokens || !wallet?.publicKey || !daoTreasury) {
      return;
    }
    const txs = [
      new Transaction()
        .add(
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            getAssociatedTokenAddressSync(tokens.token.publicKey, daoTreasury, true),
            daoTreasury,
            tokens.token.publicKey,
          ),
        )
        .add(
          createTransferInstruction(
            getAssociatedTokenAddressSync(tokens.token.publicKey, wallet.publicKey, true),
            getAssociatedTokenAddressSync(tokens.token.publicKey, daoTreasury, true),
            wallet.publicKey,
            1000000000n,
          ),
        ),
    ];
    await sender.send(txs);
  }, [autocratProgram]);

  return <Button onClick={() => handleTransfer()}>Transfer tokens</Button>;
}
