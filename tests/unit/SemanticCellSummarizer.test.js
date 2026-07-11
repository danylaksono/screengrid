import assert from 'assert';
import { Aggregator } from '../../src/core/Aggregator.js';
import { CellQueryEngine } from '../../src/core/CellQueryEngine.js';

console.log('[Test] Semantic cell summaries');

const projectedPoints = [
  { x: 10, y: 10, w: 1 },
  { x: 15, y: 15, w: 2 },
  { x: 60, y: 10, w: 5 }
];
const originalData = [
  { id: 1, score: 10, category: 'A', sparse: 1 },
  { id: 2, score: 40, category: 'A', sparse: null },
  { id: 3, score: 90, category: 'B', sparse: 3 }
];

const result = Aggregator.aggregate(
  projectedPoints,
  originalData,
  100,
  100,
  50,
  null,
  (cellData) => ({ legacyCount: cellData.length }),
  { aggregationMode: 'screen-grid', normalizationFunction: 'max-global', zoomLevel: 12 }
);

assert.ok(Array.isArray(result.cells));
assert.strictEqual(result.cells, result.cellSemantics);
assert.strictEqual(result.populatedCells.length, 2);

const first = result.cells[0];
assert.strictEqual(first.spatial.type, 'screen-cell');
assert.strictEqual(first.records.count, 2);
assert.strictEqual(first.measures.fields.score.mean, 25);
assert.strictEqual(first.measures.fields.score.min, 10);
assert.strictEqual(first.measures.fields.score.max, 40);
assert.strictEqual(first.measures.fields.category.mode, 'A');
assert.strictEqual(first.measures.fields.category.distinct, 1);
assert.strictEqual(first.measures.fields.sparse.missing, 1);
assert.strictEqual(first.reliability.sampleSizeClass, 'low');
assert.ok(first.reliability.warnings.includes('low-sample-size'));
assert.ok(first.reliability.warnings.includes('missing-values'));
assert.strictEqual(first.comparability.comparableAcrossCells, true);
assert.deepStrictEqual(first.custom, { legacyCount: 2 });
assert.deepStrictEqual(first.customData, { legacyCount: 2 });
assert.strictEqual(first.cellData.length, 2);

const queried = CellQueryEngine.getCellAt(result, { x: 12, y: 12 });
assert.strictEqual(queried.id, first.id);
assert.strictEqual(queried.records.count, 2);
assert.strictEqual(queried.cellData.length, 2);

console.log('Semantic cell summaries OK');
