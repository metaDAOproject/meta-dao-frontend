import { Text } from '@mantine/core';
import { Mint } from '@solana/spl-token';
import { Connection } from '@solana/web3.js';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { DefaultDecodedInstructionCard } from '@/components/Proposals/Instructions/Decoded/DefaultDecodedInstruction';
import { PublicKeyAsCodeLink } from '@/components/Proposals/Instructions/PublicKeyAsCodeLink';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { DecodedInstruction } from '@/lib/instructions/coder/types';
import { Metadata } from '@/lib/metadata';
import { getMint, getMintForAta } from '@/lib/token';
import { shortKey } from '@/lib/utils';
import unknownToken from '@/public/unknown.svg';

const TransferInstructionJsx = ({
  instruction,
  mint,
  metadata,
}: {
  instruction: DecodedInstruction;
  mint: Mint;
  metadata?: Metadata;
}) => {
  const { generateExplorerLink } = useExplorerConfiguration();

  const transferAmount = +instruction.args.filter((a) => a.name?.toLowerCase() === 'amount')[0]
    .data;
  const sourceAccount = instruction.accounts.filter((a) => a.name?.toLowerCase() === 'source')[0]
    .pubkey;
  const destinationAccount = instruction.accounts.filter(
    (a) => a.name?.toLowerCase() === 'destination',
  )[0].pubkey;
  const transferAuthority = instruction.accounts.filter(
    (a) => a.name?.toLowerCase() === 'authority',
  )[0].pubkey;

  return (
    <>
      transfer {transferAmount / (1 * 10 ** mint.decimals)}
      <a
        href={generateExplorerLink(mint.address.toBase58(), 'account')}
        target="blank"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={metadata?.json?.image ?? unknownToken}
          alt="App logo"
          width={25}
          height={25}
          style={{ position: 'relative', top: '6px', marginLeft: '3px', marginRight: '3px' }}
        />
      </a>
      from <PublicKeyAsCodeLink publicKey={sourceAccount} /> to{' '}
      <PublicKeyAsCodeLink publicKey={destinationAccount} />. The transfer authority is{' '}
      <PublicKeyAsCodeLink publicKey={transferAuthority} />.
    </>
  );
};

const MintInstructionJsx = ({
  instruction,
  mint,
  metadata,
}: {
  instruction: DecodedInstruction;
  mint: Mint;
  metadata?: Metadata;
}) => {
  const { generateExplorerLink } = useExplorerConfiguration();

  const mintAmount = +instruction.args.filter((a) => a.name?.toLowerCase() === 'amount')[0].data;
  const mintToAccount = instruction.accounts.filter((a) => a.name?.toLowerCase() === 'account')[0]
    .pubkey;

  return (
    <>
      mint {mintAmount / (1 * 10 ** mint.decimals)}
      <a
        href={generateExplorerLink(mint.address.toBase58(), 'account')}
        target="blank"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={metadata?.json?.image ?? unknownToken}
          alt="App logo"
          width={25}
          height={25}
          style={{
            position: 'relative',
            top: '6px',
            marginLeft: '3px',
            marginRight: '3px',
          }}
        />
      </a>
      to{' '}
      <a
        href={generateExplorerLink(mintToAccount.toBase58(), 'account')}
        target="blank"
        onClick={(e) => e.stopPropagation()}
      >
        {shortKey(mintToAccount.toBase58())}
      </a>
      .
    </>
  );
};

const BurnInstructionJsx = ({
  instruction,
  mint,
  metadata,
}: {
  instruction: DecodedInstruction;
  mint: Mint;
  metadata?: Metadata;
}) => {
  const { generateExplorerLink } = useExplorerConfiguration();

  const burnAmount = +instruction.args.filter((a) => a.name?.toLowerCase() === 'amount')[0].data;
  const burnAmountUi = mint?.decimals ? burnAmount / (1 * 10 ** mint.decimals) : burnAmount;

  const burnAuthority = instruction.accounts.filter((a) => a.name?.toLowerCase() === 'authority')[0]
    .pubkey;
  return (
    <>
      burn {burnAmountUi.toLocaleString()} of
      <a
        href={generateExplorerLink(mint.address.toBase58(), 'account')}
        target="blank"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={metadata?.json?.image ?? unknownToken}
          alt="App logo"
          width={25}
          height={25}
          style={{
            position: 'relative',
            top: '6px',
            marginLeft: '5px',
          }}
        />
      </a>
      . The burn authority is <PublicKeyAsCodeLink publicKey={burnAuthority} />.
    </>
  );
};

export const TokenProgramInstructionCard = ({
  instruction,
  connection,
}: {
  instruction: DecodedInstruction;
  connection: Connection;
}) => {
  const instructionsWithMintAccount = [
    'transferChecked',
    'mintTo',
    'mintToChecked',
    'burn',
    'burnChecked',
    'freezeAccount',
    'thawAccount',
  ];

  const [mint, setMint] = useState<Mint | undefined>(undefined);
  const [isLoadingMintInfo, setIsLoadingMintInfo] = useState<boolean>(mint === undefined);
  const [metadata, setMetadata] = useState<Metadata | undefined>(undefined);

  const loadIxAccountInfo = async () => {
    if (instruction.accounts.length === 0) return;
    if (instruction.name === 'transfer') {
      const { mint: loadedMint, metadata: loadedMetadata } = await getMintForAta({
        connection,
        ata: instruction.accounts.filter((a) => a.name?.toLowerCase() === 'source')[0].pubkey,
      });

      setMint(loadedMint);
      setMetadata(loadedMetadata);
    } else if (instructionsWithMintAccount.includes(instruction.name)) {
      const { mint: loadedMint, metadata: loadedMetadata } = await getMint({
        connection,
        mint: instruction.accounts.filter((a) => a.name?.toLowerCase() === 'mint')[0].pubkey,
      });

      setMint(loadedMint);
      setMetadata(loadedMetadata);
    }
  };

  useEffect(() => {
    loadIxAccountInfo();
  }, [instruction]);

  useEffect(() => {
    setIsLoadingMintInfo(mint === undefined);
  }, [mint]);

  const renderInstructionJsxPostfix = () => {
    if (!mint) return <></>;
    switch (instruction.name) {
      case 'transfer':
      case 'transferChecked':
        return <TransferInstructionJsx instruction={instruction} mint={mint} metadata={metadata} />;
      case 'mintTo':
      case 'mintToChecked':
        return <MintInstructionJsx instruction={instruction} mint={mint} metadata={metadata} />;
      case 'burn':
      case 'burnChecked':
        return <BurnInstructionJsx instruction={instruction} mint={mint} metadata={metadata} />;
      default:
        console.warn(
          `No decoded ix component for token_program::instruction = ${instruction.name}. Falling back to default.`,
        );
        return undefined;
    }
  };

  const jsxPostfix = renderInstructionJsxPostfix();
  return isLoadingMintInfo ? (
    <>Loading...</>
  ) : jsxPostfix ? (
    <Text c="white">
      Invoke the{' '}
      <span>
        Token Program (<PublicKeyAsCodeLink publicKey={instruction.programId} />)
      </span>{' '}
      to {jsxPostfix}
    </Text>
  ) : (
    <DefaultDecodedInstructionCard instruction={instruction} />
  );
};
