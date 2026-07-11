/**
 * Aggregator.js
 * Pure business logic for aggregating points into grid cells
 */

import { AggregationFunctionRegistry, AggregationFunctions } from '../aggregation/functions/index.js';
import { SemanticCellSummarizer } from './SemanticCellSummarizer.js';

export class Aggregator {
  /**
   * Aggregate projected points into a grid
   * @param {Array} projectedPoints - Array of {x, y, w} projected points
   * @param {Array} originalData - Original data array for reference
   * @param {number} width - Canvas width in pixels
   * @param {number} height - Canvas height in pixels
   * @param {number} cellSizePixels - Size of each grid cell
   * @param {Function|string} aggregationFunction - Aggregation function or name (default: sum)
   * @param {Function} onAfterAggregate - Hook for post-aggregation calculations (optional)
   * @returns {Object} Aggregation result: {grid, cellData, cols, rows, width, height, cellSizePixels, customData}
   */
  static aggregate(projectedPoints, originalData, width, height, cellSizePixels, aggregationFunction = null, onAfterAggregate = null, semanticOptions = {}) {
    const cols = Math.ceil(width / cellSizePixels);
    const rows = Math.ceil(height / cellSizePixels);
    const grid = new Array(rows * cols).fill(0);
    const cellData = new Array(rows * cols).fill(null).map(() => []);
    const customData = new Array(rows * cols).fill(null);

    // Get aggregation function (default to sum for backward compatibility)
    const aggFn = aggregationFunction
      ? (AggregationFunctionRegistry.get(aggregationFunction) || aggregationFunction)
      : AggregationFunctions.sum;

    // First pass: collect all points into cellData
    for (let i = 0; i < projectedPoints.length; i++) {
      const p = projectedPoints[i];
      const col = Math.floor(p.x / cellSizePixels);
      const row = Math.floor(p.y / cellSizePixels);

      // Bounds check
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        const idx = row * cols + col;

        // Store original data point for glyph rendering and aggregation
        cellData[idx].push({
          data: originalData[i],
          weight: p.w,
          projectedX: p.x,
          projectedY: p.y,
        });
      }
    }

    // Second pass: apply aggregation function to each cell
    for (let idx = 0; idx < grid.length; idx++) {
      if (cellData[idx].length > 0) {
        grid[idx] = aggFn(cellData[idx]);
      }
    }

    // Third pass: Run post-aggregation hook if provided
    if (onAfterAggregate && typeof onAfterAggregate === 'function') {
      for (let idx = 0; idx < grid.length; idx++) {
        if (cellData[idx].length > 0) {
          // Pass (cellData, aggregatedValue, index, grid)
          // User can return custom data to be stored for this cell
          customData[idx] = onAfterAggregate(cellData[idx], grid[idx], idx, grid);
        }
      }
    }

    const result = {
      grid,
      cellData,
      customData,
      cols,
      rows,
      width,
      height,
      cellSizePixels,
    };

    // Semantic cells (`cells`/`populatedCells`/`cellSemantics`) are attached as
    // lazy getters: the render loop's default colour path never triggers them,
    // so aggregation stays cheap per frame. See SemanticCellSummarizer.attachLazy.
    return SemanticCellSummarizer.attachLazy(result, {
      aggregationMode: semanticOptions.aggregationMode || 'screen-grid',
      normalizationFunction: semanticOptions.normalizationFunction || 'max-local',
      zoomLevel: semanticOptions.zoomLevel ?? null
    });
  }

  /**
   * Instance method for convenience
   */
  constructor() {}

  /**
   * Aggregate using instance method
   * @param {Array} projectedPoints - Projected points
   * @param {Array} originalData - Original data
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {number} cellSizePixels - Cell size
   * @param {Function|string} aggregationFunction - Aggregation function or name
   * @param {Function} onAfterAggregate - Post-aggregation hook
   * @returns {Object} Aggregation result
   */
  aggregate(projectedPoints, originalData, width, height, cellSizePixels, aggregationFunction = null, onAfterAggregate = null, semanticOptions = {}) {
    return Aggregator.aggregate(projectedPoints, originalData, width, height, cellSizePixels, aggregationFunction, onAfterAggregate, semanticOptions);
  }

  /**
   * Get statistics about a grid.
   * Cells count as "with data" when they contain points (when cellData is
   * available), so zero/negative aggregates are included in the stats.
   * @param {Object} aggregationResult - Result from aggregate()
   * @returns {Object} Statistics: {totalCells, cellsWithData, maxValue, minValue, avgValue, totalValue}
   */
  static getStats(aggregationResult) {
    const { grid, cellData } = aggregationResult;

    let count = 0;
    let maxValue = -Infinity;
    let minValue = Infinity;
    let sum = 0;
    let totalValue = 0;

    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (typeof v === 'number') {
        totalValue += v;
      }
      const hasData = cellData
        ? Array.isArray(cellData[i]) && cellData[i].length > 0
        : v > 0;
      if (!hasData || typeof v !== 'number') continue;
      count++;
      if (v > maxValue) maxValue = v;
      if (v < minValue) minValue = v;
      sum += v;
    }

    return {
      totalCells: grid.length,
      cellsWithData: count,
      maxValue: count > 0 ? maxValue : 0,
      minValue: count > 0 ? minValue : 0,
      avgValue: count > 0 ? sum / count : 0,
      totalValue,
    };
  }

  getStats(aggregationResult) {
    return Aggregator.getStats(aggregationResult);
  }
}

function hasNonZeroValue(value) {
  return Number.isFinite(toNumericValue(value)) && toNumericValue(value) !== 0;
}

function toNumericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value && typeof value === 'object') {
    const numericValues = Object.values(value).map(Number).filter(Number.isFinite);
    return numericValues.length > 0 ? numericValues.reduce((sum, item) => sum + item, 0) : 0;
  }
  return 0;
}
