import { SPEC_VERSION } from '../../../src/grammar/validateSpec.js';

export function createDefaultSpec(datasetProfile) {
  const candidate = datasetProfile.coordinateCandidates[0];
  const numeric = datasetProfile.fields.find((field) => field.type === 'number' && ![candidate?.x, candidate?.y].includes(field.name));
  const numericFields = datasetProfile.fields
    .filter((field) => field.type === 'number' && ![candidate?.x, candidate?.y].includes(field.name))
    .map((field) => field.name);
  const categorical = datasetProfile.fields.find((field) => field.type === 'string');

  return {
    version: SPEC_VERSION,
    datasetProfile,
    intent: inferIntent(datasetProfile),
    parameters: [],
    screengrid: {
      coordinateSystem: candidate?.coordinateSystem || 'lonlat',
      coordinateFields: {
        x: candidate?.x || '',
        y: candidate?.y || ''
      },
      aggregationMode: 'screen-grid',
      aggregation: {
        function: 'count',
        field: numeric?.name || null
      },
      derivedMeasures: [],
      cellSizePixels: 48,
      filters: [],
      summaries: [
        {
          name: 'count',
          role: 'primary',
          field: null,
          op: 'count',
          description: 'Number of points in the cell.',
          reliability: { warnBelowCount: 5, warnOnMissingness: true, warnOnHeterogeneity: true },
          comparability: { normalization: 'local', validAcrossZoom: false, requiresDenominator: false }
        },
        ...numericFields.slice(0, 3).map((field) => ({
          name: `mean_${field}`,
          role: 'profile',
          field,
          op: 'mean',
          description: `Mean ${field} per screen cell.`,
          reliability: { warnBelowCount: 5, warnOnMissingness: true, warnOnHeterogeneity: true },
          comparability: { normalization: 'global', validAcrossZoom: false, requiresDenominator: true }
        }))
      ],
      normalization: 'max-local',
      emptyCellPolicy: 'hide',
      semanticModel: {
        enabled: true,
        includeRawRefs: true,
        reliability: {
          lowCountThreshold: 5,
          heterogeneityWarning: true,
          missingnessWarning: true
        }
      }
    },
    glyph: {
      type: 'heatmap',
      channels: {
        size: { field: 'count', aggregate: 'count', fallback: 1 },
        color: { field: categorical?.name || numeric?.name || 'count', aggregate: categorical ? 'mode' : 'mean', fallback: null },
        opacity: { field: 'count', aggregate: 'count', fallback: 0.85 },
        segments: { field: categorical?.name || null, aggregate: 'mode', fallback: null },
        measures: numericFields.slice(0, 3).map((field) => ({ field, aggregate: 'mean', label: field }))
      },
      scales: {
        size: 'sqrt',
        color: categorical ? 'categorical' : 'sequential',
        opacity: 'linear'
      },
      palette: categorical ? 'categorical' : 'ember',
      legend: {
        enabled: true,
        title: 'Cell summary'
      },
      limits: {
        maxCategories: 6,
        minSizePixels: 18,
        supportsUncertainty: false,
        supportsTemporalProfile: true
      },
      custom: createLineGlyphSpec(datasetProfile)
    },
    validation: {
      cartographicChecks: true,
      maxCategories: 6,
      minGlyphSizePixels: 18,
      notes: ['Screen-space cells are viewport dependent; use global normalization for cross-place claims.']
    },
    interaction: {
      hover: true,
      click: true,
      selection: false,
      explanation: 'The current view aggregates uploaded points into screen-space cells and maps cell summaries to glyph channels.',
      tooltip: {
        enabled: true,
        trigger: 'hover',
        fields: [categorical?.name].filter(Boolean),
        calculations: [
          { label: 'Points', op: 'count' },
          ...(numeric ? [{ label: `Mean ${numeric.name}`, op: 'mean', field: numeric.name }] : [])
        ]
      }
    }
  };
}

function inferIntent(datasetProfile) {
  const numeric = datasetProfile.fields.filter((field) => field.type === 'number');
  const categorical = datasetProfile.fields.find((field) => field.type === 'string');
  const temporal = numeric.filter((field) => /\d{4}|hour|time|date|year/i.test(field.name));
  if (temporal.length >= 2) {
    return {
      task: 'temporal-trend',
      audience: 'cartography researchers',
      comparison: 'across-cells',
      question: 'How do local temporal profiles vary across screen-space cells?'
    };
  }
  if (categorical) {
    return {
      task: 'composition',
      audience: 'cartography researchers',
      comparison: 'across-cells',
      question: 'How does category composition vary across dense point locations?'
    };
  }
  return {
    task: 'density',
    audience: 'cartography researchers',
    comparison: 'across-cells',
    question: 'Where are records concentrated, and how reliable is each cell summary?'
  };
}

export function createLineGlyphSpec(datasetProfile) {
  const fields = inferSeriesFields(datasetProfile);
  return {
    layout: 'cartesian-mini',
    domain: 'global',
    marks: [
      {
        mark: 'line',
        data: { fields, order: 'temporal', aggregate: 'mean' },
        stroke: '#266d55',
        lineWidth: 2,
        opacity: 0.95
      },
      {
        mark: 'point',
        data: { fields, order: 'temporal', aggregate: 'mean' },
        fill: '#bf5a36',
        opacity: 0.9
      }
    ]
  };
}

export function createRoseGlyphSpec(datasetProfile) {
  const fields = inferSeriesFields(datasetProfile);
  return {
    layout: 'radial',
    domain: 'global',
    marks: [
      {
        mark: 'wedge',
        data: { fields, order: 'temporal', aggregate: 'mean' },
        fill: '#266d55',
        opacity: 0.82
      },
      {
        mark: 'ring',
        stroke: '#1e2421',
        lineWidth: 1,
        opacity: 0.35
      }
    ]
  };
}

function inferSeriesFields(datasetProfile) {
  const coordinateNames = new Set(datasetProfile.coordinateCandidates.flatMap((candidate) => [candidate.x, candidate.y]));
  const numeric = datasetProfile.fields
    .filter((field) => field.type === 'number' && !coordinateNames.has(field.name))
    .map((field) => field.name);
  const yearLike = numeric.filter((name) => /\d{4}/.test(name)).sort((a, b) => Number(a.match(/\d{4}/)?.[0] || 0) - Number(b.match(/\d{4}/)?.[0] || 0));
  return (yearLike.length >= 2 ? yearLike : numeric).slice(0, 8);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function applyPatch(document, patch) {
  const next = clone(document);

  patch.forEach((operation) => {
    const parts = operation.path.split('/').slice(1).map(unescapePointer);
    const key = parts.pop();
    const parent = parts.reduce((target, part) => target?.[part], next);

    if (!parent || key === undefined) {
      throw new Error(`Invalid patch path: ${operation.path}`);
    }

    if (operation.op === 'remove') {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete parent[key];
    } else if (operation.op === 'replace' || operation.op === 'add') {
      parent[key] = operation.value;
    } else {
      throw new Error(`Unsupported patch op: ${operation.op}`);
    }
  });

  return next;
}

function unescapePointer(value) {
  return value.replace(/~1/g, '/').replace(/~0/g, '~');
}
