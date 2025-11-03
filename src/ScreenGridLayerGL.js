/**
 * ScreenGridLayerGL.js
 * Main orchestrator class - composes all modular components
 */

import { ConfigManager } from './config/ConfigManager.js';
import { Projector } from './core/Projector.js';
import { Aggregator } from './core/Aggregator.js';
import { CellQueryEngine } from './core/CellQueryEngine.js';
import { CanvasManager } from './canvas/CanvasManager.js';
import { Renderer } from './canvas/Renderer.js';
import { EventBinder } from './events/EventBinder.js';
import { EventHandlers } from './events/EventHandlers.js';
import { GlyphUtilities } from './glyphs/GlyphUtilities.js';
import { GlyphRegistry } from './glyphs/GlyphRegistry.js';
import { AggregationModeRegistry } from './aggregation/AggregationModeRegistry.js';
// Ensure built-in modes are registered
import './aggregation/modes/index.js';

export class ScreenGridLayerGL {
  /**
   * Create a new ScreenGrid layer
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Configuration
    this.config = ConfigManager.create(options);

    // Components
    this.projector = new Projector();
    this.aggregator = new Aggregator();
    this.cellQueryEngine = new CellQueryEngine();
    this.canvasManager = new CanvasManager();
    this.renderer = new Renderer();
    this.eventBinder = new EventBinder();

    // Internal state
    this.map = null;
    this.gl = null;
    this.pointsProjected = [];
    this.gridData = null;
    // Plugin instance returned by plugin.init (if any)
    this._glyphInstance = null;
    // Aggregation mode state
    this._aggregationModeInstance = null;
    this._aggregationModePlugin = null;
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
      this._initAggregationMode();

      // Initialize glyph plugin for this layer (if configured)
      this._initGlyphPlugin();

      // Bind events
      this.eventBinder.bind(map, {
        handleHover: (e) => this._handleHover(e),
        handleClick: (e) => this._handleClick(e),
        handleZoom: () => this._handleZoom(),
        handleMove: () => this._handleMove(),
      });

      // Project initial data
      this._projectPoints();

      console.log('ScreenGridLayerGL added to map');
    } catch (error) {
      console.error('Error adding ScreenGridLayerGL to map:', error);
    }
  }

  /**
   * Called before each render
   */
  prerender() {
    console.log('[ScreenGridLayerGL] prerender() called');
    this._projectPoints();
  }

  /**
   * Called when layer is removed from map
   */
  onRemove() {
    this.eventBinder.unbind();
    this.canvasManager.cleanup();
    this._destroyAggregationMode();
    this._destroyGlyphPlugin();

    this.map = null;
    this.pointsProjected = [];
    this.gridData = null;

    console.log('ScreenGridLayerGL removed from map');
  }

