/**
 * Renderer.js
 * Canvas drawing logic for grid cells
 */

import { Logger } from '../utils/Logger.js';
import { NormalizationFunctionRegistry, NormalizationFunctions } from '../normalization/functions/index.js';

export class Renderer {
  constructor() {}

  /**
   * Compute statistics for normalization context
   * @private
   */
  static _computeStats(grid) {
    const cellsWithData = grid.filter((v) => {
      // Handle both numbers and objects (for multi-attribute aggregation)
      if (typeof v === 'number') {
        return v > 0;
      }
      // For objects, check if any numeric property > 0
      return v && typeof v === 'object' && Object.values(v).some(val => typeof val === 'number' && val > 0);
    });

    if (cellsWithData.length === 0) {
      return {
        max: 0,
        min: 0,
        mean: 0,
        std: 0,
        totalValue: 0,
        cellsWithData: 0,
      };
    }

    // Extract numeric values (handle both numbers and objects)
    const numericValues = cellsWithData.map(v => {
      if (typeof v === 'number') {
        return v;
      }
      // For objects, use the first numeric value found (or sum all numeric values)
      if (v && typeof v === 'object') {
        const nums = Object.values(v).filter(val => typeof val === 'number');
        return nums.length > 0 ? nums.reduce((sum, n) => sum + n, 0) : 0;
      }
      return 0;
    });

    const max = Math.max(...numericValues);
    const min = Math.min(...numericValues);
    const mean = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
    const variance = numericValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numericValues.length;
    const std = Math.sqrt(variance);
    const totalValue = numericValues.reduce((sum, v) => sum + v, 0);

    return {
      max,
      min,
      mean,
      std,
      totalValue,
      cellsWithData: cellsWithData.length,
    };
  }

  /**
   * Render grid cells to canvas
   * @param {Object} aggregationResult - Result from Aggregator.aggregate()
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} config - Configuration options
   * @param {Function} config.colorScale - Color function: (normalizedValue) => [r, g, b, a]
   * @param {boolean} config.enableGlyphs - Enable glyph rendering
   * @param {Function} config.onDrawCell - Custom glyph drawing callback
   * @param {number} config.glyphSize - Glyph size factor
   * @param {Function|string} config.normalizationFunction - Normalization function or name (default: max-local)
   * @param {Object} config.normalizationContext - Additional context for normalization (e.g., globalMax)
   */
  static render(aggregationResult, ctx, config) {
    if (!aggregationResult || !ctx) {
      Logger.log('[Renderer] No aggregation result or context available for rendering', {
        hasResult: !!aggregationResult,
        hasContext: !!ctx
      });
      return;
    }

    const { grid, cellData, customData = [], cols, rows, cellSizePixels } = aggregationResult;
    const { 
      colorScale, 
      enableGlyphs, 
      onDrawCell, 
      glyphSize, 
      showBackground,
      normalizationFunction,
      normalizationContext = {},
      zoomLevel = 0, // Passed from Layer
      isHovered = false, // Current cell hovered state
      hoveredIndex = -1 // Global hovered index
    } = config;

    // Compute stats for normalization
    const stats = Renderer._computeStats(grid);
    
    if (stats.max === 0) {
      Logger.log('[Renderer] No data to render (max value is 0)', {
        gridLength: grid.length,
        cols,
        rows
      });
      return;
    }

    // Get normalization function (default to max-local for backward compatibility)
    const normFn = normalizationFunction
      ? (NormalizationFunctionRegistry.get(normalizationFunction) || normalizationFunction)
      : NormalizationFunctions.maxLocal;

    // Build normalization context
    const normContext = {
      ...stats,
      ...normalizationContext,
    };

    Logger.log('[Renderer] Rendering grid:', {
      cols,
      rows,
      maxVal: stats.max,
      cellsWithData: stats.cellsWithData,
      enableGlyphs,
      hasOnDrawCell: !!onDrawCell
    });

    // console.log('Rendering grid:', {
    //   cols,
    //   rows,
    //   maxVal,
    //   cellsWithData: grid.filter((v) => v > 0).length,
    //   enableGlyphs,
    // });

    // Clear canvas
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, aggregationResult.width, aggregationResult.height);

    // Render each cell
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const val = grid[idx];

        // Check if cell has data (handle both numbers and objects)
        const hasData = typeof val === 'number' 
          ? val > 0 
          : (val && typeof val === 'object' && Object.values(val).some(v => typeof v === 'number' && v > 0));

