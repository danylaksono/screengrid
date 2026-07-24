// london.js — synthetic Greater London point generator for the Screengrid
// grammar examples and the stress-test harness. No real/proprietary data: only
// public geography (a bounding box and approximate town-centre coordinates)
// drives a seeded PRNG. Deterministic for a given (count, seed), so every
// example renders the same map on every run.
//
// Works unchanged in Node (the smoke test) and the browser (the examples):
// it is a dependency-free ES module. `generateLondonPoints` returns plain
// records; `buildLondonProfile` turns a sample of them into the datasetProfile
// the grammar validates and compiles against (field min/max included, which
// global term normalization in derived measures needs).

export const LONDON_CENTER = [-0.1276, 51.5074];
// Greater London-ish bounding box [west, south, east, north].
export const LONDON_BBOX = [-0.51, 51.28, 0.33, 51.69];

// Approximate town centres (public geography). `pull` biases land use and price
// (1 = central/expensive/office-heavy, 0 = outer/residential/greener).
const CENTRES = [
  { name: 'City & Westminster', lon: -0.101, lat: 51.512, spread: 0.020, weight: 26, pull: 1.00 },
  { name: 'Canary Wharf',       lon: -0.019, lat: 51.505, spread: 0.012, weight: 10, pull: 0.95 },
  { name: 'Stratford',          lon: -0.004, lat: 51.541, spread: 0.018, weight: 8,  pull: 0.70 },
  { name: 'Camden',             lon: -0.143, lat: 51.539, spread: 0.016, weight: 9,  pull: 0.78 },
  { name: 'Hammersmith',        lon: -0.224, lat: 51.492, spread: 0.018, weight: 7,  pull: 0.72 },
  { name: 'Croydon',            lon: -0.099, lat: 51.376, spread: 0.022, weight: 7,  pull: 0.45 },
  { name: 'Wembley',            lon: -0.283, lat: 51.556, spread: 0.020, weight: 6,  pull: 0.42 },
  { name: 'Ealing',             lon: -0.303, lat: 51.513, spread: 0.020, weight: 6,  pull: 0.50 },
  { name: 'Richmond',           lon: -0.301, lat: 51.461, spread: 0.020, weight: 5,  pull: 0.55 },
  { name: 'Greenwich',          lon: 0.010,  lat: 51.483, spread: 0.018, weight: 6,  pull: 0.60 },
];

const LAND_USE = ['residential', 'retail', 'office', 'greenspace', 'industrial'];

// --- seeded PRNG (mulberry32) + a gaussian, matching generate-synthetic-data.mjs ---
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

