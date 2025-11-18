/**
 * Aggregation Functions Index
 * Registers all built-in aggregation functions
 */

import { AggregationFunctionRegistry } from './AggregationFunctionRegistry.js';
import { sumAggregation } from './SumAggregation.js';
import { meanAggregation } from './MeanAggregation.js';
import { countAggregation } from './CountAggregation.js';
import { maxAggregation } from './MaxAggregation.js';
import { minAggregation } from './MinAggregation.js';

// Export registry and built-in functions
export { AggregationFunctionRegistry } from './AggregationFunctionRegistry.js';
export { sumAggregation } from './SumAggregation.js';
export { meanAggregation } from './MeanAggregation.js';
export { countAggregation } from './CountAggregation.js';
export { maxAggregation } from './MaxAggregation.js';
export { minAggregation } from './MinAggregation.js';

// Export convenience object with all built-in functions
export const AggregationFunctions = {
  sum: sumAggregation,
  mean: meanAggregation,
  count: countAggregation,
  max: maxAggregation,
  min: minAggregation,
};

// Register built-in functions
function _registerBuiltins() {
  AggregationFunctionRegistry.register('sum', sumAggregation);
  AggregationFunctionRegistry.register('mean', meanAggregation);
  AggregationFunctionRegistry.register('count', countAggregation);
  AggregationFunctionRegistry.register('max', maxAggregation);
  AggregationFunctionRegistry.register('min', minAggregation);
}

_registerBuiltins();

