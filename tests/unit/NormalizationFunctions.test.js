import assert from 'assert';
import { maxGlobalNormalization } from '../../src/normalization/functions/MaxGlobalNormalization.js';
import { zScoreNormalization } from '../../src/normalization/functions/ZScoreNormalization.js';
import { maxLocalNormalization } from '../../src/normalization/functions/MaxLocalNormalization.js';
import { percentileNormalization } from '../../src/normalization/functions/PercentileNormalization.js';

console.log('[Test] MaxGlobalNormalization');

const grid1 = [10, 20, 30, 40, 50];
const context1 = { globalMax: 50, max: 50, min: 10, mean: 30, std: 15 };

assert.strictEqual(maxGlobalNormalization(grid1, 50, 4, context1), 1.0);
assert.strictEqual(maxGlobalNormalization(grid1, 25, 2, context1), 0.5);
assert.strictEqual(maxGlobalNormalization(grid1, 0, 0, context1), 0);
console.log('maxGlobalNormalization OK');

// Test with zero globalMax
const context2 = { globalMax: 0, max: 0 };
assert.strictEqual(maxGlobalNormalization(grid1, 10, 0, context2), 0);
console.log('maxGlobalNormalization with zero globalMax OK');

// Test fallback to max when globalMax not provided
const context3 = { max: 50, min: 10 };
assert.strictEqual(maxGlobalNormalization(grid1, 25, 2, context3), 0.5);
console.log('maxGlobalNormalization fallback to max OK');

console.log('[Test] ZScoreNormalization');

const grid2 = [10, 20, 30, 40, 50];
const context4 = { mean: 30, std: 15.811, max: 50, min: 10 };

// Test with valid data
const result1 = zScoreNormalization(grid2, 50, 4, context4);
assert(result1 >= 0 && result1 <= 1);
console.log('zScoreNormalization OK');

// Test with zero std
const context5 = { mean: 10, std: 0, max: 10, min: 10 };
assert.strictEqual(zScoreNormalization([10, 10, 10], 10, 0, context5), 0);
console.log('zScoreNormalization with zero std OK');

// Test with zero cellValue
assert.strictEqual(zScoreNormalization(grid2, 0, 0, context4), 0);
console.log('zScoreNormalization with zero cellValue OK');

console.log('[Test] MaxLocalNormalization');

const grid3 = [10, 20, 30, 40, 50];
const context6 = { max: 50, min: 10 };

assert.strictEqual(maxLocalNormalization(grid3, 50, 4, context6), 1.0);
assert.strictEqual(maxLocalNormalization(grid3, 25, 2, context6), 0.5);
assert.strictEqual(maxLocalNormalization(grid3, 0, 0, context6), 0);
console.log('maxLocalNormalization OK');

console.log('[Test] PercentileNormalization');

const grid4 = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const context7 = { max: 100, min: 10, mean: 55 };

// Test percentile normalization
const result2 = percentileNormalization(grid4, 50, 4, context7);
assert(result2 >= 0 && result2 <= 1);
console.log('percentileNormalization OK');

// Test with zero value
assert.strictEqual(percentileNormalization(grid4, 0, 0, context7), 0);
console.log('percentileNormalization with zero value OK');

console.log('NormalizationFunctions tests passed');

