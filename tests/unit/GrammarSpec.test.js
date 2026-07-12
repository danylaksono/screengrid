import assert from 'assert';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateSpec, SPEC_VERSION } from '../../src/grammar/validateSpec.js';
import { compileSpec, compileDerivedMeasure, resolveParameters } from '../../src/grammar/compileSpec.js';
import { Aggregator } from '../../src/core/Aggregator.js';

console.log('[Test] Grammar spec validation and compilation');

function makeProfile() {
  return {
    sourceName: 'test',
    sourceType: 'csv',
    rowCount: 4,
    fields: [
      { name: 'lon', type: 'number', missingCount: 0, min: -1, max: 1 },
      { name: 'lat', type: 'number', missingCount: 0, min: 51, max: 52 },
      { name: 'cost', type: 'number', missingCount: 0, min: 0, max: 100 },
      { name: 'access', type: 'number', missingCount: 0, min: 0, max: 1 },
      { name: 'value', type: 'number', missingCount: 0, min: 0, max: 50 },
      { name: 'population', type: 'number', missingCount: 0, min: 0, max: 200 },
      { name: 'lower', type: 'number', missingCount: 0, min: 0, max: 10 },
      { name: 'upper', type: 'number', missingCount: 0, min: 0, max: 10 },
      { name: 'reading', type: 'number', missingCount: 0, min: 0, max: 10 },
      { name: 'category', type: 'string', missingCount: 0, distinctCount: 3 }
    ],
    coordinateCandidates: [{ x: 'lon', y: 'lat', coordinateSystem: 'lonlat', confidence: 0.9 }]
  };
}

function makeSpec(overrides = {}) {
  const spec = {
    version: SPEC_VERSION,
    datasetProfile: makeProfile(),
    intent: { task: 'density', comparison: 'within-cell' },
    parameters: [],
    screengrid: {
      coordinateSystem: 'lonlat',
      coordinateFields: { x: 'lon', y: 'lat' },
      aggregationMode: 'screen-grid',
      aggregation: { function: 'count', field: null },
      derivedMeasures: [],
      cellSizePixels: 48,
      filters: [],
      summaries: [
        { name: 'count', role: 'primary', field: null, op: 'count', reliability: { warnBelowCount: 5 } }
      ],
      normalization: 'max-local',
      emptyCellPolicy: 'hide'
    },
    glyph: {
      type: 'heatmap',
      channels: { size: { field: 'count' }, color: { field: 'count' }, opacity: { field: 'count' } },
      scales: { size: 'sqrt', color: 'sequential', opacity: 'linear' },
      palette: 'ember',
      legend: { enabled: true },
      limits: { maxCategories: 6, minSizePixels: 18 }
    },
    interaction: { hover: true, click: true }
  };
  return deepMerge(spec, overrides);
}

function deepMerge(base, patch) {
  if (Array.isArray(patch) || typeof patch !== 'object' || patch === null) return patch;
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    out[key] = key in base ? deepMerge(base[key], patch[key]) : patch[key];
  }
  return out;
}

// --- 1) Baseline spec validates ---------------------------------------------
{
  const result = validateSpec(makeSpec());
  assert.strictEqual(result.valid, true, `baseline should be valid: ${result.errors.join('; ')}`);
  assert.strictEqual(result.checkability, 'full');
  console.log('baseline spec valid OK');
}

// --- 2) Missing version is an error ------------------------------------------
{
  const spec = makeSpec();
  delete spec.version;
  const result = validateSpec(spec);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('version')), 'expects version error');
  console.log('missing version rejected OK');
}

// --- 3) MCDA-style spec: parameters + weighted-sum derived measure ----------
const mcdaSpec = makeSpec({
  intent: { task: 'suitability', comparison: 'across-cells' },
  parameters: [
    { name: 'w_cost', domain: [0, 1], default: 0.5 },
    { name: 'w_access', domain: [0, 1], default: 0.5 }
  ],
  screengrid: {
    aggregation: { function: 'derived', measure: 'suitability', field: null },
    derivedMeasures: [{
      name: 'suitability',
      op: 'weighted-sum',
      aggregate: 'mean',
      terms: [
        { field: 'cost', weight: { param: 'w_cost' }, normalize: 'global', invert: true },
        { field: 'access', weight: { param: 'w_access' }, normalize: 'global' }
      ]
    }],
    normalization: 'max-global'
  }
});
{
  const result = validateSpec(mcdaSpec);
  assert.strictEqual(result.valid, true, `MCDA spec should be valid: ${result.errors.join('; ')}`);
  console.log('MCDA weighted-sum spec valid OK');
}

