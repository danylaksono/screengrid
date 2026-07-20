import assert from 'assert';
import { ScreenHexMode } from '../../src/aggregation/modes/ScreenHexMode.js';

console.log('[Test] Hex semantic cells');

const data = [
  { coordinates: [0, 0], value: 10, category: 'north' },
  { coordinates: [10, 0], value: 20, category: 'north' },
  { coordinates: [120, 60], value: 40, category: 'south' }
];

const map = {
  project: ([x, y]) => ({ x, y }),
  getCanvas: () => ({ width: 200, height: 120 }),
  getZoom: () => 9
};

const result = ScreenHexMode.aggregate(
  data,
  (item) => item.coordinates,
  (item) => item.value,
  map,
  {
    cellSizePixels: 50,
    aggregationMode: 'screen-hex',
    normalizationFunction: 'max-global',
    displaySize: { width: 200, height: 120 }
  }
);

assert.ok(result.populatedCells.length >= 2);
assert.strictEqual(result.cells, result.cellSemantics);
assert.strictEqual(result.populatedCells[0].spatial.type, 'screen-hex');
assert.ok(result.populatedCells[0].records.count >= 1);
assert.ok(result.populatedCells[0].measures.fields.value);
assert.strictEqual(result.populatedCells[0].comparability.comparableAcrossCells, true);

const queried = ScreenHexMode.getCellAt(result.populatedCells[0].spatial.centroid, result, map);
assert.ok(queried);
assert.ok(queried.spatial);
assert.ok(queried.records);

console.log('Hex semantic cells OK');
