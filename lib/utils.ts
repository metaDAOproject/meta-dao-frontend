import { PublicKey, TransactionSignature } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { InstructionFieldTypes } from './types';

export const shortKey = (key?: PublicKey | string) => {
  if (!key) return '???';
  const str = key?.toString();
  return `${str.substring(0, 4)}...${str.substring(str.length - 5, str.length)}`;
};

export const shortSignature = (sig?: TransactionSignature, length: number = 8) => {
  if (!sig) return '???';
  return `${sig.substring(0, length)}...`;
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

export const convertTokenPrice = (data: any, decimals: number) => {
  const price = Math.round(
    (Number(data.outAmount) / Number(data.inAmount)) * 1_000 * (10 ** decimals)
  ) / 10 ** decimals;
  return price;
};

export const getDecimalCount = (value: number) => {
  if (!value) {
    return 0;
  }
  let splitString = value.toString().split('.');
  if (splitString.length === 1) {
    splitString = value.toString().split('e-');
    return Number(splitString[1]);
  }
  if (splitString.length > 1) {
    return splitString[1].length;
  }
  return 0;
};

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

export const toScientificNotation = (number: number, decimalPlaces: number) =>
  // Convert number to scientific notation with specified decimal places
  number.toExponential(decimalPlaces);

export const toCompactNumber = (number: any) => {
  const value = Number(number);
  if (Number.isNaN(value)) return Number(0.0);
  // Convert number to compact form 123,000,000 becomes 123M
  return new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 4 }).format(
    value,
  );
};

export const parsePossibleBoolean = (value?: string): boolean | undefined => {
  if (value === undefined) return undefined;

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'true' || normalizedValue === '1') return true;
  if (normalizedValue === 'false' || normalizedValue === '0') return false;

  return undefined;
};

// NOTE: Bringing these in from the updated OpenBook as we can't upgrade...
// https://github.com/openbook-dex/openbook-v2/blob/d7d909c876e161d0a2bed9678c3dc5b9d0d430fb/ts/client/src/utils/utils.ts#L51
// eslint-disable-next-line max-len
export const toNative = (
  uiAmount: number,
  decimals: number
) => {
  const roundedAmount = Math.round(uiAmount * 10 ** decimals);
  return new BN(roundedAmount.toString());
};

// eslint-disable-next-line max-len
export const toUiDecimals = (nativeAmount: number, decimals: number): number => nativeAmount / 10 ** decimals;

export const priceUiToLots = (
  uiAmount: number,
  baseLotSize: BN,
  quoteLotSize: BN,
  quoteDecimals: number,
  baseDecimals: number
) => toNative(uiAmount * Number(baseLotSize.toString()), quoteDecimals)
    .div(
      new BN(10 ** baseDecimals).imul(
      quoteLotSize,
      ),
    );

export const quoteUiToLots = (
  uiAmount: number,
  quoteDecimals: number,
  quoteLotSize: BN
) => toNative(uiAmount, quoteDecimals).div(
    quoteLotSize,
  );

export const baseUiToLots = (
  uiAmount: number,
  baseDecimals: number,
  baseLotSize: BN
) => toNative(uiAmount, baseDecimals).div(
    baseLotSize,
  );
