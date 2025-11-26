# ScreenGrid Library

[![npm](https://img.shields.io/npm/v/screengrid.svg)](https://www.npmjs.com/package/screengrid)

A GPU/Canvas hybrid Screen-Space Grid Aggregation library for MapLibre GL JS. This library provides efficient real-time aggregation of point data into screen-space grids with customizable styling, interactive features, and advanced glyph drawing capabilities. It now also supports non-point geometries via a geometry placement preprocessor and a per-feature glyph rendering mode.

This library is inspired by Aidan Slingsby's [Gridded Glyphmaps](https://openaccess.city.ac.uk/id/eprint/31115/) and borrows some basic concepts from deck.gl's [`ScreenGridLayer`](https://deck.gl/docs/api-reference/aggregation-layers/screen-grid-layer), but is built from the ground up with a modular architecture, focusing on performance, flexibility, and ease of use, particularly for MaplibreGL ecosystem.

![](./screengrid.png)

## 🚀 Features

- **Real-time Aggregation**: Efficiently aggregates point data into screen-space grids
- **Multiple Aggregation Modes**: Support for rectangular grids (`screen-grid`) and hexagonal tessellation (`screen-hex`)
- **Customizable Styling**: Flexible color scales and cell sizing
- **Interactive Events**: Hover, click, brush selection, and enhanced pan/zoom callbacks for grid cells
- **Glyph Drawing**: Custom glyph rendering with Canvas 2D for advanced visualizations
- **Plugin Ecosystem**: Reusable, named glyph plugins with registry system, lifecycle hooks, and legend integration
- **Built-in Plugins**: Four ready-to-use plugins (`circle`, `bar`, `pie`, `heatmap`) plus utilities for custom plugins
- **Flexible Aggregation Functions**: Built-in functions (sum, mean, count, max, min) with registry system for custom functions
- **Customizable Normalization**: Multiple normalization strategies (max-local, max-global, z-score, percentile) with registry for custom functions
- **MapLibre Integration**: Seamless integration with MapLibre GL JS
- **Performance Optimized**: Uses Canvas 2D rendering for optimal performance
- **Responsive Design**: Automatically adjusts to map viewport changes
- **Zoom-based Sizing**: Dynamic cell size adjustment based on zoom level
- **Multi-attribute Visualization**: Support for visualizing multiple data attributes per cell
- **Geometry Input**: Accept GeoJSON `source` with `placement` strategies for Polygon/Line inputs
- **Feature Anchors**: Render one glyph per feature anchor with `renderMode: 'feature-anchors'`
- **Debug Logging**: Configurable debug logging system for troubleshooting

## 📁 Project Structure

```
screengrid/
├── src/
│   ├── index.js                    # Main entry point
│   ├── ScreenGridLayerGL.js        # Main orchestrator class
│   ├── config/ConfigManager.js     # Configuration management
│   ├── core/                       # Core business logic (pure)
│   │   ├── Aggregator.js
│   │   ├── Projector.js
│   │   └── CellQueryEngine.js
│   ├── canvas/                     # Canvas rendering
│   │   ├── CanvasManager.js
│   │   └── Renderer.js
│   ├── events/                     # Event system
│   │   ├── EventBinder.js
│   │   └── EventHandlers.js
│   ├── glyphs/GlyphUtilities.js    # Glyph drawing utilities
│   └── legend/                     # Legend system
│       ├── Legend.js
│       ├── LegendDataExtractor.js
│       └── LegendRenderers.js
├── dist/                           # Built distribution files
├── docs/
│   ├── ARCHITECTURE.md             # Detailed architecture guide
│   ├── USAGE.md                    # Detailed usage guide
│   └── README.md
├── examples/
│   ├── index.html
│   ├── simple-test.html
│   ├── test.html
│   ├── legend-example.html
│   ├── timeseries.html
│   └── multivariate-timeseries.html
├── package.json
└── rollup.config.mjs
```

## 🚀 Quick Start

### Installation

```bash
# From npm
npm install screengrid

# Peer dependency (you manage this in your app)
npm install maplibre-gl

# Or clone the repository for development
git clone https://github.com/danylaksono/screengrid.git
cd screengrid
npm install
npm run build

# To run examples locally, use a simple HTTP server:
npx http-server -p 8000
# Then open http://localhost:8000/examples/ in your browser
```

### Basic Usage

```javascript
// ESM (bundlers / modern Node)
import { ScreenGridLayerGL } from 'screengrid';
import maplibregl from 'maplibre-gl';

// Initialize MapLibre map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [-122.4, 37.74],
  zoom: 11
});

map.on('load', async () => {
  // Load your data
  const data = await fetch('your-data.json').then(r => r.json());
  
  // Create grid layer
  const gridLayer = new ScreenGridLayerGL({
    data: data,
    getPosition: (d) => d.coordinates,
    getWeight: (d) => d.weight,
    cellSizePixels: 60,
    colorScale: (v) => [255 * v, 200 * (1 - v), 50, 220]
  });
  
  // Add to map
  map.addLayer(gridLayer);
});
```

### CommonJS (Node or older bundlers)

```javascript
// CJS require
const { ScreenGridLayerGL } = require('screengrid');
const maplibregl = require('maplibre-gl');
```

### CDN Usage

```html
<!-- UMD build exposes global `ScreenGrid` -->
<script src="https://unpkg.com/screengrid/dist/screengrid.umd.min.js"></script>
<!-- MapLibre (peer) must also be included on the page -->
<link href="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.js"></script>
<script>
  const { ScreenGridLayerGL } = ScreenGrid;
  // use ScreenGridLayerGL here
  // ...
  // map.addLayer(new ScreenGridLayerGL({...}))
</script>
```

### Full Example (CDN)

```html
<div id="map" style="position:absolute;top:0;bottom:0;width:100%"></div>
<link href="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/screengrid/dist/screengrid.umd.min.js"></script>
<script>
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [-122.4, 37.74],
    zoom: 11
  });

  map.on('load', async () => {
    const data = await fetch('your-data.json').then(r => r.json());
    const layer = new ScreenGrid.ScreenGridLayerGL({
      data,
      getPosition: d => d.coordinates,
      getWeight: d => d.weight,
      cellSizePixels: 60,
      colorScale: v => [255 * v, 200 * (1 - v), 50, 220]
    });
    map.addLayer(layer);
  });
  
  // Optional: hover/click handlers
  // layer.setConfig({ onHover: ({cell}) => console.log(cell) });
  
  // Enhanced pan/zoom callbacks
  layer.setConfig({
    onZoom: (zoomData) => {
      console.log(`Zoom: ${zoomData.previousZoom} → ${zoomData.zoom}`);
      console.log(`Center:`, zoomData.center);
    },
    onMove: (moveData) => {
      console.log(`Map moved to:`, moveData.center);
    }
  });
</script>
```

### Bundles

- ESM: `dist/screengrid.mjs`
- CJS: `dist/screengrid.cjs`
- UMD: `dist/screengrid.umd.js`
- UMD (min): `dist/screengrid.umd.min.js`

`maplibre-gl` is a peer dependency and is not bundled. In UMD builds, it is expected as a global `maplibregl`.                                                                                                                                             
## 🎨 Glyph Drawing

The library supports custom glyph drawing through the `onDrawCell` callback and a powerful **Plugin Ecosystem** for reusable glyph visualizations. This enables rich multivariate visualizations including time series, categorical breakdowns, and complex relationships.

📖 **📚 Comprehensive Guide**: See [docs/GLYPH_DRAWING_GUIDE.md](./docs/GLYPH_DRAWING_GUIDE.md) for detailed documentation on:
- All built-in glyph utilities (8 types including time series)
- Custom glyph implementation patterns
- Multivariate data visualization techniques
- Time series and spatio-temporal visualization
- Advanced patterns and best practices

📖 **📊 Data Utilities**: See [docs/DATA_UTILITIES.md](./docs/DATA_UTILITIES.md) for utility functions that simplify common data processing patterns:
- `groupBy` - Group data by categories
- `extractAttributes` - Extract multiple attributes from cellData
- `computeStats` - Compute statistics for uncertainty encoding
- `groupByTime` - Group data by time periods for temporal visualizations

### Quick Example: Using onDrawCell

```javascript
const gridLayer = new ScreenGridLayerGL({
  data: bikeData,
  getPosition: (d) => d.COORDINATES,
  getWeight: (d) => d.SPACES,
  enableGlyphs: true,
  onDrawCell: (ctx, x, y, normVal, cellInfo) => {
    const { cellData, glyphRadius } = cellInfo;
    
    // Calculate aggregated values
    const totalRacks = cellData.reduce((sum, item) => sum + item.data.RACKS, 0);
    const totalSpaces = cellData.reduce((sum, item) => sum + item.data.SPACES, 0);
    
    // Draw custom glyph
    ctx.fillStyle = `hsl(${200 + normVal * 60}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(x, y, glyphRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(totalSpaces.toString(), x, y);
  }
});
```

## 🔌 Plugin Ecosystem

ScreenGrid includes a **Plugin Ecosystem** that allows you to create reusable, named glyph visualizations. This system provides:

- **Built-in Plugins**: Four ready-to-use plugins (`circle`, `bar`, `pie`, `heatmap`)
- **Plugin Registry**: Register custom plugins by name for reuse across multiple layers
- **Lifecycle Hooks**: Support for initialization and cleanup
- **Legend Integration**: Automatic legend generation for plugins
- **Backward Compatible**: Existing `onDrawCell` callbacks work with highest precedence

📖 **📚 Full Documentation**: See [docs/PLUGIN_GLYPH_ECOSYSTEM.md](./docs/PLUGIN_GLYPH_ECOSYSTEM.md) for comprehensive plugin documentation, API reference, and usage patterns.

### Using Built-in Plugins

```javascript
import { ScreenGridLayerGL } from 'screengrid';

// Use a built-in plugin
const layer = new ScreenGridLayerGL({
  data,
  getPosition: (d) => d.coordinates,
  glyph: 'circle',  // Built-in plugin name
  glyphConfig: {
    radius: 15,
    color: '#3498db',
    alpha: 0.9
  },
  enableGlyphs: true
});
```

### Available Built-in Plugins

1. **`circle`** - Simple filled circle with customizable size, color, and opacity
2. **`bar`** - Horizontal bar chart showing multiple values side-by-side
3. **`pie`** - Pie chart showing proportional distribution of values
4. **`heatmap`** - Circle with color intensity representing normalized values

### Creating Custom Plugins

```javascript
import { ScreenGridLayerGL, GlyphRegistry } from 'screengrid';

// Define a custom plugin
const MyCustomGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    const radius = config.radius || cellInfo.glyphRadius;
    ctx.fillStyle = config.color || '#3498db';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  },
  
  // Optional: initialization hook
  init({ layer, config }) {
    console.log(`Initializing plugin for layer ${layer.id}`);
    return {
      destroy() {
        console.log('Cleaning up plugin');
      }
    };
  },
  
  // Optional: legend support
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

// Register the plugin
GlyphRegistry.register('myGlyph', MyCustomGlyph);

// Use the registered plugin
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'myGlyph',  // Use by name
  glyphConfig: { radius: 15, color: '#ff6600' },
  enableGlyphs: true
});
```

### Plugin Precedence

When rendering glyphs, the system uses the following precedence order (highest to lowest):

1. **User-provided `onDrawCell` callback** (full backward compatibility)
2. **Registered plugin via `glyph` name**
3. **Color-mode rendering** (no glyphs)

This ensures backward compatibility while allowing gradual migration to the plugin system.

### Plugin Example

See [`examples/plugin-glyph.html`](./examples/plugin-glyph.html) for a complete example demonstrating:
- Custom plugin registration (`grouped-bar` plugin)
- Lifecycle hooks (`init` and `destroy`)
- Legend integration
- Global state management for cross-cell normalization
- Interactive hover effects

📖 **For detailed plugin API documentation**: See [docs/PLUGIN_GLYPH_ECOSYSTEM.md](./docs/PLUGIN_GLYPH_ECOSYSTEM.md)

## 🖱️ Interactive Events

ScreenGrid provides comprehensive event handling for interactive visualizations:

### Basic Events

**Hover and Click:**
```javascript
const layer = new ScreenGridLayerGL({
  data: myData,
  onHover: ({ cell, event }) => {
    if (cell) {
      console.log(`Hovering over cell [${cell.col}, ${cell.row}]`);
      console.log(`Value: ${cell.value}`);
    }
  },
  onClick: ({ cell, event }) => {
    if (cell) {
      console.log(`Clicked cell with ${cell.cellData.length} data points`);
    }
  }
});
```

### Enhanced Pan/Zoom Callbacks

**Zoom and Move Events:**
```javascript
const layer = new ScreenGridLayerGL({
  data: myData,
  onZoom: (zoomData) => {
    // Enhanced callback with map state
    console.log(`Zoom: ${zoomData.previousZoom} → ${zoomData.zoom}`);
    console.log(`Center:`, zoomData.center);
    console.log(`Bounds:`, zoomData.bounds);
  },
  onMove: (moveData) => {
    // Enhanced callback with map state
    console.log(`Moved to:`, moveData.center);
    console.log(`Previous center:`, moveData.previousCenter);
  }
});
```

### Brush Selection

**Rectangular Selection:**
```javascript
const layer = new ScreenGridLayerGL({
  data: myData,
  onBrush: ({ cells, bounds, event }) => {
    console.log(`Selected ${cells.length} cells`);
    console.log(`Selection bounds:`, bounds);
    // Process selected cells...
  }
});

