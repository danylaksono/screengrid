import assert from 'assert';
import { SPEC_VERSION } from '../../src/grammar/validateSpec.js';
import { compileSpec } from '../../src/grammar/compileSpec.js';
import { compileGlyph } from '../../src/grammar/compileGlyph.js';

console.log('[Test] Glyph compilation (the visual half of a spec)');

// --- A recording 2D context ------------------------------------------------
// Counts the drawing operations a compiled glyph performs, so "this glyph type
// actually renders" is an assertion rather than a screenshot.
function recordingContext() {
  const ops = [];
  const ctx = {
    ops,
    globalAlpha: 1,
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 1,
    save() { ops.push('save'); },
    restore() { ops.push('restore'); },
    beginPath() { ops.push('beginPath'); },
    closePath() { ops.push('closePath'); },
    moveTo() { ops.push('moveTo'); },
    lineTo() { ops.push('lineTo'); },
    arc() { ops.push('arc'); },
    fill() { ops.push('fill'); },
    stroke() { ops.push('stroke'); },
    fillRect() { ops.push('fillRect'); },
    setLineDash() { ops.push('setLineDash'); },
  };
  ctx.paintOps = () => ops.filter((o) => o === 'fill' || o === 'stroke' || o === 'fillRect').length;
  return ctx;
}

// --- Fixture ---------------------------------------------------------------

const HOUR_FIELDS = ['hour_1', 'hour_2', 'hour_3', 'hour_10'];

function makeProfile() {
  return {
    sourceName: 'glyph-fixture',
    sourceType: 'csv',
    rowCount: 6,
    fields: [
      { name: 'lon', type: 'number', missingCount: 0, min: -1, max: 1 },
      { name: 'lat', type: 'number', missingCount: 0, min: 51, max: 52 },
      { name: 'value', type: 'number', missingCount: 0, min: 0, max: 100 },
      { name: 'other', type: 'number', missingCount: 0, min: 0, max: 40 },
      { name: 'lower', type: 'number', missingCount: 0, min: 0, max: 100 },
      { name: 'upper', type: 'number', missingCount: 0, min: 0, max: 100 },
      ...HOUR_FIELDS.map((name) => ({ name, type: 'number', missingCount: 0, min: 0, max: 60 })),
      {
        name: 'category', type: 'string', missingCount: 0, distinctCount: 3,
        categories: [{ value: 'a', count: 4 }, { value: 'b', count: 3 }, { value: 'c', count: 2 }],
      },
    ],
    coordinateCandidates: [{ x: 'lon', y: 'lat', coordinateSystem: 'lonlat', confidence: 0.9 }],
  };
}

function makeSpec(glyph, screengridOverrides = {}) {
  return {
    version: SPEC_VERSION,
    datasetProfile: makeProfile(),
    intent: { task: 'density', comparison: 'within-cell' },
    parameters: [],
    screengrid: {
      coordinateSystem: 'lonlat',
      coordinateFields: { x: 'lon', y: 'lat' },
      aggregationMode: 'screen-grid',
      aggregation: { function: 'count' },
      cellSizePixels: 48,
      summaries: [{ name: 'count', role: 'primary', op: 'count' }],
      normalization: 'max-local',
      ...screengridOverrides,
    },
    glyph,
    interaction: { hover: true, click: false },
  };
}

/** Two populated cells with contrasting values, in Aggregator's record shape. */
function makeAggregationResult() {
  const record = (over) => ({
    data: {
      lon: 0, lat: 51.5, value: 10, other: 5, lower: 5, upper: 20,
      hour_1: 1, hour_2: 5, hour_3: 9, hour_10: 3, category: 'a', ...over,
    },
    weight: 1, projectedX: 0, projectedY: 0,
  });
  return {
    cellData: [
      [record({}), record({ category: 'b', value: 30 })],
      [record({ value: 80, other: 35, lower: 60, upper: 95, hour_1: 40, category: 'c' })],
      [], // an empty cell must be skipped, not drawn
    ],
    grid: [40, 80, 0],
  };
}

/** Render every populated cell of a compiled glyph and return the context. */
function renderAll(compiled) {
  const result = makeAggregationResult();
  compiled.onAggregate(result);
  const ctx = recordingContext();
  for (let i = 0; i < result.cellData.length; i++) {
    compiled.onDrawCell(ctx, 100, 100, i === 0 ? 0.4 : 0.9, {
      index: i,
      cellSize: 48,
      glyphRadius: 21,
      cellData: result.cellData[i],
    });
  }
  return ctx;
}

// --- 1. Every glyph type compiles to something that draws ------------------

