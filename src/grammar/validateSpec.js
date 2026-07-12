/**
 * validateSpec.js
 * Validator for Screengrid grammar specifications.
 *
 * Two kinds of output:
 *  - errors:   the spec cannot be rendered or references incompatible fields
 *  - warnings: the spec renders but may mislead for the stated analytical intent
 *              (cartographic validation rules — executable design knowledge)
 *
 * Also reports `checkability`: 'full' for fully declarative specs, 'partial' when the
 * spec uses the custom-function escape hatch (design logic the validator cannot see).
 *
 * The JSON Schemas in ./schemas/ are the structural contracts; this validator adds the
 * cross-field and cartographic rules that JSON Schema cannot express.
 */

export const SPEC_VERSION = '0.2.0';

const GLYPHS = new Set(['heatmap', 'circle', 'bar', 'pie', 'ring', 'custom']);
const AGGREGATIONS = new Set(['count', 'sum', 'mean', 'max', 'min', 'derived', 'custom']);
const NORMALIZATIONS = new Set(['max-local', 'max-global', 'z-score', 'percentile']);
const PALETTES = new Set(['ember', 'viridis', 'ocean', 'categorical', 'slate']);
const INTENTS = new Set(['density', 'composition', 'profile-comparison', 'temporal-trend', 'anomaly', 'uncertainty', 'flow-balance', 'suitability']);
const DERIVED_OPS = new Set(['weighted-sum', 'ratio', 'difference']);
const UNCERTAINTY_MARKS = new Set(['band', 'interval', 'whisker']);

export function validateSpec(spec) {
  const errors = [];
  const warnings = [];
  let checkability = 'full';

  const fields = new Set(spec.datasetProfile?.fields?.map((field) => field.name) || []);
  const numeric = new Set((spec.datasetProfile?.fields || []).filter((field) => field.type === 'number').map((field) => field.name));
  const categoricalProfiles = (spec.datasetProfile?.fields || []).filter((field) => field.type === 'string');
  const parameters = new Map((spec.parameters || []).map((p) => [p.name, p]));
  const derivedMeasures = new Map((spec.screengrid?.derivedMeasures || []).map((m) => [m.name, m]));

  // --- Spec format version -------------------------------------------------
  if (!spec.version || typeof spec.version !== 'string') {
    errors.push('Spec is missing a "version" field; saved specs must declare the grammar version they conform to.');
  } else if (!/^\d+\.\d+(\.\d+)?$/.test(spec.version)) {
    errors.push(`Spec version "${spec.version}" is not a valid version string.`);
  } else if (spec.version.split('.')[0] !== SPEC_VERSION.split('.')[0]) {
    warnings.push(`Spec version ${spec.version} differs in major version from this validator (${SPEC_VERSION}); check the migration notes.`);
  }

  // --- Structural / reference checks ---------------------------------------
  if (!INTENTS.has(spec.intent?.task)) errors.push('Analytical intent is required and must be supported.');
  if (!fields.has(spec.screengrid.coordinateFields.x)) errors.push('X coordinate field is missing or unknown.');
  if (!fields.has(spec.screengrid.coordinateFields.y)) errors.push('Y coordinate field is missing or unknown.');
  if (!AGGREGATIONS.has(spec.screengrid.aggregation.function)) errors.push('Unsupported aggregation function.');
  if (!NORMALIZATIONS.has(spec.screengrid.normalization)) errors.push('Unsupported normalization.');
  if (spec.screengrid.cellSizePixels < 12 || spec.screengrid.cellSizePixels > 180) errors.push('Cell size must be between 12 and 180 pixels.');
  if (['sum', 'mean', 'max', 'min'].includes(spec.screengrid.aggregation.function) && !numeric.has(spec.screengrid.aggregation.field)) {
    errors.push('Numeric aggregation functions require a numeric aggregation field.');
  }
  if (!GLYPHS.has(spec.glyph.type)) errors.push('Unsupported glyph type.');
  if (!PALETTES.has(spec.glyph.palette)) errors.push('Unsupported palette.');

  validateParameters(spec, errors);
  validateDerivedMeasures(spec, fields, numeric, parameters, errors);

  // Aggregation function referencing derived / custom
  const aggregation = spec.screengrid.aggregation;
  if (aggregation.function === 'derived') {
    if (!aggregation.measure || !derivedMeasures.has(aggregation.measure)) {
      errors.push(`Derived aggregation references unknown measure "${aggregation.measure || ''}"; declare it in screengrid.derivedMeasures.`);
    }
  }
  if (aggregation.function === 'custom') {
    if (!aggregation.ref) {
      errors.push('Custom aggregation requires a "ref" naming a registered aggregation function.');
    }
    checkability = 'partial';
    warnings.push('This spec uses a custom aggregation function; its design logic is outside the grammar, so validation and reproducibility guarantees are partial.');
  }

  Object.entries(spec.glyph.channels || {}).forEach(([channel, config]) => {
    if (channel === 'measures') return;
    if (!config || config.field === null || config.field === 'count') return;
    if (!fields.has(config.field) && !derivedMeasures.has(config.field)) {
      errors.push(`${channel} channel references unknown field "${config.field}".`);
    }
  });
  (spec.glyph.channels?.measures || []).forEach((measure) => {
    if (derivedMeasures.has(measure.field)) return;
    if (!fields.has(measure.field)) errors.push(`Bar measure references unknown field "${measure.field}".`);
    else if (!numeric.has(measure.field)) errors.push(`Bar measure "${measure.field}" must be numeric.`);
  });

  const colorField = spec.glyph.channels?.color?.field;
  const colorProfile = spec.datasetProfile.fields.find((field) => field.name === colorField);
  if (colorProfile?.type === 'string' && spec.glyph.scales.color !== 'categorical') {
    warnings.push('Categorical color fields should use a categorical color scale.');
  }
  if (spec.glyph.type === 'pie' && !spec.glyph.channels?.segments?.field) {
    warnings.push('Pie glyphs are most useful with a categorical segments field.');
  }

  validateSummaries(spec, fields, numeric, errors);
  validateCartography(spec, numeric, categoricalProfiles, derivedMeasures, warnings);
  validateTooltip(spec, fields, numeric, errors);
  validateCustomGlyph(spec, fields, numeric, errors, warnings);

  return { valid: errors.length === 0, errors, warnings, checkability };
}

