import { useCallback, useEffect, useState } from 'react';
import { Button, Fieldset, Group, Text, TextInput, SegmentedControl, Loader, Stack, HoverCard } from '@mantine/core';
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
  fetchUnderlying: () => Promise<void>;
  fetchPass: () => Promise<void>,
  fetchFail: () => Promise<void>;
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

  const { metaToken, usdcToken } = useConditionalTokens();

  const [token, setToken] = useState<Balance | undefined>();

  useEffect(() => {
    setToken((prev) => {
      if (!prev) return metaToken;
      return prev.symbol === 'META' ? metaToken : usdcToken;
    }
    );
  }, [metaToken, usdcToken]);

  const updateSelectedToken = (e: string) => {
    if (e === 'META') setToken(metaToken);
    else if (e === 'USDC') {
      setToken(usdcToken);
    }
  };

  const handleMint = useCallback(async () => {
    if (!mintAmount) return;

    setIsMinting(true);
    const fromBase = token?.symbol !== 'USDC';
    try {
      const txs = await mintTokensTransactions(mintAmount, fromBase);

      if (!txs) return;

      await sender.send(txs);
      token?.fetchUnderlying();
      token?.fetchFail();
      token?.fetchPass();
    } finally {
      setIsMinting(false);
    }
  }, [mintTokensTransactions, sender, mintAmount, token]);

  return !token ?
    (
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
          onChange={(e) =>
            updateSelectedToken(e)
          }
          fullWidth
          data={['META', 'USDC']}
        />
        <TextInput
          label="Amount"
          description={`Balance: ${numeral(token.balanceSpot?.uiAmountString || 0).format(NUMERAL_FORMAT)} $${token.token.symbol
            }`}
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
          Mint {mintAmount ? `${mintAmount} p${token.symbol} and ${mintAmount} f${token.symbol}` : ''}
        </Button>
      </Fieldset>
    );
}