  /**
   * Called to render the layer
   */
  render() {
    console.log('[ScreenGridLayerGL] render() called');
    const ctx = this.canvasManager.getContext();
    if (!ctx) {
      console.log('[ScreenGridLayerGL] No canvas context available');
      return;
    }

    // If disabled, clear the canvas and return
    if (!this.config.enabled) {
      console.log('[ScreenGridLayerGL] Layer is disabled');
      this.canvasManager.clear();
      return;
    }

    console.log('[ScreenGridLayerGL] Aggregating and drawing...');
    this._aggregate();
    console.log('[ScreenGridLayerGL] About to call _draw(), gridData exists:', !!this.gridData);
    console.log('[ScreenGridLayerGL] gridData details:', {
      type: this.gridData?.type,
      cols: this.gridData?.cols,
      rows: this.gridData?.rows,
      hasGrid: !!this.gridData?.grid,
      gridLength: this.gridData?.grid?.length
    });
    try {
      this._draw();
      console.log('[ScreenGridLayerGL] _draw() completed successfully');
    } catch (e) {
      console.error('[ScreenGridLayerGL] Error in _draw():', e);
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
    this._projectPoints();
    
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
    
    this.config = ConfigManager.update(this.config, updates);

    // If glyph name changed, re-initialize/destroy plugin lifecycle
    const newGlyph = this.config ? this.config.glyph : null;
    if (previousGlyph !== newGlyph) {
      this._destroyGlyphPlugin();
      this._initGlyphPlugin();
    }

    // If aggregation mode changed, re-initialize mode
    const newAggregationMode = this.config ? this.config.aggregationMode : null;
    if (previousAggregationMode !== newAggregationMode) {
      this._destroyAggregationMode();
      this._initAggregationMode();
      // Clear grid data when mode changes
      this.gridData = null; // Clear stale aggregation data from previous mode
      // Clear canvas to remove old rendering from previous mode
      if (this.canvasManager) {
        this.canvasManager.clear();
      }
    }

    this._projectPoints();
    
    // Trigger repaint so changes are visible immediately
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  // ============ Public Query Methods ============

  /**
   * Get cell information at a point
   * @param {Object} point - {x, y}
   * @returns {Object|null} Cell information
   */
  getCellAt(point) {
    // Normal mode
    if (!this.gridData || !this._aggregationModePlugin) {
      // Fallback to old behavior for backward compatibility
      return this.cellQueryEngine.getCellAt(point);
    }
    return this._aggregationModePlugin.getCellAt(point, this.gridData, this.map);
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
    if (!this.gridData) return null;
    
    // Use mode plugin's getStats if available, otherwise fallback to aggregator
    if (this._aggregationModePlugin && typeof this._aggregationModePlugin.getStats === 'function') {
      return this._aggregationModePlugin.getStats(this.gridData);
    }
    
    return this.aggregator.getStats(this.gridData);
  }

  // ============ Internal Methods ============

  /**
   * Initialize glyph plugin for this layer if configured
   * @private
   */
  _initGlyphPlugin() {
    if (!this.config || !this.config.glyph) return;
    try {
      const plugin = GlyphRegistry.get(this.config.glyph);
      if (plugin && typeof plugin.init === 'function') {
        // Allow plugin.init to return a per-layer instance/state
        this._glyphInstance = plugin.init({ layer: this, config: this.config.glyphConfig || {} }) || null;
      }
    } catch (e) {
      console.error(`Glyph plugin init failed for "${this.config.glyph}":`, e);
      this._glyphInstance = null;
    }
  }

  /**
   * Destroy glyph plugin instance for this layer
   * @private
   */
  _destroyGlyphPlugin() {
    if (!this.config || !this.config.glyph) return;
    try {
      const plugin = GlyphRegistry.get(this.config.glyph);
      // If plugin returned an instance with destroy, prefer that
      if (this._glyphInstance && typeof this._glyphInstance.destroy === 'function') {
        this._glyphInstance.destroy();
      } else if (plugin && typeof plugin.destroy === 'function') {
        plugin.destroy({ layer: this });
      }
    } catch (e) {
      console.error(`Glyph plugin destroy failed for "${this.config.glyph}":`, e);
    } finally {
      this._glyphInstance = null;
    }
  }

  /**
   * Initialize aggregation mode for this layer
   * @private
   */
  _initAggregationMode() {
    console.log('[ScreenGridLayerGL] _initAggregationMode() called');
    const modeName = this.config.aggregationMode || 'screen-grid';
    console.log('[ScreenGridLayerGL] Looking for mode:', modeName);
    console.log('[ScreenGridLayerGL] Available modes:', AggregationModeRegistry.list());
    
    const modePlugin = AggregationModeRegistry.get(modeName);
    
    if (!modePlugin) {
      const error = `AggregationModeRegistry: mode "${modeName}" not found. Available modes: ${AggregationModeRegistry.list().join(', ')}`;
      console.error('[ScreenGridLayerGL]', error);
      throw new Error(error);
    }

    console.log('[ScreenGridLayerGL] Mode plugin found:', modePlugin.name);
    this._aggregationModePlugin = modePlugin;

    // Initialize mode if it has init method
    if (typeof modePlugin.init === 'function') {
      try {
        console.log('[ScreenGridLayerGL] Initializing mode plugin...');
        this._aggregationModeInstance = modePlugin.init(
          this.config.aggregationModeConfig || {},
          this.map
        );
        console.log('[ScreenGridLayerGL] Mode plugin initialized');
      } catch (e) {
        console.error(`[ScreenGridLayerGL] AggregationMode "${modeName}" init failed:`, e);
        this._aggregationModeInstance = null;
      }
    } else {
      console.log('[ScreenGridLayerGL] Mode plugin has no init method');
    }
  }

  /**
   * Destroy aggregation mode instance for this layer
   * @private
   */
  _destroyAggregationMode() {
    if (this._aggregationModeInstance && typeof this._aggregationModeInstance.destroy === 'function') {
      try {
        this._aggregationModeInstance.destroy();
      } catch (e) {
        console.error('Error destroying aggregation mode instance:', e);
      }
    }
    this._aggregationModeInstance = null;
    this._aggregationModePlugin = null;
  }


  /**
   * Project geographic coordinates to screen space
   * @private
   */
  _projectPoints() {
    if (!this.map) return;

    this.pointsProjected = Projector.projectPoints(
      this.config.data,
      this.config.getPosition,
      this.config.getWeight,
      this.map
    );
  }

  /**
   * Aggregate points into grid
   * @private
   */
  _aggregate() {
    console.log('[ScreenGridLayerGL] _aggregate() called');
    if (!this.map) {
      console.log('[ScreenGridLayerGL] No map available for aggregation');
      return;
    }

    // Get aggregation mode plugin
    const modeName = this.config.aggregationMode || 'screen-grid';
    console.log('[ScreenGridLayerGL] Getting mode plugin:', modeName);
    
    if (!this._aggregationModePlugin) {
      this._aggregationModePlugin = AggregationModeRegistry.get(modeName);
    }
    
    if (!this._aggregationModePlugin) {
      const error = `AggregationModeRegistry: mode "${modeName}" not found. Available modes: ${AggregationModeRegistry.list().join(', ')}`;
      console.error('[ScreenGridLayerGL]', error);
      throw new Error(error);
    }

    console.log('[ScreenGridLayerGL] Aggregating with data:', {
      dataLength: this.config.data?.length || 0,
      hasGetPosition: typeof this.config.getPosition === 'function',
      hasGetWeight: typeof this.config.getWeight === 'function'
    });

    // Prepare config for aggregation
    const { width, height } = this.canvasManager.getDisplaySize();
    console.log('[ScreenGridLayerGL] Canvas size:', { width, height });
    const modeConfig = {
      ...this.config.aggregationModeConfig,
      cellSizePixels: this.config.cellSizePixels,
      displaySize: { width, height },
    };

    // Aggregate using mode plugin
    console.log('[ScreenGridLayerGL] Calling mode plugin aggregate...');
    try {
      this.gridData = this._aggregationModePlugin.aggregate(
        this.config.data,
        this.config.getPosition,
        this.config.getWeight,
        this.map,
        modeConfig
      );
      
      // Store aggregationModeConfig in gridData for render phase
      if (this.gridData && this.config.aggregationModeConfig) {
        this.gridData.aggregationModeConfig = this.config.aggregationModeConfig;
      }
      
      console.log('[ScreenGridLayerGL] Aggregation complete:', {
        hasGridData: !!this.gridData,
        gridLength: this.gridData?.grid?.length || 0,
        cols: this.gridData?.cols,
        rows: this.gridData?.rows
      });
    } catch (e) {
      console.error('[ScreenGridLayerGL] Error during aggregation:', e);
      throw e;
    }

    // Update cell query engine (for screen-space modes)
    if (this._aggregationModePlugin?.type === 'screen-space') {
      this.cellQueryEngine.setAggregationResult(this.gridData);
    }

    // Trigger callback
    if (this.config.onAggregate) {
      console.log('[ScreenGridLayerGL] Calling onAggregate callback');
      try {
        this.config.onAggregate(this.gridData);
        console.log('[ScreenGridLayerGL] onAggregate callback completed');
      } catch (e) {
        console.error('[ScreenGridLayerGL] Error in onAggregate callback:', e);
        // Don't throw - allow rendering to continue even if callback fails
      }
    } else {
      console.log('[ScreenGridLayerGL] No onAggregate callback defined');
    }
    
    console.log('[ScreenGridLayerGL] _aggregate() returning, gridData exists:', !!this.gridData);
  }

  /**
   * Draw grid to canvas
   * @private
   */
  _draw() {
    const ctx = this.canvasManager.getContext();
    if (!ctx) {
      console.log('[ScreenGridLayerGL] _draw() skipping - no ctx');
      return;
    }

    // Normal rendering path
    if (!this.gridData) {
      console.log('[ScreenGridLayerGL] _draw() skipping - no gridData');
      return;
    }

    console.log('[ScreenGridLayerGL] _draw() called with gridData:', {
      hasGridData: !!this.gridData,
      type: this.gridData.type,
      cols: this.gridData.cols,
      rows: this.gridData.rows,
      gridLength: this.gridData.grid?.length
    });

    // Get aggregation mode plugin
    const modeName = this.config.aggregationMode || 'screen-grid';
    const modePlugin = this._aggregationModePlugin || AggregationModeRegistry.get(modeName);
    
    if (!modePlugin) {
      console.error(`AggregationModeRegistry: mode "${modeName}" not found`);
      return;
    }
    
    console.log('[ScreenGridLayerGL] Using mode plugin:', modePlugin.name);

    // Determine the onDrawCell behavior. Priority:
    // 1. user-provided onDrawCell callback
    // 2. registered glyph via `config.glyph` (uses GlyphRegistry)
    // 3. no onDrawCell -> color-mode rendering
    let onDrawCell = this.config.onDrawCell || null;

    if (!onDrawCell && this.config.glyph) {
      const plugin = GlyphRegistry.get(this.config.glyph);
      if (plugin && typeof plugin.draw === 'function') {
        // Wrap plugin.draw to match the onDrawCell signature and pass glyphConfig
        const glyphCfg = this.config.glyphConfig || {};
        onDrawCell = (ctxArg, x, y, normVal, cellInfo) => {
          try {
            plugin.draw(ctxArg, x, y, normVal, cellInfo, glyphCfg);
          } catch (e) {
            console.error(`Glyph plugin "${this.config.glyph}" threw an error:`, e);
          }
        };
      } else {
        console.warn(`Glyph "${this.config.glyph}" not found in GlyphRegistry`);
      }
    }

    // Prepare config for rendering
    const renderConfig = {
      colorScale: this.config.colorScale,
      enableGlyphs: this.config.enableGlyphs || Boolean(onDrawCell),
      onDrawCell: onDrawCell,
      glyphSize: this.config.glyphSize,
      showBackground: this.config.aggregationModeConfig?.showBackground, // Extract showBackground from mode config
    };

    // Merge mode config (showBackground is already extracted above, so it won't conflict)
    const modeConfig = {
      ...renderConfig,
      ...this.config.aggregationModeConfig,
    };

    console.log('[ScreenGridLayerGL] Calling modePlugin.render() with:', {
      hasGridData: !!this.gridData,
      hasCtx: !!ctx,
      modePluginName: modePlugin.name,
      modeConfigKeys: Object.keys(modeConfig)
    });

    // Render using mode plugin
    try {
      modePlugin.render(this.gridData, ctx, modeConfig, this.map);
      console.log('[ScreenGridLayerGL] modePlugin.render() completed');
    } catch (e) {
      console.error('[ScreenGridLayerGL] Error in modePlugin.render():', e);
      throw e;
    }
  }

  /**
   * Handle hover event
   * @private
   */
  _handleHover(e) {
    // Pass layer instance so it can use mode-aware getCellAt() for both grid and hex modes
    EventHandlers.handleHover(e, this, this.config.onHover);
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
    // Check if mode needs update on zoom
    const modePlugin = this._aggregationModePlugin || 
      AggregationModeRegistry.get(this.config.aggregationMode || 'screen-grid');
    
    if (modePlugin && !modePlugin.needsUpdateOnZoom()) {
      return; // Mode doesn't need update on zoom
    }

    EventHandlers.handleZoom(this.map, this.config, () => {
      this._projectPoints();
    });
  }

  /**
   * Handle move event
   * @private
   */
  _handleMove() {
    // Check if mode needs update on move
    const modePlugin = this._aggregationModePlugin || 
      AggregationModeRegistry.get(this.config.aggregationMode || 'screen-grid');
    
    if (modePlugin && !modePlugin.needsUpdateOnMove()) {
      return; // Mode doesn't need update on move
    }

    EventHandlers.handleMove(() => {
      this._projectPoints();
    });
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
