import { Grid, Switch, Text } from '@mantine/core';
import { Connection, TransactionInstruction } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { IconExternalLink } from '@tabler/icons-react';

import { DecodedInstructionCard } from '@/components/Proposals/Instructions/Decoded/DecodedInstruction';
import { RawInstructionCard } from '@/components/Proposals/Instructions/Raw';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import { useProvider } from '@/hooks/useProvider';
import { Proposal } from '@/lib/types';
import { shortSignature } from '@/lib/utils';

/**
 * Helper function to find the FinalizeProposal for a finalized proposal so that we can display the finalize proposal transaction link.
 * To reduce the runtime of this function and chance that it continues running, we only execute the logic once instead of in a loop.
 */
const findFinalizeProposalTransaction = async ({
  connection,
  proposal,
}: {
  connection: Connection;
  proposal: Proposal;
}): Promise<string | undefined> => {
  if (proposal.account.state.passed) {
    const confirmedSignatureInfo = await connection.getSignaturesForAddress(proposal.publicKey, {
      limit: 10,
      before: undefined,
    });

    const signatures = confirmedSignatureInfo.map((i) => i.signature);
    if (signatures.length === 0) return undefined;

    const transactions = await connection.getTransactions(signatures, {
      maxSupportedTransactionVersion: 0,
    });
    const finalizeProposalTransaction = transactions.find((tx) => {
      const possibleError = tx?.meta?.err;
      if (possibleError !== null) return false;
      const logLine = tx?.meta?.logMessages?.filter((log) =>
        log.includes('Instruction: FinalizeProposal'),
      );

      return logLine && logLine.length === 1;
    });

    if (finalizeProposalTransaction) {
      return finalizeProposalTransaction.transaction.signatures[0];
    }
  }

  // pending or failed
  return undefined;
};

/**
 * Note: `RawInstructionsCard` and `DecodedInstructionsCard` currently only support a single instruction. Eventually,
 * we will support multi-instruction proposals, so this choice will require an update at that time. The reason I didn't
 * try to implement a multi-instruction display is that the UI is going to change a lot anyways, so I opted to keep things simple
 * and only display a single instruction. We should be able to extend realtively easy though.
 */
const ProposalInstructionCard = ({ proposal }: { proposal: Proposal }) => {
  const provider = useProvider();
  const { generateExplorerLink } = useExplorerConfiguration();

  const [finalizeProposalSignature, setFinalizeProposalSignature] = useState<string | undefined>(
    undefined,
  );
  const [showRawInstructions, setShowRawInstructions] = useState(false);
  const [transactionInstruction, setTransactionInstruction] = useState<
    TransactionInstruction | undefined
  >(undefined);

  useEffect(() => {
    if (!proposal) return;

    const formattedIx: TransactionInstruction = {
      ...proposal?.account.instruction,
      keys: proposal?.account.instruction.accounts,
    };

    findFinalizeProposalTransaction({
      connection: provider.connection,
      proposal,
    }).then((finalizeSignature) => {
      setFinalizeProposalSignature(finalizeSignature);
    });

    setTransactionInstruction(formattedIx);
  }, [proposal]);

  const formatProposalInstructionMessage = () => {
    // hard-coded for now, could be variable in the future
    const numProposalInstructions = 1;
    const { state } = proposal.account;

    let messagePrefix = '';
    if (state.passed) {
      messagePrefix += 'On passing, this proposal executed';
    } else if (state.failed) {
      messagePrefix += 'If passed, this proposal would have executed';
    } else {
      messagePrefix += 'If passed, this proposal would execute';
    }

    return (
      <Text>
        {messagePrefix} {numProposalInstructions} instruction
        {numProposalInstructions === 1 ? '' : 's'}.{' '}
        {finalizeProposalSignature ? (
          <>
            Here is the transaction where the instruction was executed:{' '}
            <a
              href={generateExplorerLink(finalizeProposalSignature, 'transaction')}
              target="blank"
              onClick={(e) => e.stopPropagation()}
            >
              {shortSignature(finalizeProposalSignature)}
              <IconExternalLink strokeWidth={1} size={18} />
            </a>
          </>
        ) : (
          <></>
        )}
      </Text>
    );
  };

  return (
    <>
      <Grid>
        <Grid.Col span={9}>
          <Text fw="bold" size="md">
            Proposal Instructions
          </Text>
        </Grid.Col>
        <Grid.Col span={3}>
          <Switch
            label={showRawInstructions ? 'Decoded' : 'Raw'}
            checked={showRawInstructions}
            onChange={(event) => setShowRawInstructions(event.currentTarget.checked)}
          />
        </Grid.Col>
      </Grid>
      {formatProposalInstructionMessage()}
      {transactionInstruction ? (
        showRawInstructions ? (
          <RawInstructionCard instruction={transactionInstruction} />
        ) : (
          <DecodedInstructionCard instruction={transactionInstruction} provider={provider} />
        )
      ) : (
        <Text>Sorry, there was a problem loading the instruction</Text>
      )}
    </>
  );
};

export default ProposalInstructionCard;
