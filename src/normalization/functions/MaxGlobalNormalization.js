/**
 * MaxGlobalNormalization.js
 * Max-global normalization
 * Normalizes values relative to a global maximum (must be provided in context)
 */

/**
 * Max-global normalization function
 * @param {Array<number>} grid - Array of cell values
 * @param {number} cellValue - Value of the current cell
 * @param {number} cellIndex - Index of the current cell
 * @param {Object} context - Context object with stats: {max, min, mean, std, totalValue, cellsWithData, globalMax}
 * @returns {number} Normalized value (0-1)
 */
export function maxGlobalNormalization(grid, cellValue, cellIndex, context) {
  const globalMax = context.globalMax || context.max;
  const globalMin = context.globalMin ?? context.min;
  if (!Number.isFinite(cellValue)) {
    return 0;
  }
  if (globalMin < 0) {
    const range = globalMax - globalMin;
    if (range === 0) return cellValue === 0 ? 0 : 1;
    return (cellValue - globalMin) / range;
  }
  if (cellValue === 0 || globalMax === 0) {
    return 0;
  }
  return cellValue / globalMax;
}
