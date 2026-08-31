// catalogue.js — the design-space atlas.
//
// One spec per case of the gridded-glyphmap design space Screengrid formalizes.
// This module is the single source of truth for two consumers:
//
//   - examples/atlas/index.html      renders every case as a small multiple
//   - tests/unit/DesignSpaceCoverage.test.js  asserts the catalogue exercises
//     every enum value declared in src/grammar/schemas/
//
// That second consumer is the point. "The grammar covers the design space" is
// otherwise a prose claim; here it is a test that fails when a case is missing,
// so the claim cannot rot as the grammar grows.
//
// The technique and its design space are due to Aidan Slingsby (IEEE VIS 2023,
// doi:10.1109/VIS54172.2023.00009). Screengrid's contribution is the executable
// formalization — this catalogue is the evidence for that claim.

import { SPEC_VERSION } from '../../src/grammar/validateSpec.js';
import { HOUR_FIELDS, DIRECTION_FIELDS } from '../data/atlas.js';

const PROFILE_MEASURES = ['price', 'access', 'rent', 'pm25'];

/**
 * Build every catalogue case against a dataset profile.
 *
 * @param {Object} profile - from buildAtlasProfile()
 * @returns {Array<Object>} cases: {id, title, group, question, spec, render, note}
 */
export function buildCatalogue(profile) {
  /** Fill the boilerplate so each case shows only what makes it distinct. */
  const spec = ({ intent, screengrid, glyph, parameters, interaction, validation }) => ({
    version: SPEC_VERSION,
    datasetProfile: profile,
    intent,
    parameters: parameters || [],
    screengrid: {
      coordinateSystem: 'lonlat',
      coordinateFields: { x: 'lon', y: 'lat' },
      aggregationMode: 'screen-grid',
      cellSizePixels: 52,
      derivedMeasures: [],
      summaries: [{ name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } }],
      normalization: 'max-local',
      ...screengrid,
    },
    glyph: { channels: {}, scales: {}, legend: { enabled: true }, ...glyph },
    interaction: { hover: true, click: true, ...interaction },
    ...(validation ? { validation } : {}),
  });

  const cases = [];
  const add = (c) => { cases.push(c); return c; };

  // =========================================================================
  // DENSITY — where is there more of something?
  // =========================================================================

  add({
    id: 'density-basic',
    group: 'density',
    title: 'Density, view-scaled',
    question: 'Where do records concentrate in this view?',
    note: 'The baseline case: count into square screen cells, colour by the view maximum. '
      + 'Comparable within the view only — the legend must say so.',
    spec: spec({
      intent: { task: 'density', comparison: 'within-cell', question: 'Where do records concentrate?' },
      screengrid: {
        aggregation: { function: 'count' },
        normalization: 'max-local',
        emptyCellPolicy: 'hide',
        summaries: [{
          name: 'count', role: 'primary', op: 'count',
          per: { type: 'none', description: 'An absolute count, expressed per nothing' },
          reliability: { warnBelowCount: 5 },
          comparability: { normalization: 'max-local', validAcrossZoom: false, requiresDenominator: false },
        }],
      },
      glyph: { type: 'heatmap', palette: 'ember', legend: { enabled: true, title: 'Records per cell' } },
      interaction: {
        hover: true,
        click: false,
        tooltip: {
          enabled: true,
          trigger: 'hover',
          fields: ['land_use'],
          calculations: [{ label: 'Records', op: 'count' }],
        },
      },
    }),
  });

  add({
    id: 'density-hex-global',
    group: 'density',
    title: 'Hex density, dataset-scaled',
    question: 'Which areas are dense relative to the whole dataset?',
    note: 'Hexagonal tessellation and global normalization: the same value renders the same '
      + 'colour in every view, which is what an across-cells claim requires.',
    spec: spec({
      intent: { task: 'density', comparison: 'across-cells' },
      screengrid: {
        aggregationMode: 'screen-hex',
        aggregation: { function: 'count' },
        normalization: 'max-global',
        summaries: [{
          name: 'count', role: 'primary', op: 'count',
          reliability: { warnBelowCount: 5 },
          comparability: { normalization: 'max-global', validAcrossZoom: true, requiresDenominator: false },
        }],
      },
      glyph: { type: 'heatmap', palette: 'viridis', legend: { enabled: true, title: 'Records (dataset scale)' } },
    }),
  });

  add({
    id: 'density-sized-circles',
    group: 'density',
    title: 'Sized circles, percentile-scaled',
    question: 'How does total property value vary across the city?',
    note: 'Sum aggregation with a percentile scale (robust to the heavy right tail of prices) '
      + 'and a square-root size channel, so area — not radius — reads as quantity.',
    spec: spec({
      intent: { task: 'density', comparison: 'across-zoom' },
      screengrid: {
        aggregation: { function: 'sum', field: 'price' },
        normalization: 'percentile',
        emptyCellPolicy: 'show-zero',
        summaries: [{
          name: 'total_value', role: 'primary', op: 'sum', field: 'price',
          reliability: { warnBelowCount: 5 },
          comparability: { normalization: 'percentile', validAcrossZoom: false, requiresDenominator: true },
        }],
      },
      glyph: {
        type: 'circle',
        channels: {
          size: { field: 'price', aggregate: 'sum' },
          color: { field: 'access', aggregate: 'mean' },
        },
        scales: { size: 'sqrt', color: 'sequential' },
        palette: 'ocean',
        legend: { enabled: true, title: 'Total value (percentile)' },
      },
    }),
  });

  add({
    id: 'density-rate-per-household',
    group: 'density',
    title: 'Rate with an explicit denominator',
    question: 'How much accessibility is there per household?',
    note: 'An across-viewports claim needs a rate: absolute screen-cell counts change with the '
      + 'view, shares do not. The denominator is declared, so the rate is falsifiable.',
    spec: spec({
      intent: { task: 'density', comparison: 'across-viewports' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'access_per_household' },
        derivedMeasures: [{
          name: 'access_per_household',
          op: 'ratio',
          numerator: { field: 'access' },
          denominator: { type: 'field', field: 'households', description: 'Households in the cell' },
          description: 'Accessibility per household',
        }],
        normalization: 'max-global',
        summaries: [
          {
            name: 'access_total', role: 'primary', op: 'sum', field: 'access',
            per: { type: 'field', field: 'households', description: 'Households in the cell' },
            reliability: { warnBelowCount: 5 },
          },
          { name: 'households', role: 'denominator', op: 'sum', field: 'households' },
        ],
      },
      glyph: { type: 'heatmap', palette: 'slate', legend: { enabled: true, title: 'Access per household' } },
    }),
  });

  // =========================================================================
  // COMPOSITION — how does the total break down?
  // =========================================================================

  add({
    id: 'composition-land-use',
    group: 'composition',
    title: 'Land-use mix',
    question: 'What is the mix of land uses in each part of the city?',
    note: 'Five categories, inside the six-category guardrail. Colours are fixed from the '
      + 'dataset profile, so a category keeps its colour across cells and across pans.',
    spec: spec({
      intent: { task: 'composition', comparison: 'within-cell' },
      screengrid: {
        aggregation: { function: 'count' },
        summaries: [
          {
            name: 'count', role: 'primary', op: 'count',
            per: { type: 'count', description: 'Share of the records in this cell' },
            reliability: { warnBelowCount: 5 },
          },
          { name: 'land_use_mix', role: 'composition', op: 'category-distribution', field: 'land_use' },
        ],
      },
      glyph: {
        type: 'pie',
        channels: { segments: { field: 'land_use', aggregate: 'count' } },
        scales: { color: 'categorical' },
        palette: 'categorical',
        legend: { enabled: true, title: 'Land use' },
      },
      interaction: {
        hover: true,
        click: true,
        tooltip: {
          enabled: true,
          trigger: 'click',
          fields: ['land_use', 'borough'],
          calculations: [
            { label: 'Records', op: 'count' },
            { label: 'Dominant use', op: 'mode', field: 'land_use' },
          ],
        },
      },
    }),
  });

  add({
    id: 'composition-sector-ring',
    group: 'composition',
    title: 'Sector mix as a ring',
    question: 'How does the activity mix differ between places?',
    note: 'A ring leaves the cell centre free, so a background density can be read through the '
      + 'composition. Four categories: well inside the angle-discrimination limit.',
    spec: spec({
      intent: { task: 'composition', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'count' }, normalization: 'max-global' },
      glyph: {
        type: 'ring',
        channels: { segments: { field: 'sector', aggregate: 'count' } },
        scales: { color: 'categorical' },
        palette: 'categorical',
        legend: { enabled: true, title: 'Sector' },
      },
    }),
  });

  add({
    id: 'composition-long-tail',
    group: 'composition',
    title: 'Eight categories, folded',
    question: 'Which compass sector dominates, without eight unreadable slices?',
    note: 'The compass field has eight categories — past the point where angle and hue '
      + 'discrimination collapse. The declared cap keeps the top six and folds the rest into '
      + '"other" rather than drawing a slice nobody can read.',
    spec: spec({
      intent: { task: 'composition', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'count' },
        normalization: 'max-global',
        summaries: [
          { name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } },
          { name: 'compass_modal', role: 'composition', op: 'mode', field: 'compass' },
        ],
      },
      glyph: {
        type: 'pie',
        channels: { segments: { field: 'compass', aggregate: 'count' } },
        scales: { color: 'categorical' },
        palette: 'categorical',
        legend: { enabled: true, title: 'Compass sector' },
        limits: { maxCategories: 6 },
      },
      validation: { cartographicChecks: true, maxCategories: 6 },
    }),
  });

  // =========================================================================
  // PROFILE-COMPARISON — do these places have the same signature?
  // =========================================================================

  add({
    id: 'profile-bars',
    group: 'profile-comparison',
    title: 'Four-measure bar profile',
    question: 'Do these neighbourhoods share a multivariate signature?',
    note: 'Each bar carries its own domain, shared across every cell. That is what makes two '
      + 'cells comparable; a per-cell divisor would render different values identically.',
    spec: spec({
      intent: { task: 'profile-comparison', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'mean', field: 'access' },
        normalization: 'max-global',
        summaries: [
          { name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } },
          { name: 'access_mean', role: 'profile', op: 'mean', field: 'access' },
          { name: 'access_variance', role: 'profile', op: 'variance', field: 'access' },
          { name: 'access_missing', role: 'profile', op: 'missingness', field: 'access' },
        ],
      },
      glyph: {
        type: 'bar',
        channels: {
          measures: [
            { field: 'price', aggregate: 'sum', label: 'Total value' },
            { field: 'access', aggregate: 'mean', label: 'Mean access' },
            { field: 'rent', aggregate: 'mean', label: 'Mean rent' },
            { field: 'pm25', aggregate: 'mean', label: 'Mean PM2.5' },
          ],
        },
        scales: {},
        palette: 'slate',
        legend: { enabled: true, title: 'Mean profile' },
      },
    }),
  });

  add({
    id: 'profile-radial-star',
    group: 'profile-comparison',
    title: 'Radial star profile',
    question: 'Which places have unusually shaped profiles?',
    note: 'The same four measures on a radial layout. Shape reads faster than height for '
      + '"is this place like that place", at the cost of exact value reading.',
    spec: spec({
      intent: { task: 'profile-comparison', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'mean', field: 'access' }, normalization: 'max-global' },
      glyph: {
        type: 'custom',
        palette: 'ocean',
        legend: { enabled: true, title: 'Profile shape' },
        custom: {
          layout: 'radial',
          domain: 'global',
          marks: [
            { mark: 'line', data: { fields: PROFILE_MEASURES, order: 'given', aggregate: 'mean' }, lineWidth: 1.5 },
            { mark: 'point', data: { fields: PROFILE_MEASURES, order: 'given', aggregate: 'mean' }, lineWidth: 1.5 },
          ],
        },
      },
    }),
  });

  add({
    id: 'profile-extremes',
    group: 'profile-comparison',
    title: 'Within-cell extremes',
    question: 'How wide is the spread of rents inside each cell?',
    note: 'Min and max of the same field, side by side: the gap between the bars is the '
      + 'within-cell heterogeneity a mean would have hidden.',
    spec: spec({
      intent: { task: 'profile-comparison', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'min', field: 'rent' },
        normalization: 'max-global',
        summaries: [
          { name: 'rent_low', role: 'profile', op: 'min', field: 'rent' },
          { name: 'rent_high', role: 'profile', op: 'max', field: 'rent' },
        ],
      },
      glyph: {
        type: 'bar',
        channels: {
          measures: [
            { field: 'rent', aggregate: 'min', label: 'Lowest rent' },
            { field: 'rent', aggregate: 'max', label: 'Highest rent' },
          ],
        },
        scales: {},
        palette: 'ember',
        legend: { enabled: true, title: 'Rent range' },
      },
    }),
  });

  // =========================================================================
  // TEMPORAL-TREND — what shape does the day take here?
  // =========================================================================

  add({
    id: 'temporal-global-domain',
    group: 'temporal-trend',
    title: 'Daily profile, one shared axis',
    question: 'Where is activity highest, and when?',
    note: 'Twelve ordered fields on a global domain: every sparkline shares a y-axis, so a tall '
      + 'line really is a busier place. This is the case where field order carries meaning, '
      + 'which is why the order is declared rather than inferred.',
    spec: spec({
      intent: { task: 'temporal-trend', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'mean', field: 'hour_08' },
        normalization: 'max-global',
        summaries: [
          { name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } },
          { name: 'activity_profile', role: 'profile', op: 'time-series', field: 'hour_08' },
        ],
      },
      glyph: {
        type: 'custom',
        palette: 'viridis',
        legend: { enabled: true, title: 'Activity by hour (shared axis)' },
        custom: {
          layout: 'cartesian-mini',
          domain: 'global',
          marks: [
            { mark: 'line', data: { fields: HOUR_FIELDS, order: 'temporal', aggregate: 'mean' }, lineWidth: 1.5 },
          ],
        },
      },
    }),
  });

  add({
    id: 'temporal-local-domain',
    group: 'temporal-trend',
    title: 'Daily profile, per-cell axis',
    question: 'What shape does the day take here, regardless of volume?',
    note: 'The same data on a per-cell domain. Shape becomes legible everywhere — and magnitude '
      + 'becomes unreadable. Both are legitimate; only one can be true at a time, so the legend '
      + 'must name which. Compare against the case above.',
    spec: spec({
      intent: { task: 'temporal-trend', comparison: 'within-cell' },
      screengrid: { aggregation: { function: 'mean', field: 'hour_08' } },
      glyph: {
        type: 'custom',
        palette: 'viridis',
        legend: { enabled: true, title: 'Activity shape (per-cell axis)' },
        custom: {
          layout: 'cartesian-mini',
          domain: 'local',
          marks: [
            { mark: 'line', data: { fields: HOUR_FIELDS, order: 'given', aggregate: 'mean' }, lineWidth: 1.5 },
            { mark: 'point', data: { fields: HOUR_FIELDS, order: 'given', aggregate: 'mean' }, lineWidth: 1 },
          ],
        },
      },
    }),
  });

  // =========================================================================
  // UNCERTAINTY — how confident is this cell?
  // =========================================================================

  add({
    id: 'uncertainty-band',
    group: 'uncertainty',
    title: 'Accessibility with a confidence band',
    question: 'How confident is the accessibility estimate here?',
    note: 'A band draws the lower..upper extent behind the central value. Outer areas are '
      + 'measured less confidently in this dataset, so their bands are visibly wider.',
    spec: spec({
      intent: { task: 'uncertainty', comparison: 'within-cell' },
      screengrid: {
        aggregation: { function: 'mean', field: 'access' },
        normalization: 'max-global',
        summaries: [
          { name: 'access_mean', role: 'uncertainty', op: 'mean', field: 'access' },
          { name: 'access_variance', role: 'uncertainty', op: 'variance', field: 'access' },
        ],
      },
      glyph: {
        type: 'custom',
        palette: 'ember',
        legend: { enabled: true, title: 'Access (mean and range)' },
        custom: {
          layout: 'cartesian-mini',
          domain: 'global',
          marks: [{
            mark: 'band',
            data: { field: 'access', lower: 'access_lower', upper: 'access_upper', aggregate: 'mean' },
            opacity: 0.45,
          }],
        },
      },
    }),
  });

  add({
    id: 'uncertainty-interval-whisker',
    group: 'uncertainty',
    title: 'Interval and whisker',
    question: 'Which estimates overlap, and which are genuinely different?',
    note: 'Interval and whisker marks together, with opacity bound inversely to sample count: '
      + 'the cells you should trust least are the faintest, so they stop competing for '
      + 'attention with the cells you can trust.',
    spec: spec({
      intent: { task: 'uncertainty', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'mean', field: 'access' }, normalization: 'max-global' },
      glyph: {
        type: 'custom',
        channels: { opacity: { field: null, aggregate: 'count' } },
        scales: { opacity: 'inverse' },
        palette: 'ember',
        legend: { enabled: true, title: 'Access with interval' },
        custom: {
          layout: 'cartesian-mini',
          domain: 'global',
          marks: [
            { mark: 'interval', data: { field: 'access', lower: 'access_lower', upper: 'access_upper', aggregate: 'mean' } },
            { mark: 'whisker', data: { field: 'access', lower: 'access_lower', upper: 'access_upper', aggregate: 'mean' }, lineWidth: 1 },
          ],
        },
      },
    }),
  });

  add({
    id: 'uncertainty-radial-annulus',
    group: 'uncertainty',
    title: 'Radial uncertainty annulus',
    question: 'How wide is the estimate, read as an area rather than a bar?',
    note: 'The same triple on a radial layout: the annulus between the lower and upper radii is '
      + 'the uncertainty, the solid disc is the estimate. Opacity rises with sample size.',
    spec: spec({
      intent: { task: 'uncertainty', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'mean', field: 'access' },
        normalization: 'max-global',
        summaries: [{
          name: 'sample_size', role: 'reliability', op: 'count',
          reliability: { warnBelowCount: 5, warnOnMissingness: true, warnOnHeterogeneity: true },
        }],
        semanticModel: {
          enabled: true,
          includeRawRefs: false,
          reliability: { lowCountThreshold: 5, heterogeneityWarning: true, missingnessWarning: true },
        },
      },
      glyph: {
        type: 'custom',
        channels: { opacity: { field: null, aggregate: 'count' } },
        scales: { opacity: 'linear' },
        palette: 'ocean',
        legend: { enabled: true, title: 'Access (radial interval)' },
        custom: {
          layout: 'radial',
          domain: 'global',
          marks: [{
            mark: 'band',
            data: { field: 'access', lower: 'access_lower', upper: 'access_upper', aggregate: 'mean' },
          }],
        },
      },
    }),
  });

  // =========================================================================
  // ANOMALY — what departs from expectation?
  // =========================================================================

  add({
    id: 'anomaly-difference',
    group: 'anomaly',
    title: 'Access against a baseline',
    question: 'Where is accessibility better or worse than the city-wide expectation?',
    note: 'A declared difference measure, z-score scaled so the middle of the ramp is "as '
      + 'expected". The reliability threshold matters more here than anywhere: a sparse cell '
      + 'will happily produce a large residual out of noise.',
    spec: spec({
      intent: { task: 'anomaly', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'access_residual' },
        derivedMeasures: [{
          name: 'access_residual',
          op: 'difference',
          aggregate: 'mean',
          terms: [
            { field: 'access', normalize: 'global' },
            { field: 'access_baseline', normalize: 'global' },
          ],
          description: 'Observed accessibility minus the modelled baseline',
        }],
        normalization: 'z-score',
        summaries: [
          {
            name: 'count', role: 'primary', op: 'count',
            reliability: { warnBelowCount: 8 },
            comparability: { normalization: 'z-score', validAcrossZoom: false, requiresDenominator: false },
          },
          { name: 'access_mean', role: 'profile', op: 'mean', field: 'access' },
          { name: 'access_variance', role: 'profile', op: 'variance', field: 'access' },
        ],
      },
      glyph: {
        type: 'circle',
        channels: { size: { field: 'access', aggregate: 'mean' } },
        scales: { size: 'linear', color: 'sequential' },
        palette: 'ember',
        legend: { enabled: true, title: 'Residual (z-score)' },
      },
    }),
  });

  add({
    id: 'anomaly-dominant-category',
    group: 'anomaly',
    title: 'Residual, coloured by dominant sector',
    question: 'Do the anomalies cluster in one kind of place?',
    note: 'Size carries the magnitude, hue carries the modal category. The mode is a per-cell '
      + 'summary in its own right — a cell whose mode flips under a small pan is telling you '
      + 'the cell has no dominant sector at all.',
    spec: spec({
      intent: { task: 'anomaly', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'mean', field: 'access' },
        normalization: 'z-score',
      },
      glyph: {
        type: 'circle',
        channels: {
          size: { field: 'access', aggregate: 'mean' },
          color: { field: 'sector', aggregate: 'mode' },
        },
        scales: { size: 'sqrt', color: 'categorical' },
        palette: 'categorical',
        legend: { enabled: true, title: 'Dominant sector' },
      },
    }),
  });

  // =========================================================================
  // FLOW-BALANCE — which way does this place lean?
  // =========================================================================

  add({
    id: 'flow-directional-wedges',
    group: 'flow-balance',
    title: 'Directional balance',
    question: 'Which way do flows from this cell tend to run?',
    note: 'Four wedges by compass axis, with a ring for the total. These connect analytical '
      + 'bins, not places: the wedges summarise a tendency and imply no route. Sum aggregation, '
      + 'because direction volumes add.',
    spec: spec({
      intent: { task: 'flow-balance', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'sum', field: 'flow_n' }, normalization: 'max-global' },
      glyph: {
        type: 'custom',
        palette: 'ocean',
        legend: { enabled: true, title: 'Directional volume' },
        custom: {
          layout: 'radial',
          domain: 'global',
          marks: [
            { mark: 'wedge', data: { fields: DIRECTION_FIELDS, order: 'given', aggregate: 'sum' } },
            { mark: 'ring', data: { field: 'flow_n', aggregate: 'max' }, lineWidth: 1 },
          ],
        },
      },
    }),
  });

  add({
    id: 'flow-share-external',
    group: 'flow-balance',
    title: 'Share of a regional total',
    question: 'What share of the region’s northbound flow starts here?',
    note: 'An external denominator: a fixed regional total that does not change with the '
      + 'viewport. That is what lets the same cell mean the same thing at two zoom levels.',
    spec: spec({
      intent: { task: 'flow-balance', comparison: 'across-viewports' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'northbound_share' },
        derivedMeasures: [{
          name: 'northbound_share',
          op: 'ratio',
          aggregate: 'sum',
          numerator: { field: 'flow_n' },
          denominator: { type: 'external', value: 750000, description: 'Regional northbound total' },
        }],
        normalization: 'max-global',
        summaries: [{
          name: 'northbound', role: 'primary', op: 'sum', field: 'flow_n',
          per: { type: 'external', value: 750000, description: 'Regional northbound total' },
        }],
      },
      glyph: { type: 'heatmap', palette: 'slate', legend: { enabled: true, title: 'Share of regional flow' } },
    }),
  });

  add({
    id: 'flow-per-record',
    group: 'flow-balance',
    title: 'Mean flow per record',
    question: 'Is the flow here concentrated in a few records or spread across many?',
    note: 'A ratio whose denominator is the record count: the simplest honest per-unit measure, '
      + 'and the one that separates "a lot of flow" from "a lot of records".',
    spec: spec({
      intent: { task: 'flow-balance', comparison: 'across-cells' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'flow_per_record' },
        derivedMeasures: [{
          name: 'flow_per_record',
          op: 'ratio',
          numerator: { field: 'flow_e', normalize: 'none' },
          denominator: { type: 'count', description: 'Records in the cell' },
        }],
        normalization: 'max-global',
      },
      glyph: {
        type: 'circle',
        channels: { size: { field: 'flow_e', aggregate: 'mean' } },
        scales: { size: 'sqrt', color: 'sequential' },
        palette: 'viridis',
        legend: { enabled: true, title: 'Flow per record' },
      },
    }),
  });

  // =========================================================================
  // SUITABILITY — where should this go?
  // =========================================================================

  add({
    id: 'suitability-mcda',
    group: 'suitability',
    title: 'Weighted-sum suitability (MCDA)',
    question: 'Where does this site best satisfy three weighted criteria?',
    note: 'Three criteria in three different units, each normalized per term before weighting — '
      + 'without that, the weighted sum adds pounds to micrograms. Weights are declared '
      + 'parameters with domains, so a reader can move them and the spec still describes '
      + 'what they saw.',
    spec: spec({
      intent: { task: 'suitability', comparison: 'across-cells' },
      parameters: [
        { name: 'w_cost', label: 'Rent (lower is better)', domain: [0, 1], default: 0.4, step: 0.05 },
        { name: 'w_access', label: 'Accessibility', domain: [0, 1], default: 0.4, step: 0.05 },
        { name: 'w_air', label: 'Air quality (lower PM2.5 is better)', domain: [0, 1], default: 0.2, step: 0.05 },
      ],
      screengrid: {
        aggregation: { function: 'derived', measure: 'suitability' },
        derivedMeasures: [{
          name: 'suitability',
          op: 'weighted-sum',
          aggregate: 'mean',
          terms: [
            { field: 'rent', weight: { param: 'w_cost' }, normalize: 'global', invert: true },
            { field: 'access', weight: { param: 'w_access' }, normalize: 'global' },
            { field: 'pm25', weight: { param: 'w_air' }, normalize: 'global', invert: true },
          ],
        }],
        normalization: 'max-global',
      },
      glyph: {
        type: 'circle',
        channels: {
          size: { field: 'access', aggregate: 'mean' },
          color: { field: 'rent', aggregate: 'mean' },
        },
        scales: { size: 'linear', color: 'sequential' },
        palette: 'viridis',
        legend: { enabled: true, title: 'Suitability score' },
      },
    }),
  });

  add({
    id: 'suitability-per-area',
    group: 'suitability',
    title: 'Per-area intensity',
    question: 'How intense is demand per unit of screen area?',
    note: 'An area denominator. In screen space the cell area is constant per aggregation, so '
      + 'this reduces to an intensity — which is exactly why the denominator has to be '
      + 'declared rather than assumed.',
    spec: spec({
      intent: { task: 'suitability', comparison: 'within-cell' },
      screengrid: {
        aggregation: { function: 'derived', measure: 'demand_intensity' },
        derivedMeasures: [{
          name: 'demand_intensity',
          op: 'ratio',
          aggregate: 'sum',
          numerator: { field: 'households' },
          denominator: { type: 'area', description: 'Screen-cell area (constant per aggregation)' },
        }],
        normalization: 'max-local',
        summaries: [{
          name: 'households_total', role: 'primary', op: 'sum', field: 'households',
          per: { type: 'area', description: 'Screen-cell area (constant per aggregation)' },
        }],
      },
      glyph: { type: 'heatmap', palette: 'ember', legend: { enabled: true, title: 'Demand intensity' } },
    }),
  });

  // =========================================================================
  // EDGES — the escape hatch, and the cases that are easy to get wrong
  // =========================================================================

  add({
    id: 'edge-custom-aggregation',
    group: 'edges',
    title: 'Custom aggregation (escape hatch)',
    question: 'What if the computation cannot be declared?',
    note: 'A registered custom function. This is legal and sometimes necessary, but the spec '
      + 'drops to checkability "partial": the validator cannot see the design logic, so the '
      + 'reproducibility guarantee weakens. The atlas includes it to show the boundary of the '
      + 'grammar, not to recommend it.',
    customFunctions: {
      medianPrice: (records) => {
        const values = [];
        for (const r of records) {
          const v = Number(r?.data?.price);
          if (Number.isFinite(v)) values.push(v);
        }
        if (values.length === 0) return 0;
        values.sort((a, b) => a - b);
        const mid = values.length >> 1;
        return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
      },
    },
    spec: spec({
      intent: { task: 'density', comparison: 'within-cell' },
      screengrid: {
        aggregation: { function: 'custom', ref: 'medianPrice' },
        normalization: 'max-local',
        summaries: [
          { name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } },
          {
            name: 'source_records', role: 'provenance', op: 'count',
            description: 'Raw record references retained so a custom result can be audited',
          },
        ],
      },
      glyph: { type: 'heatmap', palette: 'slate', legend: { enabled: true, title: 'Median price (custom)' } },
    }),
  });

  add({
    id: 'edge-distinct-count',
    group: 'edges',
    title: 'Distinct-count channel',
    question: 'How mixed is this cell, rather than how full?',
    note: 'Size by the number of distinct boroughs present. A cell with many records from one '
      + 'borough and a cell straddling four read very differently — and a count alone cannot '
      + 'tell them apart.',
    spec: spec({
      intent: { task: 'density', comparison: 'within-cell' },
      screengrid: {
        aggregation: { function: 'count' },
        normalization: 'max-local',
        summaries: [
          { name: 'count', role: 'primary', op: 'count', reliability: { warnBelowCount: 5 } },
          { name: 'borough_mix', role: 'composition', op: 'distinct', field: 'borough' },
        ],
      },
      glyph: {
        type: 'circle',
        channels: {
          size: { field: 'borough', aggregate: 'distinct' },
          opacity: { field: 'land_use', aggregate: 'distinct' },
        },
        scales: { size: 'linear', color: 'sequential', opacity: 'linear' },
        palette: 'ocean',
        legend: { enabled: true, title: 'Distinct boroughs' },
      },
    }),
  });

  add({
    id: 'edge-max-lexical',
    group: 'edges',
    title: 'Max aggregation, lexical ordering',
    question: 'What is the worst air quality reading in each cell?',
    note: 'Max aggregation surfaces the extreme rather than the typical, which is the right '
      + 'summary for a threshold question. The marks order their fields lexically — the '
      + 'fallback when field names carry no temporal sequence.',
    spec: spec({
      intent: { task: 'density', comparison: 'across-cells' },
      screengrid: { aggregation: { function: 'max', field: 'pm25' }, normalization: 'max-global' },
      glyph: {
        type: 'custom',
        channels: {
          size: { field: 'pm25', aggregate: 'max' },
          opacity: { field: 'pm25', aggregate: 'min' },
        },
        scales: { size: 'linear', opacity: 'linear' },
        palette: 'ember',
        legend: { enabled: true, title: 'Worst PM2.5' },
        custom: {
          layout: 'cartesian-mini',
          domain: 'global',
          marks: [
            { mark: 'point', data: { fields: PROFILE_MEASURES, order: 'lexical', aggregate: 'max' }, lineWidth: 1.5 },
            { mark: 'line', data: { fields: PROFILE_MEASURES, order: 'lexical', aggregate: 'min' }, lineWidth: 1 },
          ],
        },
      },
      interaction: {
        hover: true,
        click: false,
        tooltip: {
          enabled: true,
          trigger: 'hover',
          fields: ['pm25'],
          calculations: [
            { label: 'Worst', op: 'max', field: 'pm25' },
            { label: 'Best', op: 'min', field: 'pm25' },
            { label: 'Mean', op: 'mean', field: 'pm25' },
            { label: 'Total rent', op: 'sum', field: 'rent' },
            { label: 'Boroughs', op: 'distinct', field: 'borough' },
          ],
        },
      },
    }),
  });

  add({
    id: 'edge-projected-coordinates',
    group: 'edges',
    title: 'Projected coordinates (xy)',
    question: 'Can the grammar describe data that is not in lon/lat?',
    render: false,
    note: 'Validates and compiles against projected coordinates. It is not rendered in the '
      + 'atlas because the atlas basemap is geographic — showing it would mean silently '
      + 'reprojecting, which is exactly the kind of hidden step the grammar exists to prevent.',
    spec: spec({
      intent: { task: 'density', comparison: 'within-cell' },
      screengrid: {
        coordinateSystem: 'xy',
        coordinateFields: { x: 'lon', y: 'lat' },
        aggregation: { function: 'count' },
        normalization: 'max-local',
      },
      glyph: { type: 'heatmap', palette: 'slate', legend: { enabled: true, title: 'Projected density' } },
    }),
  });

  return cases;
}

/** Group ids in the order the atlas presents them. */
export const GROUP_ORDER = [
  'density', 'composition', 'profile-comparison', 'temporal-trend',
  'uncertainty', 'anomaly', 'flow-balance', 'suitability', 'edges',
];

/** Human-readable group labels. */
export const GROUP_LABELS = {
  density: 'Density',
  composition: 'Composition',
  'profile-comparison': 'Profile comparison',
  'temporal-trend': 'Temporal trend',
  uncertainty: 'Uncertainty',
  anomaly: 'Anomaly',
  'flow-balance': 'Flow balance',
  suitability: 'Suitability',
  edges: 'Edges and escape hatches',
};