function gaussian(rand) {
  // Box–Muller; one value is enough per call for our purposes.
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function weightedCentre(rand) {
  const total = CENTRES.reduce((s, c) => s + c.weight, 0);
  let t = rand() * total;
  for (const c of CENTRES) {
    t -= c.weight;
    if (t <= 0) return c;
  }
  return CENTRES[0];
}

function pickLandUse(rand, pull) {
  // Central cells lean office/retail; outer cells lean residential/greenspace.
  const w = {
    residential: 0.30 + (1 - pull) * 0.35,
    retail:      0.16 + pull * 0.10,
    office:      0.06 + pull * 0.34,
    greenspace:  0.10 + (1 - pull) * 0.18,
    industrial:  0.08 + (1 - pull) * 0.06,
  };
  const total = LAND_USE.reduce((s, k) => s + w[k], 0);
  let t = rand() * total;
  for (const k of LAND_USE) {
    t -= w[k];
    if (t <= 0) return k;
  }
  return 'residential';
}

/**
 * Generate synthetic multivariate London points.
 * @param {Object} [opts]
 * @param {number} [opts.count=40000] - number of points
 * @param {number} [opts.seed=42] - PRNG seed (same seed => same points)
 * @param {number} [opts.scatter=0.12] - fraction placed uniformly across the
 *   bbox rather than around a centre (background density)
 * @returns {Array<Object>} records with lon/lat and several attributes
 */
export function generateLondonPoints({ count = 40000, seed = 42, scatter = 0.12 } = {}) {
  const rand = rng(seed);
  const [west, south, east, north] = LONDON_BBOX;
  const records = new Array(count);

  for (let i = 0; i < count; i++) {
    let lon, lat, pull;
    if (rand() < scatter) {
      // Uniform background across Greater London.
      lon = west + rand() * (east - west);
      lat = south + rand() * (north - south);
      // Distance-to-centre proxy for background points.
      const dx = (lon - LONDON_CENTER[0]) / 0.25;
      const dy = (lat - LONDON_CENTER[1]) / 0.18;
      pull = clamp(1 - Math.sqrt(dx * dx + dy * dy), 0, 1);
    } else {
      const c = weightedCentre(rand);
      lon = c.lon + gaussian(rand) * c.spread;
      lat = c.lat + gaussian(rand) * c.spread * 0.7; // lat spans less than lon here
      pull = c.pull * (0.85 + rand() * 0.3);
    }
    lon = clamp(lon, west, east);
    lat = clamp(lat, south, north);
    pull = clamp(pull, 0, 1);

    const land_use = pickLandUse(rand, pull);

    // House price (£): centrality-driven with a heavy right tail; noise added.
    const basePrice = 320000 + pull * 1700000;
    const price = Math.round(clamp(basePrice * (0.8 + rand() * 0.5) + gaussian(rand) * 90000, 180000, 3200000));

    // Public-transport accessibility 0..100 (PTAL-like), higher in the centre.
    const access = Math.round(clamp(18 + pull * 74 + gaussian(rand) * 8, 0, 100));

    // Monthly rent (£): correlated with price but its own noise (the "cost"
    // criterion for the MCDA example — lower is better).
    const rent = Math.round(clamp(900 + pull * 2600 + gaussian(rand) * 220, 650, 4800));

    // Air quality PM2.5 (µg/m³): worse (higher) near the centre and roads.
    const pm25 = round(clamp(6 + pull * 12 + gaussian(rand) * 2.2, 3, 30), 1);

    const year = 2019 + Math.floor(rand() * 6); // 2019..2024

    records[i] = {
      lon: round(lon, 6),
      lat: round(lat, 6),
      borough: weightedCentre(rand).name, // coarse label; fine for tooltips
      land_use,
      price,
      access,
      rent,
      pm25,
      year,
    };
  }
  return records;
}

const NUMERIC_FIELDS = ['price', 'access', 'rent', 'pm25', 'year'];

/**
 * Build the datasetProfile the grammar validates/compiles against. Computes
 * real min/max for each numeric field (global term normalization needs them)
 * and distinct counts for categoricals (the category-count guardrail uses them).
 * Pass the full generated array (or a large sample) so ranges are representative.
 * @param {Array<Object>} records
 * @returns {Object} datasetProfile
 */
export function buildLondonProfile(records) {
  const stats = {};
  for (const f of NUMERIC_FIELDS) stats[f] = { min: Infinity, max: -Infinity };
  const landUse = new Set();
  const boroughs = new Set();

  for (const r of records) {
    for (const f of NUMERIC_FIELDS) {
      const v = r[f];
      if (v < stats[f].min) stats[f].min = v;
      if (v > stats[f].max) stats[f].max = v;
    }
    landUse.add(r.land_use);
    boroughs.add(r.borough);
  }

  return {
    rowCount: records.length,
    coordinateCandidates: [
      { x: 'lon', y: 'lat', coordinateSystem: 'lonlat' },
    ],
    fields: [
      { name: 'lon', type: 'number', min: LONDON_BBOX[0], max: LONDON_BBOX[2] },
      { name: 'lat', type: 'number', min: LONDON_BBOX[1], max: LONDON_BBOX[3] },
      { name: 'borough', type: 'string', distinctCount: boroughs.size },
      { name: 'land_use', type: 'string', distinctCount: landUse.size },
      { name: 'price', type: 'number', min: stats.price.min, max: stats.price.max },
      { name: 'access', type: 'number', min: stats.access.min, max: stats.access.max },
      { name: 'rent', type: 'number', min: stats.rent.min, max: stats.rent.max },
      { name: 'pm25', type: 'number', min: stats.pm25.min, max: stats.pm25.max },
      { name: 'year', type: 'number', min: stats.year.min, max: stats.year.max },
    ],
  };
}
