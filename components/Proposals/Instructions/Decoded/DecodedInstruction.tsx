import { Provider } from '@coral-xyz/anchor';
import { Card } from '@mantine/core';
import { Connection, TransactionInstruction } from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { DefaultDecodedInstructionCard } from '@/components/Proposals/Instructions/Decoded/DefaultDecodedInstruction';
import { MemoProgramInstructionCard } from '@/components/Proposals/Instructions/Decoded/SPL/Memo';
import { TokenProgramInstructionCard } from '@/components/Proposals/Instructions/Decoded/SPL/Token';
import { RawInstructionCard } from '@/components/Proposals/Instructions/Raw';
import {
  InstructionDecoder,
  SPL_MEMO_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
} from '@/lib/instructions/coder';
import { DecodedInstruction } from '@/lib/instructions/coder/types';

const isDecodedInstruction = (
  ix: TransactionInstruction | DecodedInstruction | undefined,
): ix is DecodedInstruction => {
  if (!ix) return false;
  return (ix as DecodedInstruction).name !== undefined;
};

export const DecodedInstructionCard = ({
  instruction,
  provider,
}: {
  instruction: TransactionInstruction;
  provider: Provider;
}) => {
  const queryClient = useQueryClient();

  const [possiblyDecodedInstruction, setPossiblyDecodedInstruction] = useState<
    DecodedInstruction | TransactionInstruction
  >(instruction);

  useEffect(() => {
    queryClient
      .fetchQuery({
        queryKey: ['DecodeInstruction', instruction.data],
        staleTime: Infinity,
        queryFn: async () => {
          const decoder = new InstructionDecoder(instruction, provider);
          return decoder.decodeInstruction();
        },
      })
      .then((result) => {
        setPossiblyDecodedInstruction(result === undefined ? instruction : result);
      });
  }, [instruction]);

  return (
    <>
      <Card shadow="sm" radius="sm" withBorder m="0" px="24" py="12">
        {isDecodedInstruction(possiblyDecodedInstruction) ? (
          <DecodedInstruction
            instruction={possiblyDecodedInstruction}
            connection={provider?.connection}
          />
        ) : (
          <RawInstructionCard instruction={possiblyDecodedInstruction} />
        )}
      </Card>
    </>
  );
};

const DecodedInstruction = ({
  instruction,
  connection,
}: {
  instruction: DecodedInstruction;
  connection: Connection;
}) => {
  const renderDecodedInstructionData = () => {
    switch (instruction.programId.toBase58()) {
      case SPL_TOKEN_PROGRAM_ID:
        return <TokenProgramInstructionCard instruction={instruction} connection={connection} />;
      case SPL_MEMO_PROGRAM_ID:
        return <MemoProgramInstructionCard instruction={instruction} />;
      default:
        return <DefaultDecodedInstructionCard instruction={instruction} />;
    }
  };

  return renderDecodedInstructionData();
};
