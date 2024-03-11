import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Fieldset,
  Group,
  Text,
  TextInput,
  SegmentedControl,
  Loader,
  Stack,
  HoverCard,
} from '@mantine/core';
import numeral from 'numeral';
import { BN } from '@coral-xyz/anchor';
import { IconInfoCircle } from '@tabler/icons-react';
import { PublicKey } from '@solana/web3.js';
import { useProposal } from '@/contexts/ProposalContext';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { NUMERAL_FORMAT } from '../../lib/constants';
import { Token } from '@/hooks/useTokens';
import useConditionalTokens from '@/hooks/useConditionalTokens';
import { useProposalMarkets } from '@/contexts/ProposalMarketsContext';

interface Balance {
  token: Token;
  symbol: string;
  balanceSpot: BN;
  balancePass: BN;
  balanceFail: BN;
  finalize: PublicKey;
  revert: PublicKey;
}

export function MintConditionalTokenCard() {
  const sender = useTransactionSender();
  const { mintTokensTransactions } = useProposal();
  const { markets } = useProposalMarkets();
  const [mintAmount, setMintAmount] = useState<number>();
  const [isMinting, setIsMinting] = useState(false);
  if (!markets) return null;

  const { baseToken, quoteToken } = useConditionalTokens();

  const [token, setToken] = useState<Balance | undefined>(baseToken);

  useEffect(() => {
    setToken((prev) => {
      if (!prev) return baseToken;
      return prev.symbol === baseToken?.symbol ? baseToken : quoteToken;
    });
  }, [baseToken?.symbol, quoteToken?.symbol]);

  const updateSelectedToken = (e: string) => {
    if (e === baseToken?.symbol) setToken(baseToken);
    else if (e === quoteToken?.symbol) {
      setToken(quoteToken);
    }
  };

  const handleMint = useCallback(async () => {
    if (!mintAmount) return;

    setIsMinting(true);
    const fromBase = token?.symbol !== quoteToken?.symbol;
    try {
      const txs = await mintTokensTransactions(mintAmount, fromBase);

      if (!txs) return;

      await sender.send(txs);
      // TODO add direct state update here
    } finally {
      setIsMinting(false);
    }
  }, [mintTokensTransactions, sender, mintAmount, token]);

  const selectOptions = [baseToken?.symbol, quoteToken?.symbol].filter((s): s is string => !!s);

  return !token ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <Fieldset legend="Deposit" miw="350px" w="100%" pos="relative">
      <HoverCard position="top">
        <HoverCard.Target>
          <Group pos="absolute" top="-10px" right="0" justify="center" align="flex-start">
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
      <SegmentedControl
        style={{ marginTop: '10px' }}
        color="#4e4e4e"
        value={token.symbol}
        className="label"
        onChange={(e) => updateSelectedToken(e)}
        fullWidth
        data={selectOptions}
      />
      <TextInput
        label="Amount"
        description={`Balance: ${numeral(token.balanceSpot?.uiAmountString || 0).format(
          NUMERAL_FORMAT,
        )} $${token.symbol}`}
        placeholder="Amount to deposit"
        type="number"
        onChange={(e) => setMintAmount(Number(e.target.value))}
      />

      <Button
        mt="md"
        disabled={(mintAmount || 0) <= 0}
        loading={isMinting}
        onClick={handleMint}
        fullWidth
      >
        Deposit{' '}
        {mintAmount ? `${mintAmount} p${token.symbol} and ${mintAmount} f${token.symbol}` : ''}
      </Button>
    </Fieldset>
  );
}
