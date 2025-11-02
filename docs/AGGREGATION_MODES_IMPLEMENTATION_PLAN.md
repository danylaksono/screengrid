# Aggregation Modes Implementation Plan

## Overview

This document outlines a comprehensive plan for implementing three major aggregation enhancements:
1. **Alternative Tessellation** (hexagons and other shapes in screen space)
2. **Freeze Aggregation Mode** (static aggregation during interactions)
3. **Map-Space Aggregation** (H3-based geographic aggregation)

## Design Principles

1. **Backward Compatibility**: Existing code must work without changes
2. **Mutual Exclusivity**: Only one aggregation mode active at a time
3. **Plugin Architecture**: Leverage existing plugin pattern (similar to `GlyphRegistry`)
4. **Modular Design**: Keep concerns separated (Aggregator, Renderer, Projector)
5. **Performance**: Optimize for large datasets with thousands of points
6. **Opt-in H3**: H3 as optional peer dependency, not required for core library

## Architecture: Aggregation Mode Plugin System

### Core Concept

Similar to `GlyphRegistry`, create an `AggregationModeRegistry` that manages different aggregation strategies. Each mode is a plugin that implements a standardized interface.

### Aggregation Mode Interface

```javascript
/**
 * AggregationMode Plugin Interface
 * Each aggregation mode must implement these methods
 */
class AggregationModePlugin {
  /**
   * Unique identifier for this aggregation mode
   * @type {string}
   */
  name = '';

  /**
   * Type of aggregation: 'screen-space' | 'map-space'
   * Screen-space: aggregates in pixel coordinates (viewport-dependent)
   * Map-space: aggregates in geographic coordinates (viewport-independent)
   * @type {'screen-space' | 'map-space'}
   */
  type = 'screen-space';

  /**
   * Initialize the aggregation mode
   * Called when mode is activated
   * @param {Object} options - Mode-specific configuration
   * @param {Object} map - MapLibre map instance
   * @returns {Object|null} Optional instance state with destroy() method
   */
  init(options, map) {
    return null; // or { destroy: () => {} }
  }

  /**
   * Aggregate data points
   * @param {Array} data - Original data array
   * @param {Function} getPosition - Position extractor function
   * @param {Function} getWeight - Weight extractor function
   * @param {Object} map - MapLibre map instance
   * @param {Object} config - Layer configuration
   * @returns {Object} Aggregation result (mode-specific structure)
   */
  aggregate(data, getPosition, getWeight, map, config) {
    throw new Error('aggregate() must be implemented');
  }

  /**
   * Render aggregated cells to canvas
   * @param {Object} aggregationResult - Result from aggregate()
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} config - Layer configuration (colorScale, enableGlyphs, etc.)
   * @param {Object} map - MapLibre map instance (for map-space modes)
   */
  render(aggregationResult, ctx, config, map) {
    throw new Error('render() must be implemented');
  }

  /**
   * Get cell at screen coordinates (for hover/click events)
   * @param {Object} point - {x, y} screen coordinates
   * @param {Object} aggregationResult - Current aggregation result
   * @param {Object} map - MapLibre map instance
   * @returns {Object|null} Cell information or null
   */
  getCellAt(point, aggregationResult, map) {
    throw new Error('getCellAt() must be implemented');
  }

  /**
   * Check if aggregation needs to update on map move
   * @returns {boolean} true if mode needs re-aggregation on pan
   */
  needsUpdateOnMove() {
    return true;
  }

  /**
   * Check if aggregation needs to update on map zoom
   * @returns {boolean} true if mode needs re-aggregation on zoom
   */
  needsUpdateOnZoom() {
    return true;
  }

  /**
   * Get statistics about aggregation result
   * @param {Object} aggregationResult - Aggregation result
   * @returns {Object} Statistics object
   */
  getStats(aggregationResult) {
    return {};
  }
}
```

---

## Implementation Details

### Phase 1: Core Infrastructure

#### 1.1 Create AggregationModeRegistry

**File**: `src/aggregation/AggregationModeRegistry.js`