// Implement brush UI (user's responsibility)
let brushStart = null;
let brushEnd = null;

map.on('mousedown', (e) => {
  if (e.originalEvent.shiftKey) { // Hold Shift to enable brush
    brushStart = { x: e.point.x, y: e.point.y };
  }
});

map.on('mousemove', (e) => {
  if (brushStart) {
    brushEnd = { x: e.point.x, y: e.point.y };
    // Draw selection rectangle (user's responsibility)
    drawBrushRect(brushStart, brushEnd);
  }
});

map.on('mouseup', (e) => {
  if (brushStart && brushEnd) {
    const bounds = {
      minX: Math.min(brushStart.x, brushEnd.x),
      minY: Math.min(brushStart.y, brushEnd.y),
      maxX: Math.max(brushStart.x, brushEnd.x),
      maxY: Math.max(brushStart.y, brushEnd.y)
    };
    // Trigger brush callback
    layer.handleBrush(bounds, e);
    brushStart = null;
    brushEnd = null;
  }
});
```

**Note:** Brush selection UI (drawing the rectangle, handling mouse events) must be implemented by the user. The library provides the callback mechanism and cell query functionality.

📖 **For complete event API documentation**: See [docs/API_REFERENCE.md](./docs/API_REFERENCE.md#event-callbacks)

## 📚 Examples

### Running the Examples

To run the examples locally:

```bash
npx http-server -p 8000
# Then open http://localhost:8000/examples/ in your browser
```

### Available Examples

1. **Full Demo** (`examples/index.html`) - Complete interactive demo with all features
2. **Simple Test** (`examples/simple-test.html`) - Basic functionality verification
3. **Original Test** (`examples/test.html`) - Original test implementation
4. **Legend Example** (`examples/legend-example.html`) - Demonstrates legend functionality
5. **Time Series** (`examples/timeseries.html`) - Temporal data visualization
6. **Multivariate Time Series** (`examples/multivariate-timeseries.html`) - Advanced multi-attribute temporal visualization
7. **Plugin Glyph** (`examples/plugin-glyph.html`) - Complete plugin ecosystem example with custom `grouped-bar` plugin, lifecycle hooks, and legend integration
8. **Data Utilities** (`examples/data-utilities.html`) - Demonstrates data utility functions (`groupBy`, `extractAttributes`, `computeStats`, `groupByTime`)
9. **Hex Mode** (`examples/hex-mode.html`) - Hexagonal aggregation mode with interactive controls
10. **Hex Mode Simple** (`examples/hex-mode-simple.html`) - Simple hexagonal aggregation example
11. **US States** (`examples/us-states.html`) - Geometry input example with polygon features
12. **Creative Coding** (`examples/creative-coding.html`) - Artistic visualizations: mosaic tiles, tessellations, particles, and abstract patterns demonstrating the library's creative coding capabilities


### Example Features

- **Multiple Data Sources**: SF Bike Parking, Restaurants, NYC Taxis
- **Visualization Modes**: Color-based and Glyph-based rendering
- **Interactive Controls**: Real-time parameter adjustment
- **Live Preview**: Glyph preview and real-time updates
- **Legend Support**: Dynamic legend generation for various visualization types
- **Time Series**: Temporal data aggregation and visualization
- **Debug Information**: Console logging and status updates

## 🔧 API Reference

### ScreenGridLayerGL

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | string | `"screen-grid-layer"` | Unique identifier for the layer |
| `data` | Array | `[]` | Array of data points to aggregate (legacy point input) |
| `getPosition` | Function | `(d) => d.coordinates` | Function to extract coordinates from data |
| `getWeight` | Function | `() => 1` | Function to extract weight from data |
| `cellSizePixels` | number | `50` | Size of each grid cell in pixels |
| `colorScale` | Function | `(v) => [255 * v, 100, 200, 200]` | Color scale function |
| `onAggregate` | Function | `null` | Callback when grid is aggregated |
| `onHover` | Function | `null` | Callback when hovering over cells |
| `onClick` | Function | `null` | Callback when clicking cells |
| `onBrush` | Function | `null` | Callback when brush selection completes (rectangular selection) |
| `onZoom` | Function | `null` | Callback when map zoom changes (enhanced with map state) |
| `onMove` | Function | `null` | Callback when map pan/move changes (enhanced with map state) |
| `onDrawCell` | Function | `null` | Callback for custom glyph drawing (highest precedence) |
| `enableGlyphs` | boolean | `false` | Enable glyph-based rendering (when `true` and a glyph is active, cell backgrounds are **off by default** unless `aggregationModeConfig.showBackground === true`) |
| `glyph` | string | `null` | Registered plugin name to use (e.g., `'circle'`, `'bar'`, `'pie'`, `'heatmap'`) |
| `glyphConfig` | object | `{}` | Configuration object passed to plugin's `draw()` method |
| `glyphSize` | number | `0.8` | Size of glyphs relative to cell size |
| `aggregationFunction` | Function\|string | `'sum'` | Aggregation function or name (see [Aggregation Functions](#-aggregation-functions)) |
| `normalizationFunction` | Function\|string | `'max-local'` | Normalization function or name (see [Normalization Functions](#-normalization-functions)) |
| `normalizationContext` | object | `{}` | Additional context for normalization (e.g., `{globalMax: 1000}`) |
| `aggregationMode` | string | `'screen-grid'` | Aggregation mode: `'screen-grid'` (rectangular) or `'screen-hex'` (hexagonal) |
| `aggregationModeConfig` | object | `{}` | Mode-specific configuration (e.g., `{hexSize: 50, showBackground: true}` for hex mode) |
| `adaptiveCellSize` | boolean | `false` | Enable adaptive cell sizing |
| `minCellSize` | number | `20` | Minimum cell size in pixels |
| `maxCellSize` | number | `100` | Maximum cell size in pixels |
| `zoomBasedSize` | boolean | `false` | Adjust cell size based on zoom level |
| `enabled` | boolean | `true` | Whether the layer is enabled |
| `debugLogs` | boolean | `false` | Enable verbose debug logging (useful for troubleshooting) |
| `source` | GeoJSON | `null` | GeoJSON Feature/FeatureCollection or array of Features (mutually exclusive with `data`) |
| `placement` | object | `null` | Placement config to derive anchors from geometries (see docs) |
| `renderMode` | `'screen-grid'|'feature-anchors'` | `'screen-grid'` | Rendering path (aggregate vs draw directly) |
| `anchorSizePixels` | number | `auto` | Glyph size in pixels for `feature-anchors` mode |

See `docs/GEOMETRY_INPUT_AND_PLACEMENT.md` and `docs/PLACEMENT_CONFIG.md` for geometry input, placement strategies, and validation rules.

## 🔷 Aggregation Modes

ScreenGrid supports multiple aggregation modes for different visualization needs. The default mode is `screen-grid` (rectangular cells), but you can also use `screen-hex` for hexagonal tessellation.

### Available Modes

#### `screen-grid` (Default)
Rectangular grid cells aligned to screen pixels. This is the classic ScreenGrid behavior.

```javascript
const layer = new ScreenGridLayerGL({
  data: myData,
  aggregationMode: 'screen-grid', // Default, can be omitted
  cellSizePixels: 50
});
```

#### `screen-hex`
Hexagonal tessellation in screen space. Provides a more organic, visually appealing grid pattern.

```javascript
const layer = new ScreenGridLayerGL({
  data: myData,
  aggregationMode: 'screen-hex',
  aggregationModeConfig: {
    hexSize: 50, // Size of hexagons (similar to cellSizePixels)
    showBackground: true // Show colored hexagon backgrounds
  }
});
```

### Mode Configuration

Each mode can have mode-specific configuration via `aggregationModeConfig`:

**For `screen-hex`:**
- `hexSize` (number): Size of hexagons in pixels (defaults to `cellSizePixels` if not provided)
- `showBackground` (boolean): Whether to show colored hexagon backgrounds (default: `false` when glyphs are enabled)

**For `screen-grid`:**
- `showBackground` (boolean): Whether to show colored cell backgrounds (default: `false` when glyphs are enabled)

### Custom Aggregation Modes

You can register custom aggregation modes using the `AggregationModeRegistry`:

```javascript
import { AggregationModeRegistry } from 'screengrid';

