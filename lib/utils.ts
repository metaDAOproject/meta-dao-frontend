import { PublicKey } from '@solana/web3.js';
import { InstructionFieldTypes } from './types';

export const shortKey = (key?: PublicKey | string) => {
  if (!key) return '???';
  const str = key?.toString();
  return `${str.substring(0, 4)}...${str.substring(str.length - 5, str.length)}`;
};

// Define the debounce function
export function debounce<T extends any[]>(
  callback: (...args: T) => Promise<void>,
  delay: number,
): (...args: T) => Promise<void> {
  let timerId: NodeJS.Timeout;
  return async (...args: T) => {
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

export const validateType = async (type: InstructionFieldTypes, value?: string) => {
  switch (type) {
    case InstructionFieldTypes.Key:
      if (!value) {
        return false;
      }
      return /^[1-9A-HJ-NP-Za-km-z]{40,44}$/.test(value);
    default:
      return true;
  }
};

export const dedup = <T = any>(arr: Array<T>, key: (a: T) => string): Array<T> => {
  const seen = new Set();
  return arr.filter((item) => {
    const k = key(item);
    return seen.has(k) ? false : seen.add(k);
  });
};
