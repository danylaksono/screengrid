/**
 * SemanticCellSummarizer.js
 * Builds first-class analytical cell objects from aggregated screen cells.
 */

export class SemanticCellSummarizer {
  static summarizeGrid({
    grid,
    cellData,
    customData = [],
    cols,
    rows,
    width,
    height,
    cellSizePixels,
    aggregationMode = 'screen-grid',
    normalizationFunction = 'max-local',
    zoomLevel = null
  }) {
    const cells = new Array(grid.length).fill(null);
    const populatedCells = [];

    // `comparability` and `viewport` are identical for every cell in a single
    // aggregation, so build them once and share the references (this loop runs
    // per frame; per-cell object churn here is a measurable hot-path cost).
    const comparability = comparabilityFor(aggregationMode, normalizationFunction);
    const viewport = { width, height };

    for (let idx = 0; idx < grid.length; idx += 1) {
      const records = cellData[idx] || [];
      if (!records.length && !hasValue(grid[idx])) continue;

      const col = cols ? idx % cols : 0;
      const row = cols ? Math.floor(idx / cols) : idx;
      const x = col * cellSizePixels;
      const y = row * cellSizePixels;
      const cell = SemanticCellSummarizer.createCell({
        index: idx,
        value: grid[idx],
        records,
        custom: customData[idx],
        spatial: {
          type: 'screen-cell',
          aggregationMode,
          col,
          row,
          bounds: { x, y, width: cellSizePixels, height: cellSizePixels },
          centroid: { x: x + cellSizePixels / 2, y: y + cellSizePixels / 2 },
          zoom: zoomLevel,
          cellSizePixels,
          viewport
        },
        comparability
      });
      cells[idx] = cell;
      populatedCells.push(cell);
    }

    return { cells, populatedCells };
  }

  static summarizeHex({
    grid,
    cellData,
    customData = [],
    hexCoords,
    hexRadius,
    width,
    height,
    aggregationMode = 'screen-hex',
    normalizationFunction = 'max-local',
    zoomLevel = null
  }) {
    const cells = new Array(grid.length).fill(null);
    const populatedCells = [];

    // Shared per-aggregation references (see summarizeGrid).
    const comparability = comparabilityFor(aggregationMode, normalizationFunction);
    const viewport = { width, height };
    const hexDiameter = hexRadius * 2;

    for (let idx = 0; idx < grid.length; idx += 1) {
      const records = cellData[idx] || [];
      if (!records.length && !hasValue(grid[idx])) continue;

      const coords = hexCoords[idx];
      const centroid = {
        x: hexRadius * (Math.sqrt(3) * coords.q + Math.sqrt(3) / 2 * coords.r),
        y: hexRadius * (3 / 2 * coords.r)
      };
      const cell = SemanticCellSummarizer.createCell({
        index: idx,
        value: grid[idx],
        records,
        custom: customData[idx],
        spatial: {
          type: 'screen-hex',
          aggregationMode,
          hexCoords: coords,
          bounds: {
            x: centroid.x - hexRadius,
            y: centroid.y - hexRadius,
            width: hexDiameter,
            height: hexDiameter
          },
          centroid,
          zoom: zoomLevel,
          cellSizePixels: hexDiameter,
          viewport
        },
        comparability
      });
      cells[idx] = cell;
      populatedCells.push(cell);
    }

    return { cells, populatedCells };
  }

  static createCell({ index, value, records, custom = null, spatial, comparability }) {
    return new SemanticCell(index, value, records, custom, spatial, comparability);
  }

