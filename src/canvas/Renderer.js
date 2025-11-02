/**
 * Renderer.js
 * Canvas drawing logic for grid cells
 */

export class Renderer {
  constructor() {}

  /**
   * Render grid cells to canvas
   * @param {Object} aggregationResult - Result from Aggregator.aggregate()
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} config - Configuration options
   * @param {Function} config.colorScale - Color function: (normalizedValue) => [r, g, b, a]
   * @param {boolean} config.enableGlyphs - Enable glyph rendering
   * @param {Function} config.onDrawCell - Custom glyph drawing callback
   * @param {number} config.glyphSize - Glyph size factor
   */
  static render(aggregationResult, ctx, config) {
    if (!aggregationResult || !ctx) {
      console.log('[Renderer] No aggregation result or context available for rendering', {
        hasResult: !!aggregationResult,
        hasContext: !!ctx
      });
      return;
    }

    const { grid, cellData, cols, rows, cellSizePixels } = aggregationResult;
    const { colorScale, enableGlyphs, onDrawCell, glyphSize, showBackground } = config;

    const maxVal = Math.max(...grid);
    if (maxVal === 0) {
      console.log('[Renderer] No data to render (max value is 0)', {
        gridLength: grid.length,
        cols,
        rows
      });
      return;
    }

    console.log('[Renderer] Rendering grid:', {
      cols,
      rows,
      maxVal,
      cellsWithData: grid.filter((v) => v > 0).length,
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

        if (val > 0) {
          const x = c * cellSizePixels;
          const y = r * cellSizePixels;
          const normVal = val / maxVal;

          // Determine if background should be drawn
          // Default to true if showBackground is not explicitly false
          const shouldShowBackground = showBackground !== false;
          const drawBackground = !enableGlyphs || !onDrawCell || (enableGlyphs && onDrawCell && shouldShowBackground);

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
              cellData[idx]
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
  static _drawGlyph(ctx, x, y, cellSize, normVal, glyphSize, onDrawCell, cellDataArray) {
    const cellCenterX = x + cellSize / 2;
    const cellCenterY = y + cellSize / 2;
    const glyphRadius = (cellSize * glyphSize) / 2;

    ctx.save();

    try {
      onDrawCell(ctx, cellCenterX, cellCenterY, normVal, {
        cellData: cellDataArray,
        cellSize,
        glyphRadius,
        normalizedValue: normVal,
      });
    } catch (e) {
      console.error('Error in onDrawCell callback:', e);
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
