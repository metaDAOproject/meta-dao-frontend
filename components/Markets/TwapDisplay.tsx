import { Group, HoverCard, Stack, Text } from '@mantine/core';
import numeral from 'numeral';
import React, { useEffect, useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import { PublicKey } from '@solana/web3.js';
import { NUMERAL_FORMAT } from '../../lib/constants';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import useClusterDataSubscription from '@/hooks/useClusterDataSubscription';
import { toScientificNotation } from '@/lib/utils';

type MarketType = 'pass' | 'fail';

const TwapDisplay: React.FC<{
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
  const [lastObservedDate, setLastObservedDate] = useState(new Date().toUTCString());
  const { generateExplorerLink } = useExplorerConfiguration();
  const {
    data: { slot },
  } = useClusterDataSubscription();

  const timeDifference = Math.max(0, slot - lastObservedSlot);

  const timeSinceObservation = () => {
    const diff = (timeDifference * 400) / 1000;
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
    return `${diff.toFixed(0)} seconds ago`;
  };

  useEffect(() => {
    if (timeDifference <= 5) {
      setLastObservedDate(new Date().toUTCString());
    }
  }, [timeDifference]);

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
              slot {lastObservedSlot} | {Math.max(0, slot - lastObservedSlot)} slots behind cluster
              <br />
              {lastObservedDate} | {timeSinceObservation()}
            </Text>
            <Text>Crank Impact {toScientificNotation(Math.max(0, totalImpact) * 100, 5)}%</Text>
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

export default TwapDisplay;
