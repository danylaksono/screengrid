import assert from 'assert';
import { Renderer } from '../../src/canvas/Renderer.js';
import {
  maxLocalNormalization,
  maxGlobalNormalization,
  zScoreNormalization,
  percentileNormalization,
} from '../../src/normalization/functions/index.js';

// Regression: the per-frame render sort of cell values must be skipped for the
// normalizations that never read `context.sortedValues` (max-local, max-global,
// z-score), and kept for percentile (and unknown/custom functions).
console.log('[Test] Renderer stats sort gating');

const grid = [5, 1, 9, 3, 7];
const cellData = grid.map((v) => (v > 0 ? [{ data: { v } }] : []));

// _needsSortedValues classification.
assert.strictEqual(Renderer._needsSortedValues(maxLocalNormalization), false, 'max-local skips sort');
assert.strictEqual(Renderer._needsSortedValues(maxGlobalNormalization), false, 'max-global skips sort');
assert.strictEqual(Renderer._needsSortedValues(zScoreNormalization), false, 'z-score skips sort');
assert.strictEqual(Renderer._needsSortedValues(percentileNormalization), true, 'percentile needs sort');
assert.strictEqual(Renderer._needsSortedValues(() => 0), true, 'unknown/custom fn needs sort (safe default)');

// When not needed, sortedValues is left empty (no O(n log n) work).
const skipped = Renderer.computeStats(grid, cellData, { needsSorted: false });
assert.deepStrictEqual(skipped.sortedValues, [], 'sortedValues empty when not needed');
assert.strictEqual(skipped.max, 9, 'max still computed');
assert.strictEqual(skipped.min, 1, 'min still computed');
assert.strictEqual(skipped.cellsWithData, 5, 'cellsWithData still computed');

// Default preserves the sorted array (backwards compatible for any other caller).
const kept = Renderer.computeStats(grid, cellData);
assert.deepStrictEqual(kept.sortedValues, [1, 3, 5, 7, 9], 'sorted ascending by default');

// Percentile still works end to end through computeStats' prepared context.
const ctx = Renderer.computeStats(grid, cellData, { needsSorted: true });
const p = percentileNormalization(grid, 9, 2, ctx);
assert.strictEqual(p, 1, 'largest value ranks at the top percentile');

console.log('Renderer stats sort gating OK');