        if (hasData) {
          const x = c * cellSizePixels;
          const y = r * cellSizePixels;
          
          // Normalize value using normalization function
          // For objects, pass the first numeric value or a primary value
          const cellValue = typeof val === 'number' 
            ? val 
            : (val && typeof val === 'object' 
              ? (val.value !== undefined ? val.value : Object.values(val).find(v => typeof v === 'number') || 0)
              : 0);
          
          const normVal = normFn(grid, cellValue, idx, normContext);
          
          // Skip normalization if result is not a number (e.g., multi-attribute aggregation)
          if (typeof normVal !== 'number' || isNaN(normVal)) {
            continue;
          }

          // Determine if background should be drawn
          // New default: when glyphs are active (enableGlyphs && onDrawCell),
          // backgrounds are OFF unless showBackground is explicitly true.
          // When glyphs are not active, backgrounds remain ON by default.
          const glyphsActive = enableGlyphs && !!onDrawCell;
          const shouldShowBackground = glyphsActive
            ? showBackground === true
            : showBackground !== false;
          const drawBackground = !glyphsActive || shouldShowBackground;

          // Draw background if needed
          if (drawBackground) {
            Renderer._drawCell(ctx, x, y, cellSizePixels, normVal, colorScale, enableGlyphs && onDrawCell);
          }

          // Draw glyph on top if enabled
          if (enableGlyphs && onDrawCell) {
            Renderer._drawGlyph(
              ctx,
              x,
              y,
              cellSizePixels,
              normVal,
              glyphSize,
              onDrawCell,
              cellData[idx],
              c,
              r,
              idx,
              customData[idx],
              {
                zoomLevel,
                isHovered: (idx === hoveredIndex),
                grid
              }
            );
          }
        }
      }
    }
  }

  /**
   * Draw a colored cell
   * @private
   */
  static _drawCell(ctx, x, y, size, normVal, colorScale, withGlyphs = false) {
    const [rC, gC, bC, aC] = colorScale(normVal);
    // Reduce opacity slightly when glyphs are enabled to make them stand out
    const opacity = withGlyphs ? aC * 0.6 : aC;
    ctx.fillStyle = `rgba(${rC}, ${gC}, ${bC}, ${opacity / 255})`;
    ctx.fillRect(x, y, size, size);
  }

  /**
   * Draw a custom glyph
   * @private
   */
  static _drawGlyph(
    ctx,
    x,
    y,
    cellSize,
    normVal,
    glyphSize,
    onDrawCell,
    cellDataArray,
    col,
    row,
    index,
    customData = null,
    context = {}
  ) {
    const cellCenterX = x + cellSize / 2;
    const cellCenterY = y + cellSize / 2;
    const glyphRadius = (cellSize * glyphSize) / 2;

    ctx.save();

    try {
      
      onDrawCell(ctx, cellCenterX, cellCenterY, normVal, {
        cellData: cellDataArray,
        col,
        row,
        index,
        glyphRadius,
        cellSize,
        customData,
        ...context
      });
    } catch (e) {
      Logger.error('Error in onDrawCell callback:', e);
    }

    ctx.restore();
  }

  /**
   * Instance method for convenience
   */
  render(aggregationResult, ctx, config) {
    Renderer.render(aggregationResult, ctx, config);
  }
  
  /**
   * Compute statistics for a grid (exposed for external use)
   * @param {Array} grid - Grid array
   * @returns {Object} Statistics object
   */
  static computeStats(grid) {
    return Renderer._computeStats(grid);
  }

  /**
   * Render with glyph mode enabled
   * @param {Object} aggregationResult - Aggregation result
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Function} onDrawCell - Glyph drawing callback
   * @param {number} glyphSize - Glyph size (0-1)
   */
  renderGlyphs(aggregationResult, ctx, onDrawCell, glyphSize = 0.8) {
    Renderer.render(aggregationResult, ctx, {
      enableGlyphs: true,
      onDrawCell,
      glyphSize,
      colorScale: () => [0, 0, 0, 0], // Not used in glyph mode
    });
  }

  /**
   * Render with color mode enabled
   * @param {Object} aggregationResult - Aggregation result
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Function} colorScale - Color scale function
   */
  renderColors(aggregationResult, ctx, colorScale) {
    Renderer.render(aggregationResult, ctx, {
      enableGlyphs: false,
      colorScale,
    });
  }
}
