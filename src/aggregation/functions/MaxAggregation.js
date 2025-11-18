/**
 * MaxAggregation.js
 * Maximum aggregation function
 * Returns the maximum weight value in a cell
 */

/**
 * Max aggregation function
 * @param {Array} cellData - Array of {data, weight, projectedX, projectedY}
 * @returns {number} Maximum weight value
 */
export function maxAggregation(cellData) {
  if (!cellData || cellData.length === 0) {
    return 0;
  }
  return Math.max(...cellData.map(item => item.weight || 0));
}