```javascript
/**
 * AggregationModeRegistry.js
 * Registry for aggregation mode plugins (similar to GlyphRegistry)
 */

const _registry = new Map();

export const AggregationModeRegistry = {
  /**
   * Register an aggregation mode plugin
   * @param {string} name - Unique mode identifier
   * @param {Object} plugin - Mode plugin object
   * @param {Object} options - { overwrite: false }
   */
  register(name, plugin, { overwrite = false } = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('AggregationModeRegistry.register: name must be a non-empty string');
    }
    if (!plugin || typeof plugin.aggregate !== 'function') {
      throw new Error('AggregationModeRegistry.register: plugin must have an aggregate() method');
    }
    if (!plugin || typeof plugin.render !== 'function') {
      throw new Error('AggregationModeRegistry.register: plugin must have a render() method');
    }
    if (_registry.has(name) && !overwrite) {
      throw new Error(`AggregationModeRegistry: mode "${name}" already exists`);
    }

    // Validate plugin structure
    const requiredMethods = ['aggregate', 'render', 'getCellAt'];
    for (const method of requiredMethods) {
      if (typeof plugin[method] !== 'function') {
        throw new Error(`AggregationModeRegistry.register: plugin must have ${method}() method`);
      }
    }

    // Set defaults for optional methods
    plugin.name = name;
    plugin.type = plugin.type || 'screen-space';
    plugin.needsUpdateOnMove = plugin.needsUpdateOnMove ?? true;
    plugin.needsUpdateOnZoom = plugin.needsUpdateOnZoom ?? true;
    plugin.getStats = plugin.getStats || (() => ({}));
    plugin.init = plugin.init || (() => null);

    _registry.set(name, plugin);
  },

  get(name) {
    return _registry.get(name);
  },

  has(name) {
    return _registry.has(name);
  },

  list() {
    return Array.from(_registry.keys());
  },

  unregister(name) {
    return _registry.delete(name);
  },

  clear() {
    _registry.clear();
  },
};
```

#### 1.2 Create Built-in Aggregation Modes

**File**: `src/aggregation/modes/ScreenGridMode.js`

```javascript
/**
 * ScreenGridMode.js
 * Default rectangular grid aggregation (current behavior)
 * This is the backward-compatible default mode
 */

import { Aggregator } from '../../core/Aggregator.js';
import { Projector } from '../../core/Projector.js';
import { Renderer } from '../../canvas/Renderer.js';
import { CellQueryEngine } from '../../core/CellQueryEngine.js';

export const ScreenGridMode = {
  name: 'screen-grid',
  type: 'screen-space',

  aggregate(data, getPosition, getWeight, map, config) {
    // Use existing projection and aggregation logic
    const projectedPoints = Projector.projectPoints(data, getPosition, getWeight, map);
    const { width, height } = config.displaySize || { width: map.getCanvas().width, height: map.getCanvas().height };
    
    return Aggregator.aggregate(
      projectedPoints,
      data,
      width,
      height,
      config.cellSizePixels
    );
  },

  render(aggregationResult, ctx, config, map) {
    // Use existing renderer
    Renderer.render(aggregationResult, ctx, {
      colorScale: config.colorScale,
      enableGlyphs: config.enableGlyphs || Boolean(config.onDrawCell),
      onDrawCell: config.onDrawCell,
      glyphSize: config.glyphSize,
    });
  },

  getCellAt(point, aggregationResult, map) {
    const engine = new CellQueryEngine();
    engine.setAggregationResult(aggregationResult);
    return engine.getCellAt(point);
  },

  getStats(aggregationResult) {
    return Aggregator.getStats(aggregationResult);
  },
};
```

**File**: `src/aggregation/modes/ScreenHexMode.js`

