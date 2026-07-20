const LON_NAMES = ['lon', 'lng', 'long', 'longitude', 'x'];
const LAT_NAMES = ['lat', 'latitude', 'y'];

export function profileDataset(rows, sourceName = 'dataset', sourceType = 'unknown') {
  const fieldNames = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const fields = fieldNames.map((name) => profileField(name, rows));
  const coordinateCandidates = inferCoordinateCandidates(fields);

  return {
    sourceName,
    sourceType,
    rowCount: rows.length,
    fields,
    coordinateCandidates
  };
}

export function getFieldsByType(profile, type) {
  return profile.fields.filter((field) => field.type === type).map((field) => field.name);
}

function profileField(name, rows) {
  const values = rows.map((row) => row[name]);
  const present = values.filter((value) => value !== null && value !== undefined && value !== '');
  const type = inferType(present);
  const distinct = new Map();
  present.forEach((value) => distinct.set(String(value), (distinct.get(String(value)) || 0) + 1));

  const field = {
    name,
    type,
    missingCount: values.length - present.length,
    distinctCount: distinct.size
  };

  if (type === 'number') {
    const numbers = present.map(Number).filter(Number.isFinite);
    const sum = numbers.reduce((total, value) => total + value, 0);
    field.min = numbers.length ? Math.min(...numbers) : null;
    field.max = numbers.length ? Math.max(...numbers) : null;
    field.mean = numbers.length ? sum / numbers.length : null;
  } else {
    field.min = null;
    field.max = null;
    field.mean = null;
    field.categories = Array.from(distinct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));
  }

  return field;
}

function inferType(values) {
  if (values.length === 0) return 'unknown';
  const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value)).length;
  const boolean = values.filter((value) => typeof value === 'boolean').length;
  if (numeric / values.length > 0.85) return 'number';
  if (boolean / values.length > 0.85) return 'boolean';
  return 'string';
}

export function inferCoordinateCandidates(fields) {
  const numericFields = fields.filter((field) => field.type === 'number');
  const candidates = [];

  for (const x of numericFields) {
    for (const y of numericFields) {
      if (x.name === y.name) continue;
      const xName = x.name.toLowerCase();
      const yName = y.name.toLowerCase();
      const xLooksLon = LON_NAMES.some((term) => xName === term || xName.includes(term));
      const yLooksLat = LAT_NAMES.some((term) => yName === term || yName.includes(term));
      const lonLatRange = within(x.min, x.max, -180, 180) && within(y.min, y.max, -90, 90);

      if ((xLooksLon && yLooksLat) || lonLatRange) {
        candidates.push({
          x: x.name,
          y: y.name,
          coordinateSystem: lonLatRange ? 'lonlat' : 'xy',
          confidence: (xLooksLon && yLooksLat ? 0.55 : 0.25) + (lonLatRange ? 0.4 : 0),
          reason: xLooksLon && yLooksLat ? 'Column names and value ranges look spatial.' : 'Numeric ranges look like longitude/latitude.'
        });
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function within(min, max, low, high) {
  return min !== null && max !== null && min >= low && max <= high;
}