  /**
   * Attach `cells`, `populatedCells`, and `cellSemantics` to an aggregation
   * result as lazy, memoised getters. The full semantic array is only built the
   * first time one of these is read, so the render loop (which reads `grid`/
   * `cellData` for the default colour path) pays no per-frame cost unless a
   * consumer — a custom glyph callback, hover query, or inspector — asks for it.
   *
   * @param {Object} result - Aggregation result (grid mode or hex mode)
   * @param {Object} options - {aggregationMode, normalizationFunction, zoomLevel}
   * @returns {Object} The same result object, augmented with lazy accessors
   */
  static attachLazy(result, options = {}) {
    let computed;
    const compute = () => {
      if (computed === undefined) {
        const isHex = result.type === 'hex' || Array.isArray(result.hexCoords);
        computed = isHex
          ? SemanticCellSummarizer.summarizeHex({ ...result, ...options })
          : SemanticCellSummarizer.summarizeGrid({ ...result, ...options });
      }
      return computed;
    };

    Object.defineProperty(result, 'cells', {
      enumerable: false, configurable: true, get() { return compute().cells; }
    });
    Object.defineProperty(result, 'cellSemantics', {
      enumerable: false, configurable: true, get() { return compute().cells; }
    });
    Object.defineProperty(result, 'populatedCells', {
      enumerable: false, configurable: true, get() { return compute().populatedCells; }
    });

    return result;
  }
}

/**
 * A single analytical cell. Data facets are plain own properties (cheap to
 * construct in the per-frame summarize loop). The two EXPENSIVE facets —
 * `measures` and `reliability` — are prototype getters, so:
 *   - constructing a cell costs no more than a plain object (no per-cell
 *     `Object.defineProperty`, which profiling showed dominates the glyph path);
 *   - `{...cell}`/`Object.assign` do NOT trigger them (they are not own props),
 *     so spreading a cell never forces the field statistics;
 *   - they are computed once, on first read, and memoised via a non-enumerable
 *     cache prop so nothing (spread, JSON) leaks internal state.
 * Consumers that need these facets to survive a copy must inherit from the cell
 * (e.g. `Object.create(cell)`) rather than spread it — see Renderer/CellQueryEngine.
 */
class SemanticCell {
  constructor(index, value, records, custom, spatial, comparability) {
    this.index = index;
    this.id = `${spatial.type}:${index}`;
    this.value = value;
    this.spatial = spatial;
    this.records = {
      count: records.length,
      denominator: records.length,
      rawRefs: records
    };
    this.comparability = comparability;
    this.custom = custom;
    // Legacy aliases kept during the migration window.
    this.cellData = records;
    this.customData = custom;
    this.cellSize = spatial.cellSizePixels;
    this.glyphRadius = spatial.cellSizePixels * 0.4;
    this.col = spatial.col;
    this.row = spatial.row;
    this.x = spatial.bounds ? spatial.bounds.x : undefined;
    this.y = spatial.bounds ? spatial.bounds.y : undefined;
    this.center = spatial.centroid;
    this.hexCoords = spatial.hexCoords;
    // Per-draw fields populated by the renderer just before invoking onDrawCell.
    // Pre-declared here so the object shape stays monomorphic (the renderer
    // assigns these directly onto the cell instead of allocating a wrapper per
    // glyph — Object.create/spread per glyph was the dominant glyph-path cost).
    this.normalizedValue = undefined;
    this.zoomLevel = spatial.zoom;
    this.isHovered = false;
    this.grid = undefined;
  }

  /**
   * Populate the per-draw fields the glyph callback expects, in place. Returns
   * `this` so the renderer can pass the cell directly to `onDrawCell` with no
   * allocation. Safe because cells are rebuilt every frame and drawn once.
   */
  withRenderState(normalizedValue, glyphRadius, isHovered, grid, zoomLevel) {
    this.normalizedValue = normalizedValue;
    this.glyphRadius = glyphRadius;
    this.isHovered = isHovered;
    this.grid = grid;
    if (zoomLevel !== undefined) this.zoomLevel = zoomLevel;
    return this;
  }

  get measures() {
    if (this.__measures === undefined) {
      const m = summarizeMeasures(this.records.rawRefs);
      // Non-enumerable so it never leaks via spread/JSON. Written on first read
      // only, so the common (never-read) case pays nothing.
      Object.defineProperty(this, '__measures', { value: m, configurable: true });
    }
    return this.__measures;
  }

  get reliability() {
    if (this.__reliability === undefined) {
      const r = summarizeReliability(this.records.rawRefs, this.measures);
      Object.defineProperty(this, '__reliability', { value: r, configurable: true });
    }
    return this.__reliability;
  }
}