const TYPE_SPECS = {
  heatmap: { type: 'heatmap', channels: {}, scales: {}, palette: 'ember', legend: { enabled: true } },
  circle: {
    type: 'circle',
    channels: { size: { field: 'value', aggregate: 'mean' }, color: { field: 'value', aggregate: 'mean' } },
    scales: { size: 'sqrt', color: 'sequential' },
    palette: 'viridis',
    legend: { enabled: true },
  },
  bar: {
    type: 'bar',
    channels: { measures: [{ field: 'value', aggregate: 'mean' }, { field: 'other', aggregate: 'mean' }] },
    scales: {},
    palette: 'ocean',
    legend: { enabled: true },
  },
  pie: {
    type: 'pie',
    channels: { segments: { field: 'category', aggregate: 'count' } },
    scales: { color: 'categorical' },
    palette: 'categorical',
    legend: { enabled: true },
  },
  ring: {
    type: 'ring',
    channels: { segments: { field: 'category', aggregate: 'count' } },
    scales: { color: 'categorical' },
    palette: 'categorical',
    legend: { enabled: true },
  },
  custom: {
    type: 'custom',
    channels: {},
    scales: {},
    palette: 'slate',
    legend: { enabled: true },
    custom: {
      layout: 'cartesian-mini',
      domain: 'global',
      marks: [{ mark: 'line', data: { fields: HOUR_FIELDS, order: 'temporal' } }],
    },
  },
};

for (const [type, glyph] of Object.entries(TYPE_SPECS)) {
  const compiled = compileGlyph(makeSpec(glyph));
  if (type === 'heatmap') {
    // A heatmap is the cell fill: no glyph pass, but a working colour scale.
    assert.strictEqual(compiled.enableGlyphs, false, 'heatmap must not enable a glyph pass');
    assert.strictEqual(typeof compiled.colorScale, 'function');
    const [r, g, b, a] = compiled.colorScale(0.5);
    [r, g, b, a].forEach((c) => assert.ok(Number.isFinite(c), 'colorScale must return numbers'));
    assert.ok(a > 0 && a <= 255, 'alpha must be in 0..255');
  } else {
    assert.strictEqual(compiled.enableGlyphs, true, `${type} must enable glyphs`);
    assert.strictEqual(typeof compiled.onDrawCell, 'function', `${type} must compile a draw callback`);
    const ctx = renderAll(compiled);
    assert.ok(ctx.paintOps() > 0, `${type} glyph drew nothing`);
  }
  console.log(`  glyph type "${type}" compiles and draws OK`);
}

// --- 2. Every custom mark, in both layouts ---------------------------------

const MARKS = ['line', 'point', 'wedge', 'ring', 'band', 'interval', 'whisker'];
const LAYOUTS = ['cartesian-mini', 'radial'];

for (const layout of LAYOUTS) {
  for (const mark of MARKS) {
    const data = ['band', 'interval', 'whisker'].includes(mark)
      ? { field: 'value', lower: 'lower', upper: 'upper', aggregate: 'mean' }
      : { fields: HOUR_FIELDS, order: 'temporal', aggregate: 'mean' };
    const glyph = {
      type: 'custom',
      channels: {},
      scales: {},
      palette: 'ember',
      legend: { enabled: true },
      custom: { layout, domain: 'global', marks: [{ mark, data }] },
    };
    const ctx = renderAll(compileGlyph(makeSpec(glyph)));
    assert.ok(ctx.paintOps() > 0, `mark "${mark}" in layout "${layout}" drew nothing`);
  }
  console.log(`  all ${MARKS.length} marks draw in layout "${layout}" OK`);
}

// --- 3. Shared domains, not per-cell rescaling -----------------------------
// The failure this guards against is the one AGENTS.md section 5 names: a
// per-cell divisor makes two different values render identically.
{
  const compiled = compileGlyph(makeSpec(TYPE_SPECS.bar));
  const result = makeAggregationResult();
  compiled.onAggregate(result);
  const d = compiled._domains.measures[0];
  assert.ok(d.min < d.max, 'measure domain must span the observed range across cells');
  assert.strictEqual(d.min, 20, 'domain min must be the lowest per-cell value, not a per-cell min');
  assert.strictEqual(d.max, 80, 'domain max must be the highest per-cell value');
  console.log('  measure domains are shared across cells OK');
}

