/**
 * MaxLocalNormalization.js
 * Max-local normalization (default)
 * Normalizes values relative to the maximum value in the current grid
 */

/**
 * Max-local normalization function
 * @param {Array<number>} grid - Array of cell values
 * @param {number} cellValue - Value of the current cell
 * @param {number} cellIndex - Index of the current cell
 * @param {Object} context - Context object with stats: {max, min, mean, std, totalValue, cellsWithData}
 * @returns {number} Normalized value (0-1)
 */
export function maxLocalNormalization(grid, cellValue, cellIndex, context) {
  if (cellValue === 0 || context.max === 0) {
    return 0;
  }
  return cellValue / context.max;
}

