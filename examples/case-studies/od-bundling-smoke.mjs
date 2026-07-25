// Node smoke test for the grid-routing used by od-bundling.html. Verifies the
// coarse-grid router: endpoints preserved, interior waypoints snap to coarse
// grid nodes, and parallel arcs share nodes (which is what produces bundles).
// Run: node examples/case-studies/od-bundling-smoke.mjs
import assert from 'assert';

function routeThroughGrid(x0, y0, x1, y1, coarse) {
  const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.ceil(dist / coarse));
  const pts = [{ x: x0, y: y0 }];
  let lastKey = null;
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const gx = Math.round((x0 + dx * t) / coarse) * coarse;
    const gy = Math.round((y0 + dy * t) / coarse) * coarse;
    const key = gx + ',' + gy;
    if (key !== lastKey) { pts.push({ x: gx, y: gy }); lastKey = key; }
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}

const coarse = 210;

// Endpoints are preserved exactly; interior nodes snap to multiples of `coarse`.
const p = routeThroughGrid(37, 41, 1000, 640, coarse);
assert.deepStrictEqual(p[0], { x: 37, y: 41 }, 'start preserved');
assert.deepStrictEqual(p[p.length - 1], { x: 1000, y: 640 }, 'end preserved');
assert.ok(p.length >= 3, 'a long arc routes through interior nodes');
for (let i = 1; i < p.length - 1; i++) {
  assert.strictEqual(p[i].x % coarse, 0, `interior x on grid (${p[i].x})`);
  assert.strictEqual(p[i].y % coarse, 0, `interior y on grid (${p[i].y})`);
}

// No consecutive duplicate nodes.
for (let i = 1; i < p.length; i++) {
  assert.ok(!(p[i].x === p[i - 1].x && p[i].y === p[i - 1].y), 'no repeated waypoints');
}

// Two near-parallel arcs share interior nodes → they bundle.
const a = routeThroughGrid(50, 60, 980, 300, coarse);
const b = routeThroughGrid(70, 90, 1000, 330, coarse);
const nodesA = new Set(a.slice(1, -1).map((q) => q.x + ',' + q.y));
const shared = b.slice(1, -1).filter((q) => nodesA.has(q.x + ',' + q.y)).length;
assert.ok(shared > 0, `parallel arcs share coarse nodes (shared=${shared})`);

// Coarser grid => fewer/shorter node sequences (stronger bundling).
const fine = routeThroughGrid(0, 0, 1200, 800, 80).length;
const coarseN = routeThroughGrid(0, 0, 1200, 800, 320).length;
assert.ok(coarseN <= fine, `coarser grid yields no more waypoints (${coarseN} <= ${fine})`);

console.log(`Routing: ${p.length} waypoints for a long arc; parallel arcs shared ${shared} nodes.`);
console.log('All OD bundling routing smoke tests passed.');
