import { config } from 'dotenv';

import { parsePossibleBoolean } from './utils';

config();

const VERBOSE = parsePossibleBoolean(process.env.VERBOSE) ?? false;

const LOG_LEVELS = {
  log: { var: 'LOG_ENABLED', method: console.log },
  error: { var: 'ERROR_ENABLED', method: console.error },
  warn: { var: 'WARN_ENABLED', method: console.warn },
  debug: { var: 'DEBUG_ENABLED', method: console.debug },
  info: { var: 'INFO_ENABLED', method: console.info },
};

const _log = (level: keyof typeof LOG_LEVELS, ...args: any[]): void => {
  if (
    VERBOSE ||
    (parsePossibleBoolean(
      process.env[LOG_LEVELS[level as keyof typeof LOG_LEVELS].var]
    ) ??
      false)
  ) {
    LOG_LEVELS[level].method(...args);
  }
};

export const log = (...args: any[]): void => _log('error', ...args);

export const error = (...args: any[]): void => _log('error', ...args);

export const warn = (...args: any[]): void => _log('warn', ...args);

export const debug = (...args: any[]): void => _log('debug', ...args);

export const info = (...args: any[]): void => _log('info', ...args);