// --- 4) MCDA comparability warning under local normalization ----------------
{
  const localSpec = deepMerge(mcdaSpec, { screengrid: { normalization: 'max-local' } });
  const result = validateSpec(localSpec);
  assert.ok(
    result.warnings.some((w) => w.includes('suitability') && w.includes('local normalization')),
    'expects derived-measure comparability warning'
  );
  console.log('MCDA local-normalization comparability warning OK');
}

// --- 5) Unnormalized multi-term weighted sum warns ---------------------------
{
  const rawSpec = structuredClone(mcdaSpec);
  rawSpec.screengrid.derivedMeasures = [{
    name: 'suitability',
    op: 'weighted-sum',
    terms: [
      { field: 'cost', weight: 0.5 },
      { field: 'access', weight: 0.5 }
    ]
  }];
  const result = validateSpec(rawSpec);
  assert.ok(result.warnings.some((w) => w.includes('commensurable')), 'expects commensurability warning');
  console.log('unnormalized weighted-sum warning OK');
}

// --- 6) Unknown weight parameter is an error ---------------------------------
{
  const badSpec = structuredClone(mcdaSpec);
  badSpec.screengrid.derivedMeasures = [{
    name: 'suitability',
    op: 'weighted-sum',
    terms: [{ field: 'cost', weight: { param: 'nope' }, normalize: 'global' }]
  }];
  const result = validateSpec(badSpec);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('nope')));
  console.log('unknown weight parameter rejected OK');
}

// --- 7) Derived measure compiles and aggregates correctly --------------------
{
  // Two records land in one cell. cost range 0..100, access range 0..1.
  const originalData = [
    { lon: 0, lat: 51.5, cost: 0, access: 0.2 },   // cost norm 0 -> invert 1; score .5*1 + .5*.2 = .6
    { lon: 0, lat: 51.5, cost: 100, access: 0.4 }  // cost norm 1 -> invert 0; score 0 + .5*.4 = .2
  ];
  const projected = [{ x: 10, y: 10, w: 1 }, { x: 12, y: 12, w: 1 }];
  const fn = compileDerivedMeasure(mcdaSpec, 'suitability');
  const result = Aggregator.aggregate(projected, originalData, 100, 100, 50, fn, null);
  assert.ok(Math.abs(result.grid[0] - 0.4) < 1e-9, `expected mean 0.4, got ${result.grid[0]}`);

  // Parameter override: all weight on access -> mean(0.2, 0.4) = 0.3
  const fn2 = compileDerivedMeasure(mcdaSpec, 'suitability', { w_cost: 0, w_access: 1 });
  const result2 = Aggregator.aggregate(projected, originalData, 100, 100, 50, fn2, null);
  assert.ok(Math.abs(result2.grid[0] - 0.3) < 1e-9, `expected mean 0.3, got ${result2.grid[0]}`);
  console.log('derived weighted-sum executes correctly (incl. parameter override) OK');
}

// --- 8) Ratio with field denominator ----------------------------------------
{
  const ratioSpec = makeSpec({
    screengrid: {
      aggregation: { function: 'derived', measure: 'rate', field: null },
      derivedMeasures: [{
        name: 'rate',
        op: 'ratio',
        numerator: { field: 'value' },
        denominator: { type: 'field', field: 'population' }
      }]
    }
  });
  assert.strictEqual(validateSpec(ratioSpec).valid, true);
  const fn = compileDerivedMeasure(ratioSpec, 'rate');
  const originalData = [
    { lon: 0, lat: 51.5, value: 10, population: 100 },
    { lon: 0, lat: 51.5, value: 30, population: 100 }
  ];
  const projected = [{ x: 10, y: 10, w: 1 }, { x: 12, y: 12, w: 1 }];
  const result = Aggregator.aggregate(projected, originalData, 100, 100, 50, fn, null);
  assert.ok(Math.abs(result.grid[0] - 0.2) < 1e-9, `expected 40/200 = 0.2, got ${result.grid[0]}`);
  console.log('ratio with field denominator OK');
}

