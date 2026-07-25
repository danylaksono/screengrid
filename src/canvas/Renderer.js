/**
 * Renderer.js
 * Canvas drawing logic for grid cells
 */

import { Logger } from '../utils/Logger.js';
import {
  NormalizationFunctionRegistry,
  NormalizationFunctions,
  maxLocalNormalization,
  maxGlobalNormalization,
  zScoreNormalization,
} from '../normalization/functions/index.js';

// Built-in normalizations that never read `context.sortedValues`. When the
// active normalization is one of these, the renderer skips the per-frame
// O(n log n) sort entirely (the common max-local/max-global/z-score paths).
// Percentile — and any custom function that might read sortedValues — is not
// listed, so it still gets a prepared sorted array (percentile also has its own
// fallback in PercentileNormalization.js if the array is ever absent).
const NON_SORTING_NORMALIZATIONS = new Set([
  maxLocalNormalization,
  maxGlobalNormalization,
  zScoreNormalization,
]);

export class Renderer {
  constructor() {}

  /**
   * Check whether a grid cell contains data.
   * Prefers the per-cell point list (a cell that aggregates to 0 or a negative
   * value still contains data); falls back to inspecting the value itself.
   * @private
   */
  static _cellHasData(value, points) {
    if (points !== undefined && points !== null) {
      return Array.isArray(points) && points.length > 0;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    // For objects (multi-attribute aggregation), check if any numeric property > 0
    return !!value && typeof value === 'object' &&
      Object.values(value).some(v => typeof v === 'number' && v > 0);
  }

  /**
   * Extract a single numeric value from a cell value that may be a number or
   * an object (multi-attribute aggregation).
   * @private
   */
  static _numericCellValue(value) {
    if (typeof value === 'number') {
      return value;
    }
    if (value && typeof value === 'object') {
      let sum = 0;
      let found = false;
      for (const v of Object.values(value)) {
        if (typeof v === 'number') {
          sum += v;
          found = true;
        }
      }
      return found ? sum : 0;
    }
    return 0;
  }

  /**
   * Compute statistics for normalization context
   * @param {Array} grid - Array of aggregated cell values
   * @param {Array<Array>|null} cellData - Optional per-cell point lists; when
   *   provided, cells are counted as "with data" based on point count rather
   *   than value > 0 (so zero/negative aggregates are not dropped).
   * @param {Object} [options]
   * @param {boolean} [options.needsSorted=true] - When false, `sortedValues` is
   *   left empty so the render loop avoids an O(n log n) sort every frame. Only
   *   the percentile normalization consumes `sortedValues`; the default paths do
   *   not, so callers that know the active normalization can opt out.
   * @private
   */
  static _computeStats(grid, cellData = null, { needsSorted = true } = {}) {
    const values = [];
    for (let i = 0; i < grid.length; i++) {
      const points = cellData ? cellData[i] : undefined;
      if (Renderer._cellHasData(grid[i], points)) {
        values.push(Renderer._numericCellValue(grid[i]));
      }
    }

    if (values.length === 0) {
      return {
        max: 0,
        min: 0,
        mean: 0,
        std: 0,
        totalValue: 0,
        cellsWithData: 0,
        sortedValues: [],
      };
    }

    // Single pass for min/max/sum (avoids Math.max(...values) stack overflow
    // on large grids), second pass for variance.
    let min = Infinity;
    let max = -Infinity;
    let totalValue = 0;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
      totalValue += v;
    }
    const mean = totalValue / values.length;
    let variance = 0;
    for (const v of values) {
      variance += (v - mean) * (v - mean);
    }
    variance /= values.length;
    const std = Math.sqrt(variance);

    const sortedValues = needsSorted ? values.slice().sort((a, b) => a - b) : [];

    return {
      max,
      min,
      mean,
      std,
      totalValue,
      cellsWithData: values.length,
      sortedValues,
    };
  }

  /**
   * Public stats helper for aggregation modes that need renderer-compatible
   * normalization context.
   */
  static computeStats(grid, cellData = null, options = {}) {
    return Renderer._computeStats(grid, cellData, options);
  }

