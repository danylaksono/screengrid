/**
 * MeanAggregation.js
 * Mean/average aggregation function
 * Returns the average of all weights in a cell
 */

/**
 * Mean aggregation function
 * @param {Array} cellData - Array of {data, weight, projectedX, projectedY}
 * @returns {number} Average of all weights
 */
export function meanAggregation(cellData) {
  if (!cellData || cellData.length === 0) {
    return 0;
  }
  const sum = cellData.reduce((sum, item) => sum + (item.weight || 0), 0);
  return sum / cellData.length;
}

