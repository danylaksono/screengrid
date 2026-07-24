import assert from 'assert';
import { ScreenHexMode } from '../../src/aggregation/modes/ScreenHexMode.js';

// Regression for the hex point-query path:
//  - getCellAt must preserve the semantic cell's lazy `measures`/`reliability`
//    getters (previously dropped by a `{...semanticCell}` spread — the exact
//    anti-pattern AGENTS.md forbids; the old test only checked own props so it
//    never noticed).
//  - aggregate must expose the O(1) lookup helpers (hexIndex, maxValue) that
//    getCellAt now relies on instead of re-scanning the grid every hover.
console.log('[Test] Hex cell query preserves lazy facets and is O(1)');

// Several points in the same hex so measures/reliability are non-trivial.
const data = [
  { coordinates: [0, 0], value: 10, category: 'a' },
  { coordinates: [1, 1], value: 20, category: 'a' },
  { coordinates: [2, 0], value: 30, category: 'b' },
  { coordinates: [120, 60], value: 5, category: 'c' },
];

const map = {
  project: ([x, y]) => ({ x, y }),
  getCanvas: () => ({ width: 200, height: 120 }),
  getZoom: () => 9,
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
    displaySize: { width: 200, height: 120 },
  }
);

// O(1) lookup structures are present on the result.
assert.ok(result.hexIndex instanceof Map, 'result exposes a hexIndex Map');
assert.strictEqual(typeof result.maxValue, 'number', 'result exposes numeric maxValue');
assert.ok(result.maxValue > 0, 'maxValue reflects the populated cells');

// Query the densest cell by its own centroid.
const dense = result.populatedCells.reduce((a, b) =>
  b.records.count > a.records.count ? b : a
);
const queried = ScreenHexMode.getCellAt(dense.spatial.centroid, result, map);

assert.ok(queried, 'getCellAt returns a cell at a populated centroid');

// Own query fields.
assert.ok(queried.records, 'own records survive');
assert.ok(queried.spatial, 'own spatial survives');
assert.strictEqual(queried.hexCoords.q, dense.spatial.hexCoords.q);

// The bug being regressed: prototype getters must survive the query decoration.
assert.ok(queried.measures, 'measures getter is reachable on queried cell');
assert.ok(queried.measures.fields.value, 'numeric field stats present');
assert.strictEqual(queried.measures.fields.value.count, 3, 'aggregated the 3 in-cell points');
assert.ok(queried.reliability, 'reliability getter is reachable on queried cell');
assert.ok(Array.isArray(queried.reliability.warnings), 'reliability.warnings is an array');

// A miss returns null (no cell at an empty location far outside the grid).
const miss = ScreenHexMode.getCellAt({ x: -9999, y: -9999 }, result, map);
assert.strictEqual(miss, null, 'query outside any hex returns null');

console.log('Hex cell query preserves lazy facets and is O(1) OK');
