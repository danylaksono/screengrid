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
import { PlacementEngine } from './core/geometry/PlacementEngine.js';
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
    // Placement state (for geometry input)
    this._anchors = []; // Cached anchors from placement
    this._placementCacheKey = null; // Cache key for view-dependent placement
    this._lastViewState = null; // Track view state for cache invalidation
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

      if (this.config.debugLogs) console.log('ScreenGridLayerGL added to map');
    } catch (error) {
      console.error('Error adding ScreenGridLayerGL to map:', error);
    }
  }

  /**
   * Called before each render
   */
  prerender() {
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] prerender() called');
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
    this._anchors = [];
    this._placementCacheKey = null;
    this._lastViewState = null;

    if (this.config.debugLogs) console.log('ScreenGridLayerGL removed from map');
  }

  /**
   * Called to render the layer
   */
  render() {
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] render() called');
    const ctx = this.canvasManager.getContext();
    if (!ctx) {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] No canvas context available');
      return;
    }

    // If disabled, clear the canvas and return
    if (!this.config.enabled) {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Layer is disabled');
      this.canvasManager.clear();
      return;
    }

    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Aggregating and drawing...');
    this._aggregate();
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] About to call _draw(), gridData exists:', !!this.gridData);
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] gridData details:', {
      type: this.gridData?.type,
      cols: this.gridData?.cols,
      rows: this.gridData?.rows,
      hasGrid: !!this.gridData?.grid,
      gridLength: this.gridData?.grid?.length
    });
    try {
      this._draw();
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _draw() completed successfully');
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
    const previousSource = this.config ? this.config.source : null;
    const previousPlacement = this.config ? JSON.stringify(this.config.placement) : null;
    const previousRenderMode = this.config ? this.config.renderMode : null;
    
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

    // If source or placement changed, clear placement cache
    const newSource = this.config ? this.config.source : null;
    const newPlacement = this.config ? JSON.stringify(this.config.placement) : null;
    if (previousSource !== newSource || previousPlacement !== newPlacement) {
      this._placementCacheKey = null;
      this._anchors = [];
    }

    // If renderMode changed, clear grid data
    const newRenderMode = this.config ? this.config.renderMode : null;
    if (previousRenderMode !== newRenderMode) {
      this.gridData = null;
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
   * @returns {Object|null} Cell information or anchor information
   */
  getCellAt(point) {
    // Feature-anchors mode: find nearest anchor
    if (this.config.renderMode === 'feature-anchors') {
      return this._getAnchorAt(point);
    }

    // Normal mode (screen-grid)
    if (!this.gridData || !this._aggregationModePlugin) {
      // Fallback to old behavior for backward compatibility
      return this.cellQueryEngine.getCellAt(point);
    }
    return this._aggregationModePlugin.getCellAt(point, this.gridData, this.map);
  }

  /**
   * Get nearest anchor at a point (for feature-anchors mode)
   * @private
   */
  _getAnchorAt(point) {
    if (!this.map || this._anchors.length === 0) {
      return null;
    }

    const { x, y } = point;
    const anchorSize = this.config.anchorSizePixels || 
                      Math.round(this.config.cellSizePixels * this.config.glyphSize * 0.9);
    const hitRadius = anchorSize / 2 + 5; // Add 5px tolerance

    let nearestAnchor = null;
    let minDistance = Infinity;

    for (const anchor of this._anchors) {
      try {
        const [lng, lat] = anchor.position;
        const screenPoint = this.map.project([lng, lat]);
        const anchorX = screenPoint.x;
        const anchorY = screenPoint.y;

        const distance = Math.sqrt(
          Math.pow(x - anchorX, 2) + Math.pow(y - anchorY, 2)
        );

        if (distance < hitRadius && distance < minDistance) {
          minDistance = distance;
          nearestAnchor = anchor;
        }
      } catch (error) {
        // Skip invalid anchors
        continue;
      }
    }

    if (!nearestAnchor) {
      return null;
    }

    // Return anchor info in a cell-like format for consistency
    const weight = nearestAnchor.weight || 1;
    const maxWeight = Math.max(...this._anchors.map(a => a.weight || 1), 1);
    const normVal = weight / maxWeight;

    return {
      mode: 'feature-anchors',
      anchor: nearestAnchor,
      featureId: nearestAnchor.featureId,
      props: nearestAnchor.props,
      weight: weight,
      normalizedValue: normVal,
      // For backward compatibility, provide cell-like structure
      cellData: [{ data: nearestAnchor.props, weight: weight }],
      x: this.map.project(nearestAnchor.position).x,
      y: this.map.project(nearestAnchor.position).y,
    };
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
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _initAggregationMode() called');
    const modeName = this.config.aggregationMode || 'screen-grid';
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Looking for mode:', modeName);
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Available modes:', AggregationModeRegistry.list());
    
    const modePlugin = AggregationModeRegistry.get(modeName);
    
    if (!modePlugin) {
      const error = `AggregationModeRegistry: mode "${modeName}" not found. Available modes: ${AggregationModeRegistry.list().join(', ')}`;
      console.error('[ScreenGridLayerGL]', error);
      throw new Error(error);
    }

    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Mode plugin found:', modePlugin.name);
    this._aggregationModePlugin = modePlugin;

    // Initialize mode if it has init method
    if (typeof modePlugin.init === 'function') {
      try {
        if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Initializing mode plugin...');
        this._aggregationModeInstance = modePlugin.init(
          this.config.aggregationModeConfig || {},
          this.map
        );
        if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Mode plugin initialized');
      } catch (e) {
        console.error(`[ScreenGridLayerGL] AggregationMode "${modeName}" init failed:`, e);
        this._aggregationModeInstance = null;
      }
      } else {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Mode plugin has no init method');
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
   * Handles both legacy data path and new source+placement path
   * @private
   */
  _projectPoints() {
    if (!this.map) return;

    // Check if using geometry placement path
    if (this.config.source && this.config.placement) {
      this._updatePlacementAnchors();
      
      // Convert anchors to data format for projection
      const anchorData = this._anchors.map(anchor => ({
        position: anchor.position,
        weight: anchor.weight || 1,
        anchor: anchor // Keep reference to original anchor
      }));

      // Project anchors to screen space
      this.pointsProjected = Projector.projectPoints(
        anchorData,
        (d) => d.position,
        (d) => d.weight,
        this.map
      );
    } else {
      // Legacy path: use data + getPosition/getWeight
      this.pointsProjected = Projector.projectPoints(
        this.config.data,
        this.config.getPosition,
        this.config.getWeight,
        this.map
      );
    }
  }

  /**
   * Update placement anchors (with caching for view-dependent strategies)
   * @private
   */
  _updatePlacementAnchors() {
    if (!this.config.source || !this.config.placement) {
      this._anchors = [];
      return;
    }

    // Check if placement needs view update
    const needsViewUpdate = PlacementEngine.needsViewUpdate(this.config.placement);
    
    // Generate cache key
    const viewState = this.map ? {
      zoom: Math.floor(this.map.getZoom() * 10) / 10, // Round to 0.1 for zoom buckets
      center: this.map.getCenter(),
      width: this.canvasManager.getDisplaySize().width,
      height: this.canvasManager.getDisplaySize().height
    } : null;

    const cacheKey = needsViewUpdate && viewState
      ? `${this.config.placement.strategy}-${JSON.stringify(this.config.placement)}-${JSON.stringify(viewState)}`
      : `${this.config.placement.strategy}-${JSON.stringify(this.config.placement)}`;

    // Check cache
    if (this._placementCacheKey === cacheKey && this._anchors.length > 0) {
      // Check if view changed significantly (for view-dependent strategies)
      if (needsViewUpdate && viewState && this._lastViewState) {
        const zoomDelta = Math.abs(viewState.zoom - this._lastViewState.zoom);
        const panDeltaX = Math.abs(viewState.center.lng - this._lastViewState.center.lng);
        const panDeltaY = Math.abs(viewState.center.lat - this._lastViewState.center.lat);
        
        // Recompute if zoom changed significantly or pan exceeded threshold
        const zoomThreshold = 0.5;
        const panThreshold = 0.25; // 25% of viewport
        
        if (zoomDelta > zoomThreshold || 
            panDeltaX > panThreshold || 
            panDeltaY > panThreshold) {
          // Cache miss - recompute
        } else {
          // Cache hit - reuse anchors
          return;
        }
      } else {
        // Cache hit - reuse anchors
        return;
      }
    }

    // Compute placement
    try {
      this._anchors = PlacementEngine.place(
        this.config.source,
        this.config.placement,
        this.map
      );
      this._placementCacheKey = cacheKey;
      this._lastViewState = viewState;
      
      if (this.config.debugLogs) console.log(`[ScreenGridLayerGL] Placement computed: ${this._anchors.length} anchors`);
    } catch (error) {
      console.error('[ScreenGridLayerGL] Placement error:', error);
      this._anchors = [];
      this._placementCacheKey = null;
    }
  }

  /**
   * Aggregate points into grid
   * Skips aggregation if renderMode is 'feature-anchors'
   * @private
   */
  _aggregate() {
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _aggregate() called');
    
    // Skip aggregation for feature-anchors mode
    if (this.config.renderMode === 'feature-anchors') {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Skipping aggregation (feature-anchors mode)');
      this.gridData = null;
      return;
    }

    if (!this.map) {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] No map available for aggregation');
      return;
    }

    // Get aggregation mode plugin
    const modeName = this.config.aggregationMode || 'screen-grid';
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Getting mode plugin:', modeName);
    
    if (!this._aggregationModePlugin) {
      this._aggregationModePlugin = AggregationModeRegistry.get(modeName);
    }
    
    if (!this._aggregationModePlugin) {
      const error = `AggregationModeRegistry: mode "${modeName}" not found. Available modes: ${AggregationModeRegistry.list().join(', ')}`;
      console.error('[ScreenGridLayerGL]', error);
      throw new Error(error);
    }

    // Determine data source
    let dataToAggregate = this.config.data;
    let getPosition = this.config.getPosition;
    let getWeight = this.config.getWeight;

    // If using placement, convert anchors to data format
    if (this.config.source && this.config.placement) {
      dataToAggregate = this._anchors.map(anchor => ({
        position: anchor.position,
        weight: anchor.weight || 1,
        anchor: anchor
      }));
      getPosition = (d) => d.position;
      getWeight = (d) => d.weight;
    }

    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Aggregating with data:', {
      dataLength: dataToAggregate?.length || 0,
      hasGetPosition: typeof getPosition === 'function',
      hasGetWeight: typeof getWeight === 'function'
    });

    // Prepare config for aggregation
    const { width, height } = this.canvasManager.getDisplaySize();
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Canvas size:', { width, height });
    const modeConfig = {
      ...this.config.aggregationModeConfig,
      cellSizePixels: this.config.cellSizePixels,
      displaySize: { width, height },
    };

    // Aggregate using mode plugin
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Calling mode plugin aggregate...');
    try {
      this.gridData = this._aggregationModePlugin.aggregate(
        dataToAggregate,
        getPosition,
        getWeight,
        this.map,
        modeConfig
      );
      
      // Store aggregationModeConfig in gridData for render phase
      if (this.gridData && this.config.aggregationModeConfig) {
        this.gridData.aggregationModeConfig = this.config.aggregationModeConfig;
      }
      
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Aggregation complete:', {
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
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Calling onAggregate callback');
      try {
        this.config.onAggregate(this.gridData);
        if (this.config.debugLogs) console.log('[ScreenGridLayerGL] onAggregate callback completed');
      } catch (e) {
        console.error('[ScreenGridLayerGL] Error in onAggregate callback:', e);
        // Don't throw - allow rendering to continue even if callback fails
      }
    } else {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] No onAggregate callback defined');
    }
    
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _aggregate() returning, gridData exists:', !!this.gridData);
  }

  /**
   * Draw grid to canvas
   * Handles both screen-grid (aggregated) and feature-anchors (direct) rendering
   * @private
   */
  _draw() {
    const ctx = this.canvasManager.getContext();
    if (!ctx) {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _draw() skipping - no ctx');
      return;
    }

    // Feature-anchors rendering mode: draw glyphs directly at anchor positions
    if (this.config.renderMode === 'feature-anchors') {
      this._drawFeatureAnchors(ctx);
      return;
    }

    // Normal rendering path (screen-grid mode)
    if (!this.gridData) {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _draw() skipping - no gridData');
      return;
    }

    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _draw() called with gridData:', {
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
    
    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Using mode plugin:', modePlugin.name);

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

    if (this.config.debugLogs) console.log('[ScreenGridLayerGL] Calling modePlugin.render() with:', {
      hasGridData: !!this.gridData,
      hasCtx: !!ctx,
      modePluginName: modePlugin.name,
      modeConfigKeys: Object.keys(modeConfig)
    });

    // Render using mode plugin
    try {
      modePlugin.render(this.gridData, ctx, modeConfig, this.map);
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] modePlugin.render() completed');
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
    // Check if placement needs view update
    if (this.config.source && this.config.placement) {
      const needsViewUpdate = PlacementEngine.needsViewUpdate(this.config.placement);
      if (needsViewUpdate) {
        // Clear placement cache to force recomputation
        this._placementCacheKey = null;
        this._projectPoints();
        if (this.map) {
          this.map.triggerRepaint();
        }
        return;
      }
    }

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
    // Check if placement needs view update
    if (this.config.source && this.config.placement) {
      const needsViewUpdate = PlacementEngine.needsViewUpdate(this.config.placement);
      if (needsViewUpdate) {
        // Clear placement cache to force recomputation
        this._placementCacheKey = null;
        this._projectPoints();
        if (this.map) {
          this.map.triggerRepaint();
        }
        return;
      }
    }

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

  /**
   * Draw feature anchors directly (feature-anchors rendering mode)
   * @private
   */
  _drawFeatureAnchors(ctx) {
    if (!this.map || this._anchors.length === 0) {
      if (this.config.debugLogs) console.log('[ScreenGridLayerGL] _drawFeatureAnchors: no anchors to draw');
      return;
    }

    // Clear canvas
    this.canvasManager.clear();

    // Determine onDrawCell behavior (same precedence as screen-grid mode)
    let onDrawCell = this.config.onDrawCell || null;

    if (!onDrawCell && this.config.glyph) {
      const plugin = GlyphRegistry.get(this.config.glyph);
      if (plugin && typeof plugin.draw === 'function') {
        const glyphCfg = this.config.glyphConfig || {};
        onDrawCell = (ctxArg, x, y, normVal, cellInfo) => {
          try {
            plugin.draw(ctxArg, x, y, normVal, cellInfo, glyphCfg);
          } catch (e) {
            console.error(`Glyph plugin "${this.config.glyph}" threw an error:`, e);
          }
        };
      }
    }

    // If no glyph drawing, skip (or could draw simple circles)
    if (!onDrawCell && !this.config.enableGlyphs) {
      return;
    }

    // Get anchor size
    const anchorSize = this.config.anchorSizePixels || 
                      Math.round(this.config.cellSizePixels * this.config.glyphSize * 0.9);

    // Project anchors to screen space and draw
    for (const anchor of this._anchors) {
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
        const maxWeight = Math.max(...this._anchors.map(a => a.weight || 1), 1);
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
        console.warn(`[ScreenGridLayerGL] Error drawing anchor:`, error);
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
