/**
 * ScreenGridLayerGL.js
 * Main orchestrator class - composes all modular components
 */

import { ConfigManager } from './config/ConfigManager.js';
import { Aggregator } from './core/Aggregator.js';
import { CellQueryEngine } from './core/CellQueryEngine.js';
import { CanvasManager } from './canvas/CanvasManager.js';
import { Renderer } from './canvas/Renderer.js';
import { EventBinder } from './events/EventBinder.js';
import { EventHandlers } from './events/EventHandlers.js';
import { GlyphUtilities } from './glyphs/GlyphUtilities.js';
import { GlyphController } from './controllers/GlyphController.js';
import { AggregationController } from './controllers/AggregationController.js';
import { PlacementController } from './controllers/PlacementController.js';
import { Logger } from './utils/Logger.js';

export class ScreenGridLayerGL {
  /**
   * Create a new ScreenGrid layer
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Configuration
    this.config = ConfigManager.create(options);

    // Components
    this.aggregator = new Aggregator();
    this.cellQueryEngine = new CellQueryEngine();
    this.canvasManager = new CanvasManager();
    this.renderer = new Renderer();
    this.eventBinder = new EventBinder();
    this.glyphController = new GlyphController(this);
    this.aggregationController = new AggregationController();
    this.placementController = new PlacementController();

    // Internal state
    this.map = null;
    this.gl = null;
    this.gridData = null;
    this._hoveredIndex = -1; // Track currently hovered cell index
  }

  // ============ MapLibre GL Interface ============

  get id() {
    return this.config.id;
  }

  get type() {
    return 'custom';
  }

  get renderingMode() {
    return '2d';
  }

  // ============ Preset Factories ============

  /**
   * Create a standard rectangular density grid.
   * @param {Object} options - ScreenGridLayerGL options
   * @returns {ScreenGridLayerGL}
   */
  static density(options = {}) {
    return new ScreenGridLayerGL({
      aggregationMode: 'screen-grid',
      renderMode: 'screen-grid',
      ...options,
    });
  }

  /**
   * Create a hexagonal screen-space density grid.
   * @param {Object} options - ScreenGridLayerGL options
   * @returns {ScreenGridLayerGL}
   */
  static hexDensity(options = {}) {
    return new ScreenGridLayerGL({
      aggregationMode: 'screen-hex',
      renderMode: 'screen-grid',
      ...options,
    });
  }

  /**
   * Create a gridded glyph map for point data.
   * @param {Object} options - ScreenGridLayerGL options
   * @returns {ScreenGridLayerGL}
   */
  static glyphMap(options = {}) {
    return new ScreenGridLayerGL({
      aggregationMode: 'screen-grid',
      renderMode: 'screen-grid',
      enableGlyphs: true,
      ...options,
    });
  }

  /**
   * Create feature-anchored glyphs from GeoJSON source + placement.
   * @param {Object} options - ScreenGridLayerGL options
   * @returns {ScreenGridLayerGL}
   */
  static featureGlyphs(options = {}) {
    return new ScreenGridLayerGL({
      renderMode: 'feature-anchors',
      enableGlyphs: true,
      ...options,
    });
  }

  // ============ Lifecycle Hooks ============

  /**
   * Called when layer is added to map
   */
  onAdd(map, gl) {
    this.map = map;
    this.gl = gl;

    try {
      // Initialize canvas
      this.canvasManager.init(map);

      // Initialize aggregation mode
      this.aggregationController.init(this.config, this.map);

      // Initialize glyph plugin for this layer (if configured)
      this.glyphController.init(this.config);

      // Bind events
      this.eventBinder.bind(map, {
        handleHover: (e) => this._handleHover(e),
        handleClick: (e) => this._handleClick(e),
        handleZoom: () => this._handleZoom(),
        handleMove: () => this._handleMove(),
      });

      // Project initial data
      this._updatePlacement();

      Logger.log('ScreenGridLayerGL added to map');
    } catch (error) {
      Logger.error('Error adding ScreenGridLayerGL to map:', error);
    }
  }

  /**
   * Called before each render
   */
  prerender() {
    this._updatePlacement();
  }

  /**
   * Called when layer is removed from map
   */
  onRemove() {
    this.eventBinder.unbind();
    this.canvasManager.cleanup();
    this.aggregationController.destroy();
    this.glyphController.destroy(this.config);

    this.map = null;
    this.gridData = null;
    this.placementController.reset();

    Logger.log('ScreenGridLayerGL removed from map');
  }

