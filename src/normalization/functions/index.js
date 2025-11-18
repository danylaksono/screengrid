/**
 * Normalization Functions Index
 * Registers all built-in normalization functions
 */

import { NormalizationFunctionRegistry } from './NormalizationFunctionRegistry.js';
import { maxLocalNormalization } from './MaxLocalNormalization.js';
import { maxGlobalNormalization } from './MaxGlobalNormalization.js';
import { zScoreNormalization } from './ZScoreNormalization.js';
import { percentileNormalization } from './PercentileNormalization.js';

// Export registry and built-in functions
export { NormalizationFunctionRegistry } from './NormalizationFunctionRegistry.js';
export { maxLocalNormalization } from './MaxLocalNormalization.js';
export { maxGlobalNormalization } from './MaxGlobalNormalization.js';
export { zScoreNormalization } from './ZScoreNormalization.js';
export { percentileNormalization } from './PercentileNormalization.js';

// Export convenience object with all built-in functions
export const NormalizationFunctions = {
  maxLocal: maxLocalNormalization,
  maxGlobal: maxGlobalNormalization,
  zScore: zScoreNormalization,
  percentile: percentileNormalization,
};

// Register built-in functions
function _registerBuiltins() {
  NormalizationFunctionRegistry.register('max-local', maxLocalNormalization);
  NormalizationFunctionRegistry.register('max-global', maxGlobalNormalization);
  NormalizationFunctionRegistry.register('z-score', zScoreNormalization);
  NormalizationFunctionRegistry.register('percentile', percentileNormalization);
}

_registerBuiltins();

