/**
 * Logger.js
 * Lightweight logging wrapper that can be enabled via `setDebug(true)`.
 * - `log` and `warn` are emitted only when debug is enabled.
 * - `error` is always emitted.
 */

const _state = { debug: false };

export function setDebug(enabled) {
  _state.debug = !!enabled;
}

export const Logger = {
  log: (...args) => {
    if (_state.debug) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (_state.debug) {
      // eslint-disable-next-line no-console
      console.warn(...args);
    }
  },
  error: (...args) => {
    // Errors are always shown
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export default Logger;
