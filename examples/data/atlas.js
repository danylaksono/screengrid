// atlas.js — the synthetic dataset behind the design-space atlas.
//
// The atlas has to exercise EVERY case the grammar can express, so it needs a
// dataset that carries every field shape the grammar can reference: ordered
// temporal fields, uncertainty bounds, a baseline to difference against, an
// explicit denominator, directional volumes, and categoricals both inside and
// outside the six-category guardrail.
//
// Rather than fatten `london.js` (whose generator also feeds the 500k
// stress test, where 20 extra fields per record would be a real memory cost),
// this module wraps it and enriches a copy. Everything stays seeded and
// deterministic: the same (count, seed) always produces the same atlas.
//
// Data policy (AGENTS.md section 9): synthetic only. The geography is a public
// bounding box and approximate town-centre coordinates; every attribute is
// generated.

import { generateLondonPoints, buildLondonProfile, LONDON_BBOX, LONDON_CENTER } from './london.js';

export { LONDON_BBOX, LONDON_CENTER };

/** Two-hourly activity bins. Ordered fields: a temporal profile per cell. */
export const HOUR_FIELDS = [
  'hour_00', 'hour_02', 'hour_04', 'hour_06', 'hour_08', 'hour_10',
  'hour_12', 'hour_14', 'hour_16', 'hour_18', 'hour_20', 'hour_22',
];

/** Directional flow volumes, for radial flow-balance wedges. */
export const DIRECTION_FIELDS = ['flow_n', 'flow_e', 'flow_s', 'flow_w'];

/** Four-way sector label: a categorical that fits inside the guardrail. */
export const SECTORS = ['housing', 'commerce', 'civic', 'transport'];

/** Eight-way compass label: a categorical that deliberately exceeds it. */
export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Seeded PRNG (mulberry32), matching london.js so the atlas is reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (x, d = 2) => Number(x.toFixed(d));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * Generate the atlas dataset: London points enriched with the extra field
 * shapes the full design space needs.
 *
 * @param {Object} [opts]
 * @param {number} [opts.count=12000] - record count
 * @param {number} [opts.seed=7] - PRNG seed (same seed => same dataset)
 * @returns {Array<Object>} plain records
 */
