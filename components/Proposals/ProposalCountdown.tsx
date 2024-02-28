import { SLOTS_PER_10_SECS } from '@/lib/constants';
import { Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';

export const ProposalCountdown: React.FC<{
    remainingSlots: number | undefined;
}> = ({ remainingSlots }) => {

    const [secondsLeft, setSecondsLeft] = useState<number>(0);

    const timeLeft = useMemo(() => {
        if (!secondsLeft) return;
        const seconds = secondsLeft;
        const days = Math.floor(seconds / (60 * 60 * 24));
        const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        const secLeft = Math.floor(seconds % 60);

        return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(
            minutes,
        ).padStart(2, '0')}:${String(secLeft).padStart(2, '0')}`;
    }, [secondsLeft]);

    useEffect(() => {
        setSecondsLeft(((remainingSlots || 0) / SLOTS_PER_10_SECS) * 10);
    }, [remainingSlots]);

    useEffect(() => {
        const interval = setInterval(
            () => (secondsLeft && secondsLeft > 0 ? setSecondsLeft((old) => old - 1) : 0),
            1000,
        );

        return () => clearInterval(interval);
    });

    return <>
        {secondsLeft !== 0 && <Text fw="bold">Ends in {timeLeft}</Text>}
    </>;

};
