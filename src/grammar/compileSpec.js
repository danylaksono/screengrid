/**
 * compileSpec.js
 * Compiles a declarative Screengrid spec into executable pieces for ScreenGridLayerGL.
 *
 * This is the bridge between the grammar and the (deliberately generic) library:
 * derived measures and parameters are compiled into an ordinary aggregation function
 * and passed through the library's existing hooks — the library itself stays
 * domain-agnostic. Cell records have the shape pushed by Aggregator:
 * { data, weight, projectedX, projectedY }.
 *
 * The visual half (palette, glyph marks, legend) is compiled by ./compileGlyph.js
 * and folded into the same layerOptions, so a validated spec renders on its own.
 */

import { compileGlyph } from './compileGlyph.js';

/**
 * Resolve parameter values: declared defaults overlaid with runtime overrides,
 * clamped to each parameter's domain.
 * @param {Object} spec - Screengrid spec
 * @param {Object} overrides - {paramName: value} runtime values (e.g. from sliders)
 * @returns {Object} {paramName: number}
 */
export function resolveParameters(spec, overrides = {}) {
  const values = {};
  (spec.parameters || []).forEach((param) => {
    let value = Object.prototype.hasOwnProperty.call(overrides, param.name)
      ? Number(overrides[param.name])
      : param.default;
    if (!Number.isFinite(value)) value = param.default;
    const [min, max] = param.domain || [-Infinity, Infinity];
    values[param.name] = Math.min(max, Math.max(min, value));
  });
  return values;
}

/**
 * Compile a derived measure into an aggregation function usable as
 * ScreenGridLayerGL's `aggregationFunction` (records => number).
 * @param {Object} spec - Screengrid spec (needed for datasetProfile stats and parameters)
 * @param {string} measureName - name of an entry in screengrid.derivedMeasures
 * @param {Object} parameterOverrides - runtime parameter values
 * @returns {Function} (records) => number
 */
export function compileDerivedMeasure(spec, measureName, parameterOverrides = {}) {
  const measure = (spec.screengrid?.derivedMeasures || []).find((m) => m.name === measureName);
  if (!measure) throw new Error(`Unknown derived measure "${measureName}".`);
  const params = resolveParameters(spec, parameterOverrides);
  const fieldStats = new Map((spec.datasetProfile?.fields || []).map((f) => [f.name, f]));

  const termWeight = (term) => {
    if (term.weight === undefined || term.weight === null) return 1;
    if (typeof term.weight === 'number') return term.weight;
    const value = params[term.weight.param];
    if (!Number.isFinite(value)) throw new Error(`Weight parameter "${term.weight.param}" has no value.`);
    return value;
  };

  // Global term normalization uses the dataset profile's field range, so a record's
  // contribution is stable regardless of the current viewport (commensurable criteria).
  const termValue = (term, record) => {
    const raw = Number(record?.data?.[term.field]);
    if (!Number.isFinite(raw)) return null;
    let value = raw;
    if ((term.normalize || 'none') === 'global') {
      const stats = fieldStats.get(term.field);
      const min = Number(stats?.min);
      const max = Number(stats?.max);
      value = Number.isFinite(min) && Number.isFinite(max) && max > min ? (raw - min) / (max - min) : 0;
    }
    if (term.invert) value = 1 - value;
    return value;
  };

  const aggregate = measure.aggregate === 'sum' ? 'sum' : 'mean';

  if (measure.op === 'weighted-sum' || measure.op === 'difference') {
    const terms = measure.terms || [];
    const signs = measure.op === 'difference' ? [1, -1] : terms.map(() => 1);
    return function derivedAggregation(records) {
      let total = 0;
      let counted = 0;
      for (const record of records) {
        let score = 0;
        let valid = true;
        for (let t = 0; t < terms.length; t++) {
          const value = termValue(terms[t], record);
          if (value === null) { valid = false; break; }
          score += signs[t] * termWeight(terms[t]) * value;
        }
        if (!valid) continue;
        total += score;
        counted += 1;
      }
      if (counted === 0) return 0;
      return aggregate === 'sum' ? total : total / counted;
    };
  }

  if (measure.op === 'ratio') {
    const numerator = measure.numerator;
    const denominator = measure.denominator || { type: 'count' };
    return function ratioAggregation(records) {
      let top = 0;
      for (const record of records) {
        const value = termValue(numerator, record);
        if (value !== null) top += termWeight(numerator) * value;
      }
      let bottom = 0;
      if (denominator.type === 'count') {
        bottom = records.length;
      } else if (denominator.type === 'field') {
        for (const record of records) {
          const value = Number(record?.data?.[denominator.field]);
          if (Number.isFinite(value)) bottom += value;
        }
      } else if (denominator.type === 'external') {
        bottom = denominator.value;
      } else if (denominator.type === 'area') {
        // Screen-space cell area is constant per aggregation; the renderer's
        // normalization handles scale, so per-area reduces to the raw sum here.
        bottom = 1;
      }
      return bottom > 0 ? top / bottom : 0;
    };
  }

  throw new Error(`Unsupported derived measure op "${measure.op}".`);
}

