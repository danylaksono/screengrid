// Node smoke test for the inter-cell flow example: drives the real aggregation
// pipeline with the page's onAfterAggregate (bin trips by the OTHER-END cell)
// and checks the arc endpoints land on cell centroids and conserve trip counts.
// Run: node examples/case-studies/inter-cell-smoke.mjs
import assert from 'assert';
import { ScreenGridMode } from '../../src/aggregation/modes/ScreenGridMode.js';
import { generateLondonFlows, LONDON_BBOX } from '../data/london.js';

const [west, south, east, north] = LONDON_BBOX;
const width = 1200, height = 800, cs = 72;
const map = {
  project: ([lon, lat]) => ({ x: (lon - west) / (east - west) * width, y: (north - lat) / (north - south) * height }),
  getCanvas: () => ({ width, height }),
  getZoom: () => 10.2,
};

function binOtherEnd(records) {
  const dest = new Map();
  let localMax = 0;
  for (let i = 0; i < records.length; i++) {
    const d = records[i].data;
    const p = map.project([d.dlon, d.dlat]);      // aggregate by origin -> bin destinations
    const col = Math.floor(p.x / cs), row = Math.floor(p.y / cs);
    const key = col + ',' + row;
    let e = dest.get(key);
    if (!e) { e = { x: (col + 0.5) * cs, y: (row + 0.5) * cs, count: 0, distSum: 0 }; dest.set(key, e); }
    e.count += 1; e.distSum += d.dist_km;
  }
  const destinations = [];
  for (const e of dest.values()) { destinations.push(e); if (e.count > localMax) localMax = e.count; }
  return { destinations, localMax, total: records.length };
}

const data = generateLondonFlows({ count: 9000, seed: 99 });
const result = ScreenGridMode.aggregate(
  data, (d) => [d.olon, d.olat], () => 1, map,
  { cellSizePixels: cs, displaySize: { width, height }, aggregationMode: 'screen-grid', normalizationFunction: 'max-local', onAfterAggregate: (r) => binOtherEnd(r) }
);

const onGrid = (v) => Number.isInteger(v / (cs / 2)) && !Number.isInteger(v / cs); // (k+0.5)*cs
let cells = 0, arcs = 0, gmax = 1;
for (let i = 0; i < result.customData.length; i++) {
  const cd = result.customData[i];
  if (!cd) continue;
  cells += 1;
  arcs += cd.destinations.length;
  let sum = 0;
  for (const dst of cd.destinations) {
    assert.ok(dst.count > 0 && dst.distSum >= 0, 'arc has a positive flow');
    assert.ok(onGrid(dst.x) && onGrid(dst.y), `endpoint on a cell centroid (${dst.x}, ${dst.y})`);
    sum += dst.count;
  }
  assert.strictEqual(sum, cd.total, 'every trip is assigned to exactly one destination cell');
  if (cd.localMax > gmax) gmax = cd.localMax;
}

// The origin cell's own centroid (what the glyph draws from) shares the grid.
const idx = result.customData.findIndex((c) => c);
const centroid = result.cellAt(idx).spatial.centroid;
assert.ok(onGrid(centroid.x) && onGrid(centroid.y), 'origin centroid is on the same grid as arc endpoints');

assert.ok(cells > 20 && arcs > cells, `expected many cells and more arcs (${cells} cells, ${arcs} arcs)`);
console.log(`Inter-cell flows: ${cells} origin cells, ${arcs} cell-to-cell arcs, busiest flow = ${gmax} trips.`);
console.log('All inter-cell flow smoke tests passed.');
