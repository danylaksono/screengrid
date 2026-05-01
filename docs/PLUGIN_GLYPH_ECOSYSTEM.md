# Plugin Glyph Ecosystem — Evaluation & Documentation

This document provides a comprehensive evaluation and documentation of the ScreenGrid plugin glyph ecosystem, including built-in plugins, custom plugins, architecture, API details, and usage patterns.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Evaluation](#architecture-evaluation)
3. [Plugin Registry System](#plugin-registry-system)
4. [Built-in Plugins](#built-in-plugins)
5. [Custom Plugins](#custom-plugins)
6. [Plugin API Reference](#plugin-api-reference)
7. [Integration Points](#integration-points)
8. [Usage Patterns](#usage-patterns)
9. [Performance Considerations](#performance-considerations)
10. [Limitations & Future Improvements](#limitations--future-improvements)

---

## Overview

The plugin glyph system in ScreenGrid enables developers to create reusable, named glyph visualizations that can be registered and used across multiple layers. This system provides:

- **Reusability**: Define glyphs once, use them multiple times
- **Name-based Access**: Reference glyphs by string name instead of function references
- **Plugin Lifecycle**: Support for initialization and cleanup hooks
- **Legend Integration**: Optional legend generation support
- **Backward Compatibility**: Existing `onDrawCell` callbacks continue to work with highest precedence

### Status

✅ **Implemented and Functional** — The plugin system is fully integrated into `ScreenGridLayerGL` and ready for production use.

### Ecosystem Components

1. **GlyphRegistry** (`src/glyphs/GlyphRegistry.js`) — Core registry for managing plugins
2. **GlyphUtilities** (`src/glyphs/GlyphUtilities.js`) — Low-level drawing utilities
3. **ScreenGridLayerGL** — Layer integration with plugin support
4. **Legend Module** — Optional legend generation support for plugins

---

## Architecture Evaluation

### Design Strengths

1. **Lightweight & Simple**: Minimal abstraction overhead, uses plain JavaScript objects
2. **Non-Breaking**: Fully backward compatible with existing `onDrawCell` patterns
3. **Flexible**: Supports both simple drawing functions and complex plugins with lifecycle hooks
4. **Performance-Oriented**: Synchronous execution path, no async overhead
5. **Error Resilient**: Plugin errors are caught and logged, preventing render loop failures

### Design Patterns

- **Registry Pattern**: Centralized registration and retrieval of plugins
- **Adapter Pattern**: Built-in plugins wrap `GlyphUtilities` methods
- **Factory Pattern**: Layer constructs wrapper functions from plugins
- **Lifecycle Hooks**: Optional initialization and cleanup methods

### Precedence Order

The system uses a clear precedence order for glyph rendering:

1. **Highest**: User-provided `onDrawCell` callback (full backward compatibility)
2. **Medium**: Registered plugin via `glyph` name
3. **Lowest**: Color-mode rendering (no glyphs)

This ensures backward compatibility while allowing gradual migration to the plugin system.

---

## Plugin Registry System

### GlyphRegistry API

The `GlyphRegistry` is the central component for managing glyph plugins.

#### Methods

```javascript
// Register a plugin
GlyphRegistry.register(name, plugin, { overwrite = false })

// Retrieve a plugin
GlyphRegistry.get(name)

// Check if plugin exists
GlyphRegistry.has(name)

// List all registered plugins
GlyphRegistry.list()

// Unregister a plugin
GlyphRegistry.unregister(name)

// Clear all plugins (use with caution)
GlyphRegistry.clear()
```

#### Example: Registration

```javascript
import { GlyphRegistry } from 'screengrid';

GlyphRegistry.register('myCustomGlyph', {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    // Drawing logic here
  },
  init({ layer, config }) {
    // Optional initialization
    return { destroy: () => {} };
  },
  getLegend(gridData, config) {
    // Optional legend data
  }
}, { overwrite: true }); // Overwrite if exists
```

#### Registry Characteristics

- **In-Memory Storage**: Uses JavaScript `Map` for fast lookups
- **Global Scope**: Registry is shared across all layers
- **No Persistence**: Plugins are registered at runtime, not persisted
- **Thread Safety**: Single-threaded JavaScript execution eliminates race conditions

---

## Built-in Plugins

ScreenGrid includes four built-in plugins that are automatically registered on import. These plugins wrap the underlying `GlyphUtilities` methods.

### 1. `circle` — Simple Circle Glyph

**Description**: Draws a filled circle glyph with customizable size, color, and opacity.

**Parameters** (`glyphConfig`):
- `radius` (number): Circle radius (default: auto-calculated from cell size)
- `color` (string): Fill color (default: `'#ff6b6b'`)
- `alpha` (number): Opacity 0-1 (default: `0.8`)
- `colorScale` (function): Optional color scale function `(v) => color`

**Usage**:
```javascript
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'circle',
  glyphConfig: {
    radius: 15,
    color: '#3498db',
    alpha: 0.9
  },
  enableGlyphs: true
});
```

**Underlying Utility**: `GlyphUtilities.drawCircleGlyph()`

---

### 2. `bar` — Bar Chart Glyph

**Description**: Draws a horizontal bar chart showing multiple values side-by-side.

**Parameters** (`glyphConfig`):
- `values` (array): Array of numeric values (default: extracted from `cellData`)
- `maxValue` (number): Maximum value for scaling (default: max of values)
- `colors` (array): Array of colors for bars (default: `['#ff6b6b', '#4ecdc4', '#45b7d1']`)

**Usage**:
```javascript
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'bar',
  glyphConfig: {
    values: [10, 20, 15], // Or let it auto-extract from cellData
    maxValue: 100,
    colors: ['#e74c3c', '#3498db', '#2ecc71']
  },
  enableGlyphs: true
});
```

**Underlying Utility**: `GlyphUtilities.drawBarGlyph()`

**Data Extraction**: If `values` not provided, automatically extracts weights from `cellInfo.cellData`.

---

### 3. `pie` — Pie Chart Glyph

**Description**: Draws a pie chart showing proportional distribution of values.

**Parameters** (`glyphConfig`):
- `values` (array): Array of numeric values for slices (default: extracted from `cellData`)
- `radius` (number): Pie radius (default: auto-calculated from cell size)
- `colors` (array): Array of colors for slices (default: `['#ff6b6b', '#4ecdc4', '#45b7d1']`)

**Usage**:
```javascript
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'pie',
  glyphConfig: {
    values: [30, 40, 30], // Percentages or raw values
    radius: 20,
    colors: ['#e74c3c', '#3498db', '#2ecc71']
  },
  enableGlyphs: true
});
```

**Underlying Utility**: `GlyphUtilities.drawPieGlyph()`

---

### 4. `heatmap` — Heatmap Intensity Glyph

**Description**: Draws a circle whose color intensity represents a normalized value (0-1).

**Parameters** (`glyphConfig`):
- `radius` (number): Circle radius (default: auto-calculated from cell size)
- `colorScale` (function): Color scale function `(v) => colorString` (default: red intensity scale)

**Usage**:
```javascript
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'heatmap',
  glyphConfig: {
    radius: 15,
    colorScale: (v) => `rgba(255, ${255 * (1 - v)}, 0, ${Math.min(0.9, v)})`
  },
  enableGlyphs: true
});
```

**Underlying Utility**: `GlyphUtilities.drawHeatmapGlyph()`

---

## Custom Plugins

Custom plugins can be created by implementing the plugin interface. The ecosystem currently includes one documented custom plugin:

### `grouped-bar` — Grouped Bar Chart Plugin

**Location**: `examples/glyphs/plugin-glyph.html`

**Description**: A sophisticated custom plugin that visualizes parking capacity data comparing bike racks vs. parking spaces using grouped bars. This plugin demonstrates advanced plugin features including global state management, cross-cell normalization, and interactive hover effects.

**Features**:
- Multivariate data aggregation (racks and spaces values)
- Category-specific color schemes (blue for racks, green for spaces)
- Global normalization for cross-cell comparison
- Integrated legend support via `getLegend()` method
- Lifecycle hooks (`init()` and `destroy()`)
- Interactive hover effects with comparison outlines
- Global statistics tracking across all cells

**Key Implementation Details**:

```javascript
const GroupedBarGlyph = {
  // Global stats for normalization across all cells
  globalStats: {
    maxRacks: 0,
    maxSpaces: 0,
    maxTotal: 0,
    initialized: false
  },
  
  init({ layer, config } = {}) {
    // Store layer reference and reset global stats
    this.layerRef = layer;
    this.globalStats = { maxRacks: 0, maxSpaces: 0, maxTotal: 0, initialized: false };
    return {
      destroy() {
        console.log('GroupedBarGlyph instance destroyed');
      }
    };
  },

  draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
    // 1. Aggregate data from cellData (racks and spaces)
    // 2. Calculate chart dimensions
    // 3. Draw grouped bars for each category (racks vs spaces)
    // 4. Apply color schemes (blue for racks, green for spaces)
    // 5. Show comparison outline when hovering over different cell
  },

  getLegend(gridData, config = {}) {
    return {
      type: 'custom',
      title: 'Parking Capacity',
      description: 'Grouped bar chart comparing bike racks and parking spaces:',
      items: [
        { label: 'Racks', description: 'Number of bike racks (blue)', color: 'rgba(52, 152, 219, 0.85)' },
        { label: 'Spaces', description: 'Number of parking spaces (green)', color: 'rgba(46, 204, 113, 0.85)' }
      ]
    };
  }
};

GlyphRegistry.register('grouped-bar', GroupedBarGlyph, { overwrite: true });
```

**Usage**:
```javascript
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'grouped-bar',
  glyphConfig: { glyphSize: null },
  enableGlyphs: true
});
```

---

## Plugin API Reference

### Plugin Interface

A plugin is a JavaScript object with the following optional methods:

#### Required Methods

##### `draw(ctx, x, y, normalizedValue, cellInfo, config)`

**Description**: Main drawing method called for each cell during rendering.

**Parameters**:
- `ctx` (CanvasRenderingContext2D): Canvas 2D rendering context
- `x` (number): Center X coordinate of the cell in screen space
- `y` (number): Center Y coordinate of the cell in screen space
- `normalizedValue` (number): Normalized aggregate value (0-1) for the cell
- `cellInfo` (object): Cell metadata object containing:
  - `cellData` (array): Array of original data points in this cell
  - `cellSize` (number): Cell size in pixels
  - `glyphRadius` (number): Recommended glyph radius based on cell size
  - `aggregatedValue` (number): Raw aggregated value
  - Additional properties may be present depending on aggregation configuration
- `config` (object): Custom configuration object passed from `glyphConfig` layer option

**Return Value**: `undefined` (void)

**Example**:
```javascript
draw(ctx, x, y, normalizedValue, cellInfo, config) {
  const radius = config.radius || cellInfo.glyphRadius;
  ctx.fillStyle = config.color || '#3498db';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
}
```

#### Optional Methods

##### `init({ layer, config })`

**Description**: Called when a layer using this plugin is created. Allows plugin to initialize per-layer state.

**Parameters**:
- `layer` (ScreenGridLayerGL): The layer instance using this plugin
- `config` (object): The `glyphConfig` object from layer options

**Return Value**: Optional object with `destroy()` method, or `null`/`undefined`

**Example**:
```javascript
init({ layer, config }) {
  console.log(`Initializing plugin for layer ${layer.id}`);
  const state = {
    counter: 0,
    destroy() {
      console.log('Plugin instance destroyed');
    }
  };
  return state;
}
```

**Storage**: The returned object is stored in `layer._glyphInstance` and can be accessed in `destroy()`.

##### `destroy({ layer })`

**Description**: Called when a layer using this plugin is removed. Allows cleanup of per-layer resources.

**Parameters**:
- `layer` (ScreenGridLayerGL): The layer instance being removed

**Return Value**: `undefined` (void)

**Note**: If `init()` returned an object with a `destroy()` method, that method is called instead of the plugin's `destroy()` method.

**Example**:
```javascript
destroy({ layer }) {
  // Cleanup resources, close connections, etc.
  console.log(`Cleaning up plugin for layer ${layer.id}`);
}
```

##### `getLegend(gridData, config)`

**Description**: Optional method to provide legend metadata for the glyph. Used by the Legend module.

**Parameters**:
- `gridData` (object): Aggregation result data
- `config` (object): The `glyphConfig` object from layer options

**Return Value**: Object with legend metadata, or `null`/`undefined`

**Example**:
```javascript
getLegend(gridData, config) {
  return {
    type: 'custom',
    title: 'My Glyph Legend',
    description: 'Description of what the glyph shows',
    items: [
      { label: 'Item 1', description: 'Description 1', color: '#ff0000' },
      { label: 'Item 2', description: 'Description 2', color: '#00ff00' }
    ]
  };
}
```

**Legend Integration**: The `Legend` module checks for `getLegend()` when a plugin is used and automatically generates legend content.

---

## Integration Points

### Layer Integration

The plugin system is integrated into `ScreenGridLayerGL` at several points:

#### 1. Initialization (`_initGlyphPlugin()`)

```203:219:src/ScreenGridLayerGL.js
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
```

#### 2. Destruction (`_destroyGlyphPlugin()`)

```221:240:src/ScreenGridLayerGL.js
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
```

#### 3. Rendering (`_draw()`)

```290:312:src/ScreenGridLayerGL.js
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
```

### Legend Integration

The Legend module automatically detects and uses plugin legends:

```javascript
// From src/legend/Legend.js (simplified)
if (this.layer.config.glyph) {
  const plugin = GlyphRegistry.get(this.layer.config.glyph);
  if (plugin && typeof plugin.getLegend === 'function') {
    const pluginLegend = plugin.getLegend(gridData, this.layer.config.glyphConfig);
    // Use pluginLegend to generate legend content
  }
}
```

---

## Usage Patterns

### Pattern 1: Simple Built-in Plugin

Use a built-in plugin with default settings:

```javascript
const layer = new ScreenGridLayerGL({
  data,
  getPosition: (d) => d.coordinates,
  glyph: 'circle',
  enableGlyphs: true
});
```

### Pattern 2: Built-in Plugin with Configuration

Configure a built-in plugin via `glyphConfig`:

```javascript
const layer = new ScreenGridLayerGL({
  data,
  getPosition: (d) => d.coordinates,
  glyph: 'pie',
  glyphConfig: {
    colors: ['#e74c3c', '#3498db', '#2ecc71'],
    radius: 25
  },
  enableGlyphs: true
});
```

### Pattern 3: Register and Use Custom Plugin

Define and register a custom plugin, then use it:

```javascript
import { GlyphRegistry, ScreenGridLayerGL } from 'screengrid';

// Define plugin
const MyGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    const radius = config.radius || cellInfo.glyphRadius;
    ctx.fillStyle = config.color || '#3498db';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }
};

// Register
GlyphRegistry.register('myGlyph', MyGlyph);

// Use
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'myGlyph',
  glyphConfig: { radius: 15, color: '#ff6600' },
  enableGlyphs: true
});
```

### Pattern 4: Plugin with Lifecycle Hooks

Use initialization and cleanup for stateful plugins:

```javascript
const StatefulGlyph = {
  init({ layer, config }) {
    const state = {
      cache: new Map(),
      destroy() {
        state.cache.clear();
      }
    };
    return state;
  },
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    // Use state if needed
    // Drawing logic
  }
};

GlyphRegistry.register('stateful', StatefulGlyph);
```

### Pattern 5: Plugin with Legend Support

Include legend generation for better user experience:

```javascript
const LegendGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    // Drawing logic
  },
  getLegend(gridData, config) {
    return {
      type: 'custom',
      title: 'My Visualization',
      items: [
        { label: 'Category A', color: '#ff0000' },
        { label: 'Category B', color: '#00ff00' }
      ]
    };
  }
};

GlyphRegistry.register('legendGlyph', LegendGlyph);
```

### Pattern 6: Conditional Plugin Registration

Register plugins conditionally or from external sources:

```javascript
async function loadCustomGlyph(url) {
  const module = await import(url);
  GlyphRegistry.register(module.name, module.glyph, { overwrite: true });
}

// Or register multiple plugins
const plugins = {
  gauge: GaugePlugin,
  sparkline: SparklinePlugin,
  tree: TreeMapPlugin
};

Object.entries(plugins).forEach(([name, plugin]) => {
  GlyphRegistry.register(name, plugin);
});
```

---

## Performance Considerations

### Execution Model

- **Synchronous**: Plugin `draw()` methods execute synchronously during render
- **Per-Cell**: Called once per visible grid cell on each render cycle
- **Main Thread**: Runs on the main thread (no Web Workers)

### Performance Best Practices

1. **Keep `draw()` Fast**: Minimize computations in `draw()`; precompute during aggregation
2. **Cache Calculations**: Store computed values in `cellInfo` during aggregation
3. **Avoid Heavy Operations**: No network requests, file I/O, or blocking operations
4. **Use Canvas Efficiently**: Minimize context state changes, batch drawing operations
5. **Leverage Aggregation**: Compute aggregations in `onAggregate` callback, not in `draw()`

### Example: Precomputed Data

```javascript
// Good: Precompute during aggregation
layer.setConfig({
  onAggregate: (gridData) => {
    gridData.cells.forEach(cell => {
      // Precompute statistics
      cell.computedStats = computeStats(cell.cellData);
    });
  },
  glyph: 'myGlyph'
});

// Plugin uses precomputed data
const MyGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    // Use cellInfo.computedStats instead of recalculating
    const stats = cellInfo.computedStats;
    // Fast drawing using precomputed data
  }
};
```

### Performance Monitoring

Monitor plugin performance:

```javascript
const ProfiledGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    const start = performance.now();
    
    // Drawing logic
    drawGlyph(ctx, x, y, cellInfo);
    
    const duration = performance.now() - start;
    if (duration > 1) { // Warn if > 1ms
      console.warn(`Glyph draw took ${duration.toFixed(2)}ms`);
    }
  }
};
```

---

## Limitations & Future Improvements

### Current Limitations

1. **No Async Support**: Plugins cannot be async; must complete synchronously
2. **No Web Worker Support**: All plugins run on main thread
3. **No Plugin Sandboxing**: No isolation for untrusted third-party plugins
4. **Limited State Management**: Per-layer state only via `init()` return value
5. **No Plugin Versioning**: Registry doesn't track plugin versions
6. **No Plugin Metadata**: No description, author, or dependency metadata
7. **No Dynamic Loading**: Cannot load plugins from URLs or external sources (must import)
8. **Limited Error Recovery**: Errors are logged but no retry or fallback mechanism

### Planned Improvements (from PLUGIN_GLYPHS.md)

1. **Enhanced Lifecycle Hooks**: Full support for `init()` and `destroy()` per layer
2. **Legend Integration**: Complete integration with Legend module's `getLegend()` support
3. **Plugin Sandboxing**: Consider WebWorker or sandboxed execution for untrusted code
4. **Dynamic Loading**: Allow registering plugins from URLs (with security considerations)
5. **Plugin Marketplace**: Potential for a community plugin repository
6. **Plugin Validation**: Schema validation for plugin structure
7. **Plugin Dependencies**: Support for plugins that depend on other plugins

### Recommended Enhancements (Not Yet Planned)

1. **Plugin Middleware**: Chain of plugins or transformation pipeline
2. **Plugin Events**: Plugin-to-plugin communication or event system
3. **Plugin Configuration UI**: Auto-generate configuration UI from plugin schema
4. **Plugin Testing Framework**: Utilities for testing plugins in isolation
5. **Plugin Performance Profiling**: Built-in performance monitoring and reporting
6. **Plugin Hot Reloading**: Development-time hot reloading for faster iteration

---

## Available Utilities

The `GlyphUtilities` class provides low-level drawing utilities that can be used within plugins:

### Methods

1. **`drawCircleGlyph(ctx, x, y, radius, color, alpha)`** — Draw a filled circle
2. **`drawBarGlyph(ctx, x, y, values, maxValue, cellSize, colors)`** — Draw horizontal bars
3. **`drawPieGlyph(ctx, x, y, values, radius, colors)`** — Draw pie chart slices
4. **`drawScatterGlyph(ctx, x, y, points, cellSize, color)`** — Draw scatter plot points
5. **`drawDonutGlyph(ctx, x, y, values, outerRadius, innerRadius, colors)`** — Draw donut chart
6. **`drawHeatmapGlyph(ctx, x, y, radius, normalizedValue, colorScale)`** — Draw heatmap circle
7. **`drawRadialBarGlyph(ctx, x, y, values, maxValue, maxRadius, color)`** — Draw radial bars
8. **`drawTimeSeriesGlyph(ctx, x, y, timeSeriesData, cellSize, options)`** — Draw time series line chart

### Using Utilities in Plugins

```javascript
import { GlyphUtilities } from 'screengrid';

const MyGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    // Use built-in utilities
    GlyphUtilities.drawCircleGlyph(ctx, x, y, 10, '#3498db', 0.8);
    
    // Or combine multiple utilities
    GlyphUtilities.drawPieGlyph(ctx, x - 15, y, [1, 2, 3], 8, ['#e74c3c', '#3498db', '#2ecc71']);
    GlyphUtilities.drawBarGlyph(ctx, x + 15, y, [10, 20], 100, cellInfo.cellSize, ['#ff0000', '#00ff00']);
  }
};
```

---

## Summary

### Ecosystem Status: ✅ Production Ready

The plugin glyph ecosystem is fully functional and production-ready. It provides:

- **4 Built-in Plugins**: `circle`, `bar`, `pie`, `heatmap`
- **1 Documented Custom Plugin**: `grouped-bar` (example)
- **8 Utility Methods**: Low-level drawing functions available for custom plugins
- **Full Integration**: Seamlessly integrated into layer and legend systems
- **Backward Compatible**: No breaking changes to existing code

### Quick Start

```javascript
import { ScreenGridLayerGL, GlyphRegistry } from 'screengrid';

// Option 1: Use built-in
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'circle',
  enableGlyphs: true
});

// Option 2: Create custom
GlyphRegistry.register('myGlyph', {
  draw(ctx, x, y, normVal, cellInfo, config) {
    // Your drawing logic
  }
});

const layer2 = new ScreenGridLayerGL({
  data,
  glyph: 'myGlyph',
  enableGlyphs: true
});
```

### Documentation References

- **Design Doc**: `docs/PLUGIN_GLYPHS.md`
- **Usage Guide**: `docs/GLYPH_DRAWING_GUIDE.md`
- **Example**: `examples/glyphs/plugin-glyph.html`
- **Registry Code**: `src/glyphs/GlyphRegistry.js`
- **Utilities Code**: `src/glyphs/GlyphUtilities.js`

---

*Last Updated: Based on codebase evaluation as of current state*