const MyCustomMode = {
  name: 'my-custom-mode',
  type: 'screen-space', // or 'geographic'
  aggregate(data, getPosition, getWeight, map, config) {
    // Custom aggregation logic
    return aggregationResult;
  },
  render(aggregationResult, ctx, config, map) {
    // Custom rendering logic
  },
  getCellAt(point, aggregationResult, map) {
    // Custom cell query logic
    return cellInfo;
  },
  getStats(aggregationResult) {
    // Optional: custom statistics
    return stats;
  },
  needsUpdateOnZoom() { return true; },
  needsUpdateOnMove() { return true; }
};

AggregationModeRegistry.register('my-custom-mode', MyCustomMode);

// Use it
const layer = new ScreenGridLayerGL({
  data: myData,
  aggregationMode: 'my-custom-mode'
});
```

See `examples/hex-mode.html` and `examples/hex-mode-simple.html` for complete examples of hexagonal aggregation.

## 📊 Aggregation Functions

ScreenGrid supports flexible aggregation functions that determine how multiple data points within a cell are combined. You can use built-in functions or provide custom functions.

### Built-in Aggregation Functions

```javascript
import { AggregationFunctions } from 'screengrid';

// Sum (default) - sums all weights in a cell
aggregationFunction: AggregationFunctions.sum
// or
aggregationFunction: 'sum'