export function generateAtlasPoints({ count = 12000, seed = 7 } = {}) {
  const records = generateLondonPoints({ count, seed });
  const rand = rng(seed ^ 0x5f3759df);

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    // `access` (0..100, PTAL-like) is the spine: centrality drives the daily
    // activity profile, the uncertainty width, and the directional balance.
    const centrality = clamp(r.access / 100, 0, 1);

    // --- Ordered temporal profile -----------------------------------------
    // Central cells peak twice (commuter AM/PM); outer cells peak once, midday.
    for (let h = 0; h < HOUR_FIELDS.length; h++) {
      const hour = h * 2;
      const commuter = Math.exp(-((hour - 8) ** 2) / 6) + Math.exp(-((hour - 18) ** 2) / 6);
      const midday = Math.exp(-((hour - 13) ** 2) / 28);
      const shape = centrality * commuter + (1 - centrality) * midday;
      r[HOUR_FIELDS[h]] = round(clamp(shape * 60 + rand() * 6, 0, 100), 1);
    }

    // --- Uncertainty bounds ------------------------------------------------
    // Sparse outer areas are measured less confidently: the interval widens as
    // centrality falls, so an uncertainty glyph has something honest to show.
    const halfWidth = 4 + (1 - centrality) * 18 + rand() * 3;
    r.access_lower = round(clamp(r.access - halfWidth, 0, 100), 1);
    r.access_upper = round(clamp(r.access + halfWidth, 0, 100), 1);
    // The interval width as a field in its own right. A glyph that encodes a
    // magnitude without it invites the reader to trust every cell equally.
    r.access_ci_width = round(r.access_upper - r.access_lower, 1);

    // --- Baseline, for anomaly (difference) --------------------------------
    // A smooth city-wide expectation; the residual is the anomaly signal.
    r.access_baseline = round(clamp(30 + centrality * 45 + (rand() - 0.5) * 6, 0, 100), 1);

    // --- Explicit denominator ---------------------------------------------
    r.households = Math.round(clamp(40 + centrality * 260 + rand() * 60, 10, 400));

    // --- Directional volumes ----------------------------------------------
    // Net inflow toward the centre: the compass bearing from this point to the
    // city centre gets the largest share.
    const dx = LONDON_CENTER[0] - r.lon;
    const dy = LONDON_CENTER[1] - r.lat;
    const toCentre = Math.atan2(dx, dy); // 0 = north, clockwise
    for (let d = 0; d < DIRECTION_FIELDS.length; d++) {
      const axis = (d * Math.PI) / 2; // N, E, S, W
      const alignment = Math.max(0, Math.cos(axis - toCentre));
      r[DIRECTION_FIELDS[d]] = round(20 + alignment * 70 * centrality + rand() * 10, 1);
    }

    // --- Categoricals ------------------------------------------------------
    r.sector = SECTORS[Math.floor(rand() * SECTORS.length)];
    // Compass bearing toward the centre, but only as a tendency: a third of
    // records head somewhere else. A purely deterministic bearing would make
    // every cell single-valued, and a composition glyph over a single-valued
    // field is a filled circle — it would demonstrate nothing.
    const bearingIndex = Math.round(((toCentre + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    r.compass = rand() < 0.34
      ? COMPASS[Math.floor(rand() * COMPASS.length)]
      : COMPASS[bearingIndex];
  }

  return records;
}

/** Tally a categorical field into the profile's {value, count} shape. */
function categoriesOf(records, field) {
  const counts = new Map();
  for (const r of records) {
    const v = r[field];
    if (v === null || v === undefined || v === '') continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

/** Min/max/mean for a numeric field, in one pass (no spread over the array). */
function statsOf(records, field) {
  let min = Infinity;
  let max = -Infinity;
  let total = 0;
  let n = 0;
  let missing = 0;
  for (const r of records) {
    const v = Number(r[field]);
    if (!Number.isFinite(v)) { missing += 1; continue; }
    if (v < min) min = v;
    if (v > max) max = v;
    total += v;
    n += 1;
  }
  return {
    min: n ? min : null,
    max: n ? max : null,
    mean: n ? total / n : null,
    missingCount: missing,
  };
}

/**
 * Build the datasetProfile the atlas specs validate and compile against.
 *
 * Extends `buildLondonProfile` with the atlas fields, and — unlike the base
 * profile — includes `categories` for every categorical. The glyph compiler
 * uses that list to fix category order and colour across cells, frames and
 * viewports; without it, colours would be assigned in first-seen order and a
 * category could change colour between pans.
 *
 * @param {Array<Object>} records
 * @returns {Object} datasetProfile
 */
export function buildAtlasProfile(records) {
  const base = buildLondonProfile(records);
  const numericExtras = [
    ...HOUR_FIELDS,
    ...DIRECTION_FIELDS,
    'access_lower', 'access_upper', 'access_ci_width', 'access_baseline', 'households',
  ];

  const fields = base.fields.map((f) => {
    const out = { missingCount: 0, ...f };
    if (f.type === 'string') out.categories = categoriesOf(records, f.name);
    return out;
  });

  for (const name of numericExtras) {
    const s = statsOf(records, name);
    fields.push({ name, type: 'number', missingCount: s.missingCount, min: s.min, max: s.max, mean: s.mean });
  }

  for (const name of ['sector', 'compass']) {
    const categories = categoriesOf(records, name);
    fields.push({
      name,
      type: 'string',
      missingCount: 0,
      distinctCount: categories.length,
      categories,
    });
  }

  return {
    ...base,
    sourceName: 'synthetic-london-atlas',
    sourceType: 'csv',
    fields,
    coordinateCandidates: [
      { x: 'lon', y: 'lat', coordinateSystem: 'lonlat', confidence: 0.95, reason: 'seeded synthetic lon/lat' },
    ],
  };
}