  /**
   * Whether a resolved normalization function reads `context.sortedValues`.
   * Used to decide if `_computeStats` should pay for the per-frame sort.
   */
  static _needsSortedValues(normFn) {
    return !NON_SORTING_NORMALIZATIONS.has(normFn);
  }

  /**
   * Render grid cells to canvas
   * @param {Object} aggregationResult - Result from Aggregator.aggregate()
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} config - Configuration options
   * @param {Function} config.colorScale - Color function: (normalizedValue) => [r, g, b, a]
   * @param {boolean} config.enableGlyphs - Enable glyph rendering
   * @param {Function} config.onDrawCell - Custom glyph drawing callback
   * @param {number} config.glyphSize - Glyph size factor
   * @param {Function|string} config.normalizationFunction - Normalization function or name (default: max-local)
   * @param {Object} config.normalizationContext - Additional context for normalization (e.g., globalMax)
   */
  static render(aggregationResult, ctx, config) {
    if (!aggregationResult || !ctx) {
      Logger.log('[Renderer] No aggregation result or context available for rendering', {
        hasResult: !!aggregationResult,
        hasContext: !!ctx
      });
      return;
    }

    // NB: `cells` (semantic summaries) is intentionally NOT destructured here.
    // It is a lazy getter on the result; reading it eagerly would build every
    // semantic cell each frame. It is accessed only inside the glyph branch below.
    const { grid, cellData, customData = [], cols, rows, cellSizePixels } = aggregationResult;
    const { 
      colorScale, 
      enableGlyphs, 
      onDrawCell, 
      glyphSize, 
      showBackground,
      normalizationFunction,
      normalizationContext = {},
      zoomLevel = 0, // Passed from Layer
      isHovered = false, // Current cell hovered state
      hoveredIndex = -1 // Global hovered index
    } = config;

    // Get normalization function (default to max-local for backward compatibility)
    const normFn = normalizationFunction
      ? (NormalizationFunctionRegistry.get(normalizationFunction) || normalizationFunction)
      : NormalizationFunctions.maxLocal;

    // Compute stats for normalization (cell "has data" is based on point
    // count, so cells that aggregate to 0 or negative values still render).
    // Only sort cell values when the active normalization actually needs them.
    const stats = Renderer._computeStats(grid, cellData, {
      needsSorted: Renderer._needsSortedValues(normFn),
    });

    if (stats.cellsWithData === 0) {
      return;
    }

    // Build normalization context
    const normContext = {
      ...stats,
      ...normalizationContext,
    };

    // Clear canvas
    ctx.clearRect(0, 0, aggregationResult.width, aggregationResult.height);

    // Render each cell
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const val = grid[idx];

        if (Renderer._cellHasData(val, cellData ? cellData[idx] : undefined)) {
          const x = c * cellSizePixels;
          const y = r * cellSizePixels;

          // Normalize value using normalization function
          // For objects, pass the primary value or the first numeric value
          const cellValue = typeof val === 'number'
            ? val
            : (val && typeof val === 'object'
              ? (val.value !== undefined ? val.value : Object.values(val).find(v => typeof v === 'number') || 0)
              : 0);

          let normVal = normFn(grid, cellValue, idx, normContext);

          // Skip normalization if result is not a number (e.g., multi-attribute aggregation)
          if (typeof normVal !== 'number' || isNaN(normVal)) {
            continue;
          }

          // Clamp so colorScale/onDrawCell always receive a value in [0, 1]
          // (negative aggregates or globalMax overrides can fall outside)
          normVal = Math.min(1, Math.max(0, normVal));

          // Determine if background should be drawn
          // New default: when glyphs are active (enableGlyphs && onDrawCell),
          // backgrounds are OFF unless showBackground is explicitly true.
          // When glyphs are not active, backgrounds remain ON by default.
          const glyphsActive = enableGlyphs && !!onDrawCell;
          const shouldShowBackground = glyphsActive
            ? showBackground === true
            : showBackground !== false;
          const drawBackground = !glyphsActive || shouldShowBackground;

          // Draw background if needed
          if (drawBackground) {
            Renderer._drawCell(ctx, x, y, cellSizePixels, normVal, colorScale, enableGlyphs && onDrawCell);
          }

          // Draw glyph on top if enabled
          if (enableGlyphs && onDrawCell) {
            Renderer._drawGlyph(
              ctx,
              x,
              y,
              cellSizePixels,
              normVal,
              glyphSize,
              onDrawCell,
              cellData[idx],
              c,
              r,
              idx,
              customData[idx],
              // Lazy: cellAt() builds just this cell (or reuses the full array
              // if something else already forced it this frame); the expensive
              // measures/reliability on the cell remain lazy until the
              // callback actually reads them.
              aggregationResult.cellAt ? aggregationResult.cellAt(idx) : null,
              {
                value: val,
                normalizedValue: normVal,
                zoomLevel,
                isHovered: (idx === hoveredIndex),
                grid
              }
            );
          }
        }
      }
    }
  }

  /**
   * Draw a colored cell
   * @private
   */
  static _drawCell(ctx, x, y, size, normVal, colorScale, withGlyphs = false) {
    const [rC, gC, bC, aC] = colorScale(normVal);
    // Reduce opacity slightly when glyphs are enabled to make them stand out
    const opacity = withGlyphs ? aC * 0.6 : aC;
    ctx.fillStyle = `rgba(${rC}, ${gC}, ${bC}, ${opacity / 255})`;
    ctx.fillRect(x, y, size, size);
  }

  /**
   * Draw a custom glyph
   * @private
   */
  static _drawGlyph(
    ctx,
    x,
    y,
    cellSize,
    normVal,
    glyphSize,
    onDrawCell,
    cellDataArray,
    col,
    row,
    index,
    customData = null,
    semanticCell = null,
    context = {}
  ) {
    const cellCenterX = x + cellSize / 2;
    const cellCenterY = y + cellSize / 2;
    const glyphRadius = (cellSize * glyphSize) / 2;

    ctx.save();

    try {
      // The semantic cell already carries cellData/customData/col/row/index/
      // cellSize/value as own props. Populate the per-draw fields in place and
      // pass the cell directly — no per-glyph allocation. (Profiling showed a
      // wrapper object per glyph, via Object.create or spread, dominated the
      // glyph render path.) Lazy `measures`/`reliability` stay lazy on the cell.
      const cellArg = semanticCell
        ? semanticCell.withRenderState(context.normalizedValue, glyphRadius, context.isHovered, context.grid, context.zoomLevel)
        : { cellData: cellDataArray, col, row, index, glyphRadius, cellSize, customData, ...context };

      onDrawCell(ctx, cellCenterX, cellCenterY, normVal, cellArg);
    } catch (e) {
      Logger.error('Error in onDrawCell callback:', e);
    }

    ctx.restore();
  }

  /**
   * Instance method for convenience
   */
  render(aggregationResult, ctx, config) {
    Renderer.render(aggregationResult, ctx, config);
  }

  /**
   * Render with glyph mode enabled
   * @param {Object} aggregationResult - Aggregation result
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Function} onDrawCell - Glyph drawing callback
   * @param {number} glyphSize - Glyph size (0-1)
   */
  renderGlyphs(aggregationResult, ctx, onDrawCell, glyphSize = 0.8) {
    Renderer.render(aggregationResult, ctx, {
      enableGlyphs: true,
      onDrawCell,
      glyphSize,
      colorScale: () => [0, 0, 0, 0], // Not used in glyph mode
    });
  }

  /**
   * Render with color mode enabled
   * @param {Object} aggregationResult - Aggregation result
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Function} colorScale - Color scale function
   */
  renderColors(aggregationResult, ctx, colorScale) {
    Renderer.render(aggregationResult, ctx, {
      enableGlyphs: false,
      colorScale,
    });
  }
}