// Mean - average of all weights
aggregationFunction: AggregationFunctions.mean
// or
aggregationFunction: 'mean'

// Count - number of points in a cell
aggregationFunction: AggregationFunctions.count
// or
aggregationFunction: 'count'

// Max - maximum weight value
aggregationFunction: AggregationFunctions.max
// or
aggregationFunction: 'max'

// Min - minimum weight value
aggregationFunction: AggregationFunctions.min
// or
aggregationFunction: 'min'
```

### Custom Aggregation Functions

You can provide your own aggregation function to support multi-attribute aggregation or custom calculations:

```javascript
// Single-value custom aggregation
aggregationFunction: (cellData) => {
  // cellData is array of {data, weight, projectedX, projectedY}
  return cellData.reduce((sum, item) => sum + item.weight * 2, 0);
}

// Multi-attribute aggregation (returns object)
aggregationFunction: (cellData) => {
  return {
    total: cellData.reduce((sum, item) => sum + item.weight, 0),
    count: cellData.length,
    avg: cellData.reduce((sum, item) => sum + item.weight, 0) / cellData.length,
    max: Math.max(...cellData.map(item => item.weight)),
    // Access original data attributes
    categories: cellData.map(item => item.data.category)
  };
}
```

### Registering Custom Aggregation Functions

```javascript
import { AggregationFunctionRegistry } from 'screengrid';

