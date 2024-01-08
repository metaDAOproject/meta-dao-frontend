import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Fieldset, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import numeral, { Numeral } from 'numeral';
import { BN } from '@coral-xyz/anchor';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAutocrat } from '@/contexts/AutocratContext';
import { instructionGroups } from '@/lib/instructions';
import { InstructionAction, ProposalInstruction } from '@/lib/types';
import { NUMERAL_FORMAT } from '../../lib/constants';
import { useInitializeProposal } from '../../hooks/useInitializeProposal';
import { validateType } from '../../lib/utils';

export function CreateProposalCard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { daoState } = useAutocrat();
  const initializeProposal = useInitializeProposal();
  const [url, setUrl] = useState<string>('https://www.eff.org/cyberspace-independence');
  const [selectedInstruction, setSelectedInstruction] = useState<InstructionAction>(
    instructionGroups[0].actions[0],
  );
  const [instruction, setInstruction] = useState<ProposalInstruction>();
  const [params, setParams] = useState<any[]>();
  const [balance, setBalance] = useState<Numeral>();
  const [lastSlot, setLastSlot] = useState<number>();
  const nextProposalCost = numeral(
    daoState && lastSlot
      ? daoState.baseBurnLamports
          .sub(
            new BN(lastSlot).sub(daoState.lastProposalSlot).mul(daoState.burnDecayPerSlotLamports),
          )
          .toString()
      : 0,
  ).divide(LAMPORTS_PER_SOL);

  const fetchBalance = useCallback(async () => {
    if (!wallet.publicKey || !connection) return;
    setBalance(numeral(await connection.getBalance(wallet.publicKey)).divide(LAMPORTS_PER_SOL));
  }, [connection, wallet]);
  const fetchSlot = useCallback(async () => {
    setLastSlot(await connection.getSlot());
  }, [connection]);
  useEffect(() => {
    if (!balance) {
      fetchBalance();
    }
  }, [balance, fetchBalance]);
  useEffect(() => {
    if (!lastSlot || daoState?.lastProposalSlot.gt(new BN(lastSlot || 0))) {
      fetchSlot();
    }
  }, [lastSlot, daoState, fetchSlot]);
  useEffect(() => {
    if (lastSlot && daoState) {
      const interval = setInterval(() => {
        setLastSlot((old) => (old || daoState.lastProposalSlot.toNumber()) + 1);
      }, 400);
      return () => clearInterval(interval);
    }
  }, [daoState, lastSlot]);

  useEffect(() => {
    setParams(new Array(selectedInstruction.fields.length));
  }, [selectedInstruction]);

  useEffect(() => {
    if (params && params.filter((_, i) => selectedInstruction.fields[i].required).length > 0) {
      const constructInstruction = async () => {
        const validFields = await Promise.all(
          params.map((p, i) => validateType(selectedInstruction.fields[i].type, p)),
        );
        if (
          validFields.filter((f, i) => f && selectedInstruction.fields[i].required).length <
          selectedInstruction.fields.filter((e) => e.required).length
        ) {
          return;
        }
        const ix = await selectedInstruction.instruction(params);
        setInstruction(ix);
      };
      constructInstruction();
    }
  }, [params, selectedInstruction]);

  const handleCreate = useCallback(async () => {
    if (!instruction || !initializeProposal) return;

    initializeProposal(url, instruction);
  }, [initializeProposal, url, instruction]);

  return (
    <Stack>
      <Title order={2}>Proposal creation</Title>
      <Card shadow="sm" padding="sm" radius="md" withBorder>
        {daoState ? (
          <Stack>
            <TextInput
              defaultValue={url}
              onChange={(e) => setUrl(e.target.value)}
              label="Proposal's description URL"
              description="A link to a page that describes what the proposal does"
            />
            <NativeSelect
              label="Select instruction"
              data={instructionGroups.map((group, j) => ({
                group: group.name,
                items: group.actions.map((a, i) => ({
                  label: a.label,
                  value: `${j}-${i}`,
                })),
              }))}
              onChange={(e) => {
                const [j, i] = e.target.value.split('-').map(Number);
                setSelectedInstruction(instructionGroups[j].actions[i]);
              }}
            />
            <Fieldset legend="Instruction parameters">
              {selectedInstruction?.fields.map((field, index) => (
                <TextInput
                  key={field.label + index}
                  label={field.label}
                  description={field.description}
                  onChange={(e) =>
                    setParams((old) => {
                      if (!old) {
                        old = new Array(selectedInstruction.fields.length);
                      }
                      return old.toSpliced(index, 1, e.target.value);
                    })
                  }
                />
              ))}
            </Fieldset>
            <Button
              onClick={handleCreate}
              // disabled={(balance?.value() || 0) < (nextProposalCost.value() || 0)}
            >
              Create proposal
            </Button>
            {(nextProposalCost.value() || 0) > 0 ? (
              <Stack gap="0">
                <Text fw="lighter">Your balance: {balance?.format(NUMERAL_FORMAT)} $SOL</Text>
                <Text fw="lighter">
                  A {nextProposalCost.format(NUMERAL_FORMAT)} $SOL fee is required to create the
                  proposal. This helps prevent spam.
                </Text>
              </Stack>
            ) : null}
          </Stack>
        ) : (
          <Text fw="bolder" ta="center">
            DAO not found
          </Text>
        )}
      </Card>
    </Stack>
  );
}
