// Node smoke test for the OD flow-glyph case study: drives the real aggregation
// pipeline (ScreenGridMode.aggregate) with the same onAfterAggregate binning the
// page uses, and checks the histogram reaches the glyph via customData and the
// semantic cell. Run: node examples/case-studies/smoke-test.mjs
import assert from 'assert';
import { ScreenGridMode } from '../../src/aggregation/modes/ScreenGridMode.js';
import { generateLondonFlows, LONDON_BBOX } from '../data/london.js';

const NSECTORS = 16;
const SECTOR_DEG = 360 / NSECTORS;
function binFlows(records) {
  const hist = new Float64Array(NSECTORS);
  const dist = new Float64Array(NSECTORS);
  let localMax = 0;
  for (let i = 0; i < records.length; i++) {
    const d = records[i].data;
    let s = Math.floor(((d.bearing + SECTOR_DEG / 2) % 360) / SECTOR_DEG) % NSECTORS;
    if (s < 0) s += NSECTORS;
    hist[s] += 1;
    dist[s] += d.dist_km;
  }
  for (let s = 0; s < NSECTORS; s++) if (hist[s] > localMax) localMax = hist[s];
  return { hist, dist, localMax, total: records.length };
}

const data = generateLondonFlows({ count: 9000, seed: 99 });
const [west, south, east, north] = LONDON_BBOX;
const width = 1200, height = 800;
const map = {
  project: ([lon, lat]) => ({ x: (lon - west) / (east - west) * width, y: (north - lat) / (north - south) * height }),
  getCanvas: () => ({ width, height }),
  getZoom: () => 10.2,
};

const result = ScreenGridMode.aggregate(
  data,
  (d) => [d.olon, d.olat],
  () => 1,
  map,
  { cellSizePixels: 64, displaySize: { width, height }, aggregationMode: 'screen-grid', normalizationFunction: 'max-local', onAfterAggregate: (records) => binFlows(records) }
);

// customData carries the per-cell histogram for every populated cell.
let populated = 0, globalMax = 1, totalTrips = 0;
for (let i = 0; i < result.customData.length; i++) {
  const cd = result.customData[i];
  if (!cd) { assert.strictEqual(result.cellData[i].length, 0, `empty cells have no customData (idx ${i})`); continue; }
  populated += 1;
  totalTrips += cd.total;
  assert.strictEqual(cd.hist.length, NSECTORS, 'hist has 16 sectors');
  assert.strictEqual(cd.total, result.cellData[i].length, 'total matches cell point count');
  const sum = cd.hist.reduce((a, b) => a + b, 0);
  assert.strictEqual(sum, cd.total, 'histogram counts sum to total');
  assert.ok(cd.localMax > 0 && cd.localMax <= cd.total, 'localMax within range');
  if (cd.localMax > globalMax) globalMax = cd.localMax;
}
assert.ok(populated > 20, `expected many populated cells, got ${populated}`);
assert.ok(totalTrips <= data.length, 'no more binned trips than input (some fall off-canvas)');
assert.ok(globalMax >= 1, 'global reference computed');

// The semantic cell exposes the same customData object the glyph reads, and its
// reliability facet (used by the hover tooltip) is available on demand.
const idx = result.customData.findIndex((c) => c && c.total >= 5);
const cell = result.cellAt(idx);
assert.strictEqual(cell.customData, result.customData[idx], 'semantic cell.customData === onAfterAggregate output');
assert.ok(['low', 'medium', 'high'].includes(cell.reliability.sampleSizeClass), 'reliability available for hover');
assert.ok(Array.isArray(cell.reliability.warnings), 'reliability.warnings is an array');

console.log(`OD flow case study: ${populated} populated cells, ${totalTrips} trips binned, global max direction = ${globalMax} trips.`);
console.log('All OD flow case-study smoke tests passed.');
