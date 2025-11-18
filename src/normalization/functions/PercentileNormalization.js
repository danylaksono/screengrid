/**
 * PercentileNormalization.js
 * Percentile normalization
 * Normalizes values based on their percentile rank in the distribution
 */

/**
 * Percentile normalization function
 * @param {Array<number>} grid - Array of cell values
 * @param {number} cellValue - Value of the current cell
 * @param {number} cellIndex - Index of the current cell
 * @param {Object} context - Context object with stats: {max, min, mean, std, totalValue, cellsWithData}
 * @returns {number} Normalized value (0-1) representing percentile rank
 */
export function percentileNormalization(grid, cellValue, cellIndex, context) {
  if (cellValue === 0) {
    return 0;
  }
  
  // Get all non-zero values
  const cellsWithData = grid.filter(v => v > 0);
  if (cellsWithData.length === 0) {
    return 0;
  }
  
  // Count how many values are less than or equal to current value
  const rank = cellsWithData.filter(v => v <= cellValue).length;
  
  // Return percentile rank (0-1)
  return rank / cellsWithData.length;
}

