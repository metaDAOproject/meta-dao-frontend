import { useLocalStorage } from '@mantine/hooks';

export function usePriorityFee() {
  const [priorityFee, setPriorityFee] = useLocalStorage<number>({
    key: 'meta-dao-priority-fee',
    defaultValue: 10,
    getInitialValueInEffect: false,
  });

  return {
    priorityFee,
    setPriorityFee,
  };
}
