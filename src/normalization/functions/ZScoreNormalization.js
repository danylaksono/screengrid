/**
 * ZScoreNormalization.js
 * Z-score normalization
 * Normalizes values using z-score: (value - mean) / std
 * Result is then mapped to 0-1 range using min-max scaling
 */

/**
 * Z-score normalization function
 * @param {Array<number>} grid - Array of cell values
 * @param {number} cellValue - Value of the current cell
 * @param {number} cellIndex - Index of the current cell
 * @param {Object} context - Context object with stats: {max, min, mean, std, totalValue, cellsWithData}
 * @returns {number} Normalized value (0-1)
 */
export function zScoreNormalization(grid, cellValue, cellIndex, context) {
  if (cellValue === 0 || context.std === 0) {
    return 0;
  }

  // z-score is a monotonic linear transform, so the min/max z-scores are the
  // transforms of the min/max values already provided in the context stats.
  const zScore = (cellValue - context.mean) / context.std;
  const minZ = (context.min - context.mean) / context.std;
  const maxZ = (context.max - context.mean) / context.std;

  // Map z-score to 0-1 range
  if (maxZ === minZ) {
    return 0.5; // All values are the same
  }

  return (zScore - minZ) / (maxZ - minZ);
}

