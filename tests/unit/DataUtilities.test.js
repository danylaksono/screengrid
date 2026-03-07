import assert from 'assert';
import { groupBy, extractAttributes, computeStats, groupByTime } from '../../src/utils/DataUtilities.js';

console.log('[Test] DataUtilities.groupBy');

// Test groupBy with function extractors
const cellData1 = [
  { data: { category: 'A', value: 10 }, weight: 5 },
  { data: { category: 'A', value: 20 }, weight: 3 },
  { data: { category: 'B', value: 15 }, weight: 7 },
  { data: { category: 'B', value: 25 }, weight: 2 }
];

const result1 = groupBy(cellData1, (item) => item.data.category);
assert.strictEqual(result1.size, 2);
assert.strictEqual(result1.get('A'), 8); // 5 + 3
assert.strictEqual(result1.get('B'), 9); // 7 + 2
console.log('groupBy with function extractor OK');

// Test groupBy with string extractor
const result2 = groupBy(cellData1, 'category');
assert.strictEqual(result2.size, 2);
assert.strictEqual(result2.get('A'), 8);
assert.strictEqual(result2.get('B'), 9);
console.log('groupBy with string extractor OK');

// Test groupBy with custom value extractor
const result3 = groupBy(cellData1, 'category', 'value');
assert.strictEqual(result3.size, 2);
assert.strictEqual(result3.get('A'), 30); // 10 + 20
assert.strictEqual(result3.get('B'), 40); // 15 + 25
console.log('groupBy with custom value extractor OK');

// Test groupBy with empty data
const result4 = groupBy([], 'category');
assert.strictEqual(result4.size, 0);
console.log('groupBy with empty data OK');

// Test groupBy with null/undefined values
const cellData2 = [
  { data: { category: 'A' }, weight: 5 },
  { data: { category: null }, weight: 3 },
  { data: {}, weight: 7 }
];
const result5 = groupBy(cellData2, 'category');
assert.strictEqual(result5.size, 1);
assert.strictEqual(result5.get('A'), 5);
console.log('groupBy with null/undefined values OK');

console.log('[Test] DataUtilities.extractAttributes');

const cellData3 = [
  { data: { category: 'A', value: 10 }, weight: 5 },
  { data: { category: 'B', value: 20 }, weight: 3 }
];

const result6 = extractAttributes(cellData3, {
  total: (item) => item.weight,
  count: () => 1,
  category: (item) => item.data.category
});

assert.strictEqual(result6.total, 8); // 5 + 3
assert.strictEqual(result6.count, 2); // 1 + 1
assert(Array.isArray(result6.category));
assert.strictEqual(result6.category.length, 2);
console.log('extractAttributes OK');

// Test extractAttributes with empty data
const result7 = extractAttributes([], { total: (item) => item.weight });
assert.deepStrictEqual(result7, {});
console.log('extractAttributes with empty data OK');

console.log('[Test] DataUtilities.computeStats');

const cellData4 = [
  { weight: 10 },
  { weight: 20 },
  { weight: 30 },
  { weight: 40 }
];

const stats1 = computeStats(cellData4);
assert.strictEqual(stats1.count, 4);
assert.strictEqual(stats1.sum, 100);
assert.strictEqual(stats1.mean, 25);
assert.strictEqual(stats1.min, 10);
assert.strictEqual(stats1.max, 40);
assert(stats1.std > 0);
console.log('computeStats OK');

// Test computeStats with empty data
const stats2 = computeStats([]);
assert.strictEqual(stats2.count, 0);
assert.strictEqual(stats2.sum, 0);
assert.strictEqual(stats2.mean, 0);
console.log('computeStats with empty data OK');

// Test computeStats with custom extractor
const cellData5 = [
  { data: { value: 5 } },
  { data: { value: 15 } },
  { data: { value: 25 } }
];
const stats3 = computeStats(cellData5, 'value');
assert.strictEqual(stats3.count, 3);
assert.strictEqual(stats3.sum, 45);
assert.strictEqual(stats3.mean, 15);
console.log('computeStats with custom extractor OK');

console.log('[Test] DataUtilities.groupByTime');

const cellData6 = [
  { data: { timestamp: new Date('2020-01-15').getTime(), value: 10 }, weight: 5 },
  { data: { timestamp: new Date('2020-02-15').getTime(), value: 20 }, weight: 3 },
  { data: { timestamp: new Date('2021-01-15').getTime(), value: 15 }, weight: 7 }
];

const result8 = groupByTime(cellData6, (item) => item.data.timestamp, null, 'year');
assert.strictEqual(result8.length, 2);
assert.strictEqual(result8[0].time, 2020);
assert.strictEqual(result8[0].value, 8); // 5 + 3
assert.strictEqual(result8[1].time, 2021);
assert.strictEqual(result8[1].value, 7);
console.log('groupByTime OK');

// Test groupByTime with empty data
const result9 = groupByTime([], (item) => item.data.timestamp);
assert.strictEqual(result9.length, 0);
console.log('groupByTime with empty data OK');

console.log('DataUtilities tests passed');

