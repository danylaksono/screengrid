// failures.js — the cartographic failure gallery.
//
// The atlas shows what the grammar can express. This shows what the *validator*
// catches: every cartographic warning rule in `validateSpec`, fired by a spec
// that earns it and then silenced by a spec that repairs it.
//
// Each case is a pair of specs that differ in as few keys as possible, so the
// repair is legible as a diff rather than as a rewrite. The warning text shown
// on each card is not stored here — it is computed as the set difference between
// validating the broken spec and validating the repaired one, so the page cannot
// claim a repair it did not actually make.
//
// `tests/unit/ValidationCoverage.test.js` parses `validateSpec.js` for its
// `warnings.push` sites and fails if any rule has no case here. A new guardrail
// therefore ships with the demonstration that it works.
//
// The rules encode known failure modes of gridded glyphmaps; the technique and
// its design space are due to Aidan Slingsby (IEEE VIS 2023,
// doi:10.1109/VIS54172.2023.00009).

import { SPEC_VERSION } from '../../src/grammar/validateSpec.js';
import { HOUR_FIELDS } from '../data/atlas.js';

/** A summary block that satisfies the reliability and heterogeneity rules. */
const SAFE_SUMMARIES = [
  { name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } },
];

/**
 * Build the failure gallery against a dataset profile.
 *
 * @param {Object} profile - from buildAtlasProfile()
 * @returns {Array<Object>} cases: {id, title, why, repair, visual, broken, repaired}
 */