/**
 * Compile a spec into ScreenGridLayerGL constructor options (data not included).
 *
 * Emits BOTH halves of a layer: the analytical half (aggregation, cell size,
 * normalization, positions) and the visual half (palette colour scale, glyph
 * draw callback, legend descriptor) compiled by `compileGlyph`. A spec is
 * therefore a complete, reproducible description of a map — pass `data` and add
 * the layer. Use `{ glyph: false }` to emit only the analytical half when the
 * application supplies its own rendering.
 *
 * @param {Object} spec - Screengrid spec
 * @param {Object} options
 * @param {Object} options.parameters - runtime parameter overrides
 * @param {Object} options.customFunctions - {ref: fn} implementations for
 *   aggregation.function === 'custom' escape-hatch specs
 * @param {boolean} [options.glyph=true] - compile the visual half
 * @param {number} [options.glyphSize=0.9] - mark size as a fraction of the cell
 * @param {Function} [options.onAggregate] - application aggregation callback,
 *   composed with (not replaced by) the glyph compiler's domain pass
 * @returns {Object} {layerOptions, parameters, checkability, legend}
 */
export function compileSpec(spec, {
  parameters = {},
  customFunctions = {},
  glyph = true,
  glyphSize = 0.9,
  onAggregate = null,
} = {}) {
  const resolved = resolveParameters(spec, parameters);
  const aggregation = spec.screengrid.aggregation;
  let aggregationFunction;
  let checkability = 'full';

  if (aggregation.function === 'derived') {
    aggregationFunction = compileDerivedMeasure(spec, aggregation.measure, parameters);
  } else if (aggregation.function === 'custom') {
    checkability = 'partial';
    aggregationFunction = customFunctions[aggregation.ref];
    if (typeof aggregationFunction !== 'function') {
      throw new Error(`Custom aggregation "${aggregation.ref}" was not supplied in options.customFunctions.`);
    }
  } else if (aggregation.function === 'count') {
    aggregationFunction = 'count';
  } else {
    // Numeric builtins operate on a field of the original datum; adapt weight-based
    // builtins by mapping the field into the record weight the library aggregates.
    const field = aggregation.field;
    const builtin = aggregation.function;
    aggregationFunction = function fieldAggregation(records) {
      const values = [];
      for (const record of records) {
        const value = Number(record?.data?.[field]);
        if (Number.isFinite(value)) values.push(value);
      }
      if (values.length === 0) return 0;
      if (builtin === 'sum') return values.reduce((a, b) => a + b, 0);
      if (builtin === 'mean') return values.reduce((a, b) => a + b, 0) / values.length;
      if (builtin === 'max') return values.reduce((a, b) => (b > a ? b : a), -Infinity);
      if (builtin === 'min') return values.reduce((a, b) => (b < a ? b : a), Infinity);
      return 0;
    };
  }

  const { x, y } = spec.screengrid.coordinateFields;
  const layerOptions = {
    aggregationMode: spec.screengrid.aggregationMode,
    cellSizePixels: spec.screengrid.cellSizePixels,
    normalizationFunction: spec.screengrid.normalization,
    aggregationFunction,
    getPosition: (d) => [Number(d[x]), Number(d[y])],
    getWeight: () => 1,
  };

  if (!glyph) {
    if (onAggregate) layerOptions.onAggregate = onAggregate;
    return { layerOptions, parameters: resolved, checkability, legend: null };
  }

  const compiledGlyph = compileGlyph(spec, { glyphSize, onAggregate });
  layerOptions.colorScale = compiledGlyph.colorScale;
  layerOptions.enableGlyphs = compiledGlyph.enableGlyphs;
  layerOptions.showBackground = compiledGlyph.showBackground;
  layerOptions.glyphSize = compiledGlyph.glyphSize;
  if (compiledGlyph.onDrawCell) layerOptions.onDrawCell = compiledGlyph.onDrawCell;
  if (compiledGlyph.onAggregate) layerOptions.onAggregate = compiledGlyph.onAggregate;

  return {
    layerOptions,
    parameters: resolved,
    checkability,
    legend: compiledGlyph.legend,
    glyph: compiledGlyph,
  };
}
