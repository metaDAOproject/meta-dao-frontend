import { Code, Stack, Text } from '@mantine/core';
import { TransactionInstruction } from '@solana/web3.js';

export const RawInstructionCard = ({ instruction }: { instruction: TransactionInstruction }) => (
  <>
    <Text>Instruction:</Text>
    <Stack pl={15}>
      {instruction.keys.length > 0 && (
        <>
          <Text size="xs">Accounts</Text>
          {instruction.keys.map((account) => (
            <Code key={account.pubkey.toString()}>{account.pubkey.toString()}</Code>
          ))}
        </>
      )}
      <Text size="xs">Data</Text>
      <Code>[{Uint8Array.from(instruction.data).toString()}]</Code>
      <Text size="xs">Program</Text>
      <Code>{instruction.programId.toString()}</Code>
    </Stack>
  </>
);
