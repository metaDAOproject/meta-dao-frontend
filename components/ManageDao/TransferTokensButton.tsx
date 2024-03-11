'use client';

import { Button } from '@mantine/core';
import { useCallback } from 'react';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useAutocrat } from '../../contexts/AutocratContext';
import { useTokens } from '../../hooks/useTokens';
import { useTransactionSender } from '../../hooks/useTransactionSender';

export default function TransferTokensButton() {
  const wallet = useWallet();
  const { tokens } = useTokens();
  const { autocratProgram, daoTreasury } = useAutocrat();
  const sender = useTransactionSender();

  const handleTransfer = useCallback(async () => {
    if (!tokens.meta?.publicKey || !wallet?.publicKey || !daoTreasury) {
      return;
    }
    const txs = [
      new Transaction()
        .add(
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            getAssociatedTokenAddressSync(tokens.meta.publicKey, daoTreasury, true),
            daoTreasury,
            tokens.meta.publicKey,
          ),
        )
        .add(
          createTransferInstruction(
            getAssociatedTokenAddressSync(tokens.meta.publicKey, wallet.publicKey, true),
            getAssociatedTokenAddressSync(tokens.meta.publicKey, daoTreasury, true),
            wallet.publicKey,
            1000000000n,
          ),
        ),
    ];
    console.log(txs);
    await sender.send(txs);
  }, [autocratProgram, tokens]);

  return <Button onClick={() => handleTransfer()}>Transfer tokens</Button>;
}
