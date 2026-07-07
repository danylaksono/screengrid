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
 * @param {Object} context - Context object with stats: {max, min, mean, std, totalValue, cellsWithData, sortedValues}
 *   `sortedValues` (ascending array of cell values with data) enables an O(log n)
 *   binary-search rank; the renderer provides it automatically.
 * @returns {number} Normalized value (0-1) representing percentile rank
 */
export function percentileNormalization(grid, cellValue, cellIndex, context) {
  if (cellValue === 0) {
    return 0;
  }

  // Fast path: binary search over pre-sorted values from the render context
  const sorted = context && context.sortedValues;
  if (sorted && sorted.length > 0) {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] <= cellValue) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo / sorted.length;
  }

  // Fallback for direct callers without a prepared context
  const cellsWithData = grid.filter(v => v > 0);
  if (cellsWithData.length === 0) {
    return 0;
  }

  // Count how many values are less than or equal to current value
  const rank = cellsWithData.filter(v => v <= cellValue).length;

  // Return percentile rank (0-1)
  return rank / cellsWithData.length;
}

