import assert from 'assert';
import PublicTransportGlyph from '../../src/glyphs/PublicTransportGlyph.js';

console.log('[Test] PublicTransportGlyph value scaling');

// Regression: the glyph computes `normalizeFactor` (1 for 0-1 proportions, 100
// for 0-100 percentages) but used to divide by a hardcoded 100 regardless. With
// 0-1 source data that produced sub-pixel squares -- the glyph drew nothing
// visible. Assert both scales produce the same, visible geometry.

function paint(props) {
  const rects = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, rect() {}, arc() {},
    fillRect(x, y, w, h) { rects.push(w); },
    strokeRect() {},
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
  };
  const cellInfo = { cellData: [{ data: { properties: props } }], glyphRadius: 30, cellSize: 60 };
  PublicTransportGlyph.draw(ctx, 100, 100, 0.5, cellInfo, { timeIndex: 7 });
  return rects;
}

const CATS = ['employment', 'supermarket', 'school_primary', 'school_secondary', 'gp', 'hospitals'];

// 0-1 proportions, as the bundled example dataset uses.
const proportion = {};
for (const c of CATS) proportion[`${c}_pct_120`] = 0.5;

// The same values expressed as 0-100 percentages.
const percentage = {};
for (const c of CATS) percentage[`${c}_pct_120`] = 50;

const fromProportion = paint(proportion);
const fromPercentage = paint(percentage);

assert.strictEqual(fromProportion.length, 6, 'draws one square per category');
assert.strictEqual(fromPercentage.length, 6, 'draws one square per category');

const maxProportion = Math.max(...fromProportion);
assert.ok(maxProportion > 1, `0-1 data must produce visible squares, got ${maxProportion.toFixed(4)}px`);
console.log(`0-1 proportions render at ${maxProportion.toFixed(2)}px OK`);

// Equivalent inputs on either scale must agree.
for (let i = 0; i < 6; i++) {
  assert.ok(
    Math.abs(fromProportion[i] - fromPercentage[i]) < 1e-9,
    `scale ${i}: 0-1 and 0-100 inputs must agree (${fromProportion[i]} vs ${fromPercentage[i]})`
  );
}
console.log('0-1 and 0-100 scales agree OK');

// A cell with no matching properties draws nothing rather than throwing.
assert.strictEqual(paint({ unrelated: 1 }).length, 0, 'no matching fields -> no squares');
console.log('empty cell handled OK');

console.log('PublicTransportGlyph tests passed');
