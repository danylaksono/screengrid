const GLYPHS = new Set(['heatmap', 'circle', 'bar', 'pie', 'ring', 'custom']);
const AGGREGATIONS = new Set(['count', 'sum', 'mean', 'max', 'min']);
const NORMALIZATIONS = new Set(['max-local', 'max-global', 'z-score', 'percentile']);
const PALETTES = new Set(['ember', 'viridis', 'ocean', 'categorical', 'slate']);
const INTENTS = new Set(['density', 'composition', 'profile-comparison', 'temporal-trend', 'anomaly', 'uncertainty', 'flow-balance']);

export function validateSpec(spec) {
  const errors = [];
  const warnings = [];
  const fields = new Set(spec.datasetProfile?.fields?.map((field) => field.name) || []);
  const numeric = new Set((spec.datasetProfile?.fields || []).filter((field) => field.type === 'number').map((field) => field.name));
  const categoricalProfiles = (spec.datasetProfile?.fields || []).filter((field) => field.type === 'string');

  if (!INTENTS.has(spec.intent?.task)) errors.push('Analytical intent is required and must be supported.');
  if (!fields.has(spec.screengrid.coordinateFields.x)) errors.push('X coordinate field is missing or unknown.');
  if (!fields.has(spec.screengrid.coordinateFields.y)) errors.push('Y coordinate field is missing or unknown.');
  if (!AGGREGATIONS.has(spec.screengrid.aggregation.function)) errors.push('Unsupported aggregation function.');
  if (!NORMALIZATIONS.has(spec.screengrid.normalization)) errors.push('Unsupported normalization.');
  if (spec.screengrid.cellSizePixels < 12 || spec.screengrid.cellSizePixels > 180) errors.push('Cell size must be between 12 and 180 pixels.');
  if (spec.screengrid.aggregation.function !== 'count' && !numeric.has(spec.screengrid.aggregation.field)) {
    errors.push('Numeric aggregation functions require a numeric aggregation field.');
  }
  if (!GLYPHS.has(spec.glyph.type)) errors.push('Unsupported glyph type.');
  if (!PALETTES.has(spec.glyph.palette)) errors.push('Unsupported palette.');

  Object.entries(spec.glyph.channels || {}).forEach(([channel, config]) => {
    if (channel === 'measures') return;
    if (!config || config.field === null || config.field === 'count') return;
    if (!fields.has(config.field)) errors.push(`${channel} channel references unknown field "${config.field}".`);
  });
  (spec.glyph.channels?.measures || []).forEach((measure) => {
    if (!fields.has(measure.field)) errors.push(`Bar measure references unknown field "${measure.field}".`);
    if (!numeric.has(measure.field)) errors.push(`Bar measure "${measure.field}" must be numeric.`);
  });

  const colorField = spec.glyph.channels?.color?.field;
  const colorProfile = spec.datasetProfile.fields.find((field) => field.name === colorField);
  if (colorProfile?.type === 'string' && spec.glyph.scales.color !== 'categorical') {
    warnings.push('Categorical color fields should use a categorical color scale.');
  }
  if (spec.glyph.type === 'pie' && !spec.glyph.channels?.segments?.field) {
    warnings.push('Pie glyphs are most useful with a categorical segments field.');
  }
  validateCartography(spec, numeric, categoricalProfiles, warnings);
  validateTooltip(spec, fields, numeric, errors);
  validateCustomGlyph(spec, fields, numeric, errors, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

function validateCartography(spec, numeric, categoricalProfiles, warnings) {
  if (spec.validation?.cartographicChecks === false) return;
  const task = spec.intent?.task;
  const comparison = spec.intent?.comparison;
  const maxCategories = spec.validation?.maxCategories || spec.glyph.limits?.maxCategories || 6;
  const minGlyphSize = spec.validation?.minGlyphSizePixels || spec.glyph.limits?.minSizePixels || 18;

  if (comparison && comparison !== 'within-cell' && spec.screengrid.normalization === 'max-local') {
    warnings.push('Local normalization supports pattern finding, but global normalization is safer for cross-cell or cross-view comparison claims.');
  }
  if (spec.screengrid.cellSizePixels * 0.82 < minGlyphSize && spec.glyph.type !== 'heatmap') {
    warnings.push(`Glyphs may be too small for reliable reading below ${minGlyphSize}px.`);
  }
  const segmentField = spec.glyph.channels?.segments?.field;
  const segmentProfile = categoricalProfiles.find((field) => field.name === segmentField);
  if (segmentProfile?.distinctCount > maxCategories && ['pie', 'ring', 'custom'].includes(spec.glyph.type)) {
    warnings.push(`The segment field has ${segmentProfile.distinctCount} categories; limit visible categories or aggregate long tails before using radial composition glyphs.`);
  }
  if (task === 'composition' && !segmentField) {
    warnings.push('Composition intent should include a categorical segment field or category-distribution summary.');
  }
  if (task === 'temporal-trend' && spec.glyph.type !== 'custom') {
    warnings.push('Temporal-trend intent is usually clearer with a custom line, point, or radial profile glyph.');
  }
  if ((task === 'uncertainty' || task === 'anomaly') && !spec.glyph.limits?.supportsUncertainty) {
    warnings.push('This glyph does not explicitly encode uncertainty; add opacity, interval, or reliability marks for uncertainty/anomaly tasks.');
  }
  const countSummary = (spec.screengrid.summaries || []).find((summary) => summary.op === 'count');
  if (!countSummary?.reliability?.warnBelowCount) {
    warnings.push('Add a low-count reliability threshold so sparse cells are not over-interpreted.');
  }
  const meanOnly = (spec.screengrid.summaries || []).some((summary) => summary.op === 'mean')
    && !(spec.screengrid.summaries || []).some((summary) => ['variance', 'missingness'].includes(summary.op));
  if (meanOnly && numeric.size > 0) {
    warnings.push('Mean summaries should be paired with variance or missingness checks to expose within-cell heterogeneity.');
  }
  if (['screen-grid', 'screen-hex'].includes(spec.screengrid.aggregationMode)) {
    warnings.push('Screen-space cells are viewport dependent; avoid presenting them as stable geographic districts.');
  }
}

function validateTooltip(spec, fields, numeric, errors) {
  const tooltip = spec.interaction?.tooltip;
  if (!tooltip) return;
  if (tooltip.trigger && !['hover', 'click'].includes(tooltip.trigger)) errors.push('Tooltip trigger must be hover or click.');
  (tooltip.fields || []).forEach((field) => {
    if (!fields.has(field)) errors.push(`Tooltip field "${field}" is unknown.`);
  });
  (tooltip.calculations || []).forEach((calculation) => {
    if (calculation.field && !fields.has(calculation.field)) errors.push(`Tooltip calculation field "${calculation.field}" is unknown.`);
    if (calculation.field && !numeric.has(calculation.field) && !['mode', 'distinct'].includes(calculation.op)) {
      errors.push(`Tooltip calculation field "${calculation.field}" must be numeric for ${calculation.op}.`);
    }
  });
}

function validateCustomGlyph(spec, fields, numeric, errors, warnings) {
  if (spec.glyph.type !== 'custom') return;
  const custom = spec.glyph.custom;
  if (!custom || typeof custom !== 'object') {
    errors.push('Custom glyph requires a custom grammar object.');
    return;
  }
  if (!['cartesian-mini', 'radial'].includes(custom.layout)) errors.push('Custom glyph layout must be cartesian-mini or radial.');
  if (!Array.isArray(custom.marks) || custom.marks.length === 0) errors.push('Custom glyph requires at least one mark.');
  (custom.marks || []).forEach((mark, index) => {
    if (!['line', 'point', 'wedge', 'ring'].includes(mark.mark)) errors.push(`Custom mark ${index + 1} has an unsupported mark type.`);
    const dataFields = mark.data?.fields || [];
    dataFields.forEach((field) => {
      if (!fields.has(field)) errors.push(`Custom mark references unknown field "${field}".`);
      if (!numeric.has(field)) errors.push(`Custom mark field "${field}" must be numeric.`);
    });
  });
  if (custom.layout === 'radial' && !(custom.marks || []).some((mark) => mark.mark === 'wedge')) {
    warnings.push('Radial custom glyphs usually need a wedge mark.');
  }
}

export function validateAssistantProposal(proposal) {
  const errors = [];
  if (!proposal || typeof proposal !== 'object') errors.push('Proposal must be an object.');
  if (!proposal.summary) errors.push('Proposal summary is required.');
  if (!Array.isArray(proposal.actions)) errors.push('Proposal actions must be an array.');

  (proposal.actions || []).forEach((action, index) => {
    if (!action.id) errors.push(`Action ${index + 1} is missing an id.`);
    if (!Array.isArray(action.patch)) errors.push(`Action ${index + 1} patch must be an array.`);
    (action.patch || []).forEach((operation) => {
      if (!['add', 'replace', 'remove'].includes(operation.op)) errors.push(`Unsupported patch op "${operation.op}".`);
      if (!operation.path?.startsWith('/')) errors.push('Patch paths must use JSON Pointer format.');
    });
  });

  return { valid: errors.length === 0, errors };
}