  /**
   * Called to render the layer
   */
  render() {
    const ctx = this.canvasManager.getContext();
    if (!ctx) {
      return;
    }

    // If disabled, clear the canvas and return
    if (!this.config.enabled) {
      this.canvasManager.clear();
      return;
    }

    this._aggregate();
    try {
      this._draw();
    } catch (e) {
      Logger.error('[ScreenGridLayerGL] Error in _draw():', e);
      throw e;
    }
  }

  // ============ Data & Config Management ============

  /**
   * Update data
   * @param {Array} newData - New data array
   */
  setData(newData) {
    this.config = ConfigManager.update(this.config, { data: newData });
    this._updatePlacement();
    
    // Trigger repaint so changes are visible immediately
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  /**
   * Update configuration
   * @param {Object} updates - Partial configuration updates
   */
  setConfig(updates) {
    const previousGlyph = this.config ? this.config.glyph : null;
    const previousAggregationMode = this.config ? this.config.aggregationMode : null;
    const previousSource = this.config ? this.config.source : null;
    const previousPlacement = this.config ? JSON.stringify(this.config.placement) : null;
    const previousRenderMode = this.config ? this.config.renderMode : null;
    
    this.config = ConfigManager.update(this.config, updates);

    // If glyph name changed, re-initialize/destroy plugin lifecycle
    const newGlyph = this.config ? this.config.glyph : null;
    if (previousGlyph !== newGlyph) {
      this.glyphController.destroy({ ...this.config, glyph: previousGlyph });
      this.glyphController.init(this.config);
    }

    // If aggregation mode changed, re-initialize mode
    const newAggregationMode = this.config ? this.config.aggregationMode : null;
    if (previousAggregationMode !== newAggregationMode) {
      this.aggregationController.destroy();
      this.aggregationController.init(this.config, this.map);
      // Clear grid data when mode changes
      this.gridData = null; // Clear stale aggregation data from previous mode
      // Clear canvas to remove old rendering from previous mode
      if (this.canvasManager) {
        this.canvasManager.clear();
      }
    }

    // If source or placement changed, clear placement cache
    const newSource = this.config ? this.config.source : null;
    const newPlacement = this.config ? JSON.stringify(this.config.placement) : null;
    if (previousSource !== newSource || previousPlacement !== newPlacement) {
      this.placementController.reset();
    }

    // If renderMode changed, clear grid data
    const newRenderMode = this.config ? this.config.renderMode : null;
    if (previousRenderMode !== newRenderMode) {
      this.gridData = null;
      if (this.canvasManager) {
        this.canvasManager.clear();
      }
    }

    this._updatePlacement();
    
    // Trigger repaint so changes are visible immediately
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  // ============ Public Query Methods ============

  /**
   * Get cell information at a point
   * @param {Object} point - {x, y}
   * @returns {Object|null} Cell information or anchor information
   */
  getCellAt(point) {
    // Feature-anchors mode: find nearest anchor
    if (this.config.renderMode === 'feature-anchors') {
      return this.placementController.getAnchorAt(point, this.config, this.map);
    }

    // Normal mode (screen-grid)
    if (!this.gridData || !this.aggregationController.modePlugin) {
      // Fallback to old behavior for backward compatibility
      return this.cellQueryEngine.getCellAt(point);
    }
    return this.aggregationController.getCellAt(point, this.gridData, this.map);
  }

  /**
   * Get cells in a rectangular region
   * @param {Object} bounds - {minX, minY, maxX, maxY}
   * @returns {Array} Cells in bounds
   */
  getCellsInBounds(bounds) {
    return this.cellQueryEngine.getCellsInBounds(bounds);
  }

  /**
   * Get grid statistics
   * @returns {Object} Grid statistics
   */
  getGridStats() {
    return this.aggregationController.getStats(this.gridData, this.aggregator);
  }

  // ============ Internal Methods ============

  /**
   * Refresh derived point data ahead of aggregation.
   * Only the source+placement path needs work here (anchor recomputation);
   * for plain data the aggregation modes project points themselves during
   * render, so projecting here would duplicate that work every frame.
   * @private
   */
  _updatePlacement() {
    if (!this.map) return;

    if (this.config.source && this.config.placement) {
      this.placementController.update(this.config, this.map, this.canvasManager);
    }
  }

  /**
   * Aggregate points into grid
   * Skips aggregation if renderMode is 'feature-anchors'
   * @private
   */
  _aggregate() {
    // Skip aggregation for feature-anchors mode
    if (this.config.renderMode === 'feature-anchors') {
      this.gridData = null;
      return;
    }

    if (!this.map) {
      return;
    }

    // Determine data source
    let dataToAggregate = this.config.data;
    let getPosition = this.config.getPosition;
    let getWeight = this.config.getWeight;

    // If using placement, convert anchors to data format
    if (this.config.source && this.config.placement) {
      dataToAggregate = this.placementController.anchors.map(anchor => ({
        position: anchor.position,
        weight: anchor.weight || 1,
        anchor: anchor
      }));
      getPosition = (d) => d.position;
      getWeight = (d) => d.weight;
    }

    const { width, height } = this.canvasManager.getDisplaySize();

    // Aggregate using mode plugin
    try {
      this.gridData = this.aggregationController.aggregate(
        dataToAggregate,
        getPosition,
        getWeight,
        this.map,
        this.config,
        { width, height }
      );
    } catch (e) {
      Logger.error('[ScreenGridLayerGL] Error during aggregation:', e);
      throw e;
    }

    // Update cell query engine (for screen-space modes)
    if (this.aggregationController.isScreenSpace()) {
      this.cellQueryEngine.setAggregationResult(this.gridData);
    }

    // Trigger callback
    if (this.config.onAggregate) {
      try {
        this.config.onAggregate(this.gridData);
      } catch (e) {
        Logger.error('[ScreenGridLayerGL] Error in onAggregate callback:', e);
        // Don't throw - allow rendering to continue even if callback fails
      }
    }
  }

  /**
   * Draw grid to canvas
   * Handles both screen-grid (aggregated) and feature-anchors (direct) rendering
   * @private
   */
  _draw() {
    const ctx = this.canvasManager.getContext();
    if (!ctx) {
      return;
    }

    // Feature-anchors rendering mode: draw glyphs directly at anchor positions
    if (this.config.renderMode === 'feature-anchors') {
      this._drawFeatureAnchors(ctx);
      return;
    }

    // Normal rendering path (screen-grid mode)
    if (!this.gridData) {
      return;
    }

    const onDrawCell = this.glyphController.getDrawCallback(this.config);

    // Prepare config for rendering
    const renderConfig = {
      colorScale: this.config.colorScale,
      enableGlyphs: this.config.enableGlyphs || Boolean(onDrawCell),
      onDrawCell: onDrawCell,
      glyphSize: this.config.glyphSize,
      showBackground: this.config.aggregationModeConfig?.showBackground, // Extract showBackground from mode config
      normalizationFunction: this.config.normalizationFunction, // Pass normalization function
      normalizationContext: this.config.normalizationContext, // Pass normalization context
      _hoveredIndex: this._hoveredIndex, // Pass tracked hover state
    };

    // Merge mode config (showBackground is already extracted above, so it won't conflict)
    const modeConfig = {
      ...renderConfig,
      ...this.config.aggregationModeConfig,
    };

    // Render using mode plugin
    try {
      this.aggregationController.render(this.gridData, ctx, modeConfig, this.map);
    } catch (e) {
      Logger.error('[ScreenGridLayerGL] Error in modePlugin.render():', e);
      throw e;
    }
  }

  /**
   * Handle hover event
   * @private
   */
  _handleHover(e) {
    const cell = this.getCellAt({ x: e.point.x, y: e.point.y });
    const newHoveredIndex = (cell && cell.index !== undefined) ? cell.index : -1;
    
    if (this._hoveredIndex !== newHoveredIndex) {
      this._hoveredIndex = newHoveredIndex;
      // Trigger repaint to update highlight if needed
      if (this.map) {
        this.map.triggerRepaint();
      }
    }

    if (this.config.onHover && typeof this.config.onHover === 'function') {
      this.config.onHover({ cell, event: e });
    }
  }

  /**
   * Handle click event
   * @private
   */
  _handleClick(e) {
    // Pass layer instance so it can use mode-aware getCellAt() for both grid and hex modes
    EventHandlers.handleClick(e, this, this.config.onClick);
  }

  /**
   * Handle zoom event
   * @private
   */
  _handleZoom() {
    // Check if placement needs view update
    if (this.config.source && this.config.placement) {
      const needsViewUpdate = this.placementController.needsViewUpdate(this.config);
      if (needsViewUpdate) {
        // Clear placement cache to force recomputation
        this.placementController.clearCache();
        this._updatePlacement();
        if (this.map) {
          this.map.triggerRepaint();
        }
        return;
      }
    }

    if (!this.aggregationController.needsUpdateOnZoom()) {
      return; // Mode doesn't need update on zoom
    }

    EventHandlers.handleZoom(this.map, this.config, () => {
      this._updatePlacement();
    });
  }

  /**
   * Handle move event
   * @private
   */
  _handleMove() {
    // Check if placement needs view update
    if (this.config.source && this.config.placement) {
      const needsViewUpdate = this.placementController.needsViewUpdate(this.config);
      if (needsViewUpdate) {
        // Clear placement cache to force recomputation
        this.placementController.clearCache();
        this._updatePlacement();
        if (this.map) {
          this.map.triggerRepaint();
        }
        return;
      }
    }

    if (!this.aggregationController.needsUpdateOnMove()) {
      return; // Mode doesn't need update on move
    }

    EventHandlers.handleMove(() => {
      this._updatePlacement();
    });
  }

  /**
   * Draw feature anchors directly (feature-anchors rendering mode)
   * @private
   */
  _drawFeatureAnchors(ctx) {
    const anchors = this.placementController.anchors;
    if (!this.map || anchors.length === 0) {
      Logger.log('[ScreenGridLayerGL] _drawFeatureAnchors: no anchors to draw');
      return;
    }

    // Clear canvas
    this.canvasManager.clear();

    const onDrawCell = this.glyphController.getDrawCallback(this.config);

    // If no glyph drawing, skip (or could draw simple circles)
    if (!onDrawCell && !this.config.enableGlyphs) {
      return;
    }

    // Get anchor size
    const anchorSize = this.config.anchorSizePixels || 
                      Math.round(this.config.cellSizePixels * this.config.glyphSize * 0.9);

    // Calculate max weight once (outside loop)
    const maxWeight = this.placementController.maxWeight;

    // Project anchors to screen space and draw
    for (const anchor of anchors) {
      try {
        const [lng, lat] = anchor.position;
        const screenPoint = this.map.project([lng, lat]);
        const x = screenPoint.x;
        const y = screenPoint.y;

        // Check if anchor is within viewport (with some margin)
        const { width, height } = this.canvasManager.getDisplaySize();
        if (x < -anchorSize || x > width + anchorSize ||
            y < -anchorSize || y > height + anchorSize) {
          continue; // Skip anchors outside viewport
        }

        // Normalize weight (simple normalization: use weight / maxWeight)
        // For feature-anchors, we might want to normalize across all anchors
        const weight = anchor.weight || 1;
        const normVal = weight / maxWeight;

        // Prepare cellInfo-like object for glyph drawing
        const cellInfo = {
          cellData: [{ data: anchor.props, weight: weight }],
          glyphRadius: anchorSize / 2,
          anchor: anchor,
          featureId: anchor.featureId,
          props: anchor.props
        };

        // Draw glyph
        if (onDrawCell) {
          onDrawCell(ctx, x, y, normVal, cellInfo);
        } else if (this.config.enableGlyphs) {
          // Fallback: draw simple circle
          const color = this.config.colorScale ? this.config.colorScale(normVal) : [255, 100, 200, 200];
          ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
          ctx.beginPath();
          ctx.arc(x, y, anchorSize / 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      } catch (error) {
        Logger.warn(`[ScreenGridLayerGL] Error drawing anchor:`, error);
      }
    }
  }

  // ============ Static Glyph Utilities ============

  static drawCircleGlyph = GlyphUtilities.drawCircleGlyph;
  static drawBarGlyph = GlyphUtilities.drawBarGlyph;
  static drawPieGlyph = GlyphUtilities.drawPieGlyph;
  static drawScatterGlyph = GlyphUtilities.drawScatterGlyph;
  static drawDonutGlyph = GlyphUtilities.drawDonutGlyph;
  static drawHeatmapGlyph = GlyphUtilities.drawHeatmapGlyph;
  static drawRadialBarGlyph = GlyphUtilities.drawRadialBarGlyph;
  static drawTimeSeriesGlyph = GlyphUtilities.drawTimeSeriesGlyph;
}
