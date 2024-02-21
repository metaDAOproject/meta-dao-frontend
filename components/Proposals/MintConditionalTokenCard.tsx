import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Fieldset, Group, Text, TextInput, SegmentedControl, Center, Box, Loader } from '@mantine/core';
import numeral from 'numeral';
import Link from 'next/link';
import { BN } from '@coral-xyz/anchor';
import { IconExternalLink, IconCurrencyDollar, IconLetterM } from '@tabler/icons-react';
// import { Token } from '@/hooks/useTokens';
import { PublicKey } from '@solana/web3.js';
import { useProposal } from '@/contexts/ProposalContext';
import { useTransactionSender } from '../../hooks/useTransactionSender';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useBalance } from '../../hooks/useBalance';
import { NUMERAL_FORMAT } from '../../lib/constants';
import { useTokens, Token } from '@/hooks/useTokens';

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
  const { markets, mintTokensTransactions } = useProposal();
  const { generateExplorerLink } = useExplorerConfiguration();
  const { tokens } = useTokens();

  if (!markets) return null;

  const base = markets.baseVault;
  const quote = markets.quoteVault;
  const { amount: balanceUsdc, fetchAmount: vaultUSDC } = useBalance(base.underlyingTokenMint);
  const { amount: balanceMeta, fetchAmount: vaultMETA } = useBalance(quote.underlyingTokenMint);
  const {
    amount: balanceFail,
    fetchAmount: vaultFail,
  } = useBalance(base.conditionalOnRevertTokenMint);
  const {
    amount: balancePass,
    fetchAmount: vaultPass,
  } = useBalance(quote.conditionalOnFinalizeTokenMint);

  const [
    baseFinalize,
    baseRevert,
    quoteFinalize,
    quoteRevert,
  ] = useMemo(() => [
      base.conditionalOnFinalizeTokenMint,
      base.conditionalOnRevertTokenMint,
      quote.conditionalOnFinalizeTokenMint,
      quote.conditionalOnRevertTokenMint,
    ], [markets]);

  const [mintAmount, setMintAmount] = useState<number>();
  const [tokenName, setTokenName] = useState<string>('meta');
  const [_token, _setToken] = useState<Balance>({
    token: tokens.meta as unknown as Token,
    symbol: tokens.meta?.symbol as unknown as string,
    balanceSpot: balanceMeta,
    balancePass,
    balanceFail,
    finalize: baseFinalize,
    revert: baseRevert,
  });

  const updateTokenValue = () => {
    if (tokenName === 'meta') {
      _setToken({
        token: tokens.meta as unknown as Token,
        symbol: tokens.meta?.symbol as unknown as string,
        balanceSpot: balanceMeta,
        balancePass,
        balanceFail,
        finalize: baseFinalize,
        revert: baseRevert,
      });
    }
    if (tokenName === 'usdc') {
      _setToken({
        token: tokens.usdc as unknown as Token,
        symbol: tokens.usdc?.symbol as unknown as string,
        balanceSpot: balanceUsdc,
        balancePass,
        balanceFail,
        finalize: quoteFinalize,
        revert: quoteRevert,
      });
    }
  };

  useEffect(() => {
    updateTokenValue();
  }, [tokenName]);

  const [isMinting, setIsMinting] = useState(false);

  const handleMint = useCallback(async () => {
    if (!mintAmount || !markets) return;

    setIsMinting(true);
    const fromBase = _token.symbol !== 'usdc';
    try {
      const txs = await mintTokensTransactions(mintAmount!, fromBase);

      if (!txs) return;

      await sender.send(txs);
      vaultPass();
      vaultFail();
      vaultMETA();
      vaultUSDC();
    } finally {
      setIsMinting(false);
    }
  }, [mintTokensTransactions, vaultPass, vaultFail, vaultMETA, vaultUSDC, sender]);

  return !_token ?
  (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <Fieldset legend="Mint Conditional Tokens" miw="350px">
      <SegmentedControl
        style={{ marginTop: '10px' }}
        color={tokenName === 'usdc' ? 'blue' : 'gray'}
        value={tokenName}
        className="label"
        onChange={(e) => {
          setTokenName(e);
        }}
        fullWidth
        data={[
          {
            value: 'meta',
            label: (
              <Center>
                <IconLetterM size={16} />
                <Box ml={4}>Meta</Box>
              </Center>
            ),
          },
          {
            value: 'usdc',
            label: (
              <Center>
                <IconCurrencyDollar size={16} />
                <Box>USDC</Box>
              </Center>
            ),
          },
        ]}
      />
      <TextInput
        label="Amount"
        description={`Balance: ${numeral(_token.balanceSpot?.uiAmountString || 0).format(NUMERAL_FORMAT)} $${
          _token.token.symbol
        }`}
        placeholder="Amount to mint"
        type="number"
        onChange={(e) => setMintAmount(Number(e.target.value))}
      />
      <Text fw="lighter" size="sm">
        Balances:
      </Text>
      <Text fw="lighter" size="sm" c="green">
        {_token.balancePass?.uiAmountString || 0} $p{_token.symbol}
      </Text>
      <Text fw="lighter" size="sm" c="red">
        {_token.balanceFail?.uiAmountString || 0} $f{_token.symbol}
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
          href={generateExplorerLink(_token.finalize.toString(), 'account')}
        >
          <Group gap="0" justify="center" ta="center" c="green">
            <Text size="xs">p{_token.symbol}</Text>
            <IconExternalLink height="1rem" width="1rem" />
          </Group>
        </Link>
        <Link
          target="_blank"
          href={generateExplorerLink(_token.revert.toString(), 'account')}
        >
          <Group gap="0" align="center" c="red">
            <Text size="xs">f{_token.symbol}</Text>
            <IconExternalLink height="1rem" width="1rem" />
          </Group>
        </Link>
      </Group>
    </Fieldset>
  );
}
