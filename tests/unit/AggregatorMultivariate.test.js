import assert from 'assert';
import { Aggregator } from '../../src/core/Aggregator.js';

console.log('[Test] Aggregator Post-Aggregation Hook');

const projectedPoints = [
  { x: 10, y: 10, w: 1 },
  { x: 15, y: 15, w: 2 },
  { x: 60, y: 10, w: 5 }
];
const originalData = [
  { id: 1, val: 10 },
  { id: 2, val: 20 },
  { id: 3, val: 50 }
];
const width = 100;
const height = 100;
const cellSize = 50;

// Test 1: Simple aggregation without hook
const result1 = Aggregator.aggregate(projectedPoints, originalData, width, height, cellSize);
assert.strictEqual(result1.grid[0], 3); // (1 + 2)
assert.strictEqual(result1.grid[1], 5); // (5)
assert.strictEqual(result1.customData[0], null);
console.log('Base aggregation OK');

// Test 2: Aggregation with post-aggregation hook
const onAfterAggregate = (cellData, aggregatedValue, index, grid) => {
  // Calculate average of 'val' property in original data
  const sum = cellData.reduce((s, p) => s + p.data.val, 0);
  const avg = sum / cellData.length;
  return { avg, count: cellData.length };
};

const result2 = Aggregator.aggregate(
  projectedPoints, 
  originalData, 
  width, 
  height, 
  cellSize, 
  null, 
  onAfterAggregate
);

assert.strictEqual(result2.grid[0], 3);
assert.notStrictEqual(result2.customData[0], null);
assert.strictEqual(result2.customData[0].avg, 15); // (10+20)/2
assert.strictEqual(result2.customData[0].count, 2);
assert.strictEqual(result2.customData[1].avg, 50);
assert.strictEqual(result2.customData[1].count, 1);
console.log('Post-aggregation hook OK');

console.log('Aggregator multivariate tests passed');