function validateParameters(spec, errors) {
  const seen = new Set();
  (spec.parameters || []).forEach((param, index) => {
    const label = param.name || `#${index + 1}`;
    if (!param.name) errors.push(`Parameter ${label} is missing a name.`);
    if (param.name && seen.has(param.name)) errors.push(`Duplicate parameter name "${param.name}".`);
    seen.add(param.name);
    const domain = param.domain;
    if (!Array.isArray(domain) || domain.length !== 2 || !domain.every(Number.isFinite) || domain[0] >= domain[1]) {
      errors.push(`Parameter "${label}" needs a numeric domain [min, max] with min < max.`);
      return;
    }
    if (!Number.isFinite(param.default)) {
      errors.push(`Parameter "${label}" needs a numeric default.`);
    } else if (param.default < domain[0] || param.default > domain[1]) {
      errors.push(`Parameter "${label}" default ${param.default} is outside its domain [${domain[0]}, ${domain[1]}].`);
    }
  });
}

function validateDerivedMeasures(spec, fields, numeric, parameters, errors) {
  const seen = new Set();
  (spec.screengrid?.derivedMeasures || []).forEach((measure, index) => {
    const label = measure.name || `#${index + 1}`;
    if (!measure.name) errors.push(`Derived measure ${label} is missing a name.`);
    if (measure.name && seen.has(measure.name)) errors.push(`Duplicate derived measure name "${measure.name}".`);
    seen.add(measure.name);
    if (!DERIVED_OPS.has(measure.op)) {
      errors.push(`Derived measure "${label}" has unsupported op "${measure.op}".`);
      return;
    }

    const checkTerm = (term, context) => {
      if (!term || !term.field) {
        errors.push(`Derived measure "${label}" ${context} is missing a field.`);
        return;
      }
      if (!fields.has(term.field)) errors.push(`Derived measure "${label}" ${context} references unknown field "${term.field}".`);
      else if (!numeric.has(term.field)) errors.push(`Derived measure "${label}" ${context} field "${term.field}" must be numeric.`);
      if (term.weight && typeof term.weight === 'object') {
        if (!parameters.has(term.weight.param)) {
          errors.push(`Derived measure "${label}" ${context} weight references unknown parameter "${term.weight.param}".`);
        }
      }
    };

    if (measure.op === 'weighted-sum') {
      if (!Array.isArray(measure.terms) || measure.terms.length === 0) {
        errors.push(`Derived measure "${label}" (weighted-sum) requires at least one term.`);
      }
      (measure.terms || []).forEach((term, i) => checkTerm(term, `term ${i + 1}`));
    } else if (measure.op === 'difference') {
      if (!Array.isArray(measure.terms) || measure.terms.length !== 2) {
        errors.push(`Derived measure "${label}" (difference) requires exactly two terms.`);
      }
      (measure.terms || []).forEach((term, i) => checkTerm(term, `term ${i + 1}`));
    } else if (measure.op === 'ratio') {
      checkTerm(measure.numerator, 'numerator');
      const denominator = measure.denominator;
      if (!denominator || !denominator.type) {
        errors.push(`Derived measure "${label}" (ratio) requires an explicit denominator ({type: count|field|area|external}).`);
      } else if (denominator.type === 'field') {
        if (!denominator.field) errors.push(`Derived measure "${label}" denominator of type "field" needs a field.`);
        else if (!fields.has(denominator.field)) errors.push(`Derived measure "${label}" denominator references unknown field "${denominator.field}".`);
        else if (!numeric.has(denominator.field)) errors.push(`Derived measure "${label}" denominator field "${denominator.field}" must be numeric.`);
      } else if (denominator.type === 'external' && !Number.isFinite(denominator.value)) {
        errors.push(`Derived measure "${label}" denominator of type "external" needs a numeric value.`);
      }
    }
  });
}

