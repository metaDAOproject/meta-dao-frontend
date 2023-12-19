import { useCallback, useState } from 'react';
import { Button, Fieldset, Text, TextInput } from '@mantine/core';
import { Token } from '@/hooks/useTokens';
import { useTokenAmount } from '@/hooks/useTokenAmount';
import { useProposal } from '@/contexts/ProposalContext';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';

export function MintConditionalTokenCard({ token }: { token: Token }) {
  const sender = useTransactionSender();
  const { markets, mintTokensTransactions } = useProposal();
  const { generateExplorerLink } = useExplorerConfiguration();

  if (!markets) return null;

  const [mintAmount, setMintAmount] = useState<number>();
  const fromBase = markets.baseVault.underlyingTokenMint.equals(token.publicKey);
  const vault = fromBase ? markets.baseVault : markets.quoteVault;
  const { amount } = useTokenAmount(vault.underlyingTokenMint);
  const { amount: passAmount } = useTokenAmount(vault.conditionalOnFinalizeTokenMint);
  const { amount: failAmount } = useTokenAmount(vault.conditionalOnRevertTokenMint);
  const [isMinting, setIsMinting] = useState(false);

  const handleMint = useCallback(async () => {
    if (!mintAmount || !markets) return;

    setIsMinting(true);
    try {
      const txs = await mintTokensTransactions(mintAmount!, fromBase);

      if (!txs) return;

      await sender.send(txs);
    } finally {
      setIsMinting(false);
    }
  }, [mintTokensTransactions, amount, sender]);

  return (
    <Fieldset legend={`Mint conditional $${token.symbol}`}>
      <TextInput
        label="Amount"
        description={`Balance: ${amount?.uiAmountString || 0} $${token.symbol}`}
        placeholder="Amount to mint"
        type="number"
        onChange={(e) => setMintAmount(Number(e.target.value))}
      />
      <Text fw="lighter" size="sm" c="green">
        Balance: {passAmount?.uiAmountString || 0} $p{token.symbol}
      </Text>
      <Text fw="lighter" size="sm" c="red">
        Balance: {failAmount?.uiAmountString || 0} $f{token.symbol}
      </Text>
      <Button
        mt="md"
        disabled={(mintAmount || 0) <= 0}
        loading={isMinting}
        onClick={handleMint}
        fullWidth
      >
        Mint
      </Button>
      <Text size="xs" mt="md">
        <a href={generateExplorerLink(vault.toString()!, 'account')} target="blank">
          See cond{token.symbol} vault in explorer
        </a>
      </Text>
    </Fieldset>
  );
}
