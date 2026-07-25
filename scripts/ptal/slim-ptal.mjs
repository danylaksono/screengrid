#!/usr/bin/env node
// slim-ptal.mjs — reduce the Verduzco et al. (2024) public transport
// accessibility extract to the subset the ScreenGrid example actually renders,
// and store it column-wise so field names are not repeated 4,835 times.
//
// Source (19.1 MB) is recoverable from git history:
//   git show d78801d:examples/data/public_transport_accessibility.json > ptal-full.json
//
// Usage:
//   node scripts/ptal/slim-ptal.mjs ptal-full.json examples/data/ptal-london.json
//
// What it drops, and why:
//   * MultiPolygon geometry (~33% of the file). The example positions each
//     record from cent_long/cent_lat, so LSOA boundary rings are never read.
//   * Raw cumulative counts (`${cat}_${minutes}`). The glyph reads only the
//     `_pct_` fields, and the original metadata states the raw columns were
//     meant to be excluded.
//   * Excess float precision. These are percentages on a 0-100 scale carrying
//     ~16 significant digits; one decimal is ~0.02 px at the size a glyph
//     square is ever drawn.
//   * Repeated JSON keys. A record-per-Feature layout spends more bytes on
//     strings like "school_secondary_pct_105" than on values, so the output is
//     columnar and examples/data/ptal-loader.js rebuilds the Feature shape.

import fs from 'fs';

const CATEGORIES = ['employment', 'supermarket', 'school_primary', 'school_secondary', 'gp', 'hospitals'];
const MINUTES = [15, 30, 45, 60, 75, 90, 105, 120];

const PCT_DECIMALS = 1;
const COORD_DECIMALS = 5; // ~1 m at London's latitude

const ATTRIBUTION =
  'Public transport accessibility: Verduzco Torres, J.G. & McArthur, D.P. (2024), '
  + 'open access indicators for Great Britain at LSOA level. Contains National '
  + 'Statistics and OS data © Crown copyright and database right.';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node scripts/ptal/slim-ptal.mjs <input.json> <output.json>');
  process.exit(1);
}

const round = (v, dp) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(dp)) : null);

const src = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const features = Array.isArray(src) ? src : src.features;
if (!Array.isArray(features)) throw new Error('expected an array of Features or a FeatureCollection');

const codes = [];
const names = [];
const lon = [];
const lat = [];
const pct = [];

let skipped = 0;

for (const f of features) {
  const p = f.properties || {};
  const x = round(p.cent_long, COORD_DECIMALS);
  const y = round(p.cent_lat, COORD_DECIMALS);
  if (x === null || y === null) { skipped++; continue; }

  // Category-major: all 8 time cuts for category 0, then category 1, ...
  const series = [];
  let complete = true;
  for (const cat of CATEGORIES) {
    for (const m of MINUTES) {
      const v = round(p[`${cat}_pct_${m}`], PCT_DECIMALS);
      if (v === null) complete = false;
      series.push(v ?? 0);
    }
  }
  if (!complete) { skipped++; continue; }

  codes.push(p.LSOA11CD);
  names.push(p.LSOA11NM);
  lon.push(x);
  lat.push(y);
  pct.push(series);
}

const out = {
  format: 'ptal-columnar-1',
  attribution: ATTRIBUTION,
  categories: CATEGORIES,
  minutes: MINUTES,
  scale: '0-100',
  count: codes.length,
  codes,
  names,
  lon,
  lat,
  pct,
};

fs.writeFileSync(outPath, JSON.stringify(out));

const inBytes = fs.statSync(inPath).size;
const outBytes = fs.statSync(outPath).size;
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`records:  ${features.length} -> ${codes.length}${skipped ? ` (${skipped} skipped: incomplete)` : ''}`);
console.log(`size:     ${mb(inBytes)} -> ${mb(outBytes)}  (${(100 - (outBytes / inBytes) * 100).toFixed(1)}% smaller)`);

// Integrity: cumulative access must stay monotonic across time cuts.
let nonMonotonic = 0;
for (const series of pct) {
  for (let c = 0; c < CATEGORIES.length; c++) {
    const slice = series.slice(c * MINUTES.length, (c + 1) * MINUTES.length);
    if (!slice.every((v, i) => i === 0 || v >= slice[i - 1])) nonMonotonic++;
  }
}
console.log(`checks:   ${nonMonotonic} non-monotonic series`);
if (nonMonotonic) {
  console.error('FAILED integrity checks');
  process.exit(1);
}
console.log('OK');