// Register a custom function
AggregationFunctionRegistry.register('custom-sum', (cellData) => {
  return cellData.reduce((sum, item) => sum + item.weight, 0);
});

// Use it by name
aggregationFunction: 'custom-sum'
```

**Note:** When using multi-attribute aggregation (returning objects), normalization is skipped automatically. You'll need to handle normalization in your glyph drawing function (`onDrawCell`) or custom glyph plugin.

## 📈 Normalization Functions

Normalization functions convert raw aggregated cell values to a normalized range (0-1) for consistent rendering. You can use built-in strategies or provide custom functions.

### Built-in Normalization Functions

```javascript
import { NormalizationFunctions } from 'screengrid';

// Max-local (default) - normalizes relative to max value in current grid
normalizationFunction: NormalizationFunctions.maxLocal
// or
normalizationFunction: 'max-local'

// Max-global - normalizes relative to a global maximum
normalizationFunction: NormalizationFunctions.maxGlobal
// Requires normalizationContext: {globalMax: 1000}
normalizationContext: { globalMax: 1000 }

// Z-score - normalizes using z-score transformation
normalizationFunction: NormalizationFunctions.zScore
// or
normalizationFunction: 'z-score'

// Percentile - normalizes based on percentile rank
normalizationFunction: NormalizationFunctions.percentile
// or
normalizationFunction: 'percentile'
```

### Custom Normalization Functions

```javascript
// Custom normalization function
normalizationFunction: (grid, cellValue, cellIndex, context) => {
  // grid: array of all cell values
  // cellValue: value of current cell
  // cellIndex: index of current cell
  // context: {max, min, mean, std, totalValue, cellsWithData, ...custom}
  
  // Example: logarithmic normalization
  if (cellValue === 0 || context.max === 0) return 0;
  return Math.log(cellValue + 1) / Math.log(context.max + 1);
}
```

### Registering Custom Normalization Functions

```javascript
import { NormalizationFunctionRegistry } from 'screengrid';

