import { profileDataset, getFieldsByType } from './profile.js';
import { validateSpec } from './validation.js';

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(name, handler) {
    this.tools.set(name, handler);
  }

  async call(name, args, context) {
    const handler = this.tools.get(name);
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler(args, context);
  }

  list() {
    return Array.from(this.tools.keys());
  }
}

export class Orchestrator {
  constructor() {
    this.registry = new ToolRegistry();
    this.runLog = [];
    registerDefaultTools(this.registry);
  }

  async callTool(name, args, context) {
    const call = {
      id: crypto.randomUUID(),
      name,
      args,
      status: 'running',
      result: null,
      error: null
    };
    this.runLog.unshift(call);
    try {
      call.result = await this.registry.call(name, args, context);
      call.status = 'complete';
      return call.result;
    } catch (error) {
      call.status = 'error';
      call.error = error.message;
      throw error;
    }
  }
}

function registerDefaultTools(registry) {
  registry.register('profileDataset', (_args, context) => ({
    value: profileDataset(context.rows, context.sourceName, context.sourceType),
    warnings: []
  }));

  registry.register('inferCoordinateFields', (_args, context) => ({
    value: context.spec.datasetProfile.coordinateCandidates[0] || null,
    warnings: context.spec.datasetProfile.coordinateCandidates.length ? [] : ['No coordinate candidates found.']
  }));

  registry.register('suggestGridParameters', (_args, context) => ({
    value: {
      cellSizePixels: context.rows.length > 1000 ? 32 : 48,
      aggregationMode: 'screen-grid',
      normalization: context.spec.intent?.comparison === 'within-cell' ? 'max-local' : 'max-global'
    },
    warnings: ['Global normalization is preferred when the stated intent compares cells or viewports.']
  }));

  registry.register('summarizeFields', (_args, context) => ({
    value: context.spec.datasetProfile.fields,
    warnings: []
  }));

  registry.register('suggestCellSummaries', (_args, context) => {
    const numeric = getFieldsByType(context.spec.datasetProfile, 'number')
      .filter((field) => !Object.values(context.spec.screengrid.coordinateFields).includes(field));
    return {
      value: [
        { name: 'count', role: 'primary', field: null, op: 'count', description: 'Number of points per cell.', reliability: { warnBelowCount: 5, warnOnMissingness: true, warnOnHeterogeneity: true } },
        ...numeric.slice(0, 2).map((field) => ({ name: `mean_${field}`, role: 'profile', field, op: 'mean', description: `Mean ${field} per cell.`, reliability: { warnBelowCount: 5, warnOnMissingness: true, warnOnHeterogeneity: true } })),
        ...numeric.slice(0, 1).map((field) => ({ name: `variance_${field}`, role: 'reliability', field, op: 'variance', description: `Within-cell variance of ${field}.` }))
      ],
      warnings: []
    };
  });

  registry.register('suggestGlyphSpec', (_args, context) => ({
    value: createLocalProposal(context.spec),
    warnings: []
  }));

  registry.register('validateSpec', (_args, context) => ({
    value: validateSpec(context.spec),
    warnings: []
  }));

  registry.register('renderPreview', (_args, context) => ({
    value: { renderable: validateSpec(context.spec).valid, rows: context.rows.length },
    warnings: []
  }));

  registry.register('explainEncoding', (_args, context) => ({
    value: `Each cell aggregates ${context.spec.screengrid.aggregation.function} values. Glyph type ${context.spec.glyph.type} maps size to ${context.spec.glyph.channels.size.field} and color to ${context.spec.glyph.channels.color.field}.`,
    warnings: []
  }));
}

export function createLocalProposal(spec) {
  const numeric = spec.datasetProfile.fields
    .filter((field) => field.type === 'number')
    .filter((field) => !Object.values(spec.screengrid.coordinateFields).includes(field.name));
  const categorical = spec.datasetProfile.fields.find((field) => field.type === 'string');
  const valueField = numeric[0]?.name || null;
  const temporalFields = numeric.filter((field) => /\d{4}|hour|time|date|year/i.test(field.name)).slice(0, 8);
  const task = spec.intent?.task || (categorical ? 'composition' : 'density');
  const useTemporal = task === 'temporal-trend' && temporalFields.length >= 2;
  const glyphType = useTemporal ? 'custom' : categorical || task === 'composition' ? 'pie' : 'circle';
  const normalization = spec.intent?.comparison === 'within-cell' ? 'max-local' : 'max-global';

  const patch = [
    { op: 'replace', path: '/glyph/type', value: glyphType },
    { op: 'replace', path: '/glyph/palette', value: categorical || task === 'composition' ? 'categorical' : 'viridis' },
    { op: 'replace', path: '/glyph/channels/size/field', value: valueField || 'count' },
    { op: 'replace', path: '/glyph/channels/color/field', value: categorical?.name || valueField || 'count' },
    { op: 'replace', path: '/glyph/channels/segments/field', value: categorical?.name || null },
    { op: 'replace', path: '/glyph/channels/measures', value: numeric.slice(0, 3).map((field) => ({ field: field.name, aggregate: 'mean', label: field.name })) },
    { op: 'replace', path: '/glyph/scales/color', value: categorical || task === 'composition' ? 'categorical' : 'sequential' },
    { op: 'replace', path: '/screengrid/normalization', value: normalization },
    { op: 'replace', path: '/interaction/explanation', value: `Suggested by the local co-pilot: align glyph choice with ${task} intent, semantic cell reliability, and comparability warnings.` }
  ];

  if (useTemporal) {
    patch.push({
      op: 'replace',
      path: '/glyph/custom',
      value: {
        layout: 'cartesian-mini',
        domain: 'global',
        marks: [
          { mark: 'line', data: { fields: temporalFields.map((field) => field.name), order: 'temporal', aggregate: 'mean' }, stroke: '#266d55', lineWidth: 2, opacity: 0.95 },
          { mark: 'point', data: { fields: temporalFields.map((field) => field.name), order: 'temporal', aggregate: 'mean' }, fill: '#bf5a36', opacity: 0.9 }
        ]
      }
    });
  }

  if (valueField) {
    patch.push({ op: 'replace', path: '/screengrid/aggregation/field', value: valueField });
  }

  return {
    summary: `Use a ${task} cartographic design.`,
    rationale: useTemporal
      ? 'Temporal fields are present, so a compact profile glyph supports cross-cell comparison of trends.'
      : categorical
        ? 'A categorical field is present, so a composition glyph can expose internal cell structure while reliability warnings guard against sparse cells.'
        : 'No categorical field was found, so a sized circle keeps the density encoding simple and uses global normalization for comparison.',
    actions: [
      {
        id: crypto.randomUUID(),
        label: useTemporal ? 'Use temporal profile glyph' : categorical ? 'Use categorical composition glyph' : 'Use comparable density glyph',
        confidence: 0.76,
        patch
      }
    ],
    warnings: normalization === 'max-local' ? ['Local normalization is only appropriate for within-cell reading.'] : []
  };
}
