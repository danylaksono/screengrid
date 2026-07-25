// Generates fully-synthetic replacement datasets for the ScreenGrid examples,
// matching the exact schemas the examples consume. No real/proprietary data.
// Deterministic (seeded) so output is stable across runs.
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2] || 'examples/data';

// --- tiny seeded PRNG (mulberry32) for reproducibility ---
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

// =====================================================================
// 1) cambridge.json  — SYNTHETIC domestic-retrofit cost / carbon dataset
//    Schema per record (as consumed by examples/temporal/*.html):
//    { lsoa, postcode, lat, lon, budget, year, technology,
//      labour_cost, material_cost, total_cost,
//      ashp_carbonsaved, ev_carbonsaved, pv_carbonsaved }
// =====================================================================
function makeCambridge() {
  const r = rng(20260711);
  const records = [];
  const YEARS = [2020, 2021, 2022, 2023, 2024];
  const BUDGETS = ['capped5000k', 'capped15000k', 'uncapped'];
  // technology -> which carbon field it populates
  const TECHS = [
    { name: 'heat pumps', field: 'ashp_carbonsaved', carbon: [400, 1100], labour: [900, 2200], material: [2500, 6500] },
    { name: 'ev chargers', field: 'ev_carbonsaved', carbon: [150, 600], labour: [300, 900], material: [700, 2200] },
    { name: 'solar pv', field: 'pv_carbonsaved', carbon: [250, 900], labour: [600, 1600], material: [1800, 5200] },
  ];
  // Cambridge-area bounding box (coordinates are public geography, not data)
  const LON = [0.05, 0.22];
  const LAT = [52.13, 52.28];
  const SITES = 320;
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = ([lo, hi]) => lo + r() * (hi - lo);

  for (let s = 0; s < SITES; s++) {
    const lon = round(between(LON), 6);
    const lat = round(between(LAT), 6);
    const lsoa = `E0${(1017000 + Math.floor(r() * 2000)).toString()}`; // real-format, arbitrary
    const postcode = `CB${1 + Math.floor(r() * 9)} ${Math.floor(r() * 9)}${String.fromCharCode(65 + Math.floor(r() * 26))}${String.fromCharCode(65 + Math.floor(r() * 26))}`;
    const budget = pick(BUDGETS);
    // each site adopts 1-3 technologies, present across a run of years
    const techs = TECHS.filter(() => r() < 0.6);
    if (techs.length === 0) techs.push(pick(TECHS));
    for (const tech of techs) {
      const startYear = pick(YEARS);
      for (const year of YEARS) {
        if (year < startYear) continue;
        if (r() < 0.15) continue; // occasional gaps
        const labour = round(between(tech.labour));
        const material = round(between(tech.material));
        const rec = {
          lsoa,
          postcode,
          lat,
          lon,
          budget,
          year,
          technology: tech.name,
          labour_cost: labour,
          material_cost: material,
          total_cost: round(labour + material),
          ashp_carbonsaved: null,
          ev_carbonsaved: null,
          pv_carbonsaved: null,
        };
        // carbon savings grow modestly over time as installs mature
        const growth = 1 + (year - 2020) * 0.05;
        rec[tech.field] = round(between(tech.carbon) * growth, 4);
        records.push(rec);
      }
    }
  }
  return records;
}

// Note: this script used to also emit a synthetic
// public_transport_accessibility.json on a 0-1 scale. That generator has been
// removed — the accessibility example now uses the real Verduzco et al. (2024)
// London extract in ptal-london.json (0-100 scale), loaded via ptal-loader.js.
// See examples/data/README.md and scripts/ptal/slim-ptal.mjs.

fs.mkdirSync(OUT, { recursive: true });
const cambridge = makeCambridge();
fs.writeFileSync(path.join(OUT, 'cambridge.json'), JSON.stringify(cambridge));

const sz = (p) => (fs.statSync(p).size / 1024).toFixed(0) + ' KB';
console.log(`cambridge.json: ${cambridge.length} records, ${sz(path.join(OUT, 'cambridge.json'))}`);
console.log('cambridge sample:', JSON.stringify(cambridge[0]));