// Register a custom function
NormalizationFunctionRegistry.register('log-normal', (grid, cellValue, cellIndex, context) => {
  if (cellValue === 0 || context.max === 0) return 0;
  return Math.log(cellValue + 1) / Math.log(context.max + 1);
});

// Use it by name
normalizationFunction: 'log-normal'
```

### Example: Using Aggregation and Normalization Together

```javascript
import { ScreenGridLayerGL, AggregationFunctions, NormalizationFunctions } from 'screengrid';

const layer = new ScreenGridLayerGL({
  data: myData,
  getPosition: d => d.coordinates,
  getWeight: d => d.value,
  
  // Use mean aggregation instead of sum
  aggregationFunction: AggregationFunctions.mean,
  
  // Use z-score normalization
  normalizationFunction: NormalizationFunctions.zScore,
  
  // Or use global normalization with context
  normalizationFunction: NormalizationFunctions.maxGlobal,
  normalizationContext: { globalMax: 10000 },
  
  colorScale: (v) => [255 * v, 200 * (1 - v), 50, 220]
});
```

## 🛠️ Built-in Glyph Utilities

```javascript
// Circle glyph
ScreenGridLayerGL.drawCircleGlyph(ctx, x, y, radius, color, alpha);

// Bar chart glyph
ScreenGridLayerGL.drawBarGlyph(ctx, x, y, values, maxValue, cellSize, colors);

// Pie chart glyph
ScreenGridLayerGL.drawPieGlyph(ctx, x, y, values, radius, colors);

