// Offline test for the force-directed edge bundling core (no browser).
// Run: node examples/case-studies/fdeb-test.mjs
import assert from 'node:assert';
import { bundleEdges } from './fdeb.js';

const mid = (e) => e.points[(e.points.length - 1) >> 1];
const finite = (pts) => pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

// Two parallel horizontal edges, 20px apart, identical extent → highly
// compatible, so bundling should pull their middles together.
let e1 = { x0: 0, y0: 100, x1: 400, y1: 100 };
let e2 = { x0: 0, y0: 120, x1: 400, y1: 120 };
bundleEdges([e1, e2], { cycles: 6 });

// Endpoints are fixed.
assert.deepStrictEqual(e1.points[0], { x: 0, y: 100 }, 'e1 start fixed');
assert.deepStrictEqual(e1.points[e1.points.length - 1], { x: 400, y: 100 }, 'e1 end fixed');
assert.deepStrictEqual(e2.points[0], { x: 0, y: 120 }, 'e2 start fixed');

// Final subdivision: 1 → ×2 over 6 cycles ⇒ 32 interior + 2 endpoints = 34.
assert.strictEqual(e1.points.length, 34, `expected 34 points, got ${e1.points.length}`);
assert.ok(finite(e1.points) && finite(e2.points), 'no NaN/Inf in bundled points');

// Middles converged: gap started at 20, should shrink well below it.
const gapBefore = 20;
const gapAfter = Math.abs(mid(e1).y - mid(e2).y);
assert.ok(gapAfter < gapBefore * 0.6, `parallel middles should converge (before ${gapBefore}, after ${gapAfter.toFixed(1)})`);

// Points stay within the vertical band spanned by the two edges (no blow-up).
for (const p of [...e1.points, ...e2.points]) {
  assert.ok(p.y >= 95 && p.y <= 125, `point stays in band, got y=${p.y.toFixed(1)}`);
  assert.ok(p.x >= -1 && p.x <= 401, `point stays in x-extent, got x=${p.x.toFixed(1)}`);
}

// A far, perpendicular edge is incompatible → it should barely move (stays straight-ish).
let e3 = { x0: 1000, y0: 0, x1: 1000, y1: 400 };
bundleEdges([e1, e2, e3], { cycles: 6 });
const straightness = Math.max(...e3.points.map((p) => Math.abs(p.x - 1000)));
assert.ok(straightness < 5, `incompatible edge stays ~straight, max deviation ${straightness.toFixed(1)}px`);

// Empty / degenerate input doesn't throw.
assert.doesNotThrow(() => bundleEdges([]));
assert.doesNotThrow(() => bundleEdges([{ x0: 5, y0: 5, x1: 5, y1: 5 }]));

console.log(`FDEB: parallel gap ${gapBefore} → ${gapAfter.toFixed(1)}px; incompatible edge deviates ${straightness.toFixed(1)}px.`);
console.log('All FDEB tests passed.');
