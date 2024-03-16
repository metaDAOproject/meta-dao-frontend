import { Text } from '@mantine/core';

import { DecodedInstruction } from '@/lib/instructions/coder/types';
import { PublicKeyAsCodeLink } from '@/components/Proposals/Instructions/PublicKeyAsCodeLink';

export const DefaultDecodedInstructionCard = ({
  instruction,
}: {
  instruction: DecodedInstruction;
}) => (
  <>
    <Text c="white">
      Invoke the {instruction.name} function on the following program (
      <PublicKeyAsCodeLink publicKey={instruction.programId} />) with the following:
      {instruction.accounts.length > 0 ? (
        <>
          <Text mt="md" c="white">
            Accounts:
          </Text>
          <div>
            {instruction.accounts.map((a, idx) => (
              <div key={idx}>
                <Text c="white">
                  #{idx + 1}: {a.name} (<PublicKeyAsCodeLink publicKey={a.pubkey} />)
                </Text>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Text mt="md" c="white">This instruction has no accounts.</Text>
      )}
      {instruction.args.length > 0 ? (
        <>
          <Text mt="md" c="white">
            Data:
          </Text>
          <div>
            {instruction.args.map((a, idx) => (
              <div key={idx}>
                <Text>
                  #{idx + 1}: {a.name} ({a.type}), {a.data}
                </Text>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Text mt="md" c="white">This instruction has no data.</Text>
      )}
    </Text>
  </>
);