function summarizeMeasures(records) {
  const count = records.length;
  const fieldValues = new Map();

  records.forEach((record) => {
    const data = record.data || {};
    Object.keys(data).forEach((field) => {
      if (!fieldValues.has(field)) fieldValues.set(field, []);
      fieldValues.get(field).push(data[field]);
    });
  });

  const fields = {};
  for (const [field, values] of fieldValues.entries()) {
    // Single pass: presence, numeric stats, and distinct numeric values. Uses a
    // running min/max loop (NOT Math.min(...spread), which overflows the call
    // stack on dense cells) and a numeric Set (not a stringified one).
    let present = 0;
    let numericCount = 0;
    let total = 0;
    let min = Infinity;
    let max = -Infinity;
    const numericDistinct = new Set();
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (value === null || value === undefined || value === '') continue;
      present += 1;
      const n = Number(value);
      if (Number.isFinite(n)) {
        numericCount += 1;
        total += n;
        if (n < min) min = n;
        if (n > max) max = n;
        numericDistinct.add(n);
      }
    }

    if (numericCount && numericCount / present >= 0.85) {
      const mean = total / numericCount;
      // Second pass for a numerically stable variance (sum of squared deviations
      // rather than E[x^2] - E[x]^2, which loses precision on large values).
      let variance = 0;
      for (let i = 0; i < values.length; i += 1) {
        const n = Number(values[i]);
        if (Number.isFinite(n)) {
          const d = n - mean;
          variance += d * d;
        }
      }
      variance /= numericCount;
      fields[field] = {
        type: 'number',
        count: numericCount,
        missing: count - numericCount,
        sum: total,
        mean,
        min,
        max,
        variance,
        stddev: Math.sqrt(variance),
        distinct: numericDistinct.size
      };
    } else {
      // Categorical: tally only when the field isn't numeric, so numeric fields
      // never pay for a category map.
      const counts = new Map();
      for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        if (value === null || value === undefined || value === '') continue;
        const key = String(value);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const categories = Array.from(counts.entries())
        .map(([value, c]) => ({ value, count: c }))
        .sort((a, b) => b.count - a.count);
      fields[field] = {
        type: 'category',
        count: present,
        missing: count - present,
        distinct: categories.length,
        mode: categories[0]?.value ?? null,
        categories
      };
    }
  }

  return {
    count,
    weight: records.reduce((total, record) => total + (Number(record.weight) || 0), 0),
    fields
  };
}

function summarizeReliability(records, measures) {
  const count = records.length;
  const fields = Object.values(measures.fields || {});
  const missingFields = fields.filter((field) => field.missing > 0).length;
  const heterogeneousFields = fields.filter((field) => {
    if (field.type !== 'number' || !Number.isFinite(field.mean) || field.mean === 0) return false;
    return Math.abs(field.stddev / field.mean) > 1;
  }).length;

  const warnings = [];
  if (count > 0 && count < 5) warnings.push('low-sample-size');
  if (missingFields > 0) warnings.push('missing-values');
  if (heterogeneousFields > 0) warnings.push('high-within-cell-heterogeneity');

  return {
    sampleSize: count,
    sampleSizeClass: count < 5 ? 'low' : count < 20 ? 'medium' : 'high',
    missingFieldCount: missingFields,
    heterogeneousFieldCount: heterogeneousFields,
    warnings
  };
}

function comparabilityFor(aggregationMode, normalizationFunction) {
  const normalization = normalizationFunction || 'max-local';
  return {
    normalization,
    viewportDependent: aggregationMode === 'screen-grid' || aggregationMode === 'screen-hex',
    validAcrossZoom: false,
    comparableAcrossCells: normalization.includes('global') || normalization === 'z-score',
    comparableAcrossViewports: normalization.includes('global')
  };
}

function hasValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (value && typeof value === 'object') return Object.values(value).some((item) => {
    const numeric = Number(item);
    return Number.isFinite(numeric) && numeric !== 0;
  });
  return false;
}