```javascript
/**
 * ScreenHexMode.js
 * Hexagonal tessellation in screen space
 */

import { Projector } from '../../core/Projector.js';

export const ScreenHexMode = {
  name: 'screen-hex',
  type: 'screen-space',

  aggregate(data, getPosition, getWeight, map, config) {
    const projectedPoints = Projector.projectPoints(data, getPosition, getWeight, map);
    const { width, height } = config.displaySize || { width: map.getCanvas().width, height: map.getCanvas().height };
    const hexSize = config.cellSizePixels || config.hexSize || 50;

    // Hexagonal grid parameters
    const hexRadius = hexSize / 2;
    const hexWidth = hexSize * Math.sqrt(3) / 2; // Width of hexagon
    const hexHeight = hexSize; // Height of hexagon
    
    // Grid dimensions
    const cols = Math.ceil(width / (hexWidth * 1.5)) + 1;
    const rows = Math.ceil(height / hexHeight) + 1;
    
    // Use Map for sparse storage (more efficient for hex grids)
    const hexGrid = new Map();
    const hexCellData = new Map();

    // Aggregate points into hex cells
    for (let i = 0; i < projectedPoints.length; i++) {
      const p = projectedPoints[i];
      
      // Convert to hex coordinates (offset coordinates)
      const q = Math.round((Math.sqrt(3) / 3 * p.x - 1 / 3 * p.y) / hexRadius);
      const r = Math.round((2 / 3 * p.y) / hexRadius);
      
      const hexKey = `${q},${r}`;

      // Aggregate
      if (!hexGrid.has(hexKey)) {
        hexGrid.set(hexKey, 0);
        hexCellData.set(hexKey, []);
      }
      
      hexGrid.set(hexKey, hexGrid.get(hexKey) + p.w);
      hexCellData.get(hexKey).push({
        data: data[i],
        weight: p.w,
        projectedX: p.x,
        projectedY: p.y,
      });
    }

    // Convert Map to arrays for compatibility
    const cells = Array.from(hexGrid.entries());
    const grid = cells.map(([_, value]) => value);
    const cellData = cells.map(([key, _]) => hexCellData.get(key));

    // Store hex coordinates for rendering
    const hexCoords = cells.map(([key]) => {
      const [q, r] = key.split(',').map(Number);
      return { q, r };
    });

    return {
      grid,
      cellData,
      hexCoords,
      hexSize,
      hexRadius,
      cols,
      rows,
      width,
      height,
      type: 'hex',
    };
  },

  render(aggregationResult, ctx, config, map) {
    const { grid, hexCoords, hexRadius, cellData } = aggregationResult;
    const maxVal = Math.max(...grid, 1);

    ctx.clearRect(0, 0, aggregationResult.width, aggregationResult.height);

    for (let i = 0; i < grid.length; i++) {
      const val = grid[i];
      if (val <= 0) continue;

      const { q, r } = hexCoords[i];
      const normVal = val / maxVal;

      // Convert hex coordinates to pixel coordinates
      const x = hexRadius * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
      const y = hexRadius * (3 / 2 * r);

      // Draw hexagon
      this._drawHexagon(ctx, x, y, hexRadius, normVal, config, cellData[i]);
    }
  },

  _drawHexagon(ctx, centerX, centerY, radius, normVal, config, cellDataArray) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    if (config.enableGlyphs && config.onDrawCell) {
      const glyphRadius = radius * config.glyphSize || 0.8;
      config.onDrawCell(ctx, centerX, centerY, normVal, {
        cellData: cellDataArray,
        cellSize: radius * 2,
        glyphRadius,
        normalizedValue: normVal,
      });
    } else {
      const [r, g, b, a] = config.colorScale(normVal);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      ctx.fill();
    }
  },

  getCellAt(point, aggregationResult, map) {
    const { hexCoords, hexRadius } = aggregationResult;
    const { x, y } = point;

    // Convert screen coordinates to hex coordinates
    const q = Math.round((Math.sqrt(3) / 3 * x - 1 / 3 * y) / hexRadius);
    const r = Math.round((2 / 3 * y) / hexRadius);
    const hexKey = `${q},${r}`;

    // Find matching cell
    const index = hexCoords.findIndex(c => `${c.q},${c.r}` === hexKey);
    if (index === -1 || aggregationResult.grid[index] <= 0) return null;

    const { q: cellQ, r: cellR } = hexCoords[index];
    const centerX = hexRadius * (Math.sqrt(3) * cellQ + Math.sqrt(3) / 2 * cellR);
    const centerY = hexRadius * (3 / 2 * cellR);

    return {
      index,
      value: aggregationResult.grid[index],
      normalizedValue: aggregationResult.grid[index] / Math.max(...aggregationResult.grid),
      cellData: aggregationResult.cellData[index],
      hexCoords: { q: cellQ, r: cellR },
      center: { x: centerX, y: centerY },
    };
  },

  getStats(aggregationResult) {
    const { grid } = aggregationResult;
    const cellsWithData = grid.filter((v) => v > 0);
    return {
      totalCells: grid.length,
      cellsWithData: cellsWithData.length,
      maxValue: cellsWithData.length > 0 ? Math.max(...cellsWithData) : 0,
      minValue: cellsWithData.length > 0 ? Math.min(...cellsWithData) : 0,
      avgValue: cellsWithData.length > 0 ? cellsWithData.reduce((a, b) => a + b) / cellsWithData.length : 0,
      totalValue: grid.reduce((sum, v) => sum + v, 0),
    };
  },
};
```

**File**: `src/aggregation/modes/MapH3Mode.js`

