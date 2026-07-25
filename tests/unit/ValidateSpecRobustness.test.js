import assert from 'assert';
import { validateSpec } from '../../src/grammar/validateSpec.js';

// Regression: validateSpec is documented to return { valid, errors, warnings }.
// A partially-built spec (LLM authoring, the demo's patch-validate loop) must
// come back as valid:false with actionable errors rather than throwing a
// TypeError on an unguarded dereference.
console.log('[Test] validateSpec structural robustness');

const cases = [
  ['empty object', {}],
  ['null', null],
  ['undefined', undefined],
  ['string', 'nope'],
  ['missing screengrid', { version: '0.2.0', intent: { task: 'density' }, datasetProfile: { fields: [] }, glyph: { type: 'heatmap', palette: 'ember' } }],
  ['screengrid without coordinateFields', { version: '0.2.0', intent: { task: 'density' }, datasetProfile: { fields: [] }, glyph: { type: 'heatmap', palette: 'ember' }, screengrid: { aggregation: { function: 'count' } } }],
  ['fields not an array', { version: '0.2.0', intent: { task: 'density' }, datasetProfile: { fields: {} }, glyph: { type: 'heatmap', palette: 'ember' }, screengrid: { coordinateFields: { x: 'lon', y: 'lat' }, aggregation: { function: 'count' } } }],
];

for (const [label, spec] of cases) {
  let report;
  assert.doesNotThrow(() => { report = validateSpec(spec); }, `validateSpec(${label}) must not throw`);
  assert.strictEqual(report.valid, false, `${label} is invalid`);
  assert.ok(Array.isArray(report.errors) && report.errors.length > 0, `${label} reports errors`);
  assert.ok(Array.isArray(report.warnings), `${label} still returns a warnings array`);
}

// A structurally complete but empty-profile spec should get past the structural
// gate and be validated on its merits (i.e. no structural error about missing
// containers), proving the gate does not over-reject valid intermediate specs.
const skeleton = {
  version: '0.2.0',
  datasetProfile: { rowCount: 0, fields: [], coordinateCandidates: [] },
  intent: { task: 'density', comparison: 'within-cell' },
  screengrid: {
    coordinateFields: { x: 'lon', y: 'lat' },
    aggregation: { function: 'count' },
    normalization: 'max-local',
    cellSizePixels: 48,
    summaries: [],
  },
  glyph: { type: 'heatmap', palette: 'ember', channels: {}, scales: {} },
  interaction: { hover: true },
};
const skeletonReport = validateSpec(skeleton);
assert.ok(
  !skeletonReport.errors.some((e) => /is missing the|must be an array/.test(e)),
  'structurally complete skeleton raises no structural errors'
);
// x/y reference unknown fields (profile is empty) — those are the expected
// content errors, confirming validation proceeded past the gate.
assert.ok(skeletonReport.errors.some((e) => /coordinate field/i.test(e)), 'content validation still runs');

console.log('validateSpec structural robustness OK');
