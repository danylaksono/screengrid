import assert from 'assert';
import PublicTransportGlyph, { CATEGORIES, MINUTES } from '../../src/glyphs/PublicTransportGlyph.js';

console.log('[Test] PublicTransportGlyph fixed-scale encoding');

// Regression: the glyph used to infer its divisor from each cell's own maximum
// ("if any value > 1 assume 0-100, else assume 0-1"). Two cells in the same
// frame could then use different encodings, and one cell could switch encoding
// between adjacent time-slider steps. docs/CARTOGRAPHIC_EVALUATION_RUBRIC.md
// requires a shared scale for profile comparison and names "local scaling hides
// differences" as the failure mode. Bar height must depend only on the value.

const GLYPH_RADIUS = 30;
const SIZE = GLYPH_RADIUS * 2;
const PAD = Math.max(2, SIZE * 0.06);
const BARS_H = SIZE - 2 * PAD; // no sparkline

// Separate the rect kinds by fill: value bars use hex category colours,
// the envelope and backdrop use rgba white.
function paint(features, config = {}) {
  const rects = [];
  let fill = null;
  const ctx = {
    save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {}, arc() {},
    moveTo() {}, lineTo() {}, rect() {},
    fillRect(x, y, w, h) { rects.push({ h, fill }); }, strokeRect() {},
    set fillStyle(v) { fill = v; }, set strokeStyle(v) {}, set lineWidth(v) {},
  };
  PublicTransportGlyph.draw(ctx, 100, 100, 0.5,
    { cellData: features.map((f) => ({ data: f })), glyphRadius: GLYPH_RADIUS, cellSize: SIZE },
    { timeIndex: MINUTES.length - 1, showEnvelope: false, ...config });
  return rects.filter((r) => String(r.fill).startsWith('#')).map((r) => r.h);
}

// Build a record with one value per category at every time band.
function record(values, band = 120) {
  const p = {};
  for (const c of CATEGORIES) for (const m of MINUTES) p[`${c}_pct_${m}`] = 0;
  CATEGORIES.forEach((c, i) => { p[`${c}_pct_${band}`] = values[i]; });
  return { properties: p };
}

// 1. Identical value, different neighbours -> identical bar height.
const quiet = paint([record([10, 0, 0, 0, 0, 0])]);
const busy = paint([record([10, 90, 90, 90, 90, 90])]);
const quietBar = Math.min(...quiet);
const busyBar = Math.min(...busy);
assert.ok(Math.abs(quietBar - busyBar) < 1e-9,
  `10% must draw the same height in any cell: ${quietBar} vs ${busyBar}`);
console.log(`10% draws ${quietBar.toFixed(2)}px regardless of the cell OK`);

// 2. Height is proportional to value on the fixed 0-100 scale.
const expected = (10 / 100) * BARS_H;
assert.ok(Math.abs(quietBar - expected) < 0.01,
  `expected ${expected.toFixed(2)}px for 10%, got ${quietBar.toFixed(2)}px`);
const full = paint([record([100, 100, 100, 100, 100, 100])]);
assert.ok(Math.abs(Math.max(...full) - BARS_H) < 0.01, '100% fills the bar area');
console.log('height proportional to value, 100% fills the area OK');

// 3. A sub-1% value must stay sub-1% — the exact case that used to blow up 100x.
const tiny = paint([record([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])]);
const tinyExpected = (0.5 / 100) * BARS_H;
assert.ok(Math.max(...tiny, 0) <= tinyExpected + 0.01,
  `0.5% must not exceed ${tinyExpected.toFixed(3)}px, got ${Math.max(...tiny, 0).toFixed(3)}px`);
console.log('sub-1% values stay sub-1% OK');

// 4. Widening the time band never shrinks a bar.
const ramp = { properties: {} };
for (const c of CATEGORIES) MINUTES.forEach((m, i) => { ramp.properties[`${c}_pct_${m}`] = (i + 1) * 10; });
let prev = -1;
for (let t = 0; t < MINUTES.length; t++) {
  const h = Math.max(...paint([ramp], { timeIndex: t }), 0);
  assert.ok(h >= prev - 1e-9, `bar shrank between bands ${t - 1} and ${t}`);
  prev = h;
}
console.log('monotonic across time bands OK');

// 5. Nothing may escape the glyph box.
const over = paint([record([500, 500, 500, 500, 500, 500])]);
assert.ok(Math.max(...over) <= BARS_H + 1e-9, 'out-of-range values are clamped');
console.log('values above scale clamped OK');

// 6. valueScale is configurable rather than guessed.
const asFraction = paint([record([0.5, 0, 0, 0, 0, 0])], { valueScale: 1 });
assert.ok(Math.abs(Math.max(...asFraction) - 0.5 * BARS_H) < 0.01,
  'valueScale: 1 treats values as 0-1 fractions');
console.log('valueScale override OK');

// 7. A cell with no matching fields draws nothing rather than throwing.
assert.strictEqual(paint([{ properties: { unrelated: 1 } }]).length, 0, 'no matching fields -> no bars');
console.log('empty cell handled OK');

console.log('PublicTransportGlyph tests passed');
