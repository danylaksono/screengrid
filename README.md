# ScreenGrid Library

[![npm](https://img.shields.io/npm/v/screengrid.svg)](https://www.npmjs.com/package/screengrid)

A GPU/Canvas hybrid Screen-Space Grid Aggregation library for MapLibre GL JS. This library provides efficient real-time aggregation of point data into screen-space grids with customizable styling, interactive features, and advanced glyph drawing capabilities. It also supports non-point geometries via a geometry placement preprocessor and per-feature glyph rendering.

This library is inspired by Aidan Slingsby's [Gridded Glyphmaps](https://openaccess.city.ac.uk/id/eprint/31115/) and borrows some basic concepts from deck.gl's [`ScreenGridLayer`](https://deck.gl/docs/api-reference/aggregation-layers/screen-grid-layer), but is built from the ground up with a modular architecture.

![ScreenGrid multivariate glyph map example](./screengrid.png)

## Documentation

- **[Quick Start & Examples](docs/USAGE.md)** - Get started quickly with working examples
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation
- **[Glyph Drawing Guide](docs/GLYPH_DRAWING_GUIDE.md)** - Custom glyph visualizations
- **[Semantic Cells](docs/CELL_SEMANTICS.md)** - Research-grade cell summaries, reliability, comparability, and migration guidance
- **[Cartographic Evaluation Rubric](docs/CARTOGRAPHIC_EVALUATION_RUBRIC.md)** - Task-fit checks for multivariate map designs
- **[Plugin Ecosystem](docs/PLUGIN_GLYPH_ECOSYSTEM.md)** - Reusable glyph plugins
- **[Geometry Input](docs/GEOMETRY_INPUT_AND_PLACEMENT.md)** - Non-point geometries (Polygon, LineString)
- **[Spatio-Temporal Guide](docs/SPATIO_TEMPORAL_GUIDE.md)** - Time series visualization
- **[Architecture](docs/ARCHITECTURE.md)** - Modular architecture details
- **[Quick Reference](docs/QUICK_REFERENCE.md)** - Cheat sheet and common patterns

## Quick Start

### Installation

```bash
npm install screengrid maplibre-gl
```

### Basic Usage

```javascript
import { ScreenGridLayerGL } from 'screengrid';
import maplibregl from 'maplibre-gl';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [-122.4, 37.74],
  zoom: 11
});

map.on('load', async () => {
  const data = await fetch('your-data.json').then(r => r.json());
  
  const gridLayer = ScreenGridLayerGL.density({
    data: data,
    getPosition: (d) => d.coordinates,
    getWeight: (d) => d.weight,
    cellSizePixels: 60,
    colorScale: (v) => [255 * v, 200 * (1 - v), 50, 220]
  });
  
  map.addLayer(gridLayer);
});
```

### CDN Usage

```html
<script src="https://unpkg.com/screengrid/dist/screengrid.umd.min.js"></script>
<script src="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.js"></script>
<script>
  const { ScreenGridLayerGL } = ScreenGrid;
  // use ScreenGridLayerGL here
</script>
```

See [USAGE.md](docs/USAGE.md) for more examples and CDN usage details.

### Preset Constructors

Use the full `new ScreenGridLayerGL(options)` constructor when you need maximum
control, or start from one of the common presets:

```javascript
ScreenGridLayerGL.density(options);       // rectangular density grid
ScreenGridLayerGL.hexDensity(options);    // hexagonal density grid
ScreenGridLayerGL.glyphMap(options);      // gridded glyph map for point data
ScreenGridLayerGL.featureGlyphs(options); // GeoJSON feature-anchor glyphs
```

Each preset returns a normal `ScreenGridLayerGL` instance and accepts the same
advanced options as the constructor.

## Key Features

- **Real-time Aggregation** - Efficient screen-space grid aggregation
- **Multiple Modes** - Rectangular (`screen-grid`) and hexagonal (`screen-hex`) grids
- **Glyph Visualizations** - Custom glyph drawing with Canvas 2D
- **Plugin System** - Reusable glyph plugins (`circle`, `bar`, `pie`, `heatmap`)
- **Geometry Input** - Support for Polygon, LineString, and other non-point geometries
- **Interactive Events** - Hover and click handlers with reactive state
- **Time Series** - Built-in time series glyph utility
- **Legend System** - Auto-generated data-driven legends
- **Aggregation Functions** - Built-in (sum, mean, count, max, min) and custom functions
- **Normalization** - Multiple strategies (max-local, max-global, z-score, percentile)
- **Data Utilities** - Helper functions for common data processing patterns
- **Debug Logging** - Configurable logging for troubleshooting

See the [documentation](docs/) for detailed guides on each feature.

## Project Structure

```
screengrid/
├── src/
│   ├── index.js                    # Main entry point
│   ├── ScreenGridLayerGL.js        # MapLibre layer facade
│   ├── controllers/                # Layer lifecycle controllers
│   ├── core/                       # Core business logic
│   ├── canvas/                     # Canvas rendering
│   ├── events/                     # Event system
│   ├── glyphs/                     # Glyph utilities & plugins
│   ├── aggregation/                # Aggregation modes & functions
│   ├── normalization/              # Normalization functions
│   ├── utils/                      # Utilities (Logger, DataUtilities)
│   └── legend/                     # Legend system
├── docs/                           # Documentation
├── examples/                       # Example HTML files
├── dist/                           # Built distribution
└── package.json
```

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Examples

Run examples locally:

```bash
npx http-server -p 8000
# Open http://localhost:8000/examples/
```

Available examples:
- **examples/index.html** - Curated example gallery
- **getting-started/basic-density.html** - Minimal density grid
- **getting-started/interactive-controls.html** - Full interactive control demo
- **aggregation/hex-density.html** - Hexagonal aggregation
- **glyphs/plugin-glyph.html** - Custom plugin glyph
- **glyphs/legend.html** - Legend patterns
- **temporal/time-series.html** - Time-series glyphs
- **geometry/feature-anchors-us-states.html** - Geometry input and feature anchors
- **domain/public-transport-accessibility.html** - Domain-specific glyph map
- **utilities/data-utilities.html** - Data processing utilities

See [USAGE.md](docs/USAGE.md) for complete example descriptions.

## API Overview

### ScreenGridLayerGL Options

**Presets:**
- `ScreenGridLayerGL.density(options)` - Rectangular density grid
- `ScreenGridLayerGL.hexDensity(options)` - Hexagonal density grid
- `ScreenGridLayerGL.glyphMap(options)` - Gridded glyph map for point data
- `ScreenGridLayerGL.featureGlyphs(options)` - GeoJSON feature-anchor glyphs

**Basic:**
- `data` - Array of data points
- `getPosition` - Extract coordinates: `(d) => [lng, lat]`
- `getWeight` - Extract weight: `(d) => number`
- `cellSizePixels` - Cell size in pixels (default: 50)
- `colorScale` - Color function: `(v) => [r, g, b, a]`

**Glyphs:**
- `enableGlyphs` - Enable glyph rendering (default: false)
- `onDrawCell` - Custom glyph drawing callback
- `glyph` - Registered plugin name (`circle`, `bar`, `pie`, `heatmap`)
- `glyphConfig` - Plugin configuration object

**Geometry Input (v2.1.0+):**
- `source` - GeoJSON FeatureCollection (mutually exclusive with `data`)
- `placement` - Placement configuration
- `renderMode` - `screen-grid` or `feature-anchors`

**Aggregation:**
- `aggregationMode` - `screen-grid` or `screen-hex`
- `aggregationFunction` - `sum`, `mean`, `count`, `max`, `min`
- `normalizationFunction` - `max-local`, `max-global`, `z-score`, `percentile`

**Events:**
- `onHover` - Hover callback
- `onClick` - Click callback
- `onAggregate` - Aggregation callback

See [API_REFERENCE.md](docs/API_REFERENCE.md) for complete API documentation.

## Exports

```javascript
import {
  ScreenGridLayerGL,
  Aggregator, Projector, CellQueryEngine,
  PlacementEngine, PlacementValidator, GeometryUtils,
  CanvasManager, Renderer,
  EventBinder, EventHandlers,
  GlyphUtilities, GlyphRegistry,
  AggregationModeRegistry, ScreenGridMode, ScreenHexMode,
  AggregationFunctions, AggregationFunctionRegistry,
  NormalizationFunctions, NormalizationFunctionRegistry,
  Logger, setDebug,
  groupBy, extractAttributes, computeStats, groupByTime,
  Legend, LegendDataExtractor, LegendRenderers,
  ConfigManager
} from 'screengrid';
```

See [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) for usage examples.

## Development

```bash
git clone https://github.com/danylaksono/screengrid.git
cd screengrid
npm install
npm run build
npm test
```

See [USAGE.md](docs/USAGE.md) for development workflow details.

## Changelog

### v3.1.0 (Current)
- **NEW**: Aggregation results expose semantic cells via `cells`, `populatedCells`, and `cellSemantics`. These are computed lazily on first access, so the render loop pays no per-frame cost unless a consumer reads them.
- **NEW**: Cell-level spatial metadata, measures, reliability, and comparability contracts.
- **NEW**: Cartographic evaluation rubric and semantic-cell migration guide.
- Semantic cells preserve legacy `cellData`/`customData` aliases, so existing `onDrawCell` callbacks keep working.

### v3.0.1
- **FIXED**: Cells with data points that aggregate to 0 or negative values (e.g. `mean`/`min` aggregation over zero weights) are now rendered instead of silently dropped; "empty" is determined by point count
- **FIXED**: `onDrawCell` now receives `cellInfo.value` and `cellInfo.normalizedValue` as documented
- **FIXED**: Normalized values are clamped to [0, 1] before reaching `colorScale`/`onDrawCell`
- **PERF**: `z-score` and `percentile` normalization no longer rescan the grid per cell (O(n²) → O(n log n) per frame)
- **PERF**: Removed redundant per-frame point projection and per-frame debug log allocations
- **PERF**: Grid statistics no longer use spread-based `Math.max`/`Math.min` (stack-overflow risk on large grids)
- **DOCS**: Documented `aggregationFunction`, `normalizationFunction`, `normalizationContext`; removed duplicated sections and fixed incorrect examples

### v2.2.0
- **NEW**: Hexagonal aggregation mode (`screen-hex`)
- **NEW**: Aggregation mode registry system
- **IMPROVED**: Mode-specific configuration

### v2.1.0
- **NEW**: Geometry input & placement (non-point geometries)
- **NEW**: Aggregation function registry (sum, mean, count, max, min)
- **NEW**: Normalization function registry
- **NEW**: Data utilities (`groupBy`, `extractAttributes`, `computeStats`, `groupByTime`)
- **NEW**: Logger utility with debug logging

### v2.0.0
- **NEW**: Modular architecture refactoring
- **NEW**: Glyph plugin system
- **NEW**: Legend system
- **NEW**: Time series glyph utility

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for version history details.

## Author

**dany laksono**

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Related Documentation

- [API Reference](docs/API_REFERENCE.md)
- [Quick Reference](docs/QUICK_REFERENCE.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Usage Guide](docs/USAGE.md)
- [Glyph Drawing Guide](docs/GLYPH_DRAWING_GUIDE.md)
- [Plugin Ecosystem](docs/PLUGIN_GLYPH_ECOSYSTEM.md)
- [Geometry Input](docs/GEOMETRY_INPUT_AND_PLACEMENT.md)
- [Spatio-Temporal Guide](docs/SPATIO_TEMPORAL_GUIDE.md)
- [Data Utilities](docs/DATA_UTILITIES.md)
- [Cartography & Design](docs/CARTOGRAPHY_AND_MULTIVARIATE_DESIGN.md)