```javascript
/**
 * MapH3Mode.js
 * H3-based geographic aggregation (map-space)
 * Requires h3-js as optional peer dependency
 */

import { Projector } from '../../core/Projector.js';

/**
 * Lazy-load H3 library
 * This allows the library to work even if h3-js is not installed
 */
function getH3() {
  try {
    // Try to import h3-js (user must install it)
    // eslint-disable-next-line import/no-unresolved
    const h3 = require('h3-js');
    return h3;
  } catch (e) {
    throw new Error(
      'H3 aggregation mode requires h3-js package. Install it with: npm install h3-js'
    );
  }
}

export const MapH3Mode = {
  name: 'map-h3',
  type: 'map-space',

  needsUpdateOnMove() {
    return false; // Map-space doesn't need update on pan
  },

  needsUpdateOnZoom() {
    return true; // But might need different resolution on zoom
  },

  init(options, map) {
    // Validate H3 is available
    try {
      getH3();
    } catch (e) {
      console.error(e.message);
      throw e;
    }

    // Store resolution strategy
    return {
      resolution: options.h3Resolution || 7,
      autoResolution: options.autoResolution !== false,
      destroy() {},
    };
  },

  aggregate(data, getPosition, getWeight, map, config) {
    const h3 = getH3();
    const resolution = config.h3Resolution || 7;

    // Use Map for sparse storage
    const h3Cells = new Map(); // h3Index -> { value, cellData }
    
    // Aggregate by H3 index
    for (let i = 0; i < data.length; i++) {
      try {
        const pos = getPosition(data[i]);
        if (!pos || !Array.isArray(pos) || pos.length < 2) continue;

        const [lng, lat] = pos;
        if (typeof lng !== 'number' || typeof lat !== 'number') continue;

        // Convert to H3 index
        const h3Index = h3.geoToH3(lat, lng, resolution);

        if (!h3Cells.has(h3Index)) {
          h3Cells.set(h3Index, {
            value: 0,
            cellData: [],
            h3Index,
            resolution,
          });
        }

        const cell = h3Cells.get(h3Index);
        cell.value += getWeight(data[i]);
        cell.cellData.push({
          data: data[i],
          weight: getWeight(data[i]),
          lng,
          lat,
        });
      } catch (e) {
        console.warn(`MapH3Mode: error processing point ${i}`, e);
      }
    }

    // Convert to array for rendering
    const cells = Array.from(h3Cells.values());
    const grid = cells.map(c => c.value);
    const cellData = cells.map(c => c.cellData);
    const h3Indices = cells.map(c => c.h3Index);

    return {
      grid,
      cellData,
      h3Indices,
      resolution,
      type: 'h3',
      totalCells: cells.length,
    };
  },

  render(aggregationResult, ctx, config, map) {
    const h3 = getH3();
    const { grid, h3Indices, cellData } = aggregationResult;
    const maxVal = Math.max(...grid, 1);

    ctx.clearRect(0, 0, map.getCanvas().width, map.getCanvas().height);

    for (let i = 0; i < grid.length; i++) {
      const val = grid[i];
      if (val <= 0) continue;

      const h3Index = h3Indices[i];
      const normVal = val / maxVal;

      try {
        // Get H3 hexagon boundary (lat/lng coordinates)
        const boundary = h3.h3ToGeoBoundary(h3Index, true); // geoJson: true returns [lng, lat] pairs

        // Project to screen coordinates
        const screenCoords = boundary.map(([lng, lat]) => {
          const point = map.project([lng, lat]);
          return [point.x, point.y];
        });

        // Draw polygon
        ctx.beginPath();
        screenCoords.forEach(([x, y], idx) => {
          if (idx === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();

        // Calculate center for glyph rendering
        const centerLng = boundary.reduce((sum, [lng]) => sum + lng, 0) / boundary.length;
        const centerLat = boundary.reduce((sum, [, lat]) => sum + lat, 0) / boundary.length;
        const centerPoint = map.project([centerLng, centerLat]);

        if (config.enableGlyphs && config.onDrawCell) {
          const glyphRadius = Math.min(
            ...screenCoords.map(([x, y], idx) => {
              const next = screenCoords[(idx + 1) % screenCoords.length];
              return Math.hypot(next[0] - x, next[1] - y) / 2;
            })
          ) * (config.glyphSize || 0.8);

          config.onDrawCell(ctx, centerPoint.x, centerPoint.y, normVal, {
            cellData: cellData[i],
            cellSize: glyphRadius * 2,
            glyphRadius,
            normalizedValue: normVal,
            h3Index,
          });
        } else {
          const [r, g, b, a] = config.colorScale(normVal);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          ctx.fill();
        }
      } catch (e) {
        console.warn(`MapH3Mode: error rendering H3 cell ${h3Index}`, e);
      }
    }
  },

  getCellAt(point, aggregationResult, map) {
    const h3 = getH3();
    const { x, y } = point;

    // Convert screen coordinates to lat/lng
    const lngLat = map.unproject([x, y]);
    const [lng, lat] = lngLat;

    // Get H3 index at point location
    const h3Index = h3.geoToH3(lat, lng, aggregationResult.resolution);

    // Find matching cell
    const index = aggregationResult.h3Indices.indexOf(h3Index);
    if (index === -1 || aggregationResult.grid[index] <= 0) return null;

    return {
      index,
      value: aggregationResult.grid[index],
      normalizedValue: aggregationResult.grid[index] / Math.max(...aggregationResult.grid),
      cellData: aggregationResult.cellData[index],
      h3Index,
      resolution: aggregationResult.resolution,
    };
  },

  getStats(aggregationResult) {
    const { grid } = aggregationResult;
    const cellsWithData = grid.filter((v) => v > 0);
    return {
      totalCells: grid.length,
      cellsWithData: cellsWithData.length,
      maxValue: cellsWithData.length > 0 ? Math.max(...cellsWithData) : 0,
      minValue: cellsWithData.length > 0 ? Math.min(...cellsWithData) : 0,
      avgValue: cellsWithData.length > 0 ? cellsWithData.reduce((a, b) => a + b) / cellsWithData.length : 0,
      totalValue: grid.reduce((sum, v) => sum + v, 0),
      resolution: aggregationResult.resolution,
    };
  },
};
```

#### 1.3 Register Built-in Modes

**File**: `src/aggregation/modes/index.js`

