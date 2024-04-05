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

  const sender = useTransactionSender();

  const handleTransfer = useCallback(async () => {
    if (!daoTokens || !daoTokens.baseToken || !wallet?.publicKey || !daoTreasury) {
      return;
    }
    const { baseToken } = daoTokens;
    const txs = [
      new Transaction()
        .add(
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            getAssociatedTokenAddressSync(baseToken.publicKey, daoTreasury, true),
            daoTreasury,
            baseToken.publicKey,
          ),
        )
        .add(
          createTransferInstruction(
            getAssociatedTokenAddressSync(baseToken.publicKey, wallet.publicKey, true),
            getAssociatedTokenAddressSync(baseToken.publicKey, daoTreasury, true),
            wallet.publicKey,
            1000000000n,
          ),
        ),
    ];
    await sender.send(txs);
  }, [autocratProgram]);

  return <Button onClick={() => handleTransfer()}>Transfer tokens</Button>;
}
