# Usage Guide

## Quick Start

### 1. Install Dependencies

```bash
# From npm (for use in your projects)
npm install screengrid
npm install maplibre-gl

# Or clone for development
git clone https://github.com/danylaksono/screengrid.git
cd screengrid
npm install
npm run build
```

### 2. Run the Examples

```bash
# Start a local HTTP server
npx http-server -p 8000
# or
npm start
```

### 3. Open in Browser

- **Main Demo**: http://localhost:8000/examples/index.html
- **Simple Test**: http://localhost:8000/examples/simple-test.html
- **Hex Mode**: http://localhost:8000/examples/hex-mode.html
- **Plugin Glyph**: http://localhost:8000/examples/plugin-glyph.html
- **Time Series**: http://localhost:8000/examples/timeseries.html
- **Geometry Input**: http://localhost:8000/examples/us-states.html

## Preset Constructors

The full constructor remains the most flexible API, but common map types can
start from small presets. Each preset returns a normal `ScreenGridLayerGL`
instance, so you can still pass any advanced option.

### Density Grid

Use `density()` for the default rectangular screen-space grid.

```javascript
const layer = ScreenGridLayerGL.density({
  data,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.count,
  cellSizePixels: 60
});
```

### Hex Density Grid

Use `hexDensity()` when hexagonal cells reduce square-grid artefacts or fit the
visual style better.

```javascript
const layer = ScreenGridLayerGL.hexDensity({
  data,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.value,
  aggregationModeConfig: {
    hexSize: 48
  }
});
```

### Gridded Glyph Map

Use `glyphMap()` for point data where each grid cell should carry a glyph such
as a pie, bar, or custom `onDrawCell` mark.

```javascript
const layer = ScreenGridLayerGL.glyphMap({
  data,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.total,
  glyph: 'pie',
  glyphConfig: {
    colors: ['#2a9d8f', '#e9c46a', '#e76f51']
  }
});
```

### Feature-Anchored Glyphs

Use `featureGlyphs()` when the source is GeoJSON and the glyph should be placed
on polygon or line anchors rather than aggregated into screen cells.

```javascript
const layer = ScreenGridLayerGL.featureGlyphs({
  source: geojson,
  placement: { strategy: 'centroid' },
  glyph: 'circle'
});
```

## File Structure

```
screengrid/
├── src/                    # Source code (modular architecture)
│   ├── index.js            # Main entry point
│   ├── ScreenGridLayerGL.js # Main orchestrator
│   ├── core/               # Core business logic
│   ├── canvas/             # Canvas rendering
│   ├── events/             # Event system
│   ├── glyphs/             # Glyph utilities & plugins
│   ├── aggregation/        # Aggregation modes & functions
│   ├── normalization/      # Normalization functions
│   ├── utils/              # Utilities (Logger, DataUtilities)
│   └── legend/             # Legend system
├── dist/                   # Built distribution files
├── docs/                   # Documentation
├── examples/               # Example HTML files
├── package.json            # NPM package configuration
└── README.md               # Main documentation
```

## Examples Overview

### Index.html - Full Demo
- Interactive controls for cell size, color schemes, opacity
- Multiple data sources (SF bike parking, restaurants, NYC taxis)
- Real-time grid information display
- Hover and click interactions
- Glyph and color mode switching

### Hex Mode Examples
- `hex-mode.html`: Complete hexagonal aggregation with controls
- `hex-mode-simple.html`: Simple hex mode demonstration

### Plugin Glyph Example
- Custom plugin registration (`grouped-bar` plugin)
- Lifecycle hooks and legend integration
- Interactive hover effects

### Time Series Examples
- `timeseries.html`: Single-variable temporal visualization
- `multivariate-timeseries.html`: Multi-attribute temporal data

### Geometry Input Examples
- `us-states.html`: Polygon features with centroid anchors
- Demonstrates `source`, `placement`, and `renderMode` options

### Data Utilities Example
- Demonstrates utility functions: `groupBy`, `extractAttributes`, `computeStats`, `groupByTime`

### Creative Coding Examples
- Artistic visualizations: mosaic tiles, tessellations, particles
- Abstract patterns demonstrating creative coding capabilities

## Development

### Building the Library

```bash
npm run build
# Outputs to dist/ folder:
# - screengrid.mjs (ESM)
# - screengrid.cjs (CJS)
# - screengrid.umd.js (UMD)
# - screengrid.umd.min.js (UMD minified)
```

### Adding New Features

1. Create new module in appropriate folder (`core/`, `canvas/`, etc.)
2. Export from `src/index.js`
3. Update documentation in `docs/`
4. Add example in `examples/`

### Customizing Glyphs

When you switch to glyph-based rendering (`enableGlyphs: true` with either `onDrawCell` or a `glyph` plugin), the default behaviour is to **turn off the colored cell background** so the glyphs stand out. If you want to keep the heatmap-style background behind your glyphs, set:

```javascript
const gridLayer = new ScreenGridLayerGL({
  // ...other options
  enableGlyphs: true,
  onDrawCell: myGlyphFn,
  aggregationModeConfig: {
    showBackground: true // explicitly opt-in to background when using glyphs
  }
});
```

### Performance Tuning

- Adjust `cellSizePixels` for performance vs detail tradeoff
- Filter data based on zoom level
- Use simple color calculations
- Consider data clustering for large datasets
- Use hexagonal mode for better packing in dense areas

## Troubleshooting

### Common Issues

1. **CORS Errors**: Use a local server, not file:// protocol
2. **Module Import Errors**: Ensure you're using the correct build format (ESM/CJS/UMD)
3. **Map Not Loading**: Check MapLibre GL JS CDN availability
4. **Data Not Loading**: Verify data URLs are accessible
5. **Glyphs Not Rendering**: Verify `enableGlyphs: true` and glyph callback/plugin is provided
6. **Geometry Input Issues**: Ensure `source` and `placement` are correctly configured

### Debug Mode

Enable verbose debug logging via the `debugLogs` option:

```javascript
const gridLayer = new ScreenGridLayerGL({
  // ... other options
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

## Integration

### With Your Own Project

1. Install from npm:
```bash
npm install screengrid maplibre-gl
```

2. Import and use:
```javascript
import { ScreenGridLayerGL } from 'screengrid';
import maplibregl from 'maplibre-gl';

const gridLayer = new ScreenGridLayerGL({
  data: yourData,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.weight,
  cellSizePixels: 60
});

map.addLayer(gridLayer);
```

### With Build Tools

The library is ES module compatible and works with:
- Webpack
- Vite
- Rollup
- Parcel
- Native ES modules

### CDN Usage

```html
<script src="https://unpkg.com/screengrid/dist/screengrid.umd.min.js"></script>
<script src="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.js"></script>
<script>
  const { ScreenGridLayerGL } = ScreenGrid;
  // use ScreenGridLayerGL here
</script>
```

## Testing

Run tests (if test framework is configured):

```bash
npm test
```

## See Also

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Architecture Guide](./ARCHITECTURE.md) - Modular architecture details
- [Glyph Drawing Guide](./GLYPH_DRAWING_GUIDE.md) - Glyph visualization patterns
- [Quick Reference](./QUICK_REFERENCE.md) - Quick lookup snippets