```javascript
/**
 * index.js
 * Register all built-in aggregation modes
 */

import { AggregationModeRegistry } from '../AggregationModeRegistry.js';
import { ScreenGridMode } from './ScreenGridMode.js';
import { ScreenHexMode } from './ScreenHexMode.js';
import { MapH3Mode } from './MapH3Mode.js';

// Register built-in modes
function _registerBuiltins() {
  try {
    AggregationModeRegistry.register('screen-grid', ScreenGridMode, { overwrite: true });
    AggregationModeRegistry.register('screen-hex', ScreenHexMode, { overwrite: true });
    AggregationModeRegistry.register('map-h3', MapH3Mode, { overwrite: true });
  } catch (e) {
    console.warn('AggregationModeRegistry: error registering built-ins', e);
  }
}

_registerBuiltins();

export { ScreenGridMode, ScreenHexMode, MapH3Mode };
export default AggregationModeRegistry;
```

---

### Phase 2: Freeze Mechanism

#### 2.1 Add Freeze Configuration to ConfigManager

**File**: `src/config/ConfigManager.js` (update)

```javascript
static DEFAULT_CONFIG = {
  // ... existing config ...
  
  // NEW: Aggregation mode configuration
  aggregationMode: 'screen-grid', // 'screen-grid' | 'screen-hex' | 'map-h3' | string (custom)
  aggregationModeConfig: {}, // Mode-specific configuration
  
  // NEW: Freeze mode configuration
  freezeAggregation: false, // If true, aggregation is frozen
  freezeOnMove: false, // Freeze only on pan (but update on zoom)
  freezeOnZoom: false, // Freeze only on zoom (but update on pan)
  
  // ... rest of config ...
};
```

#### 2.2 Implement Freeze Logic in ScreenGridLayerGL

**File**: `src/ScreenGridLayerGL.js` (updates)

Key changes:

1. Add aggregation mode instance state:
```javascript
constructor(options = {}) {
  // ... existing code ...
  
  // Aggregation mode state
  this._aggregationModeInstance = null;
  this._aggregationModePlugin = null;
  this._frozenAggregationResult = null;
}
```

2. Update `_aggregate()` method:
```javascript
_aggregate() {
  if (!this.map) return;

  // Check freeze conditions
  if (this.config.freezeAggregation && this._frozenAggregationResult) {
    this.gridData = this._frozenAggregationResult;
    this.cellQueryEngine.setAggregationResult(this.gridData);
    if (this.config.onAggregate) {
      this.config.onAggregate(this.gridData);
    }
    return;
  }

  // Get aggregation mode plugin
  const modeName = this.config.aggregationMode || 'screen-grid';
  this._aggregationModePlugin = AggregationModeRegistry.get(modeName);
  
  if (!this._aggregationModePlugin) {
    throw new Error(`AggregationModeRegistry: mode "${modeName}" not found`);
  }

  // Prepare config for aggregation
  const { width, height } = this.canvasManager.getDisplaySize();
  const modeConfig = {
    ...this.config.aggregationModeConfig,
    cellSizePixels: this.config.cellSizePixels,
    displaySize: { width, height },
  };

  // Aggregate using mode plugin
  this.gridData = this._aggregationModePlugin.aggregate(
    this.config.data,
    this.config.getPosition,
    this.config.getWeight,
    this.map,
    modeConfig
  );

  // Store frozen result if freeze is enabled
  if (this.config.freezeAggregation) {
    this._frozenAggregationResult = this.gridData;
  }

  // Update cell query engine
  this.cellQueryEngine.setAggregationResult(this.gridData);

  // Trigger callback
  if (this.config.onAggregate) {
    this.config.onAggregate(this.gridData);
  }
}
```

3. Update `_draw()` method:
```javascript
_draw() {
  const ctx = this.canvasManager.getContext();
  if (!ctx || !this.gridData) return;

  // Get aggregation mode plugin
  const modeName = this.config.aggregationMode || 'screen-grid';
  const modePlugin = this._aggregationModePlugin || AggregationModeRegistry.get(modeName);
  
  if (!modePlugin) {
    console.error(`AggregationModeRegistry: mode "${modeName}" not found`);
    return;
  }

  // Determine onDrawCell (same logic as before)
  let onDrawCell = this.config.onDrawCell || null;
  if (!onDrawCell && this.config.glyph) {
    const glyphPlugin = GlyphRegistry.get(this.config.glyph);
    if (glyphPlugin && typeof glyphPlugin.draw === 'function') {
      const glyphCfg = this.config.glyphConfig || {};
      onDrawCell = (ctxArg, x, y, normVal, cellInfo) => {
        try {
          glyphPlugin.draw(ctxArg, x, y, normVal, cellInfo, glyphCfg);
        } catch (e) {
          console.error(`Glyph plugin "${this.config.glyph}" threw an error:`, e);
        }
      };
    }
  }

  // Prepare config for rendering
  const renderConfig = {
    colorScale: this.config.colorScale,
    enableGlyphs: this.config.enableGlyphs || Boolean(onDrawCell),
    onDrawCell: onDrawCell,
    glyphSize: this.config.glyphSize,
  };

  // Merge mode config
  const modeConfig = {
    ...renderConfig,
    ...this.config.aggregationModeConfig,
  };

  // Render using mode plugin
  modePlugin.render(this.gridData, ctx, modeConfig, this.map);
}
```

