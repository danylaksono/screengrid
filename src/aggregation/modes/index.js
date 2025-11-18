/**
 * index.js
 * Register all built-in aggregation modes
 */

import { AggregationModeRegistry } from '../AggregationModeRegistry.js';
import { Logger } from '../../utils/Logger.js';
import { ScreenGridMode } from './ScreenGridMode.js';
import { ScreenHexMode } from './ScreenHexMode.js';

// Register built-in modes
function _registerBuiltins() {
  try {
    AggregationModeRegistry.register('screen-grid', ScreenGridMode, { overwrite: true });
    AggregationModeRegistry.register('screen-hex', ScreenHexMode, { overwrite: true });
  } catch (e) {
    // Defensive: registry may already contain these during hot reloads
    Logger.warn('AggregationModeRegistry: error registering built-ins', e);
  }
}

_registerBuiltins();

export { ScreenGridMode, ScreenHexMode };
export default AggregationModeRegistry;