export function buildFailureGallery(profile) {
  /**
   * A spec that passes every cartographic rule. Each case breaks exactly one
   * thing, so the delta between broken and repaired is the rule under test.
   */
  const base = ({ intent, screengrid, glyph, parameters, validation, version } = {}) => ({
    version: version || SPEC_VERSION,
    datasetProfile: profile,
    intent: { task: 'density', comparison: 'within-cell', ...intent },
    parameters: parameters || [],
    screengrid: {
      coordinateSystem: 'lonlat',
      coordinateFields: { x: 'lon', y: 'lat' },
      aggregationMode: 'screen-grid',
      aggregation: { function: 'count' },
      cellSizePixels: 52,
      derivedMeasures: [],
      summaries: SAFE_SUMMARIES,
      normalization: 'max-local',
      ...screengrid,
    },
    glyph: {
      type: 'heatmap',
      channels: {},
      scales: {},
      palette: 'ember',
      legend: { enabled: true },
      ...glyph,
    },
    interaction: { hover: true, click: false },
    ...(validation ? { validation } : {}),
  });

  const cases = [];
  const add = (c) => cases.push(c);

  // =========================================================================

  add({
    id: 'local-scaling-cross-cell',
    title: 'Local scaling under a cross-cell claim',
    // NOT SHOWN AS A PAIR YET. `max-global` currently falls back to the view
    // maximum unless the application supplies `normalizationContext.globalMax`,
    // which `compileSpec` does not — so the two panels would render identically
    // and the page would be claiming a repair the library does not yet make.
    // The warning delta below is real; the picture is pending that fix.
    visual: false,
    why: 'Under `max-local` every view rescales to its own maximum, so two cells holding the '
      + 'identical value render in different colours depending on what else is on screen — and '
      + 'the same cell changes colour as you pan. That is fine for finding a pattern, and fatal '
      + 'for the claim "this place has more than that one".',
    repair: 'Switch the normalization to `max-global`, which scales every cell against the '
      + 'dataset maximum. The colours stop moving, and the comparison the intent declares '
      + 'becomes one the map can actually support.',
    broken: base({
      intent: { task: 'density', comparison: 'across-cells' },
      screengrid: { normalization: 'max-local' },
    }),
    repaired: base({
      intent: { task: 'density', comparison: 'across-cells' },
      screengrid: { normalization: 'max-global' },
    }),
  });

  add({
    id: 'glyph-too-small',
    title: 'Glyphs below the legibility floor',
    visual: true,
    why: 'A glyph is a shape to be read, not a pixel to be seen. Below roughly 18px, shape and '
      + 'angle judgements collapse and readers start inventing structure that is not there. '
      + 'A 20px cell leaves about 16px of glyph.',
    repair: 'Raise `cellSizePixels`, which is the aggregation size — the glyphs grow *and* stay '
      + 'tiled without overlap, and each one summarises more records. Raising `glyphSize` '
      + 'instead would only make neighbours collide.',
    broken: base({
      glyph: { type: 'pie', channels: { segments: { field: 'sector', aggregate: 'count' } }, scales: { color: 'categorical' }, palette: 'categorical' },
      screengrid: { cellSizePixels: 20 },
    }),
    repaired: base({
      glyph: { type: 'pie', channels: { segments: { field: 'sector', aggregate: 'count' } }, scales: { color: 'categorical' }, palette: 'categorical' },
      screengrid: { cellSizePixels: 52 },
    }),
  });

  add({
    id: 'too-many-categories',
    title: 'More categories than angle can carry',
    visual: true,
    why: 'Eight slices means eight hues and eight angles competing in a 50px circle. Angle '
      + 'discrimination is poor to begin with; past about six categories the reader can no '
      + 'longer tell which slice is larger, and the glyph becomes decoration.',
    repair: 'Segment on a field with fewer categories — here `sector`, which has four. The '
      + 'alternative repair is to aggregate the long tail into an "other" bucket before it '
      + 'reaches the glyph (see the note below).',
    broken: base({
      intent: { task: 'composition', comparison: 'within-cell' },
      glyph: { type: 'pie', channels: { segments: { field: 'compass', aggregate: 'count' } }, scales: { color: 'categorical' }, palette: 'categorical' },
    }),
    repaired: base({
      intent: { task: 'composition', comparison: 'within-cell' },
      glyph: { type: 'pie', channels: { segments: { field: 'sector', aggregate: 'count' } }, scales: { color: 'categorical' }, palette: 'categorical' },
    }),
    limitation: 'This rule reads the dataset profile, not the compiled glyph. The compiler '
      + 'already folds anything past the declared cap into an "other" slice, so a spec that '
      + 'has implemented the recommended repair still trips the warning — which is why the '
      + 'atlas case "Eight categories, folded" carries a written justification rather than a fix.',
  });

  add({
    id: 'composition-without-segments',
    title: 'Composition intent with nothing to compose',
    visual: true,
    why: 'The intent says the reader will compare category mixes, but no categorical field is '
      + 'bound to the glyph. The map renders a total and answers a different question than the '
      + 'one it claims to answer — the most common way a map misleads without being wrong.',
    repair: 'Bind a categorical field to the `segments` channel so the glyph can actually carry '
      + 'the composition the intent promises.',
    broken: base({
      intent: { task: 'composition', comparison: 'within-cell' },
      glyph: { type: 'circle', channels: { size: { field: 'access', aggregate: 'mean' } }, scales: { size: 'sqrt' } },
    }),
    repaired: base({
      intent: { task: 'composition', comparison: 'within-cell' },
      glyph: { type: 'pie', channels: { segments: { field: 'land_use', aggregate: 'count' } }, scales: { color: 'categorical' }, palette: 'categorical' },
    }),
  });

  add({
    id: 'temporal-without-profile',
    title: 'A trajectory flattened to one number',
    visual: true,
    why: 'A temporal-trend intent asks how a place changes over the period. A single-value glyph '
      + 'can only show one moment or one average, so two cells with opposite trajectories — one '
      + 'rising all day, one falling — render identically.',
    repair: 'Use a custom glyph with a `line` mark over the ordered time fields, on a global '
      + 'domain so the trajectories are comparable between cells.',
    broken: base({
      intent: { task: 'temporal-trend', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'mean', field: 'hour_08' }, normalization: 'max-global' },
    }),
    repaired: base({
      intent: { task: 'temporal-trend', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'mean', field: 'hour_08' }, normalization: 'max-global' },
      glyph: {
        type: 'custom',
        palette: 'viridis',
        custom: {
          layout: 'cartesian-mini',
          domain: 'global',
          marks: [{ mark: 'line', data: { fields: HOUR_FIELDS, order: 'temporal', aggregate: 'mean' } }],
        },
      },
    }),
  });

  add({
    id: 'no-uncertainty-encoding',
    title: 'A mean with no spread',
    visual: true,
    why: 'An uncertainty intent drawn as a bare magnitude invites the reader to trust every cell '
      + 'equally. The cells you should trust least — sparse, widely-bounded ones — are exactly '
      + 'the ones that produce the most eye-catching extremes.',
    repair: 'Bind the `opacity` channel to the interval width, inverted: the wider the interval '
      + 'behind an estimate, the fainter it is drawn. A `band`, `interval` or `whisker` mark '
      + 'would satisfy the rule too, and shows the extent rather than implying it.',
    broken: base({
      intent: { task: 'uncertainty', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'mean', field: 'access' }, normalization: 'max-global' },
      glyph: { type: 'circle', channels: { size: { field: 'access', aggregate: 'mean' } }, scales: { size: 'sqrt' } },
    }),
    repaired: base({
      intent: { task: 'uncertainty', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'mean', field: 'access' }, normalization: 'max-global' },
      glyph: {
        type: 'circle',
        channels: {
          size: { field: 'access', aggregate: 'mean' },
          opacity: { field: 'access_ci_width', aggregate: 'mean' },
        },
        scales: { size: 'sqrt', opacity: 'inverse' },
      },
    }),
  });

  add({
    id: 'composite-under-local-scaling',
    title: 'A composite score rescaled per view',
    // NOT SHOWN AS A PAIR YET. `max-global` currently falls back to the view
    // maximum unless the application supplies `normalizationContext.globalMax`,
    // which `compileSpec` does not — so the two panels would render identically
    // and the page would be claiming a repair the library does not yet make.
    // The warning delta below is real; the picture is pending that fix.
    visual: false,
    why: 'A weighted composite has no natural units, so its only meaning is relative. Rescale it '
      + 'to whatever happens to be on screen and the score of a fixed place changes as you pan — '
      + 'the map appears to rank places while actually ranking the current viewport.',
    repair: 'Scale the composite globally. A score compared across cells has to be computed '
      + 'against a fixed denominator, not a moving one.',
    broken: base({
      intent: { task: 'suitability', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'suitability' },
        derivedMeasures: [{
          name: 'suitability', op: 'weighted-sum', aggregate: 'mean',
          terms: [
            { field: 'access', weight: 0.6, normalize: 'global' },
            { field: 'rent', weight: 0.4, normalize: 'global', invert: true },
          ],
        }],
        normalization: 'max-local',
      },
    }),
    repaired: base({
      intent: { task: 'suitability', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'suitability' },
        derivedMeasures: [{
          name: 'suitability', op: 'weighted-sum', aggregate: 'mean',
          terms: [
            { field: 'access', weight: 0.6, normalize: 'global' },
            { field: 'rent', weight: 0.4, normalize: 'global', invert: true },
          ],
        }],
        normalization: 'max-global',
      },
    }),
  });

  add({
    id: 'incommensurable-criteria',
    title: 'Adding pounds to micrograms',
    visual: true,
    why: 'A weighted sum over raw fields is arithmetic on incompatible units. Rent runs to '
      + 'thousands and PM2.5 to tens, so rent silently dominates the score whatever weights the '
      + 'author chose. The weights become decorative.',
    repair: 'Normalize each term to [0,1] against the dataset range before weighting, so the '
      + 'declared weights are the only thing deciding the balance.',
    broken: base({
      intent: { task: 'suitability', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'suitability' },
        derivedMeasures: [{
          name: 'suitability', op: 'weighted-sum', aggregate: 'mean',
          terms: [
            { field: 'rent', weight: 0.5, normalize: 'none', invert: true },
            { field: 'pm25', weight: 0.5, normalize: 'none', invert: true },
          ],
        }],
        normalization: 'max-global',
      },
    }),
    repaired: base({
      intent: { task: 'suitability', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'suitability' },
        derivedMeasures: [{
          name: 'suitability', op: 'weighted-sum', aggregate: 'mean',
          terms: [
            { field: 'rent', weight: 0.5, normalize: 'global', invert: true },
            { field: 'pm25', weight: 0.5, normalize: 'global', invert: true },
          ],
        }],
        normalization: 'max-global',
      },
    }),
  });

  add({
    id: 'cross-viewport-without-denominator',
    title: 'An absolute count compared across views',
    // The rate on the right is genuinely different from the count on the left,
    // so this pair is honest — but note that both panels are normalized by the
    // view maximum until max-global is implemented (see the two cases above).
    visual: true,
    view: { center: [-0.11, 51.47], zoom: 11.2 },
    viewNote: 'Zoomed in, where each screen cell covers much less ground than it did in the '
      + 'city-wide view. The counts on the left have changed meaning; the rate on the right '
      + 'has not.',
    why: 'A screen cell is a different amount of ground at every zoom. An absolute count in that '
      + 'cell therefore means something different in each view, so "this cell has 40" cannot be '
      + 'carried from one viewport to another. Only rates survive the trip.',
    repair: 'Express the measure as a ratio with a declared denominator. A share of households '
      + 'means the same thing whatever the cell happens to cover.',
    broken: base({
      intent: { task: 'density', comparison: 'across-viewports' },
      screengrid: { aggregation: { function: 'count' }, normalization: 'max-global' },
    }),
    repaired: base({
      intent: { task: 'density', comparison: 'across-viewports' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'access_per_household' },
        derivedMeasures: [{
          name: 'access_per_household', op: 'ratio',
          numerator: { field: 'access' },
          denominator: { type: 'field', field: 'households', description: 'Households in the cell' },
        }],
        normalization: 'max-global',
      },
    }),
  });

  add({
    id: 'no-low-count-threshold',
    title: 'Sparse cells drawn as confidently as dense ones',
    visual: true,
    why: 'A cell holding one record renders exactly like a cell holding two hundred. Readers '
      + 'weight visual prominence, not sample size, so the thinnest evidence on the map competes '
      + 'for attention with the strongest.',
    repair: 'Declare a low-count threshold on the count summary. The compiled glyph then outlines '
      + 'cells below it, so a sparse cell announces itself instead of hiding.',
    broken: base({
      screengrid: { summaries: [{ name: 'count', role: 'primary', op: 'count' }] },
      glyph: { type: 'circle', channels: { size: { field: 'access', aggregate: 'mean' } }, scales: { size: 'sqrt' } },
    }),
    repaired: base({
      screengrid: { summaries: SAFE_SUMMARIES },
      glyph: { type: 'circle', channels: { size: { field: 'access', aggregate: 'mean' } }, scales: { size: 'sqrt' } },
    }),
  });

  add({
    id: 'radial-without-wedge',
    title: 'A radial glyph with no wedge',
    visual: true,
    why: 'Radial layouts are usually compositions, and the validator suggests a wedge on that '
      + 'assumption. Adding one turns a bare radial profile into a readable division of a whole.',
    repair: 'Add a `wedge` mark over the same fields, so each measure occupies a sector of the '
      + 'circle and the glyph reads as a division of a whole rather than an outline.',
    broken: base({
      intent: { task: 'profile-comparison', comparison: 'across-cells' },
      screengrid: { normalization: 'max-global' },
      glyph: {
        type: 'custom',
        palette: 'ocean',
        custom: {
          layout: 'radial', domain: 'global',
          marks: [{ mark: 'line', data: { fields: ['price', 'access', 'rent', 'pm25'], aggregate: 'mean' } }],
        },
      },
    }),
    repaired: base({
      intent: { task: 'profile-comparison', comparison: 'across-cells' },
      screengrid: { normalization: 'max-global' },
      glyph: {
        type: 'custom',
        palette: 'ocean',
        custom: {
          layout: 'radial', domain: 'global',
          marks: [{ mark: 'wedge', data: { fields: ['price', 'access', 'rent', 'pm25'], aggregate: 'mean' } }],
        },
      },
    }),
    limitation: 'This is the one rule the atlas declines rather than obeys: a star plot and an '
      + 'uncertainty annulus are radial without being compositions, and wedges would imply the '
      + 'measures are shares of a whole. A warning is a prompt to think, not an order.',
  });

  add({
    id: 'categorical-field-sequential-scale',
    title: 'A categorical field on a sequential ramp',
    visual: true,
    why: 'A sequential ramp asserts an order. Put land-use categories on one and the map claims '
      + 'that retail sits between residential and office on some scale — a relationship the data '
      + 'does not have and the reader will nonetheless infer.',
    repair: 'Declare the colour scale categorical so each value gets a distinct hue with no '
      + 'implied ordering.',
    broken: base({
      glyph: {
        type: 'circle',
        channels: { size: { field: 'access', aggregate: 'mean' }, color: { field: 'land_use', aggregate: 'mode' } },
        scales: { size: 'sqrt', color: 'sequential' },
      },
    }),
    repaired: base({
      glyph: {
        type: 'circle',
        channels: { size: { field: 'access', aggregate: 'mean' }, color: { field: 'land_use', aggregate: 'mode' } },
        scales: { size: 'sqrt', color: 'categorical' },
        palette: 'categorical',
      },
    }),
  });

  add({
    id: 'pie-without-segments',
    title: 'A pie with nothing to divide',
    visual: true,
    why: 'A pie glyph with no segment field has one slice: a filled disc that encodes nothing '
      + 'the reader cannot get from the cell colour, while looking like a composition.',
    repair: 'Bind a categorical field to `segments`, or use a glyph type that suits a single value.',
    broken: base({ glyph: { type: 'pie', channels: {}, scales: {} } }),
    repaired: base({
      glyph: {
        type: 'pie',
        channels: { segments: { field: 'sector', aggregate: 'count' } },
        scales: { color: 'categorical' },
        palette: 'categorical',
      },
    }),
  });

  add({
    id: 'mean-without-spread',
    title: 'A mean with no heterogeneity check',
    visual: false,
    why: 'Two cells can share a mean and hold completely different distributions — one uniform, '
      + 'one bimodal. A mean summary on its own hides that, and the glyph gives the reader no '
      + 'way to tell the two apart.',
    repair: 'Pair the mean with a `variance` or `missingness` summary so within-cell '
      + 'heterogeneity is available to tooltips and to any glyph that wants to show it.',
    broken: base({
      screengrid: {
        aggregation: { function: 'mean', field: 'access' },
        summaries: [
          ...SAFE_SUMMARIES,
          { name: 'access_mean', role: 'profile', op: 'mean', field: 'access' },
        ],
      },
    }),
    repaired: base({
      screengrid: {
        aggregation: { function: 'mean', field: 'access' },
        summaries: [
          ...SAFE_SUMMARIES,
          { name: 'access_mean', role: 'profile', op: 'mean', field: 'access' },
          { name: 'access_variance', role: 'profile', op: 'variance', field: 'access' },
        ],
      },
    }),
  });

  add({
    id: 'custom-aggregation-opaque',
    title: 'Design logic the validator cannot see',
    visual: false,
    why: 'A registered custom function is legal and sometimes necessary, but the computation '
      + 'lives outside the spec. Nothing can check it, and the spec alone no longer reproduces '
      + 'the map — the guarantee drops from the document to the application.',
    repair: 'Express the computation declaratively when the grammar can carry it. A ratio with a '
      + 'stated denominator is checkable; an opaque function is not.',
    broken: base({
      screengrid: { aggregation: { function: 'custom', ref: 'medianPrice' } },
    }),
    repaired: base({
      screengrid: {
        aggregation: { function: 'derived', measure: 'price_per_household' },
        derivedMeasures: [{
          name: 'price_per_household', op: 'ratio',
          numerator: { field: 'price' },
          denominator: { type: 'field', field: 'households', description: 'Households in the cell' },
        }],
      },
    }),
  });

  add({
    id: 'stale-spec-version',
    title: 'A spec from another grammar version',
    visual: false,
    why: 'A saved spec is only reproducible if the grammar that reads it agrees with the grammar '
      + 'that wrote it. A major-version gap means a key may have changed meaning, so the map you '
      + 'get back is not necessarily the map that was saved.',
    repair: `Migrate the spec to the current format (${SPEC_VERSION}) and re-validate.`,
    broken: base({ version: '1.0.0' }),
    repaired: base({}),
  });

  return cases;
}

/**
 * The one rule with no repair: it is emitted for every screen-space spec by
 * construction, because it describes the technique rather than a mistake.
 */
export const STANDING_NOTE = 'Screen-space cells are viewport dependent; avoid presenting them as stable geographic districts.';