function validateSummaries(spec, fields, numeric, errors) {
  (spec.screengrid?.summaries || []).forEach((summary) => {
    const label = summary.name || summary.op;
    if (summary.field && !fields.has(summary.field)) {
      errors.push(`Summary "${label}" references unknown field "${summary.field}".`);
    }
    const per = summary.per;
    if (per && per.type === 'field') {
      if (!per.field) errors.push(`Summary "${label}" denominator of type "field" needs a field.`);
      else if (!fields.has(per.field)) errors.push(`Summary "${label}" denominator references unknown field "${per.field}".`);
      else if (!numeric.has(per.field)) errors.push(`Summary "${label}" denominator field "${per.field}" must be numeric.`);
    }
    if (per && per.type === 'external' && !Number.isFinite(per.value)) {
      errors.push(`Summary "${label}" denominator of type "external" needs a numeric value.`);
    }
  });
}

function validateCartography(spec, numeric, categoricalProfiles, derivedMeasures, warnings) {
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
  if ((task === 'uncertainty' || task === 'anomaly') && !specEncodesUncertainty(spec)) {
    warnings.push('This glyph does not explicitly encode uncertainty; add a band, interval, or whisker mark, bind the opacity channel to a reliability field, or use a glyph with uncertainty support.');
  }

  // Derived-measure comparability (the MCDA rules)
  const aggregation = spec.screengrid.aggregation;
  const activeDerived = aggregation.function === 'derived' ? derivedMeasures.get(aggregation.measure) : null;
  if (activeDerived && comparison && comparison !== 'within-cell' && spec.screengrid.normalization === 'max-local') {
    warnings.push(`Derived measure "${activeDerived.name}" is compared ${comparison} under local normalization; composite scores are only comparable across cells with global normalization.`);
  }
  if (activeDerived?.op === 'weighted-sum') {
    const unnormalized = (activeDerived.terms || []).filter((term) => (term.normalize || 'none') === 'none');
    if (unnormalized.length > 0 && (activeDerived.terms || []).length > 1) {
      warnings.push(`Derived measure "${activeDerived.name}" combines criteria without per-term normalization (${unnormalized.map((t) => t.field).join(', ')}); raw-unit criteria are not commensurable in a weighted sum.`);
    }
  }
  if (comparison === 'across-viewports') {
    const hasDenominator = (spec.screengrid.summaries || []).some((summary) => summary.per && summary.per.type !== 'none')
      || (spec.screengrid.derivedMeasures || []).some((measure) => measure.op === 'ratio');
    if (!hasDenominator) {
      warnings.push('Cross-viewport claims usually need an explicit denominator (a per/ratio definition); absolute screen-cell values change with the view.');
    }
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

function specEncodesUncertainty(spec) {
  if (spec.glyph.limits?.supportsUncertainty) return true;
  if (spec.glyph.channels?.opacity?.field && spec.glyph.channels.opacity.field !== 'count') return true;
  const marks = spec.glyph.custom?.marks || [];
  return marks.some((mark) => UNCERTAINTY_MARKS.has(mark.mark));
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
    if (!['line', 'point', 'wedge', 'ring', 'band', 'interval', 'whisker'].includes(mark.mark)) {
      errors.push(`Custom mark ${index + 1} has an unsupported mark type.`);
    }
    const dataFields = mark.data?.fields || [];
    dataFields.forEach((field) => {
      if (!fields.has(field)) errors.push(`Custom mark references unknown field "${field}".`);
      else if (!numeric.has(field)) errors.push(`Custom mark field "${field}" must be numeric.`);
    });
    if (UNCERTAINTY_MARKS.has(mark.mark)) {
      ['lower', 'upper'].forEach((bound) => {
        const boundField = mark.data?.[bound];
        if (!boundField) {
          errors.push(`Custom ${mark.mark} mark ${index + 1} requires data.${bound}.`);
        } else if (!fields.has(boundField)) {
          errors.push(`Custom ${mark.mark} mark references unknown ${bound} field "${boundField}".`);
        } else if (!numeric.has(boundField)) {
          errors.push(`Custom ${mark.mark} mark ${bound} field "${boundField}" must be numeric.`);
        }
      });
      const centerField = mark.data?.field;
      if (centerField && !fields.has(centerField)) {
        errors.push(`Custom ${mark.mark} mark references unknown field "${centerField}".`);
      }
    }
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