4. Update event handlers to respect freeze:
```javascript
_handleMove() {
  // Check if mode needs update on move
  const modePlugin = this._aggregationModePlugin || 
    AggregationModeRegistry.get(this.config.aggregationMode || 'screen-grid');
  
  if (this.config.freezeAggregation || this.config.freezeOnMove) {
    return; // Skip projection/aggregation
  }

  if (modePlugin && !modePlugin.needsUpdateOnMove()) {
    return; // Mode doesn't need update on move
  }

  EventHandlers.handleMove(() => {
    this._projectPoints();
  });
}

_handleZoom() {
  // Check if mode needs update on zoom
  const modePlugin = this._aggregationModePlugin || 
    AggregationModeRegistry.get(this.config.aggregationMode || 'screen-grid');
  
  if (this.config.freezeAggregation || this.config.freezeOnZoom) {
    return; // Skip projection/aggregation
  }

  if (modePlugin && !modePlugin.needsUpdateOnZoom()) {
    return; // Mode doesn't need update on zoom
  }

  EventHandlers.handleZoom(this.map, this.config, () => {
    this._projectPoints();
  });
}
```

5. Update `getCellAt()` method:
```javascript
getCellAt(point) {
  if (!this.gridData || !this._aggregationModePlugin) return null;
  return this._aggregationModePlugin.getCellAt(point, this.gridData, this.map);
}
```

6. Add public freeze control methods:
```javascript
/**
 * Freeze aggregation at current state
 */
freezeAggregation() {
  this.setConfig({ freezeAggregation: true });
}

/**
 * Unfreeze aggregation
 */
unfreezeAggregation() {
  this.setConfig({ freezeAggregation: false });
  this._frozenAggregationResult = null;
}

/**
 * Toggle freeze state
 */
toggleFreezeAggregation() {
  this.setConfig({ freezeAggregation: !this.config.freezeAggregation });
  if (!this.config.freezeAggregation) {
    this._frozenAggregationResult = null;
  }
}
```

#### 2.3 Initialize Aggregation Mode on Layer Add

**File**: `src/ScreenGridLayerGL.js` (update `onAdd`)

```javascript
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

_initAggregationMode() {
  const modeName = this.config.aggregationMode || 'screen-grid';
  const modePlugin = AggregationModeRegistry.get(modeName);
  
  if (!modePlugin) {
    throw new Error(`AggregationModeRegistry: mode "${modeName}" not found. Available modes: ${AggregationModeRegistry.list().join(', ')}`);
  }

  this._aggregationModePlugin = modePlugin;

  // Initialize mode if it has init method
  if (typeof modePlugin.init === 'function') {
    try {
      this._aggregationModeInstance = modePlugin.init(
        this.config.aggregationModeConfig || {},
        this.map
      );
    } catch (e) {
      console.error(`AggregationMode "${modeName}" init failed:`, e);
      this._aggregationModeInstance = null;
    }
  }
}

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
  this._frozenAggregationResult = null;
}
```

Update `onRemove`:
```javascript
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
```

---

### Phase 3: H3 Auto-Resolution Feature

#### 3.1 Implement Auto-Resolution Logic

**File**: `src/aggregation/modes/MapH3Mode.js` (update)

Add automatic resolution selection based on zoom:

```javascript
static getResolutionForZoom(zoom, config) {
  // H3 resolution typically ranges from 0 (largest) to 15 (smallest)
  // Map zoom levels typically range from 0 (world) to 22+ (very close)
  
  if (!config.autoResolution) {
    return config.h3Resolution || 7;
  }

  // Resolution strategy: higher zoom = higher resolution (smaller hexagons)
  // Adjust these thresholds based on your needs
  if (zoom < 3) return 2;
  if (zoom < 5) return 3;
  if (zoom < 7) return 4;
  if (zoom < 9) return 5;
  if (zoom < 11) return 6;
  if (zoom < 13) return 7;
  if (zoom < 15) return 8;
  if (zoom < 17) return 9;
  return 10;
}

needsUpdateOnZoom() {
  // Always update on zoom if auto-resolution is enabled
  return true;
}

aggregate(data, getPosition, getWeight, map, config) {
  const h3 = getH3();
  
  // Get current zoom and determine resolution
  const currentZoom = map.getZoom();
  const resolution = MapH3Mode.getResolutionForZoom(currentZoom, config);
  
  // ... rest of aggregation logic using resolution ...
}
```

#### 3.2 Update ScreenGridLayerGL to Handle Resolution Changes

When zoom changes and resolution changes, re-aggregate:

