import { log } from '../../logger';
import { StaticTimeoutConfig } from '../types';

/**
 * Applies a static timeout to an asynchronous operation, aborting the process if the specified time limit is exceeded.
 * If the timeout is reached and the controller's abort signal has not been activated, it aborts the operation and
 * rejects the associated promise. Additionally, it handles cleanup if the abort signal is activated before the timeout.
 *
 * @param {StaticTimeoutConfig} config - Configuration object that includes the timeout duration in milliseconds.
 * @param {AbortController} controller - The AbortController associated with the asynchronous operation to be controlled.
 * @param {(reason?: any) => void} reject - The reject function of the Promise that should be called if the operation times
 */
export const applyStaticTimeout = (
  config: StaticTimeoutConfig,
  controller: AbortController,
  reject: (reason?: any) => void
) => {
  const timeoutId = setTimeout(() => {
    if (controller.signal.aborted) return;
    controller.abort();

    reject({ timeout: true });
  }, config.timeoutMs);

  controller.signal.addEventListener('abort', () => {
    log(`Controller signal aborted, cancelling static timeout: ${timeoutId}`);
    clearTimeout(timeoutId);
  });
};
