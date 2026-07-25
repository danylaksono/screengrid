// Node smoke test for the grammar examples: exercises the shared data module,
// the profiler, and every example spec through validate -> compile -> execute.
// Run: node examples/grammar/smoke-test.mjs   (not part of `npm test`)
import assert from 'assert';
import { validateSpec, compileSpec } from '../../src/grammar/index.js';
import { generateLondonPoints, buildLondonProfile } from '../data/london.js';
import { colorScaleFromPalette, categoriesFromRecords } from './grammar-render-bridge.js';

const data = generateLondonPoints({ count: 6000, seed: 42 });
const profile = buildLondonProfile(data);

// Data module sanity.
assert.strictEqual(data.length, 6000);
assert.ok(data.every((d) => d.lon >= -0.51 && d.lon <= 0.33 && d.lat >= 51.28 && d.lat <= 51.69), 'points inside London bbox');
const price = profile.fields.find((f) => f.name === 'price');
assert.ok(price.max > price.min, 'profile has real numeric ranges');
assert.strictEqual(categoriesFromRecords(data, 'land_use').length, 5, 'five land-use categories');

// Determinism: same seed -> identical first record.
assert.deepStrictEqual(generateLondonPoints({ count: 10, seed: 42 })[0], generateLondonPoints({ count: 10, seed: 42 })[0]);

// Records mirror the shape compileSpec's aggregation functions expect.
const cell = data.slice(0, 40).map((d) => ({ data: d, weight: 1 }));

// --- 01 density -----------------------------------------------------------
const density = {
  version: '0.2.0', datasetProfile: profile,
  intent: { task: 'density', comparison: 'across-cells' },
  parameters: [],
  screengrid: { coordinateSystem: 'lonlat', coordinateFields: { x: 'lon', y: 'lat' }, aggregationMode: 'screen-grid', aggregation: { function: 'count' }, cellSizePixels: 44, summaries: [{ name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } }], normalization: 'max-local' },
  glyph: { type: 'heatmap', channels: {}, scales: { color: 'sequential' }, palette: 'ember', legend: { enabled: true } },
  interaction: { hover: true, click: true },
};
report('density', density);
assert.strictEqual(compileSpec(density).layerOptions.aggregationFunction, 'count');

// --- 02 suitability (MCDA) ------------------------------------------------
const suitability = {
  version: '0.2.0', datasetProfile: profile,
  intent: { task: 'suitability', comparison: 'across-cells' },
  parameters: [{ name: 'w_access', domain: [0, 1], default: 0.5 }, { name: 'w_cost', domain: [0, 1], default: 0.5 }],
  screengrid: {
    coordinateSystem: 'lonlat', coordinateFields: { x: 'lon', y: 'lat' }, aggregationMode: 'screen-grid',
    aggregation: { function: 'derived', measure: 'suitability' },
    derivedMeasures: [{ name: 'suitability', op: 'weighted-sum', aggregate: 'mean', terms: [
      { field: 'access', weight: { param: 'w_access' }, normalize: 'global' },
      { field: 'rent', weight: { param: 'w_cost' }, normalize: 'global', invert: true },
    ] }],
    cellSizePixels: 48, summaries: [{ name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } }], normalization: 'max-global',
  },
  glyph: { type: 'heatmap', channels: {}, scales: { color: 'sequential' }, palette: 'viridis', legend: { enabled: true } },
  interaction: { hover: true, click: true },
};
report('suitability (global norm)', suitability, /* expectClean */ true);
const suit = compileSpec(suitability, { parameters: { w_access: 0.8, w_cost: 0.2 } });
const score = suit.layerOptions.aggregationFunction(cell);
assert.ok(Number.isFinite(score) && score >= 0 && score <= 1, `suitability score in [0,1], got ${score}`);
// Weights actually move the score.
const scoreAccessHeavy = compileSpec(suitability, { parameters: { w_access: 1, w_cost: 0 } }).layerOptions.aggregationFunction(cell);
const scoreCostHeavy = compileSpec(suitability, { parameters: { w_access: 0, w_cost: 1 } }).layerOptions.aggregationFunction(cell);
assert.ok(Math.abs(scoreAccessHeavy - scoreCostHeavy) > 1e-9, 'parameter weights change the composite');
// Local normalization must raise the cross-cell comparability warning.
const localNorm = JSON.parse(JSON.stringify(suitability)); localNorm.screengrid.normalization = 'max-local';
const localReport = validateSpec(localNorm);
assert.ok(localReport.warnings.some((w) => /global normalization|comparable across cells/i.test(w)), 'local norm warns on comparability');

// --- 03 composition -------------------------------------------------------
const composition = {
  version: '0.2.0', datasetProfile: profile,
  intent: { task: 'composition', comparison: 'within-cell' },
  parameters: [],
  screengrid: { coordinateSystem: 'lonlat', coordinateFields: { x: 'lon', y: 'lat' }, aggregationMode: 'screen-grid', aggregation: { function: 'count' }, cellSizePixels: 56, summaries: [{ name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } }], normalization: 'max-local' },
  glyph: { type: 'pie', channels: { segments: { field: 'land_use', aggregate: 'mode' } }, scales: { color: 'categorical' }, palette: 'categorical', legend: { enabled: true }, limits: { maxCategories: 6, minSizePixels: 18 } },
  interaction: { hover: true, click: true },
};
report('composition', composition);

// Bridge: colorScale yields valid RGBA across the domain.
const ramp = colorScaleFromPalette('viridis');
for (const v of [0, 0.5, 1]) {
  const c = ramp(v);
  assert.ok(c.length === 4 && c.every((x, i) => (i < 3 ? x >= 0 && x <= 255 : true)), `valid rgba at ${v}`);
}

console.log('\nAll grammar smoke tests passed.');

function report(label, spec, expectClean = false) {
  const r = validateSpec(spec);
  assert.ok(r.valid, `${label} must be valid; errors: ${r.errors.join('; ')}`);
  console.log(`  ${label}: valid, ${r.warnings.length} warning(s), checkability=${r.checkability}`);
  if (expectClean) {
    const bad = r.warnings.filter((w) => /comparable across cells|commensurable/i.test(w));
    assert.strictEqual(bad.length, 0, `${label} should not raise MCDA comparability warnings; got: ${bad.join('; ')}`);
  }
}