```javascript
_handleZoom() {
  const modePlugin = this._aggregationModePlugin || 
    AggregationModeRegistry.get(this.config.aggregationMode || 'screen-grid');
  
  if (this.config.freezeAggregation || this.config.freezeOnZoom) {
    return;
  }

  // For H3 mode with auto-resolution, always re-aggregate on zoom
  if (modePlugin && modePlugin.type === 'map-space' && modePlugin.needsUpdateOnZoom()) {
    // Clear frozen result to force re-aggregation
    this._frozenAggregationResult = null;
    this._aggregate();
    this._draw();
    return;
  }

  EventHandlers.handleZoom(this.map, this.config, () => {
    this._projectPoints();
  });
}
```

---

## API Changes and Migration Guide

### New Configuration Options

```javascript
const layer = new ScreenGridLayerGL({
  // ... existing options ...
  
  // NEW: Select aggregation mode
  aggregationMode: 'screen-grid', // 'screen-grid' | 'screen-hex' | 'map-h3'
  
  // NEW: Mode-specific configuration
  aggregationModeConfig: {
    // For screen-hex:
    hexSize: 50, // Optional, uses cellSizePixels if not provided
    
    // For map-h3:
    h3Resolution: 7, // H3 resolution (0-15)
    autoResolution: true, // Automatically adjust resolution based on zoom
  },
  
  // NEW: Freeze options
  freezeAggregation: false, // Freeze completely
  freezeOnMove: false, // Freeze on pan only
  freezeOnZoom: false, // Freeze on zoom only
});
```

### New Public Methods

```javascript
// Freeze control
layer.freezeAggregation();
layer.unfreezeAggregation();
layer.toggleFreezeAggregation();

// Get current aggregation mode
const mode = AggregationModeRegistry.get('screen-hex');

// Register custom aggregation mode
AggregationModeRegistry.register('my-custom-mode', MyCustomModePlugin);
```

### Backward Compatibility

**All existing code works unchanged** because:
1. Default `aggregationMode` is `'screen-grid'` (current behavior)
2. Default `freezeAggregation` is `false` (current behavior)
3. Existing `Aggregator`, `Renderer` logic is preserved in `ScreenGridMode`

---

## File Structure

```
src/
├── aggregation/
│   ├── AggregationModeRegistry.js       # NEW: Registry system
│   ├── modes/
│   │   ├── index.js                     # NEW: Register built-ins
│   │   ├── ScreenGridMode.js           # NEW: Default mode (wraps existing logic)
│   │   ├── ScreenHexMode.js            # NEW: Hexagonal tessellation
│   │   └── MapH3Mode.js                # NEW: H3 aggregation
│   └── README.md                        # NEW: Documentation
├── config/
│   └── ConfigManager.js                 # MODIFIED: Add new config options
├── core/
│   ├── Aggregator.js                    # UNCHANGED: Still used by ScreenGridMode
│   ├── Projector.js                     # UNCHANGED: Used by all modes
│   └── CellQueryEngine.js               # UNCHANGED: Used by ScreenGridMode
├── canvas/
│   └── Renderer.js                      # UNCHANGED: Still used by ScreenGridMode
├── events/
│   └── EventBinder.js                   # UNCHANGED
├── glyphs/
│   └── GlyphRegistry.js                 # UNCHANGED
└── ScreenGridLayerGL.js                 # MODIFIED: Integration logic
```

---

## Testing Strategy

### Unit Tests

1. **AggregationModeRegistry**
   - Registration and retrieval
   - Validation of plugin structure
   - Error handling

2. **ScreenGridMode** (backward compatibility)
   - Same output as current `Aggregator.aggregate()`
   - Same rendering as current `Renderer.render()`

3. **ScreenHexMode**
   - Hexagonal binning correctness
   - Rendering of hexagons
   - Point-in-hex queries

4. **MapH3Mode**
   - H3 index conversion
   - Geographic aggregation
   - Rendering of H3 hexagons
   - Error handling when H3 not available

### Integration Tests

1. **Freeze Mechanism**
   - Freeze on aggregation
   - Freeze on move
   - Freeze on zoom
   - Unfreeze and re-aggregate

2. **Mode Switching**
   - Switch between modes
   - Preserve data and config
   - Cleanup old mode instances

3. **Performance Tests**
   - Large datasets (10K+ points)
   - Frequent map interactions
   - Memory leak checks

### Example Tests

```javascript
// Test backward compatibility
const layer = new ScreenGridLayerGL({ data, getPosition, getWeight });
// Should work exactly as before

// Test hex mode
const hexLayer = new ScreenGridLayerGL({
  data,
  getPosition,
  getWeight,
  aggregationMode: 'screen-hex',
  aggregationModeConfig: { hexSize: 50 }
});

// Test H3 mode
const h3Layer = new ScreenGridLayerGL({
  data,
  getPosition,
  getWeight,
  aggregationMode: 'map-h3',
  aggregationModeConfig: { h3Resolution: 7, autoResolution: true }
});

// Test freeze
layer.freezeAggregation();
// Pan map - aggregation should not change
layer.unfreezeAggregation();
// Pan map - aggregation should update
```

