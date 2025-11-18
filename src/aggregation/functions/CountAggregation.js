/**
 * CountAggregation.js
 * Count aggregation function
 * Returns the number of points in a cell
 */

/**
 * Count aggregation function
 * @param {Array} cellData - Array of {data, weight, projectedX, projectedY}
 * @returns {number} Number of points in the cell
 */
export function countAggregation(cellData) {
  if (!cellData || cellData.length === 0) {
    return 0;
  }
  return cellData.length;
}

