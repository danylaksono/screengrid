# Usage Guide

## Quick Start

### 1. Run the Examples

```bash
# Start the development server
npm start
# or
python3 server.py
```

### 2. Open in Browser

- **Main Demo**: http://localhost:8000/index.html
- **Simple Test**: http://localhost:8000/test.html
- **Basic Example**: http://localhost:8000/example.js

## File Structure

```
screengrid/
├── screengrid.js      # Main library file
├── index.html         # Full-featured demo with controls
├── test.html          # Simple test page
├── example.js         # Basic usage example
├── package.json       # NPM package configuration
├── server.py          # Development server
├── README.md          # Documentation
└── USAGE.md           # This file
```

## Examples Overview

### index.html - Full Demo
- Interactive controls for cell size, color schemes, opacity
- Multiple data sources (SF bike parking, restaurants, NYC taxis)
- Real-time grid information display
- Hover and click interactions

### test.html - Simple Test
- Basic functionality test with sample data
- Minimal interface for quick verification
- Console logging for debugging

### example.js - Basic Usage
- Minimal code example
- Shows core API usage
- Good starting point for integration

## Development

### Adding New Data Sources

1. Add data URL to `dataSources` object in `index.html`
2. Add corresponding data accessor functions
3. Update the data source selector

### Customizing Colors

Modify the `colorSchemes` object in `index.html`:

```javascript
const colorSchemes = {
  myScheme: (v) => [r, g, b, a]  // v is normalized value 0-1
};
```

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

## Troubleshooting

### Common Issues

1. **CORS Errors**: Use a local server, not file:// protocol
2. **Module Import Errors**: Ensure server supports ES6 modules
3. **Map Not Loading**: Check MapLibre GL JS CDN availability
4. **Data Not Loading**: Verify data URLs are accessible

### Debug Mode

Enable console logging by adding debug statements:

```javascript
const gridLayer = new ScreenGridLayerGL({
  // ... other options
  onAggregate: (grid) => {
    console.log('Grid aggregated:', grid);
  },
  onHover: ({ cell }) => {
    console.log('Hovered cell:', cell);
  }
});
```

## Integration

### With Your Own Project

1. Copy `screengrid.js` to your project
2. Include MapLibre GL JS
3. Import and use the library:

```javascript
import { ScreenGridLayerGL } from './screengrid.js';

const gridLayer = new ScreenGridLayerGL({
  data: yourData,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.weight,
  cellSizePixels: 60
});

map.addLayer(gridLayer);
```

### With Build Tools

The library is ES6 module compatible and should work with:
- Webpack
- Vite
- Rollup
- Parcel
- Native ES6 modules
