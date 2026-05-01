/**
 * Aggregator.js
 * Pure business logic for aggregating points into grid cells
 */

import { AggregationFunctionRegistry, AggregationFunctions } from '../aggregation/functions/index.js';

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
  static aggregate(projectedPoints, originalData, width, height, cellSizePixels, aggregationFunction = null, onAfterAggregate = null) {
    const cols = Math.ceil(width / cellSizePixels);
    const rows = Math.ceil(height / cellSizePixels);
    const grid = new Array(rows * cols).fill(0);
    const cellData = new Array(rows * cols).fill(null).map(() => []);
    const customData = new Array(rows * cols).fill(null);

    // Get aggregation function (default to sum for backward compatibility)
    const aggFn = aggregationFunction 
      ? (AggregationFunctionRegistry.get(aggregationFunction) || aggregationFunction)
      : AggregationFunctions.sum;

    // console.log('Aggregating points:', {
    //   totalPoints: projectedPoints.length,
    //   canvasSize: { width, height },
    //   cellSize: cellSizePixels,
    //   gridSize: { cols, rows },
    // });

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

    const cellsWithData = grid.filter((v) => v > 0).length;
    // console.log('Grid aggregation complete:', {
    //   cellsWithData,
    //   maxValue: Math.max(...grid),
    //   totalValue: grid.reduce((sum, v) => sum + v, 0),
    // });

    return {
      grid,
      cellData,
      customData,
      cols,
      rows,
      width,
      height,
      cellSizePixels,
    };
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
  aggregate(projectedPoints, originalData, width, height, cellSizePixels, aggregationFunction = null, onAfterAggregate = null) {
    return Aggregator.aggregate(projectedPoints, originalData, width, height, cellSizePixels, aggregationFunction, onAfterAggregate);
  }

  /**
   * Get statistics about a grid
   * @param {Object} aggregationResult - Result from aggregate()
   * @returns {Object} Statistics: {totalCells, cellsWithData, maxValue, minValue, avgValue}
   */
  static getStats(aggregationResult) {
    const { grid } = aggregationResult;
    const cellsWithData = grid.filter((v) => v > 0);

    return {
      totalCells: grid.length,
      cellsWithData: cellsWithData.length,
      maxValue: cellsWithData.length > 0 ? Math.max(...cellsWithData) : 0,
      minValue: cellsWithData.length > 0 ? Math.min(...cellsWithData) : 0,
      avgValue: cellsWithData.length > 0 ? cellsWithData.reduce((a, b) => a + b) / cellsWithData.length : 0,
      totalValue: grid.reduce((sum, v) => sum + v, 0),
    };
  }

  getStats(aggregationResult) {
    return Aggregator.getStats(aggregationResult);
  }
}
