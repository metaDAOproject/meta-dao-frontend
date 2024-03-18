import { Group, HoverCard, Stack, Text } from '@mantine/core';
import numeral from 'numeral';
import React, { useEffect, useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { NUMERAL_FORMAT } from '../../lib/constants';
import { useProvider } from '@/hooks/useProvider';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';

type MarketType = 'pass' | 'fail';

const Twap: React.FC<{
  marketType: MarketType;
  winningMarket: MarketType;
  lastObservationValue: number;
  lastObservedSlot: number;
  midPrice: number;
  marketColor: string;
  twap: number;
  twapMarket: PublicKey;
  countdownEndConditions: string;
  totalImpact: number;
}> = ({
  marketType,
  winningMarket,
  lastObservationValue,
  lastObservedSlot,
  midPrice,
  marketColor,
  twap,
  twapMarket,
  countdownEndConditions,
  totalImpact,
}) => {
  const queryClient = useQueryClient();
  const provider = useProvider();
  const [clusterTimestamp, setClusterTimestamp] = useState<number>(0);
  const [observedTimestamp, setObservedTimestamp] = useState<number>(0);
  const { generateExplorerLink } = useExplorerConfiguration();

  const { data: slotData } = useQuery({
    queryKey: ['getSlot'],
    queryFn: () => provider.connection.getSlot(),
    staleTime: 30_000,
  });
  const slot = slotData ?? 0;

  const timeSinceObservation = () => {
    const diff = clusterTimestamp - observedTimestamp;
    if (diff > 864_000) {
      return 'A long time ago';
    }
    if (diff > 86_400) {
      const _diff = diff / 86_400;
      return `${_diff.toFixed(0)}+ days ago`;
    }
    if (diff > 3_600) {
      // hours
      const _diff = diff / 3_600;
      return `${_diff.toFixed(0)}+ hours ago`;
    }
    if (diff > 60) {
      // minutes
      const _diff = diff / 60;
      return `${_diff.toFixed(0)}+ minutes ago`;
    }
    return `${diff} seconds ago`;
  };

  const getClusterTimestamp = async () => {
    let _clusterTimestamp: number = 0;
    if (slot !== 0) {
      _clusterTimestamp = await queryClient.fetchQuery({
        queryKey: [`getBlockTime-${slot}`],
        queryFn: () => provider.connection.getBlockTime(slot),
        staleTime: 30_000,
      });
    }
    const _observedTimestamp = await queryClient.fetchQuery({
      queryKey: [`getBlockTime-${lastObservedSlot}`],
      queryFn: () => provider.connection.getBlockTime(lastObservedSlot),
      staleTime: 30_000,
    });
    if (_clusterTimestamp) {
      setClusterTimestamp(_clusterTimestamp);
    }
    if (_observedTimestamp) {
      setObservedTimestamp(_observedTimestamp);
    }
  };

  useEffect(() => {
    if ((!clusterTimestamp || clusterTimestamp === 0) && slot) {
      getClusterTimestamp();
    }
  }, [slot]);

  return (
    <Group justify="center" align="center">
      <Stack gap={0} pb="1rem" align="center">
        <Group gap={3} justify="center" align="center">
          <Text fw="bold" size="md">
            ${numeral(twap).format(NUMERAL_FORMAT)}
          </Text>
          <Text size="sm">TWAP</Text>
        </Group>
        <Text size="xs">${numeral(midPrice).format(NUMERAL_FORMAT)} (mid)</Text>
      </Stack>
      <HoverCard position="top">
        <HoverCard.Target>
          <IconInfoCircle strokeWidth={1.3} />
        </HoverCard.Target>
        <HoverCard.Dropdown w="22rem">
          <Stack>
            <Text>{countdownEndConditions}</Text>
            <Text>
              Last observed price (for TWAP calculation) $
              {numeral(lastObservationValue).format(NUMERAL_FORMAT)}
            </Text>
            <Text size="xs">
              Last observed at
              <br />
              slot {lastObservedSlot} | {slot - lastObservedSlot} slots behind cluster
              <br />
              {new Date(observedTimestamp * 1000).toUTCString()} | {timeSinceObservation()}
            </Text>
            <Text>
              Crank Impact{' '}
              {(totalImpact * 100).toLocaleString('fullwide', {
                useGrouping: false,
                maximumSignificantDigits: 20,
              })}
              %
            </Text>
            <Text c={marketColor}>Currently the {winningMarket} Market wins.</Text>
            <Text size="xs">
              <a href={generateExplorerLink(twapMarket.toString(), 'account')} target="blank">
                {`See ${marketType} TWAP Market in explorer.`}
              </a>
            </Text>
          </Stack>
        </HoverCard.Dropdown>
      </HoverCard>
    </Group>
  );
};

export default Twap;
