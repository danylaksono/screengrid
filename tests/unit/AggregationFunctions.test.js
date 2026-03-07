import assert from 'assert';
import { sumAggregation } from '../../src/aggregation/functions/SumAggregation.js';
import { meanAggregation } from '../../src/aggregation/functions/MeanAggregation.js';
import { countAggregation } from '../../src/aggregation/functions/CountAggregation.js';
import { maxAggregation } from '../../src/aggregation/functions/MaxAggregation.js';
import { minAggregation } from '../../src/aggregation/functions/MinAggregation.js';

console.log('[Test] SumAggregation');

const cellData1 = [
  { weight: 5 },
  { weight: 3 },
  { weight: 7 },
  { weight: 2 }
];

assert.strictEqual(sumAggregation(cellData1), 17);
console.log('sumAggregation with valid data OK');

// Test with empty array
assert.strictEqual(sumAggregation([]), 0);
console.log('sumAggregation with empty array OK');

// Test with null/undefined weights
const cellData2 = [
  { weight: 5 },
  { weight: null },
  { weight: undefined },
  { weight: 3 }
];
assert.strictEqual(sumAggregation(cellData2), 8);
console.log('sumAggregation with null/undefined weights OK');

console.log('[Test] MeanAggregation');

assert.strictEqual(meanAggregation(cellData1), 17 / 4);
console.log('meanAggregation with valid data OK');

// Test with empty array
assert.strictEqual(meanAggregation([]), 0);
console.log('meanAggregation with empty array OK');

// Test with zeros
const cellData3 = [
  { weight: 0 },
  { weight: 0 },
  { weight: 0 }
];
assert.strictEqual(meanAggregation(cellData3), 0);
console.log('meanAggregation with zeros OK');

console.log('[Test] CountAggregation');

assert.strictEqual(countAggregation(cellData1), 4);
console.log('countAggregation with valid data OK');

assert.strictEqual(countAggregation([]), 0);
console.log('countAggregation with empty array OK');

console.log('[Test] MaxAggregation');

assert.strictEqual(maxAggregation(cellData1), 7);
console.log('maxAggregation with valid data OK');

assert.strictEqual(maxAggregation([]), 0);
console.log('maxAggregation with empty array OK');

const cellData4 = [
  { weight: -5 },
  { weight: -1 },
  { weight: -10 }
];
assert.strictEqual(maxAggregation(cellData4), -1);
console.log('maxAggregation with negative values OK');

console.log('[Test] MinAggregation');

assert.strictEqual(minAggregation(cellData1), 2);
console.log('minAggregation with valid data OK');

assert.strictEqual(minAggregation([]), 0);
console.log('minAggregation with empty array OK');

assert.strictEqual(minAggregation(cellData4), -10);
console.log('minAggregation with negative values OK');

console.log('AggregationFunctions tests passed');

