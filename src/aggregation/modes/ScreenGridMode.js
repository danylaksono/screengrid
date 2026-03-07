/**
 * ScreenGridMode.js
 * Default rectangular grid aggregation (current behavior)
 * This is the backward-compatible default mode that wraps existing Aggregator/Renderer logic
 */

import { Aggregator } from '../../core/Aggregator.js';
import { Projector } from '../../core/Projector.js';
import { Renderer } from '../../canvas/Renderer.js';
import { CellQueryEngine } from '../../core/CellQueryEngine.js';

export const ScreenGridMode = {
  name: 'screen-grid',
  type: 'screen-space',

  /**
   * Initialize the mode (no-op for screen-grid)
   * @param {Object} options - Mode-specific configuration
   * @param {Object} map - MapLibre map instance
   * @returns {Object|null} Optional instance state
   */
  init(options, map) {
    return null;
  },

  /**
   * Aggregate data points into a rectangular grid
   * @param {Array} data - Original data array
   * @param {Function} getPosition - Position extractor function
   * @param {Function} getWeight - Weight extractor function
   * @param {Object} map - MapLibre map instance
   * @param {Object} config - Layer configuration
   * @returns {Object} Aggregation result
   */
  aggregate(data, getPosition, getWeight, map, config) {
    // Use existing projection and aggregation logic
    const projectedPoints = Projector.projectPoints(data, getPosition, getWeight, map);
    const { width, height } = config.displaySize || { 
      width: map.getCanvas().width, 
      height: map.getCanvas().height 
    };
    
    return Aggregator.aggregate(
      projectedPoints,
      data,
      width,
      height,
      config.cellSizePixels,
      config.aggregationFunction, // Pass aggregation function
      config.onAfterAggregate // Pass post-aggregation hook
    );
  },

  /**
   * Render aggregated grid cells to canvas
   * @param {Object} aggregationResult - Result from aggregate()
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} config - Layer configuration (colorScale, enableGlyphs, etc.)
   * @param {Object} map - MapLibre map instance (not used for screen-space)
   */
  render(aggregationResult, ctx, config, map) {
    // Current zoom level for context
    const zoomLevel = map ? map.getZoom() : 0;
    
    // Check if a cell is currently hovered (assuming we can track this)
    // For now, we'll pass it if it's available in the config/state
    const hoveredIndex = config._hoveredIndex !== undefined ? config._hoveredIndex : -1;

    // Use existing renderer
    Renderer.render(aggregationResult, ctx, {
      colorScale: config.colorScale,
      enableGlyphs: config.enableGlyphs || Boolean(config.onDrawCell),
      onDrawCell: config.onDrawCell,
      glyphSize: config.glyphSize,
      showBackground: config.showBackground, // Pass showBackground to renderer
      normalizationFunction: config.normalizationFunction, // Pass normalization function
      normalizationContext: config.normalizationContext, // Pass normalization context
      zoomLevel,
      hoveredIndex
    });
  },

  /**
   * Get cell at screen coordinates (for hover/click events)
   * @param {Object} point - {x, y} screen coordinates
   * @param {Object} aggregationResult - Current aggregation result
   * @param {Object} map - MapLibre map instance (not used for screen-space)
   * @returns {Object|null} Cell information or null
   */
  getCellAt(point, aggregationResult, map) {
    const engine = new CellQueryEngine();
    engine.setAggregationResult(aggregationResult);
    return engine.getCellAt(point);
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