// Scatter plot glyph
ScreenGridLayerGL.drawScatterGlyph(ctx, x, y, points, cellSize, color);

// Donut chart glyph (v2.0.0+)
ScreenGridLayerGL.drawDonutGlyph(ctx, x, y, values, outerRadius, innerRadius, colors);

// Heatmap intensity glyph (v2.0.0+)
ScreenGridLayerGL.drawHeatmapGlyph(ctx, x, y, radius, normalizedValue, colorScale);

// Radial bar chart glyph (v2.0.0+)
ScreenGridLayerGL.drawRadialBarGlyph(ctx, x, y, values, maxValue, maxRadius, color);
```

### GlyphRegistry API

The `GlyphRegistry` manages the plugin ecosystem and provides methods for registering and managing glyph plugins:

```javascript
import { GlyphRegistry } from 'screengrid';

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

See [Plugin Ecosystem](#-plugin-ecosystem) section above for detailed usage examples.

### AggregationModeRegistry API

The `AggregationModeRegistry` manages aggregation mode plugins:

```javascript
import { AggregationModeRegistry } from 'screengrid';

// Register a custom mode
AggregationModeRegistry.register(name, modePlugin, { overwrite = false })

// Retrieve a mode
AggregationModeRegistry.get(name)

// Check if mode exists
AggregationModeRegistry.has(name)

// List all registered modes
AggregationModeRegistry.list()

// Unregister a mode
AggregationModeRegistry.unregister(name)
```

### Logger API

The `Logger` utility provides controlled debug logging:

```javascript
import { Logger, setDebug } from 'screengrid';

// Enable/disable debug logging globally
setDebug(true);

// Use logger (logs only when debug is enabled)
Logger.log('Debug message');
Logger.warn('Warning message');
Logger.error('Error message'); // Always shown, even when debug is disabled
```

**Note:** Debug logging can also be controlled via the `debugLogs` configuration option.

## 📦 Exported Modules & Utilities

The library exports various modules and utilities that you can use independently:

### Core Classes
- `ScreenGridLayerGL` - Main layer class
- `Aggregator` - Pure aggregation logic
- `Projector` - Coordinate projection utilities
- `CellQueryEngine` - Spatial query engine

### Aggregation & Normalization
- `AggregationModeRegistry` - Registry for aggregation modes
- `ScreenGridMode` - Rectangular grid mode
- `ScreenHexMode` - Hexagonal grid mode
- `AggregationFunctionRegistry` - Registry for aggregation functions
- `AggregationFunctions` - Built-in aggregation functions (sum, mean, count, max, min)
- `NormalizationFunctionRegistry` - Registry for normalization functions
- `NormalizationFunctions` - Built-in normalization functions (max-local, max-global, z-score, percentile)

### Glyphs & Plugins
- `GlyphUtilities` - Low-level glyph drawing utilities
- `GlyphRegistry` - Registry for glyph plugins

### Geometry & Placement
- `PlacementEngine` - Geometry placement engine
- `PlacementValidator` - Placement configuration validator
- `PlacementStrategyRegistry` - Registry for placement strategies
- `GeometryUtils` - Geometry utility functions

### Canvas & Rendering
- `CanvasManager` - Canvas lifecycle management
- `Renderer` - Rendering logic

### Events
- `EventBinder` - Event binding management
- `EventHandlers` - Event handler implementations

### Configuration & Utilities
- `ConfigManager` - Configuration management
- `Logger` - Debug logging utility
- `setDebug` - Enable/disable debug logging
- `groupBy` - Group data by categories
- `extractAttributes` - Extract multiple attributes
- `computeStats` - Compute statistics
- `groupByTime` - Group data by time periods

### Legend
- `Legend` - Legend class
- `LegendDataExtractor` - Legend data extraction
- `LegendRenderers` - Legend rendering utilities

**Example:**
```javascript
import { 
  ScreenGridLayerGL,
  AggregationModeRegistry,
  GlyphRegistry,
  Logger,
  setDebug
} from 'screengrid';
```

## 📊 Legend Module

The library includes a powerful Legend module for automatically generating data-driven legends:

```javascript
import { Legend } from 'screengrid';

// Create a legend connected to your grid layer
const legend = new Legend({
  layer: gridLayer,
  type: 'auto', // 'color-scale', 'categorical', 'temporal', 'size-scale', 'auto', 'multi'
  position: 'bottom-right', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
  title: 'Data Legend'
});

// The legend automatically updates when the grid is aggregated
```

### Legend Types

- **`color-scale`**: Continuous color scale legend
- **`categorical`**: Categorical/discrete values legend
- **`temporal`**: Time-based legend for temporal data
- **`size-scale`**: Size-based legend
- **`auto`**: Automatically detects the best legend type
- **`multi`**: Multi-attribute legend for complex visualizations

See `examples/legend-example.html` for detailed usage examples.

## 🐛 Troubleshooting

### Common Issues

1. **Grid not visible**: Check browser console for errors, ensure data is loaded correctly
2. **Glyphs not rendering**: Verify `enableGlyphs: true` and `onDrawCell` callback is provided
3. **Performance issues**: Try increasing cell size or reducing data points
4. **Canvas issues**: Ensure MapLibre GL JS is properly loaded

### Debug Mode

Enable debug logging via the `debugLogs` configuration option:

```javascript
const layer = new ScreenGridLayerGL({
  data: myData,
  debugLogs: true // Enable verbose debug logging
});
```

Or programmatically:

```javascript
import { setDebug } from 'screengrid';

setDebug(true); // Enable debug logging globally
```

The library provides detailed logging for:
- Layer initialization
- Data aggregation
- Rendering process
- Event handling
- Error states

**Note:** Debug logs are disabled by default for performance. Enable only when troubleshooting.

## 👤 Author

**dany laksono**

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 Changelog

### v2.3.0 (Current)
- **NEW**: Brush selection callback (`onBrush`) for rectangular cell selection
- **NEW**: Enhanced pan/zoom callbacks (`onZoom`, `onMove`) with detailed map state information
- **NEW**: Advanced filtering query methods (`getCellsByAttribute`, `getCellsByTimeRange`, `getCellsByMultipleFilters`) in `CellQueryEngine`
- **IMPROVED**: Event system with enhanced callbacks providing previous and current map state
- **IMPROVED**: Better integration between brush selection and cell querying

### v2.2.0
- **NEW**: Hexagonal aggregation mode (`screen-hex`) for organic, visually appealing grid patterns
- **NEW**: Aggregation mode registry system (`AggregationModeRegistry`) for extensible aggregation strategies
- **NEW**: Mode-specific configuration via `aggregationModeConfig` option
- **IMPROVED**: Better separation between aggregation logic and rendering logic
- **IMPROVED**: Enhanced examples with hex mode demonstrations

### v2.1.0
- **NEW**: Aggregation function registry system with built-in functions (sum, mean, count, max, min)
- **NEW**: Normalization function registry system with built-in strategies (max-local, max-global, z-score, percentile)
- **NEW**: Support for custom aggregation functions (including multi-attribute aggregation)
- **NEW**: Support for custom normalization functions
- **NEW**: Geometry Input & Placement: Support for non-point geometries (Polygons, Lines) via `source` option and placement strategies
- **NEW**: Feature Anchors Rendering Mode: `renderMode: 'feature-anchors'` for drawing glyphs directly at anchor positions
- **NEW**: Data Utilities: Utility functions (`groupBy`, `extractAttributes`, `computeStats`, `groupByTime`) for data processing
- **NEW**: Logger utility with configurable debug logging (`debugLogs` option)
- **IMPROVED**: Enhanced flexibility for data aggregation and normalization strategies
- **IMPROVED**: Enhanced documentation and examples
- **IMPROVED**: Backward compatible - defaults preserve existing behavior

### v2.0.0
- **NEW**: Comprehensive modular refactoring (11 modules with clean separation of concerns)
- **NEW**: Core modules for pure business logic (Aggregator, Projector, CellQueryEngine) - zero UI dependencies
- **NEW**: Dedicated canvas management (CanvasManager, Renderer) - clean rendering pipeline
- **NEW**: Organized event system (EventBinder, EventHandlers) - testable event logic
- **NEW**: Configuration management system (ConfigManager)
- **NEW**: Glyph drawing system with `onDrawCell` callback
- **NEW**: 7 built-in glyph utilities (circle, bar, pie, scatter, donut, heatmap, radial bar)
 - **NEW**: 8 built-in glyph utilities (circle, bar, pie, scatter, donut, heatmap, radial bar, time series)
- **NEW**: Enhanced aggregation storing raw data points per cell
- **NEW**: Zoom-based cell size adjustment
- **NEW**: Adaptive cell sizing options
- **NEW**: Multi-attribute visualization support
- **NEW**: Grid statistics method (`getStats()`)
- **NEW**: Spatial query methods (`getCellsInBounds()`, `getCellsAboveThreshold()`)
- **IMPROVED**: Enhanced cell interaction with detailed data access
- **IMPROVED**: Better performance with optimized rendering pipeline
- **IMPROVED**: Modular architecture enables better testing and reusability
- **IMPROVED**: Comprehensive documentation with architecture guide

### v1.0.0
- Initial release
- Basic grid aggregation functionality
- MapLibre GL JS integration
- Interactive hover and click events
- Customizable styling options





