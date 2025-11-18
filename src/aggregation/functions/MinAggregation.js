/**
 * MinAggregation.js
 * Minimum aggregation function
 * Returns the minimum weight value in a cell
 */

/**
 * Min aggregation function
 * @param {Array} cellData - Array of {data, weight, projectedX, projectedY}
 * @returns {number} Minimum weight value
 */
export function minAggregation(cellData) {
  if (!cellData || cellData.length === 0) {
    return 0;
  }
  return Math.min(...cellData.map(item => item.weight || 0));
}

