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
  
  // Calculate z-score
  const zScore = (cellValue - context.mean) / context.std;
  
  // Get all z-scores for scaling
  const cellsWithData = grid.filter(v => v > 0);
  if (cellsWithData.length === 0) {
    return 0;
  }
  
  const zScores = cellsWithData.map(v => (v - context.mean) / context.std);
  const minZ = Math.min(...zScores);
  const maxZ = Math.max(...zScores);
  
  // Map z-score to 0-1 range
  if (maxZ === minZ) {
    return 0.5; // All values are the same
  }
  
  return (zScore - minZ) / (maxZ - minZ);
}

