export const SAMPLE_DATA = [
  { name: 'Library', longitude: -0.1246, latitude: 51.5299, visitors: 120, category: 'civic', satisfaction: 4.2, year_2020: 72, year_2021: 86, year_2022: 103, year_2023: 120 },
  { name: 'Clinic', longitude: -0.1419, latitude: 51.5155, visitors: 84, category: 'health', satisfaction: 3.8, year_2020: 91, year_2021: 88, year_2022: 82, year_2023: 84 },
  { name: 'School', longitude: -0.1062, latitude: 51.5171, visitors: 190, category: 'education', satisfaction: 4.5, year_2020: 130, year_2021: 148, year_2022: 171, year_2023: 190 },
  { name: 'Park Gate', longitude: -0.1634, latitude: 51.5073, visitors: 75, category: 'leisure', satisfaction: 4.7, year_2020: 58, year_2021: 65, year_2022: 70, year_2023: 75 },
  { name: 'Station', longitude: -0.0754, latitude: 51.5142, visitors: 260, category: 'transport', satisfaction: 3.6, year_2020: 210, year_2021: 225, year_2022: 244, year_2023: 260 },
  { name: 'Museum', longitude: -0.1281, latitude: 51.5194, visitors: 145, category: 'culture', satisfaction: 4.4, year_2020: 90, year_2021: 112, year_2022: 131, year_2023: 145 },
  { name: 'Market', longitude: -0.0991, latitude: 51.5055, visitors: 210, category: 'retail', satisfaction: 4.0, year_2020: 155, year_2021: 177, year_2022: 198, year_2023: 210 },
  { name: 'Clinic East', longitude: -0.0645, latitude: 51.5228, visitors: 98, category: 'health', satisfaction: 3.9, year_2020: 83, year_2021: 89, year_2022: 94, year_2023: 98 },
  { name: 'Campus', longitude: -0.1339, latitude: 51.4988, visitors: 175, category: 'education', satisfaction: 4.1, year_2020: 118, year_2021: 136, year_2022: 155, year_2023: 175 },
  { name: 'Gallery', longitude: -0.0925, latitude: 51.5088, visitors: 118, category: 'culture', satisfaction: 4.6, year_2020: 74, year_2021: 91, year_2022: 105, year_2023: 118 },
  { name: 'Sports Centre', longitude: -0.1562, latitude: 51.5213, visitors: 132, category: 'leisure', satisfaction: 4.0, year_2020: 96, year_2021: 108, year_2022: 121, year_2023: 132 },
  { name: 'Bus Hub', longitude: -0.1175, latitude: 51.5032, visitors: 300, category: 'transport', satisfaction: 3.5, year_2020: 235, year_2021: 252, year_2022: 279, year_2023: 300 }
];

export async function parseUploadedFile(file) {
  const text = await file.text();
  const name = file.name || 'uploaded-data';
  const lower = name.toLowerCase();

  if (lower.endsWith('.geojson') || lower.endsWith('.json') || text.trim().startsWith('{')) {
    return parseGeoJson(text, name);
  }

  return {
    rows: parseCsv(text),
    sourceName: name,
    sourceType: 'csv'
  };
}

export function parseCsv(text) {
  const rows = parseCsvRows(text.trim());
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = coerceValue(row[index] ?? '');
    });
    return record;
  });
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows;
}

function parseGeoJson(text, sourceName) {
  const geojson = JSON.parse(text);
  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];

  const rows = features
    .filter((feature) => feature?.geometry?.type === 'Point')
    .map((feature, index) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return {
        id: feature.id ?? index,
        ...(feature.properties || {}),
        longitude,
        latitude
      };
    });

  return { rows, sourceName, sourceType: 'geojson' };
}

function coerceValue(value) {
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  const number = Number(trimmed);
  if (!Number.isNaN(number) && trimmed !== '') return number;
  return trimmed;
}
