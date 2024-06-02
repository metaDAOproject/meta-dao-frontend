import { Text } from '@mantine/core';

import { DecodedInstruction } from '@/lib/instructions/coder/types';
import { PublicKeyAsCodeLink } from '@/components/Proposals/Instructions/PublicKeyAsCodeLink';

export const MemoProgramInstructionCard = ({
  instruction,
}: {
  instruction: DecodedInstruction;
}) => (
  <div>
    <Text>
      Invoke the{' '}
      <span>
        Memo Program (<PublicKeyAsCodeLink publicKey={instruction.programId} />)
      </span>{' '}
      with the following data
    </Text>
    <hr
      className="solid"
      style={{
        marginTop: 0,
        marginBottom: 0,
        border: 0,
        margin: '1em 0',
        width: '100%',
        borderTop: '1px solid #424242',
      }}
    />
    <Text fs="italic">{instruction.args[0].data}</Text>
  </div>
);