// --- 9) Uncertainty intent: band mark satisfies; absence warns; bounds checked
{
  const bandSpec = makeSpec({
    intent: { task: 'uncertainty', comparison: 'within-cell' },
    glyph: {
      type: 'custom',
      custom: {
        layout: 'cartesian-mini',
        domain: 'global',
        marks: [
          { mark: 'line', data: { fields: ['reading'] } },
          { mark: 'band', data: { field: 'reading', lower: 'lower', upper: 'upper' } }
        ]
      }
    }
  });
  const withBand = validateSpec(bandSpec);
  assert.strictEqual(withBand.valid, true, withBand.errors.join('; '));
  assert.ok(!withBand.warnings.some((w) => w.includes('does not explicitly encode uncertainty')),
    'band mark should satisfy the uncertainty rule');

  const noBand = validateSpec(makeSpec({ intent: { task: 'uncertainty', comparison: 'within-cell' } }));
  assert.ok(noBand.warnings.some((w) => w.includes('does not explicitly encode uncertainty')),
    'missing uncertainty encoding should warn');

  const brokenBand = structuredClone(bandSpec);
  brokenBand.glyph.custom.marks = [{ mark: 'band', data: { field: 'reading' } }];
  const broken = validateSpec(brokenBand);
  assert.strictEqual(broken.valid, false);
  assert.ok(broken.errors.some((e) => e.includes('data.lower')));
  console.log('uncertainty marks validated OK');
}

// --- 10) Custom escape hatch: partial checkability + compile handshake -------
{
  const customSpec = makeSpec({
    screengrid: { aggregation: { function: 'custom', ref: 'myAgg', field: null } }
  });
  const result = validateSpec(customSpec);
  assert.strictEqual(result.checkability, 'partial');
  assert.ok(result.warnings.some((w) => w.includes('escape') || w.includes('outside the grammar')));

  assert.throws(() => compileSpec(customSpec), /not supplied/);
  const compiled = compileSpec(customSpec, { customFunctions: { myAgg: (records) => records.length * 2 } });
  assert.strictEqual(compiled.checkability, 'partial');
  assert.strictEqual(typeof compiled.layerOptions.aggregationFunction, 'function');
  console.log('custom escape hatch handled OK');
}

// --- 11) compileSpec end-to-end layer options --------------------------------
{
  const compiled = compileSpec(mcdaSpec, { parameters: { w_access: 2 } });
  assert.strictEqual(compiled.layerOptions.aggregationMode, 'screen-grid');
  assert.strictEqual(compiled.layerOptions.normalizationFunction, 'max-global');
  assert.strictEqual(typeof compiled.layerOptions.aggregationFunction, 'function');
  assert.strictEqual(compiled.parameters.w_access, 1, 'override should clamp to domain [0,1]');
  assert.deepStrictEqual(compiled.layerOptions.getPosition({ lon: 3, lat: 4 }), [3, 4]);
  console.log('compileSpec layer options + parameter clamping OK');
}

// --- 12) Summary denominator semantics ---------------------------------------
{
  const perSpec = makeSpec({});
  perSpec.screengrid.summaries.push({
    name: 'rate', role: 'primary', field: 'value', op: 'sum',
    per: { type: 'field', field: 'population' }
  });
  assert.strictEqual(validateSpec(perSpec).valid, true);

  const badPer = makeSpec({});
  badPer.screengrid.summaries.push({
    name: 'rate', role: 'primary', field: 'value', op: 'sum',
    per: { type: 'field', field: 'ghost' }
  });
  const result = validateSpec(badPer);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('ghost')));
  console.log('summary denominator semantics OK');
}

// --- 13) resolveParameters clamps and defaults --------------------------------
{
  const values = resolveParameters(mcdaSpec, { w_cost: -5 });
  assert.strictEqual(values.w_cost, 0, 'clamped to domain min');
  assert.strictEqual(values.w_access, 0.5, 'default when not overridden');
  console.log('resolveParameters OK');
}

// --- 14) AGENTS.md stays in sync with the grammar version ---------------------
{
  const agentsPath = fileURLToPath(new URL('../../AGENTS.md', import.meta.url));
  const agentsDoc = fs.readFileSync(agentsPath, 'utf8');
  assert.ok(
    agentsDoc.includes(SPEC_VERSION),
    `AGENTS.md must mention the current grammar version ${SPEC_VERSION}; update its guardrails when the grammar changes.`
  );
  console.log('AGENTS.md version sync OK');
}

console.log('Grammar spec tests passed');
