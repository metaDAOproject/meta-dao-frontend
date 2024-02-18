import { useCallback, useState } from 'react';
import { Button, Fieldset, Group, Text, TextInput } from '@mantine/core';
import numeral from 'numeral';
import Link from 'next/link';
import { IconExternalLink } from '@tabler/icons-react';
import { Token } from '@/hooks/useTokens';
import { useProposal } from '@/contexts/ProposalContext';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useBalance } from '../../hooks/useBalance';
import { NUMERAL_FORMAT } from '../../lib/constants';

export function MintConditionalTokenCard({ token }: { token: Token }) {
  const sender = useTransactionSender();
  const { markets, mintTokensTransactions } = useProposal();
  const { generateExplorerLink } = useExplorerConfiguration();

  if (!markets) return null;

  const [mintAmount, setMintAmount] = useState<number>();
  const fromBase = markets.baseVault.underlyingTokenMint.equals(token.publicKey);
  const vault = fromBase ? markets.baseVault : markets.quoteVault;
  const { amount, fetchAmount: fetchUnderlying } = useBalance(vault.underlyingTokenMint);
  const { amount: passAmount, fetchAmount: fetchPass } = useBalance(
    vault.conditionalOnFinalizeTokenMint,
  );
  const { amount: failAmount, fetchAmount: fetchFail } = useBalance(
    vault.conditionalOnRevertTokenMint,
  );
  const [isMinting, setIsMinting] = useState(false);

  const handleMint = useCallback(async () => {
    if (!mintAmount || !markets) return;

    setIsMinting(true);
    try {
      const txs = await mintTokensTransactions(mintAmount!, fromBase);

      if (!txs) return;

      await sender.send(txs);
      fetchUnderlying();
      fetchPass();
      fetchFail();
    } finally {
      setIsMinting(false);
    }
  }, [mintTokensTransactions, fetchUnderlying, fetchPass, fetchFail, amount, sender]);

  return (
    <Fieldset legend={`Mint conditional $${token.symbol}`} miw="180px">
      <TextInput
        label="Amount"
        description={`Balance: ${numeral(amount?.uiAmountString || 0).format(NUMERAL_FORMAT)} $${
          token.symbol
        }`}
        placeholder="Amount to mint"
        type="number"
        onChange={(e) => setMintAmount(Number(e.target.value))}
      />
      <Text fw="lighter" size="sm">
        Balances:
      </Text>
      <Text fw="lighter" size="sm" c="green">
        - {passAmount?.uiAmountString || 0} $p{token.symbol}
      </Text>
      <Text fw="lighter" size="sm" c="red">
        - {failAmount?.uiAmountString || 0} $f{token.symbol}
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
      <Group mt="md" justify="space-between">
        <Link
          target="_blank"
          href={generateExplorerLink(vault.conditionalOnFinalizeTokenMint.toString(), 'account')}
        >
          <Group gap="0" justify="center" ta="center" c="green">
            <Text size="xs">p{token.symbol}</Text>
            <IconExternalLink height="1rem" width="1rem" />
          </Group>
        </Link>
        <Link
          target="_blank"
          href={generateExplorerLink(vault.conditionalOnRevertTokenMint.toString(), 'account')}
        >
          <Group gap="0" align="center" c="red">
            <Text size="xs">f{token.symbol}</Text>
            <IconExternalLink height="1rem" width="1rem" />
          </Group>
        </Link>
      </Group>
    </Fieldset>
  );
}
