// ptal-loader.js — provenance-aware loader for the public transport
// accessibility example.
//
// Loads the real Verduzco et al. (2024) London extract
// (examples/data/ptal-london.json, produced by scripts/ptal/slim-ptal.mjs) and
// expands its columnar layout back into the Feature shape the glyph reads:
//   { type: 'Feature', properties: { LSOA11CD, LSOA11NM, cent_long, cent_lat,
//     `${category}_pct_${minutes}`... }, geometry: { type: 'Point', ... } }
//
// The file is stored column-wise because a Feature-per-record layout spends
// more bytes repeating keys like "school_secondary_pct_105" than on the values
// themselves — 6.6 MB of key names across 4,835 records.

export async function loadPtal() {
  const res = await fetch(new URL('./ptal-london.json', import.meta.url));
  if (!res.ok) throw new Error(`ptal-london.json: ${res.status} ${res.statusText}`);
  return expandPtal(await res.json());
}

/**
 * Expand the columnar file into GeoJSON Features. Pure and transport-agnostic,
 * so Node tooling can reuse it by reading the file with fs instead of fetch.
 */
export function expandPtal(raw) {
  if (!raw || raw.format !== 'ptal-columnar-1') {
    throw new Error(`unexpected PTAL format '${raw && raw.format}'`);
  }

  const { categories, minutes, codes, names, lon, lat, pct } = raw;
  const features = new Array(codes.length);

  for (let i = 0; i < codes.length; i++) {
    const properties = {
      LSOA11CD: codes[i],
      LSOA11NM: names[i],
      cent_long: lon[i],
      cent_lat: lat[i],
    };

    // pct is category-major: 8 time cuts for category 0, then category 1, ...
    const series = pct[i];
    for (let c = 0; c < categories.length; c++) {
      for (let m = 0; m < minutes.length; m++) {
        properties[`${categories[c]}_pct_${minutes[m]}`] = series[c * minutes.length + m];
      }
    }

    features[i] = {
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [lon[i], lat[i]] },
    };
  }

  return {
    data: features,
    categories,
    minutes,
    scale: raw.scale,
    attribution: raw.attribution,
    label: `${features.length.toLocaleString()} London LSOAs`,
  };
}
