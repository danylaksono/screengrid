import assert from 'assert';
import { Aggregator } from '../../src/core/Aggregator.js';
import { CellQueryEngine } from '../../src/core/CellQueryEngine.js';
import { Renderer } from '../../src/canvas/Renderer.js';
import { ScreenHexMode } from '../../src/aggregation/modes/ScreenHexMode.js';

console.log('[Test] Non-positive populated cell values');

globalThis.window = { devicePixelRatio: 1 };

const projectedPoints = [
  { x: 10, y: 10, w: -5 },
  { x: 60, y: 10, w: 0 },
  { x: 10, y: 60, w: 2 }
];
const originalData = [
  { id: 'negative', value: -5 },
  { id: 'zero', value: 0 },
  { id: 'positive', value: 2 }
];

const result = Aggregator.aggregate(projectedPoints, originalData, 100, 100, 50);

assert.strictEqual(result.populatedCells.length, 3);
assert.strictEqual(result.cells[0].value, -5);
assert.strictEqual(result.cells[1].value, 0);

const stats = Aggregator.getStats(result);
assert.strictEqual(stats.cellsWithData, 3);
assert.strictEqual(stats.minValue, -5);
assert.strictEqual(stats.maxValue, 2);
assert.strictEqual(stats.totalValue, -3);

const cellsInBounds = CellQueryEngine.getCellsInBounds(result, {
  minX: 0,
  minY: 0,
  maxX: 99,
  maxY: 99
});
assert.strictEqual(cellsInBounds.length, 3);
assert.strictEqual(CellQueryEngine.getCellAt(result, { x: 65, y: 15 }).value, 0);

const drawn = [];
Renderer.render(result, createMockContext(), {
  colorScale: () => [0, 0, 0, 255],
  enableGlyphs: true,
  showBackground: false,
  glyphSize: 0.8,
  onDrawCell: (ctx, x, y, normalizedValue, cellInfo) => {
    drawn.push({ index: cellInfo.index, normalizedValue });
  }
});

assert.deepStrictEqual(drawn.map((cell) => cell.index), [0, 1, 2]);
assert.ok(drawn.every((cell) => cell.normalizedValue >= 0 && cell.normalizedValue <= 1));

const map = {
  project: ([x, y]) => ({ x, y }),
  getCanvas: () => ({ width: 120, height: 120 }),
  getZoom: () => 10
};
const hexResult = ScreenHexMode.aggregate(
  [
    { coordinates: [0, 0], value: -3 },
    { coordinates: [80, 0], value: 0 }
  ],
  (item) => item.coordinates,
  (item) => item.value,
  map,
  { cellSizePixels: 50, displaySize: { width: 120, height: 120 } }
);

assert.strictEqual(ScreenHexMode.getStats(hexResult).cellsWithData, 2);
assert.ok(ScreenHexMode.getCellAt(hexResult.populatedCells[0].spatial.centroid, hexResult, map));

console.log('Non-positive populated cell values OK');

function createMockContext() {
  return {
    clearRect() {},
    fillRect() {},
    save() {},
    restore() {}
  };
}