---

## Performance Considerations

### Screen-Hex Mode

- **Point-in-hex test**: O(1) with coordinate conversion
- **Sparse storage**: Use `Map` instead of arrays for efficiency
- **Rendering**: Batch hexagon draws where possible

### Map-H3 Mode

- **H3 lookups**: `h3.geoToH3()` is fast but still adds overhead
- **Polygon rendering**: H3 boundaries can be cached per resolution
- **Large datasets**: Consider Web Workers for aggregation if >50K points
- **Memory**: H3 indices are strings, consider using numeric representation

### Optimization Strategies

1. **Caching**: Cache H3 boundaries per resolution
2. **LOD**: Use lower resolution for far zoom levels
3. **Throttling**: Throttle aggregation updates during rapid zoom/pan
4. **Web Workers**: Offload aggregation for very large datasets

---

## Dependencies

### Required
- No new required dependencies (all built-in)

### Optional (Peer Dependency)
- `h3-js`: Required only for `map-h3` mode
  ```bash
  npm install h3-js
  ```
  - Version: `^4.x` (or latest)
  - Error handling: Graceful fallback with clear error messages

---

## Documentation Updates

### README.md Updates

Add new sections:

1. **Aggregation Modes** section
2. **Freeze Mode** section
3. **H3 Map-Space Aggregation** section
4. **API Reference** updates for new config options
5. **Migration Guide** (showing backward compatibility)

### New Documentation Files

1. `docs/AGGREGATION_MODES.md` - Detailed mode documentation
2. `docs/H3_INTEGRATION.md` - H3-specific guide
3. `examples/hex-mode.html` - Hexagonal tessellation example
4. `examples/h3-mode.html` - H3 aggregation example
5. `examples/freeze-mode.html` - Freeze mode example

---

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create `AggregationModeRegistry`
- [ ] Implement `ScreenGridMode` (wraps existing logic)
- [ ] Update `ConfigManager` with new options
- [ ] Basic integration in `ScreenGridLayerGL`
- [ ] Unit tests for registry and ScreenGridMode

### Phase 2: Hexagonal Mode (Week 2)
- [ ] Implement `ScreenHexMode`
- [ ] Hex rendering utilities
- [ ] Integration and testing
- [ ] Example: `examples/hex-mode.html`

### Phase 3: Freeze Mechanism (Week 2-3)
- [ ] Freeze logic in `ScreenGridLayerGL`
- [ ] Event handler updates
- [ ] Public API methods
- [ ] Testing and examples

### Phase 4: H3 Integration (Week 3-4)
- [ ] Implement `MapH3Mode`
- [ ] H3 dependency handling (optional peer)
- [ ] Auto-resolution logic
- [ ] Integration and testing
- [ ] Example: `examples/h3-mode.html`
- [ ] Documentation

### Phase 5: Polish & Documentation (Week 4)
- [ ] Complete documentation
- [ ] All examples working
- [ ] Performance optimization
- [ ] Final testing
- [ ] Release preparation

---

## Rollout Strategy

### v2.1.0: Core Infrastructure + Hex Mode
- Aggregation mode system
- Screen-grid mode (backward compatible)
- Screen-hex mode
- Basic freeze mechanism

### v2.2.0: Freeze + H3
- Full freeze functionality
- H3 map-space aggregation
- Auto-resolution

### Backward Compatibility Guarantee

All v2.0.0 code will work unchanged with v2.1.0 and v2.2.0 because:
- Default mode is `'screen-grid'` (existing behavior)
- All existing config options preserved
- No breaking API changes

---

## Risk Mitigation

### Risks

1. **Performance degradation**: New modes might be slower
   - *Mitigation*: Benchmark early, optimize critical paths

2. **H3 dependency issues**: Users might have version conflicts
   - *Mitigation*: Optional peer dependency, clear error messages, version recommendations

3. **Complexity**: More code paths to maintain
   - *Mitigation*: Clean plugin architecture, comprehensive tests

4. **Breaking changes**: Accidental breaking changes
   - *Mitigation*: Extensive backward compatibility tests, default to current behavior

### Success Metrics

- All existing tests pass
- No performance regression for default mode
- New modes work with large datasets (>10K points)
- Documentation is clear and complete

---

## Future Enhancements (Post-Implementation)

1. **Additional Tessellations**: Voronoi, triangles, custom polygons
2. **Advanced Freeze**: Snapshot/restore, multiple freeze states
3. **H3 Enhancements**: Neighbor queries, k-ring aggregation
4. **Hybrid Modes**: Combine multiple aggregation strategies
5. **Web Workers**: Parallel aggregation for very large datasets

---

This implementation plan provides a complete roadmap for adding these features while maintaining backward compatibility and following the existing architectural patterns.

