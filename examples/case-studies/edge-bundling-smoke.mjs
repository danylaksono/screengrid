// Node smoke test for the edge-bundling case study: real aggregation → build
// the cell-to-cell edge set (as onAggregate does) → run FDEB, and check the
// bundled polylines keep their endpoints pinned to cell centroids and contain no
// NaN. Run: node examples/case-studies/edge-bundling-smoke.mjs
import assert from 'node:assert';
import { ScreenGridMode } from '../../src/aggregation/modes/ScreenGridMode.js';
import { generateLondonFlows, LONDON_BBOX } from '../data/london.js';
import { bundleEdges } from './fdeb.js';

const [west, south, east, north] = LONDON_BBOX;
const width = 1200, height = 800, cs = 80;
const map = {
  project: ([lon, lat]) => ({ x: (lon - west) / (east - west) * width, y: (north - lat) / (north - south) * height }),
  getCanvas: () => ({ width, height }),
  getZoom: () => 10.2,
};

function binOtherEnd(records) {
  const dest = new Map();
  for (let i = 0; i < records.length; i++) {
    const d = records[i].data;
    const p = map.project([d.dlon, d.dlat]);
    const col = Math.floor(p.x / cs), row = Math.floor(p.y / cs);
    const key = col + ',' + row;
    let e = dest.get(key);
    if (!e) { e = { col, row, x: (col + 0.5) * cs, y: (row + 0.5) * cs, count: 0, distSum: 0 }; dest.set(key, e); }
    e.count += 1; e.distSum += d.dist_km;
  }
  return { destinations: [...dest.values()], total: records.length };
}

const data = generateLondonFlows({ count: 9000, seed: 99 });
const result = ScreenGridMode.aggregate(
  data, (d) => [d.olon, d.olat], () => 1, map,
  { cellSizePixels: cs, displaySize: { width, height }, aggregationMode: 'screen-grid', normalizationFunction: 'max-local', onAfterAggregate: (r) => binOtherEnd(r) }
);

// Build the edge set exactly as onAggregate does.
const CAP = 200, MIN = 2;
const edges = [];
const { customData: cd, cols } = result;
for (let i = 0; i < cd.length; i++) {
  const c = cd[i];
  if (!c) continue;
  const x0 = ((i % cols) + 0.5) * cs, y0 = (Math.floor(i / cols) + 0.5) * cs;
  for (const dst of c.destinations) {
    if (dst.count < MIN) continue;
    if (dst.x === x0 && dst.y === y0) continue;
    edges.push({ x0, y0, x1: dst.x, y1: dst.y, w: dst.count, dist: dst.distSum / dst.count });
  }
}
edges.sort((a, b) => b.w - a.w);
const capped = edges.slice(0, CAP);
assert.ok(capped.length > 20, `enough edges to bundle (${capped.length})`);

bundleEdges(capped, { compatibility: 0.55 });

const onGrid = (v) => Number.isInteger(v / (cs / 2)) && !Number.isInteger(v / cs);
let bundled = 0;
for (const e of capped) {
  assert.ok(Array.isArray(e.points) && e.points.length >= 3, 'edge has a bundled polyline');
  const a = e.points[0], b = e.points[e.points.length - 1];
  assert.ok(Math.abs(a.x - e.x0) < 1e-6 && Math.abs(a.y - e.y0) < 1e-6, 'start endpoint pinned');
  assert.ok(Math.abs(b.x - e.x1) < 1e-6 && Math.abs(b.y - e.y1) < 1e-6, 'end endpoint pinned');
  assert.ok(onGrid(e.x0) && onGrid(e.y0), 'origin endpoint on a cell centroid');
  assert.ok(e.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), 'no NaN in polyline');
  // Did this edge actually bend (bundle)? Compare mid to the straight midpoint.
  const m = e.points[(e.points.length - 1) >> 1];
  if (Math.hypot(m.x - (e.x0 + e.x1) / 2, m.y - (e.y0 + e.y1) / 2) > 2) bundled += 1;
}
assert.ok(bundled > 0, 'at least some edges bent into bundles');

console.log(`Edge bundling: ${capped.length} edges bundled, ${bundled} visibly bent, endpoints pinned, no NaN.`);
console.log('All edge-bundling smoke tests passed.');