// --- 4. Local vs global custom domains differ ------------------------------
{
  const mk = (domain) => compileGlyph(makeSpec({
    type: 'custom', channels: {}, scales: {}, palette: 'ember', legend: { enabled: true },
    custom: { layout: 'cartesian-mini', domain, marks: [{ mark: 'line', data: { fields: HOUR_FIELDS } }] },
  }));
  const globalCtx = renderAll(mk('global'));
  const localCtx = renderAll(mk('local'));
  assert.ok(globalCtx.paintOps() > 0 && localCtx.paintOps() > 0, 'both domains must render');
  console.log('  custom.domain local and global both render OK');
}

// --- 5. Category cap folds the long tail -----------------------------------
{
  const glyph = {
    type: 'pie',
    channels: { segments: { field: 'category', aggregate: 'count' } },
    scales: { color: 'categorical' },
    palette: 'categorical',
    legend: { enabled: true },
    limits: { maxCategories: 2 },
  };
  const compiled = compileGlyph(makeSpec(glyph));
  const result = {
    cellData: [[
      { data: { category: 'a' } }, { data: { category: 'b' } },
      { data: { category: 'c' } }, { data: { category: 'd' } },
    ]],
    grid: [4],
  };
  compiled.onAggregate(result);
  const payload = compiled._payloads[0];
  assert.ok(payload.segKeys.length <= 3, 'cap plus one "other" bucket');
  assert.strictEqual(payload.segKeys[payload.segKeys.length - 1], 'other', 'tail must fold into "other"');
  const total = payload.segValues.reduce((s, v) => s + v, 0);
  assert.strictEqual(total, 4, 'folding must preserve the record total');
  console.log('  category cap folds the long tail OK');
}

// --- 6. Empty cells are never drawn ----------------------------------------
{
  const compiled = compileGlyph(makeSpec(TYPE_SPECS.circle));
  const result = makeAggregationResult();
  compiled.onAggregate(result);
  const ctx = recordingContext();
  compiled.onDrawCell(ctx, 10, 10, 0, { index: 2, cellSize: 48, glyphRadius: 21, cellData: [] });
  assert.strictEqual(ctx.paintOps(), 0, 'an empty cell must draw nothing');
  console.log('  empty cells draw nothing OK');
}

// --- 7. compileSpec emits both halves --------------------------------------
{
  const { layerOptions, legend } = compileSpec(makeSpec(TYPE_SPECS.pie));
  ['aggregationMode', 'cellSizePixels', 'normalizationFunction', 'aggregationFunction',
    'getPosition', 'getWeight'].forEach((key) => {
    assert.ok(key in layerOptions, `analytical half must still emit ${key}`);
  });
  ['colorScale', 'enableGlyphs', 'onDrawCell', 'onAggregate', 'glyphSize'].forEach((key) => {
    assert.ok(key in layerOptions, `visual half must emit ${key}`);
  });
  assert.ok(legend && legend.normalizationNote, 'a legend descriptor must be emitted');
  assert.match(legend.normalizationNote, /not comparable across views/,
    'max-local must be labelled as view-scoped');
  console.log('  compileSpec emits analytical and visual halves OK');
}

// --- 8. The opt-out still works --------------------------------------------
{
  const { layerOptions, legend } = compileSpec(makeSpec(TYPE_SPECS.pie), { glyph: false });
  assert.ok(!('onDrawCell' in layerOptions), 'glyph:false must not emit a draw callback');
  assert.ok(!('colorScale' in layerOptions), 'glyph:false must not emit a colour scale');
  assert.strictEqual(legend, null);
  console.log('  compileSpec({glyph:false}) emits the analytical half only OK');
}

// --- 9. An application onAggregate is composed, not clobbered --------------
{
  let seen = 0;
  const { layerOptions } = compileSpec(makeSpec(TYPE_SPECS.bar), { onAggregate: () => { seen += 1; } });
  layerOptions.onAggregate(makeAggregationResult());
  assert.strictEqual(seen, 1, 'the application callback must still fire');
  console.log('  application onAggregate is composed OK');
}

// --- 10. The render path never materialises semantic measures --------------
// AGENTS.md section 7: reading cell.measures per frame costs the full per-field
// summary for every cell, every frame. A compiled glyph must not do that.
{
  const compiled = compileGlyph(makeSpec(TYPE_SPECS.bar));
  const result = makeAggregationResult();
  compiled.onAggregate(result);
  let measuresRead = 0;
  const ctx = recordingContext();
  const cell = {
    index: 0, cellSize: 48, glyphRadius: 21, cellData: result.cellData[0],
    get measures() { measuresRead += 1; return { fields: {} }; },
  };
  compiled.onDrawCell(ctx, 100, 100, 0.5, cell);
  assert.strictEqual(measuresRead, 0, 'the draw path must not touch cell.measures');
  console.log('  draw path does not touch cell.measures OK');
}

console.log('Glyph compilation tests passed');
