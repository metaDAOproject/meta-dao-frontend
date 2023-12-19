import { useCallback, useState } from 'react';
import { Button, Fieldset, Group, HoverCard, Stack, Text, TextInput } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useProposal } from '@/contexts/ProposalContext';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useTokenAmount } from '@/hooks/useTokenAmount';
import { useTokens } from '@/hooks/useTokens';

export default function MarketsBalances() {
  const [mintBaseAmount, setMintBaseAmount] = useState<number>();
  const [mintQuoteAmount, setMintQuoteAmount] = useState<number>();
  const { tokens } = useTokens();
  const { generateExplorerLink } = useExplorerConfiguration();

  const { proposal, markets, mintTokens, loading } = useProposal();

  const { amount: baseAmount } = useTokenAmount(markets?.baseVault.underlyingTokenMint);
  const { amount: basePassAmount } = useTokenAmount(
    markets?.baseVault.conditionalOnFinalizeTokenMint,
  );

  const { amount: baseFailAmount } = useTokenAmount(
    markets?.baseVault.conditionalOnRevertTokenMint,
  );
  const { amount: quoteAmount } = useTokenAmount(markets?.quoteVault.underlyingTokenMint);
  const { amount: quotePassAmount } = useTokenAmount(
    markets?.quoteVault.conditionalOnFinalizeTokenMint,
  );
  const { amount: quoteFailAmount } = useTokenAmount(
    markets?.quoteVault.conditionalOnRevertTokenMint,
  );

  const handleMint = useCallback(
    async (fromBase?: boolean) => {
      if ((!mintBaseAmount && fromBase) || (!mintQuoteAmount && !fromBase)) return;

      if (fromBase) {
        await mintTokens(mintBaseAmount!, true);
      } else {
        await mintTokens(mintQuoteAmount!, false);
      }
    },
    [mintTokens, mintBaseAmount, mintQuoteAmount],
  );

  return (
    <Group align="center" justify="center" pos="relative" pt="lg">
      <HoverCard position="top">
        <HoverCard.Target>
          <Group pos="absolute" top="0" left="0" justify="center" align="flex-start">
            <IconInfoCircle strokeWidth={1.3} />
          </Group>
        </HoverCard.Target>
        <HoverCard.Dropdown w="22rem">
          <Stack>
            <Text>
              Conditional tokens are the tokens used to trade on conditional markets. You can mint
              some by depositing $META or $USDC. These tokens will be locked up until the proposal
              is finalized.
            </Text>
            <Text size="sm">
              <Text span fw="bold">
                Pass tokens (pTokens){' '}
              </Text>
              are used to trade on the Pass Market
            </Text>
            <Text size="sm">
              <Text span fw="bold">
                Fail tokens (fTokens){' '}
              </Text>
              are used to trade on the Fail Market.
            </Text>
          </Stack>
        </HoverCard.Dropdown>
      </HoverCard>
      <Fieldset legend={`Mint conditional $${tokens?.meta?.symbol}`}>
        <TextInput
          label="Amount"
          description={`Balance: ${baseAmount?.uiAmountString || 0} $${tokens?.meta?.symbol}`}
          placeholder="Amount to mint"
          type="number"
          onChange={(e) => setMintBaseAmount(Number(e.target.value))}
        />
        <Text fw="lighter" size="sm" c="green">
          Balance: {basePassAmount?.uiAmountString || 0} $p{tokens?.meta?.symbol}
        </Text>
        <Text fw="lighter" size="sm" c="red">
          Balance: {baseFailAmount?.uiAmountString || 0} $f{tokens?.meta?.symbol}
        </Text>
        <Button
          mt="md"
          disabled={(mintBaseAmount || 0) <= 0}
          onClick={() => handleMint(true)}
          loading={loading}
          fullWidth
        >
          Mint
        </Button>
        <Text size="xs" mt="md">
          <a
            href={generateExplorerLink(proposal?.account.baseVault.toString()!, 'account')}
            target="blank"
          >
            See condMETA vault in explorer
          </a>
        </Text>
      </Fieldset>
      <Fieldset legend={`Mint conditional $${tokens?.usdc?.symbol}`}>
        <TextInput
          label="Amount"
          description={`Balance: ${quoteAmount?.uiAmountString || 0} $${tokens?.usdc?.symbol}`}
          placeholder="Amount to mint"
          type="number"
          onChange={(e) => setMintQuoteAmount(Number(e.target.value))}
        />
        <Text fw="lighter" size="sm" c="green">
          Balance: {quotePassAmount?.uiAmountString || 0} $p{tokens?.usdc?.symbol}
        </Text>
        <Text fw="lighter" size="sm" c="red">
          Balance: {quoteFailAmount?.uiAmountString || 0} $f{tokens?.usdc?.symbol}
        </Text>
        <Button
          mt="md"
          disabled={(mintQuoteAmount || 0) <= 0}
          loading={loading}
          onClick={() => handleMint(false)}
          fullWidth
        >
          Mint
        </Button>
        <Text size="xs" mt="md">
          <a
            href={generateExplorerLink(proposal?.account.quoteVault.toString()!, 'account')}
            target="blank"
          >
            See condUSDC vault in explorer
          </a>
        </Text>
      </Fieldset>
    </Group>
  );
}
