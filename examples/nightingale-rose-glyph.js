/**
 * Nightingale Rose Chart Glyph Function
 * Compatible with ScreenGridLayerGL library
 * 
 * Usage:
 * ```javascript
 * // Pre-compute max values from your data for proper normalization
 * const computeMaxValues = (data, parameters) => {
 *   const maxValues = {};
 *   parameters.forEach(param => {
 *     const values = data.map(d => d[param]).filter(v => v != null);
 *     maxValues[param] = values.length > 0 ? Math.max(...values) : 100;
 *   });
 *   return maxValues;
 * };
 * 
 * const parameters = ['param1', 'param2', 'param3', ...];
 * const maxValues = computeMaxValues(yourData, parameters);
 * 
 * const config = {
 *   selected_parameters: parameters,
 *   weights: { param1: 0.5, param2: 0.3, ... },
 *   colours: ['#ff0000', '#00ff00', '#0000ff', ...],
 *   maxValue: 100, // Fallback if maxValues not provided
 *   maxValues: maxValues, // Per-parameter max values (recommended)
 *   normalizePerParameter: true, // Normalize each parameter independently
 *   aggregationMode: 'average', // 'sum' or 'average' (use 'average' for percentages)
 *   numSegments: 8
 * };
 * 
 * const gridLayer = new ScreenGridLayerGL({
 *   // ... other config
 *   onDrawCell: (ctx, x, y, normVal, cellInfo) => {
 *     drawNightingaleRoseChart(ctx, x, y, normVal, cellInfo, config);
 *   }
 * });
 * ```

 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} x - Center X coordinate of the cell
 * @param {number} y - Center Y coordinate of the cell
 * @param {number} normVal - Normalized aggregated value (0-1)
 * @param {object} cellInfo - Cell information object
 * @param {object} config - Configuration object with selected_parameters, weights, colours, etc.
 */
function drawNightingaleRoseChart(ctx, x, y, normVal, cellInfo, config = {}) {
  const {
    cellData,
    cellSize,
    glyphRadius
  } = cellInfo;

  // Extract configuration with defaults
  const {
    selected_parameters = [],
    weights = {},
    colours = [
        "green", // Green energy potential -> PV
        "red", // Heat Efficiency -> ashp, ghsp, insulation
        "crimson", // gshp
        "deeppink", // insulation
        "cornflowerblue", // energy demand -> electricity, gas
        "blue", // gas
        "yellow", // socio-demographic -> fuel poverty, deprivation
        "gold" // deprivation
    ],
    maxValue = 100, // Default max value (can be overridden by maxValues per parameter)
    maxValues = {}, // Per-parameter max values: { 'param1': 100, 'param2': 200, ... }
    numSegments = 8,
    padding = 2,
    normalizePerParameter = true // Normalize each parameter independently
  } = config;

  // Return early if no data or no parameters
  if (!cellData || cellData.length === 0 || selected_parameters.length === 0) {
    return;
  }

  // Calculate radius from glyphRadius (recommended) or cellSize
  const radius = glyphRadius || (cellSize - 2 * padding) / 2;
  
  // Center coordinates (already provided as x, y)
  const centerX = x;
  const centerY = y;

  // Calculate angle per section
  const segmentAngle = (2 * Math.PI) / numSegments;
  const startingAngle = Math.PI;
  const gapAngle = (2 * Math.PI) / 180; // Small gap between segments

  // Aggregate data for each parameter from cellData
  const aggregationMode = config.aggregationMode || 'sum'; // 'sum' or 'average'
  
  const aggregatedData = {};
  selected_parameters.forEach(parameter => {
    if (aggregationMode === 'average') {
      // Average the values (useful for percentages)
      // Average preserves the original scale (0-100 for percentages)
      const values = cellData
        .map(item => item.data && item.data[parameter] !== undefined ? item.data[parameter] : null)
        .filter(v => v !== null);
      aggregatedData[parameter] = values.length > 0 
        ? values.reduce((sum, val) => sum + val, 0) / values.length 
        : 0;
    } else {
      // Sum the values (useful for totals like counts or absolute values)
      // Note: When using 'sum', aggregated values can exceed individual max values
      // Consider using 'average' mode for percentage data, or adjust maxValues accordingly
      aggregatedData[parameter] = cellData.reduce((sum, item) => {
        // Access the parameter value from the data object
        const value = item.data && item.data[parameter] !== undefined 
          ? item.data[parameter] 
          : 0;
        return sum + value;
      }, 0);
    }
  });

  // If normalizePerParameter is true, find max value for each parameter across this cell's data
  // This helps when different parameters have different scales
  let parameterMaxValues = {};
  if (normalizePerParameter) {
    selected_parameters.forEach(parameter => {
      // Use per-parameter max if provided, otherwise use default maxValue
      parameterMaxValues[parameter] = maxValues[parameter] !== undefined 
        ? maxValues[parameter] 
        : maxValue;
    });
  }

  // Iterate over each parameter
  selected_parameters.forEach((parameter, i) => {
    // Get aggregated value for this parameter
    const value = aggregatedData[parameter] || 0;

    // Calculate section start and end angles
    const startAngle = i * segmentAngle - startingAngle;
    const endAngle = (i + 1) * segmentAngle - startingAngle;

    // Calculate outer radius based on normalized data value
    // Use per-parameter max if normalizePerParameter is true
    const paramMaxValue = normalizePerParameter 
      ? parameterMaxValues[parameter] 
      : maxValue;
    
    // Normalize: clamp to 0-1, but allow values > maxValue to be clamped to 1
    const normalizedValue = paramMaxValue > 0 
      ? Math.min(value / paramMaxValue, 1) 
      : 0;
    
    const outerRadius = normalizedValue * radius;

    // Check if weight is significant enough to draw
    const weight = weights[parameter] || 0;
    if (Math.abs(weight) > 0.05) {
      // Draw the segment arc outline (optional background)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      // Uncomment to fill background:
      // ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      // ctx.fill();

      // Calculate pie segment width based on weight (use angular units)
      const maxWeight = Math.max(...Object.values(weights).map(Math.abs));
      const weightAngle = maxWeight > 0 
        ? (Math.abs(weight) * segmentAngle) / maxWeight
        : segmentAngle;

      // Calculate center angle of the pie segment
      const midAngle = (startAngle + endAngle) / 2;

      // Offset for pie segment arc
      const offsetAngle = 0;

      // Draw the pie segment with the color
      ctx.fillStyle = colours[i % colours.length] || '#cccccc';
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        outerRadius,
        midAngle - weightAngle / 2 - offsetAngle + gapAngle,
        midAngle + offsetAngle + weightAngle / 2 - gapAngle
      );
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fill();
    }
  });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawNightingaleRoseChart };
}

