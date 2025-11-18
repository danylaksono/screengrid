/**
 * SumAggregation.js
 * Sum aggregation function (default)
 * Returns the sum of all weights in a cell
 */

/**
 * Sum aggregation function
 * @param {Array} cellData - Array of {data, weight, projectedX, projectedY}
 * @returns {number} Sum of all weights
 */
export function sumAggregation(cellData) {
  if (!cellData || cellData.length === 0) {
    return 0;
  }
  return cellData.reduce((sum, item) => sum + (item.weight || 0), 0);
}

