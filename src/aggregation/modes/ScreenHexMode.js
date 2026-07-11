/**
 * ScreenHexMode.js
 * Hexagonal tessellation in screen space
 * Aggregates points into hexagonal cells using offset coordinate system
 */

import { Projector } from '../../core/Projector.js';
import { Aggregator } from '../../core/Aggregator.js';
import { AggregationFunctionRegistry, AggregationFunctions } from '../functions/index.js';
import { NormalizationFunctionRegistry, NormalizationFunctions } from '../../normalization/functions/index.js';
import { Renderer } from '../../canvas/Renderer.js';
import { SemanticCellSummarizer } from '../../core/SemanticCellSummarizer.js';

export const ScreenHexMode = {
  name: 'screen-hex',
  type: 'screen-space',

  /**
   * Initialize the mode (no-op for screen-hex)
   * @param {Object} options - Mode-specific configuration
   * @param {Object} map - MapLibre map instance
   * @returns {Object|null} Optional instance state
   */
  init(options, map) {
    return null;
  },

  /**
   * Aggregate data points into hexagonal grid cells
   * @param {Array} data - Original data array
   * @param {Function} getPosition - Position extractor function
   * @param {Function} getWeight - Weight extractor function
   * @param {Object} map - MapLibre map instance
   * @param {Object} config - Layer configuration
   * @returns {Object} Aggregation result
   */
  aggregate(data, getPosition, getWeight, map, config) {
    const projectedPoints = Projector.projectPoints(data, getPosition, getWeight, map);
    const { width, height } = config.displaySize || { 
      width: map.getCanvas().width, 
      height: map.getCanvas().height 
    };
    const hexSize = config.hexSize || config.cellSizePixels || 50;

    // Hexagonal grid parameters
    // Using flat-top hexagon orientation
    const hexRadius = hexSize / 2;
    const hexWidth = hexSize * Math.sqrt(3); // Width of hexagon (flat-top)
    const hexHeight = hexSize * 1.5; // Height of hexagon (flat-top)
    
    // Get aggregation function (default to sum for backward compatibility)
    const aggFn = config.aggregationFunction
      ? (AggregationFunctionRegistry.get(config.aggregationFunction) || config.aggregationFunction)
      : AggregationFunctions.sum;

    // Use Map for sparse storage (more efficient for hex grids)
    const hexCellData = new Map(); // hexKey -> array of cell data

    // First pass: collect all points into cellData
    for (let i = 0; i < projectedPoints.length; i++) {
      const p = projectedPoints[i];
      
      // Convert pixel coordinates to axial hex coordinates (q, r)
      // Using flat-top hexagon layout
      const q = Math.round((Math.sqrt(3) / 3 * p.x - 1 / 3 * p.y) / hexRadius);
      const r = Math.round((2 / 3 * p.y) / hexRadius);
      
      const hexKey = `${q},${r}`;

      // Store original data point
      if (!hexCellData.has(hexKey)) {
        hexCellData.set(hexKey, []);
      }
      
      hexCellData.get(hexKey).push({
        data: data[i],
        weight: p.w,
        projectedX: p.x,
        projectedY: p.y,
      });
    }

    // Second pass: apply aggregation function to each cell
    const hexGrid = new Map(); // hexKey -> aggregated value
    const customDataMap = new Map();
    for (const [hexKey, cellDataArray] of hexCellData.entries()) {
      if (cellDataArray.length > 0) {
        const aggregatedValue = aggFn(cellDataArray);
        hexGrid.set(hexKey, aggregatedValue);
        if (typeof config.onAfterAggregate === 'function') {
          customDataMap.set(hexKey, config.onAfterAggregate(cellDataArray, aggregatedValue, hexKey, hexGrid));
        }
      }
    }

    // Convert Map to arrays for compatibility
    const cells = Array.from(hexGrid.entries());
    const grid = cells.map(([_, value]) => value);
    const cellData = cells.map(([key, _]) => hexCellData.get(key));
    const customData = cells.map(([key]) => customDataMap.get(key) ?? null);

    // Store hex coordinates for rendering and querying
    const hexCoords = cells.map(([key]) => {
      const [q, r] = key.split(',').map(Number);
      return { q, r };
    });

    const result = {
      grid,
      cellData,
      customData,
      hexCoords,
      hexSize,
      hexRadius,
      width,
      height,
      type: 'hex',
    };

    // Semantic cells attached lazily (see SemanticCellSummarizer.attachLazy):
    // built on first access, never during the per-frame default render path.
    return SemanticCellSummarizer.attachLazy(result, {
      aggregationMode: config.aggregationMode || 'screen-hex',
      normalizationFunction: config.normalizationFunction || 'max-local',
      zoomLevel: map?.getZoom?.() ?? null
    });
  },

  /**
   * Render aggregated hex cells to canvas
   * @param {Object} aggregationResult - Result from aggregate()
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} config - Layer configuration (colorScale, enableGlyphs, etc.)
   * @param {Object} map - MapLibre map instance (not used for screen-space)
   */
  render(aggregationResult, ctx, config, map) {
    // `cells` is a lazy getter on the result; do not destructure it eagerly or
    // every semantic cell would be built each frame. Access it per cell only
    // when a glyph callback is active (see below).
    const { grid, hexCoords, hexRadius, cellData } = aggregationResult;
    const glyphsActive = config.enableGlyphs && !!config.onDrawCell;

    ctx.clearRect(0, 0, aggregationResult.width, aggregationResult.height);

    // Merge aggregationModeConfig into render config
    const renderConfig = {
      ...config,
      ...(aggregationResult.aggregationModeConfig || {}),
    };

    // Get normalization function (default to max-local for backward compatibility)
    const normFn = config.normalizationFunction
      ? (NormalizationFunctionRegistry.get(config.normalizationFunction) || config.normalizationFunction)
      : NormalizationFunctions.maxLocal;

    // Compute stats for normalization context (point-count based, so cells
    // that aggregate to 0 or negative values still render)
    const stats = Renderer.computeStats(grid, cellData);
    const normContext = {
      ...stats,
      ...(config.normalizationContext || {}),
    };

    for (let i = 0; i < grid.length; i++) {
      const val = grid[i];
      // Hex grid is sparse: every entry was created from at least one point,
      // so gate on point count rather than value > 0
      if (!cellData[i] || cellData[i].length === 0) continue;

      const { q, r } = hexCoords[i];

      // Normalize value using normalization function
      const cellValue = typeof val === 'number'
        ? val
        : (val && typeof val === 'object'
          ? (val.value !== undefined ? val.value : Object.values(val).find(v => typeof v === 'number') || 0)
          : 0);

      let normVal = normFn(grid, cellValue, i, normContext);

      // Skip if normalization result is not a number
      if (typeof normVal !== 'number' || isNaN(normVal)) {
        continue;
      }

      // Clamp so colorScale/onDrawCell always receive a value in [0, 1]
      normVal = Math.min(1, Math.max(0, normVal));

      // Convert hex coordinates to pixel coordinates (flat-top hexagon)
      const x = hexRadius * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
      const y = hexRadius * (3 / 2 * r);

      // Draw hexagon with merged config
      this._drawHexagon(
        ctx,
        x,
        y,
        hexRadius,
        normVal,
        renderConfig,
        cellData[i],
        glyphsActive ? aggregationResult.cells?.[i] : null,
        hexCoords[i],
        i,
        val
      );
    }
  },

  /**
   * Draw a single hexagon
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} centerX - X coordinate of hexagon center
   * @param {number} centerY - Y coordinate of hexagon center
   * @param {number} radius - Hexagon radius
   * @param {number} normVal - Normalized value (0-1)
   * @param {Object} config - Render configuration
   * @param {Array} cellDataArray - Array of cell data
   */
  _drawHexagon(
    ctx,
    centerX,
    centerY,
    radius,
    normVal,
    config,
    cellDataArray,
    semanticCell,
    hexCoords,
    cellIndex,
    value
  ) {
    ctx.beginPath();
    // Draw flat-top hexagon (6 vertices)
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6; // Start at -30 degrees for flat-top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    // Always draw background if showBackground is enabled or if glyphs are not enabled
    const showBackground = config.showBackground !== false; // Default to true
    const drawBackground = !config.enableGlyphs || (config.enableGlyphs && showBackground);
    
    if (drawBackground) {
      const [r, g, b, a] = config.colorScale(normVal);
      // Reduce opacity slightly when glyphs are enabled to make them stand out
      const opacity = config.enableGlyphs ? a * 0.6 : a;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity / 255})`;
      ctx.fill();
    }

    // Draw glyphs on top if enabled
    if (config.enableGlyphs && config.onDrawCell) {
      const glyphRadius = radius * (config.glyphSize || 0.8);
      // The semantic cell already carries cellData/cellSize/hexCoords/index/
      // center/value; populate the per-draw fields in place and pass it directly
      // (no per-glyph allocation). Falls back to a plain object if absent.
      const cellArg = semanticCell
        ? semanticCell.withRenderState(normVal, glyphRadius, false, undefined, undefined)
        : {
            cellData: cellDataArray, cellSize: radius * 2, glyphRadius, hexCoords,
            index: cellIndex, center: { x: centerX, y: centerY }, value, normalizedValue: normVal,
          };
      config.onDrawCell(ctx, centerX, centerY, normVal, cellArg);
    }
  },

  /**
   * Get cell at screen coordinates (for hover/click events)
   * @param {Object} point - {x, y} screen coordinates
   * @param {Object} aggregationResult - Current aggregation result
   * @param {Object} map - MapLibre map instance (not used for screen-space)
   * @returns {Object|null} Cell information or null
   */
  getCellAt(point, aggregationResult, map) {
    const { hexCoords, hexRadius } = aggregationResult;
    const { x, y } = point;

    // Convert screen coordinates to hex coordinates (matching aggregate formula)
    const q = Math.round((Math.sqrt(3) / 3 * x - 1 / 3 * y) / hexRadius);
    const r = Math.round((2 / 3 * y) / hexRadius);
    const hexKey = `${q},${r}`;

    // Find matching cell
    const index = hexCoords.findIndex(c => `${c.q},${c.r}` === hexKey);
    if (index === -1) return null;

    const points = aggregationResult.cellData[index];
    if (!points || points.length === 0) return null;

    const { q: cellQ, r: cellR } = hexCoords[index];
    const centerX = hexRadius * (Math.sqrt(3) * cellQ + Math.sqrt(3) / 2 * cellR);
    const centerY = hexRadius * (3 / 2 * cellR);

    // Loop instead of Math.max(...grid) to avoid stack overflow on large grids
    let maxValue = 0;
    for (const v of aggregationResult.grid) {
      if (typeof v === 'number' && v > maxValue) maxValue = v;
    }

    return {
      ...(aggregationResult.cells?.[index] || {}),
      index,
      value: aggregationResult.grid[index],
      normalizedValue: aggregationResult.grid[index] / (maxValue || 1),
      cellData: points,
      hexCoords: { q: cellQ, r: cellR },
      center: { x: centerX, y: centerY },
    };
  },

  /**
   * Check if aggregation needs to update on map move
   * @returns {boolean} true if mode needs re-aggregation on pan
   */
  needsUpdateOnMove() {
    return true;
  },

  /**
   * Check if aggregation needs to update on map zoom
   * @returns {boolean} true if mode needs re-aggregation on zoom
   */
  needsUpdateOnZoom() {
    return true;
  },

  /**
   * Get statistics about aggregation result
   * @param {Object} aggregationResult - Aggregation result
   * @returns {Object} Statistics object
   */
  getStats(aggregationResult) {
    return Aggregator.getStats(aggregationResult);
  },
};
