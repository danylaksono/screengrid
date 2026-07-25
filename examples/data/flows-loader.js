// flows-loader.js — provenance-aware loader for the flow case studies.
//
// Returns real preprocessed Santander Cycle journeys when they are present
// (examples/data/santander-flows.json, produced by
// scripts/santander/fetch-santander-flows.mjs), and falls back to the synthetic
// generator otherwise — so the pages always run, and become "real" the moment
// you run the script. Both sources share the same record shape:
//   { olon, olat, dlon, dlat, bearing, dist_km, period, ... }
import { generateLondonFlows } from './london.js';

export async function loadFlows({ count = 9000, seed = 99 } = {}) {
  try {
    const res = await fetch(new URL('./santander-flows.json', import.meta.url));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        let attribution = 'Powered by TfL Open Data. Cycle hire data © Transport for London.';
        try {
          const m = await fetch(new URL('./santander-flows-meta.json', import.meta.url));
          if (m.ok) attribution = (await m.json()).attribution || attribution;
        } catch { /* meta optional */ }
        return { data, source: 'santander', label: `${data.length.toLocaleString()} real Santander trips`, attribution };
      }
    }
  } catch { /* not served / not present — use synthetic */ }
  return {
    data: generateLondonFlows({ count, seed }),
    source: 'synthetic',
    label: `${count.toLocaleString()} synthetic trips`,
    attribution: 'Synthetic data — run scripts/santander/fetch-santander-flows.mjs to use real Santander journeys.',
  };
}
