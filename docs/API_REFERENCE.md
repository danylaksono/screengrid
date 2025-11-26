# API Reference

Complete reference documentation for all public APIs in ScreenGrid Library.

## Table of Contents

- [ScreenGridLayerGL](#screengridlayergl)
- [Configuration Options](#configuration-options)
- [GlyphUtilities](#glyphutilities)
- [ConfigManager](#configmanager)
- [Aggregator](#aggregator)
- [Projector](#projector)
- [CellQueryEngine](#cellqueryengine)
- [Legend](#legend)
- [CanvasManager](#canvasmanager)
- [Renderer](#renderer)
- [EventBinder](#eventbinder)
- [EventHandlers](#eventhandlers)
- [Data Normalization and Aggregation Procedure](#data-normalization-and-aggregation-procedure)

---

## ScreenGridLayerGL

Main orchestrator class that composes all modules. This is the primary interface for using the library.

### Constructor

```javascript
new ScreenGridLayerGL(options)
```

Creates a new ScreenGrid layer instance.

**Parameters:**
- `options` (Object, optional) - Configuration options. See [Configuration Options](#configuration-options) for details.

**Returns:** `ScreenGridLayerGL` instance

**Example:**
```javascript
const layer = new ScreenGridLayerGL({
  data: myData,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.value,
  cellSizePixels: 50
});
map.addLayer(layer);
```

---

### Properties

#### `id` (getter)
- **Type:** `string`
- **Description:** Unique identifier for the layer
- **Default:** `"screen-grid-layer"`

#### `type` (getter)
- **Type:** `string`
- **Description:** Always returns `"custom"` (required by MapLibre GL)

#### `renderingMode` (getter)
- **Type:** `string`
- **Description:** Always returns `"2d"` (indicates Canvas 2D rendering)

---

### Methods

#### `onAdd(map, gl)`

Called automatically by MapLibre GL when the layer is added to the map. You typically don't call this directly.

**Parameters:**
- `map` (Object) - MapLibre GL map instance
- `gl` (WebGLRenderingContext) - WebGL context

**Returns:** `void`

---

#### `prerender()`

Called automatically before each render. Projects points to screen space.

**Returns:** `void`

---

#### `render()`

Renders the grid layer to the canvas. Called automatically by MapLibre GL render loop.

**Returns:** `void`

**Note:** This method performs aggregation and drawing. For performance, avoid calling manually unless necessary.

---

#### `onRemove()`

Called automatically when the layer is removed from the map. Cleans up event bindings and canvas.

**Returns:** `void`

---

#### `setData(newData)`

Updates the data source for the layer.

**Parameters:**
- `newData` (Array) - New array of data points

**Returns:** `void`

**Example:**
```javascript
layer.setData(updatedData);
```

**Note:** Automatically re-projects points after updating data.

---

#### `setConfig(updates)`

Updates layer configuration with partial options.

**Parameters:**
- `updates` (Object) - Partial configuration object. Only include properties you want to change.

**Returns:** `void`

**Example:**
```javascript
layer.setConfig({
  cellSizePixels: 80,
  colorScale: (v) => [255 * v, 0, 0, 200],
  enableGlyphs: true
});
```

**Note:** Automatically re-projects points after updating config.

---

#### `getCellAt(point)`

Get cell information at a specific screen point.

**Parameters:**
- `point` (Object) - Point coordinates: `{x: number, y: number}` (screen pixels)

**Returns:** `Object|null` - Cell information object or `null` if no cell at point.

**Cell Object Structure:**
```javascript
{
  col: number,           // Grid column index
  row: number,           // Grid row index
  value: number,         // Aggregated value
  cellData: Array,       // Array of original data points in this cell
  x: number,             // Screen X coordinate (top-left of cell)
  y: number,             // Screen Y coordinate (top-left of cell)
  cellSize: number,      // Cell size in pixels
  index: number          // Linear index in grid array
}
```

**Example:**
```javascript
map.on('mousemove', (e) => {
  const cell = layer.getCellAt({ x: e.point.x, y: e.point.y });
  if (cell) {
    console.log(`Cell [${cell.col}, ${cell.row}]: ${cell.value}`);
    console.log(`Contains ${cell.cellData.length} data points`);
  }
});
```

---

#### `getCellsInBounds(bounds)`

Get all cells with data in a rectangular region.

**Parameters:**
- `bounds` (Object) - Bounding rectangle: `{minX: number, minY: number, maxX: number, maxY: number}` (screen pixels)

**Returns:** `Array<Object>` - Array of cell information objects (same structure as `getCellAt`)

**Example:**
```javascript
const cells = layer.getCellsInBounds({
  minX: 100,
  minY: 100,
  maxX: 500,
  maxY: 400
});

console.log(`Found ${cells.length} cells in region`);
cells.forEach(cell => {
  console.log(`Cell [${cell.col}, ${cell.row}]: ${cell.value}`);
});
```

---

#### `handleBrush(bounds, event)`

Trigger brush selection callback. Call this method from your brush UI implementation when a selection is complete.

**Parameters:**
- `bounds` (Object) - Selection bounds: `{minX: number, minY: number, maxX: number, maxY: number}` (screen pixels)
- `event` (Object, optional) - MapLibre event (optional)

**Returns:** `void`

**Note:** This method triggers the `onBrush` callback configured in the layer options. The brush selection UI (drawing the rectangle, handling mouse events) must be implemented by the user.

**Example:**
```javascript
// In your brush UI implementation:
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

---

#### `getGridStats()`

Get statistics about the current grid aggregation.

**Returns:** `Object|null` - Statistics object or `null` if grid not yet aggregated.

**Statistics Object:**
```javascript
{
  totalCells: number,      // Total number of cells in grid
  cellsWithData: number,    // Number of cells containing data
  maxValue: number,         // Maximum aggregated value
  minValue: number,         // Minimum aggregated value (excluding zeros)
  avgValue: number,         // Average value across cells with data
  totalValue: number        // Sum of all cell values
}
```

**Example:**
```javascript
const stats = layer.getGridStats();
if (stats) {
  console.log(`Grid: ${stats.cols}×${stats.rows} cells`);
  console.log(`${stats.cellsWithData} cells contain data`);
  console.log(`Value range: ${stats.minValue} - ${stats.maxValue}`);
}
```

---

### Static Methods (Glyph Utilities)

These are convenience aliases to `GlyphUtilities` methods. See [GlyphUtilities](#glyphutilities) for detailed documentation.

```javascript
ScreenGridLayerGL.drawCircleGlyph(ctx, x, y, radius, color, alpha)
ScreenGridLayerGL.drawBarGlyph(ctx, x, y, values, maxValue, cellSize, colors)
ScreenGridLayerGL.drawPieGlyph(ctx, x, y, values, radius, colors)
ScreenGridLayerGL.drawScatterGlyph(ctx, x, y, points, cellSize, color)
ScreenGridLayerGL.drawDonutGlyph(ctx, x, y, values, outerRadius, innerRadius, colors)
ScreenGridLayerGL.drawHeatmapGlyph(ctx, x, y, radius, normalizedValue, colorScale)
ScreenGridLayerGL.drawRadialBarGlyph(ctx, x, y, values, maxValue, maxRadius, color)
ScreenGridLayerGL.drawTimeSeriesGlyph(ctx, x, y, timeSeriesData, cellSize, options)
```

---

## Configuration Options

Options passed to `ScreenGridLayerGL` constructor or `setConfig()`.

### Basic Options

#### `id`
- **Type:** `string`
- **Default:** `"screen-grid-layer"`
- **Description:** Unique identifier for the layer

#### `data`
- **Type:** `Array`
- **Default:** `[]`
- **Description:** Array of data points to aggregate

#### `getPosition`
- **Type:** `Function`
- **Default:** `(d) => d.coordinates`
- **Description:** Function to extract `[lng, lat]` coordinates from a data point
- **Parameters:** `(dataPoint) => [lng, lat]`

**Example:**
```javascript
getPosition: (d) => [d.longitude, d.latitude]
// or
getPosition: (d) => d.location
```

#### `getWeight`
- **Type:** `Function`
- **Default:** `() => 1`
- **Description:** Function to extract weight/value from a data point
- **Parameters:** `(dataPoint) => number`

**Example:**
```javascript
getWeight: (d) => d.population
// or
getWeight: (d) => d.count || 1
```

#### `cellSizePixels`
- **Type:** `number`
- **Default:** `50`
- **Description:** Size of each grid cell in pixels

#### `colorScale`
- **Type:** `Function`
- **Default:** `(v) => [255 * v, 100, 200, 200]`
- **Description:** Color scale function that maps normalized value (0-1) to RGBA color
- **Parameters:** `(normalizedValue: number) => [r, g, b, a]`
  - `normalizedValue`: Value between 0 and 1
  - Returns: Array of `[red, green, blue, alpha]` where each component is 0-255

**Example:**
```javascript
// Heatmap (red to yellow)
colorScale: (v) => [255 * v, 200 * (1 - v), 50, 220]

// Blue scale
colorScale: (v) => [50, 100, 255 * v, 220]

// Custom gradient
colorScale: (v) => {
  const r = Math.floor(255 * Math.sin(v * Math.PI));
  const g = Math.floor(255 * Math.cos(v * Math.PI));
  const b = Math.floor(255 * v);
  return [r, g, b, 200];
}
```

---

### Glyph Options

#### `enableGlyphs`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Enable glyph-based rendering instead of color-based rendering

#### `onDrawCell`
- **Type:** `Function|null`
- **Default:** `null`
- **Description:** Callback function for custom glyph drawing
- **Parameters:** `(ctx, x, y, normVal, cellInfo) => void`
  - `ctx`: Canvas 2D rendering context
  - `x`, `y`: Center coordinates of the cell
  - `normVal`: Normalized value (0-1)
  - `cellInfo`: Object with cell information (see below)

**cellInfo Object:**
```javascript
{
  cellData: Array,        // Array of original data points in this cell
  cellSize: number,      // Size of the cell in pixels
  glyphRadius: number,   // Recommended radius for glyph drawing
  normalizedValue: number, // Same as normVal
  col: number,           // Grid column index
  row: number,           // Grid row index
  value: number          // Raw aggregated value
}
```

**Example:**
```javascript
onDrawCell: (ctx, x, y, normVal, cellInfo) => {
  const { cellData, glyphRadius } = cellInfo;
  const total = cellData.reduce((sum, item) => sum + item.data.value, 0);
  
  ctx.fillStyle = `hsl(${normVal * 360}, 70%, 50%)`;
  ctx.beginPath();
  ctx.arc(x, y, glyphRadius, 0, 2 * Math.PI);
  ctx.fill();
}
```

#### `glyphSize`
- **Type:** `number`
- **Default:** `0.8`
- **Description:** Size of glyphs relative to cell size (0-1). Multiplied by cell size to get glyph radius.

---

### Adaptive Sizing Options

#### `adaptiveCellSize`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Enable adaptive cell sizing (not yet fully implemented)

#### `minCellSize`
- **Type:** `number`
- **Default:** `20`
- **Description:** Minimum cell size in pixels (used with `zoomBasedSize`)

#### `maxCellSize`
- **Type:** `number`
- **Default:** `100`
- **Description:** Maximum cell size in pixels (used with `zoomBasedSize`)

#### `zoomBasedSize`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Adjust cell size based on zoom level. Cells shrink as you zoom in.

---

### Event Callbacks

#### `onAggregate`
- **Type:** `Function|null`
- **Default:** `null`
- **Description:** Callback when grid is aggregated
- **Parameters:** `(gridData) => void`

**gridData Object:**
```javascript
{
  grid: Array<number>,      // Array of aggregated values
  cellData: Array<Array>,   // 2D array of original data points per cell
  cols: number,             // Number of columns
  rows: number,             // Number of rows
  width: number,            // Canvas width
  height: number,           // Canvas height
  cellSizePixels: number    // Cell size used
}
```

**Example:**
```javascript
onAggregate: (gridData) => {
  console.log(`Grid: ${gridData.cols}×${gridData.rows}`);
  console.log(`Max value: ${Math.max(...gridData.grid)}`);
}
```

#### `onHover`
- **Type:** `Function|null`
- **Default:** `null`
- **Description:** Callback when hovering over a grid cell
- **Parameters:** `({cell, event}) => void`
  - `cell`: Cell information object (same as `getCellAt` return value)
  - `event`: MapLibre mouse event

**Example:**
```javascript
onHover: ({ cell, event }) => {
  if (cell) {
    console.log(`Hovering over cell [${cell.col}, ${cell.row}]`);
    console.log(`Value: ${cell.value}`);
    console.log(`Contains ${cell.cellData.length} points`);
  }
}
```

#### `onClick`
- **Type:** `Function|null`
- **Default:** `null`
- **Description:** Callback when clicking a grid cell
- **Parameters:** `({cell, event}) => void` (same as `onHover`)

**Example:**
```javascript
onClick: ({ cell, event }) => {
  if (cell) {
    console.log(`Clicked cell [${cell.col}, ${cell.row}]`);
    console.log(`Value: ${cell.value}`);
  }
}
```

---

#### `onBrush`
- **Type:** `Function|null`
- **Default:** `null`
- **Description:** Callback when brush selection completes (rectangular selection)
- **Parameters:** `({cells, bounds, event}) => void`
  - `cells`: Array of cell information objects within the selection
  - `bounds`: Selection bounds: `{minX: number, minY: number, maxX: number, maxY: number}`
  - `event`: Optional MapLibre event

**Note:** Brush selection UI must be implemented by the user. The library only provides the callback mechanism. Call `layer.handleBrush(bounds, event)` from your brush UI implementation.

**Example:**
```javascript
// In your brush UI implementation:
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

// Configure the callback
const layer = new ScreenGridLayerGL({
  data: myData,
  onBrush: ({ cells, bounds, event }) => {
    console.log(`Selected ${cells.length} cells`);
    console.log(`Bounds:`, bounds);
    // Process selected cells...
  }
});
```

---

#### `onZoom`
- **Type:** `Function|null`
- **Default:** `null`
- **Description:** Callback when map zoom changes
- **Parameters:** `(zoomData) => void` (enhanced callback with map state)

**Callback Data Object:**
```javascript
{
  zoom: number,              // Current zoom level
  center: {lng: number, lat: number}, // Current map center
  bounds: {                  // Current map bounds
    north: number,
    south: number,
    east: number,
    west: number
  },
  previousZoom: number,       // Previous zoom level (if available)
  previousCenter: {lng: number, lat: number}, // Previous center (if available)
  previousBounds: {           // Previous bounds (if available)
    north: number,
    south: number,
    east: number,
    west: number
  }
}
```

**Example:**
```javascript
onZoom: (zoomData) => {
  console.log(`Zoom changed from ${zoomData.previousZoom} to ${zoomData.zoom}`);
  console.log(`Center:`, zoomData.center);
  // Handle zoom change...
}
```

**Note:** The callback is backward compatible. Old callbacks that don't expect parameters will still work (they'll receive the enhanced data but can ignore it).

---

#### `onMove`
- **Type:** `Function|null`
- **Default:** `null`
- **Description:** Callback when map pan/move changes
- **Parameters:** `(moveData) => void` (enhanced callback with map state)

**Callback Data Object:**
```javascript
{
  center: {lng: number, lat: number}, // Current map center
  bounds: {                  // Current map bounds
    north: number,
    south: number,
    east: number,
    west: number
  },
  previousCenter: {lng: number, lat: number}, // Previous center (if available)
  previousBounds: {           // Previous bounds (if available)
    north: number,
    south: number,
    east: number,
    west: number
  }
}
```

**Example:**
```javascript
onMove: (moveData) => {
  console.log(`Map moved to:`, moveData.center);
  console.log(`Previous center:`, moveData.previousCenter);
  // Handle map movement...
}
```

**Note:** The callback is backward compatible. Old callbacks that don't expect parameters will still work (they'll receive the enhanced data but can ignore it).

---

#### `onDrawCell`
  if (cell) {
    showDetailsModal(cell.cellData);
  }
}
```

---

### Other Options

#### `enabled`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Whether the layer is enabled (rendered)

---

## GlyphUtilities

Static utility class for drawing common glyph types. Can be imported directly or accessed via `ScreenGridLayerGL` static methods.

### Import

```javascript
import { GlyphUtilities } from 'screengrid';
```

---

### Methods

#### `drawCircleGlyph(ctx, x, y, radius, color, alpha)`

Draw a simple circle glyph.

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas 2D context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `radius` (number) - Circle radius in pixels
- `color` (string, optional) - Fill color (CSS color string). Default: `'#ff0000'`
- `alpha` (number, optional) - Opacity (0-1). Default: `0.8`

**Returns:** `void`

**Example:**
```javascript
GlyphUtilities.drawCircleGlyph(ctx, 100, 100, 20, '#3498db', 0.8);
```

---

#### `drawBarGlyph(ctx, x, y, values, maxValue, cellSize, colors)`

Draw a horizontal bar chart glyph showing multiple values.

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `values` (Array<number>) - Array of numeric values to display
- `maxValue` (number) - Maximum value for scaling
- `cellSize` (number) - Cell size in pixels
- `colors` (Array<string>, optional) - Array of colors for bars. Default: `['#ff6b6b', '#4ecdc4', '#45b7d1']`

**Returns:** `void`

**Example:**
```javascript
GlyphUtilities.drawBarGlyph(
  ctx, x, y,
  [10, 25, 15],      // values
  30,                // maxValue
  50,                // cellSize
  ['#e74c3c', '#3498db', '#2ecc71']  // colors
);
```

---

#### `drawPieGlyph(ctx, x, y, values, radius, colors)`

Draw a pie chart glyph showing proportions.

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `values` (Array<number>) - Array of numeric values for slices
- `radius` (number) - Pie radius in pixels
- `colors` (Array<string>, optional) - Array of colors for slices. Default: `['#ff6b6b', '#4ecdc4', '#45b7d1']`

**Returns:** `void`

**Example:**
```javascript
GlyphUtilities.drawPieGlyph(
  ctx, x, y,
  [30, 20, 10],      // values
  15,                // radius
  ['#e74c3c', '#3498db', '#2ecc71']  // colors
);
```

---

#### `drawDonutGlyph(ctx, x, y, values, outerRadius, innerRadius, colors)`

Draw a donut chart glyph (pie chart with central hole).

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `values` (Array<number>) - Array of numeric values
- `outerRadius` (number) - Outer radius in pixels
- `innerRadius` (number) - Inner radius (hole size) in pixels
- `colors` (Array<string>, optional) - Array of colors. Default: `['#ff6b6b', '#4ecdc4', '#45b7d1']`

**Returns:** `void`

**Example:**
```javascript
GlyphUtilities.drawDonutGlyph(
  ctx, x, y,
  [30, 20, 10],      // values
  20,                // outerRadius
  10,                // innerRadius
  ['#e74c3c', '#3498db', '#2ecc71']
);
```

---

#### `drawScatterGlyph(ctx, x, y, points, cellSize, color)`

Draw a scatter plot glyph showing individual data points.

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `points` (Array<Object>) - Array of point objects with `weight` property
- `cellSize` (number) - Cell size in pixels
- `color` (string, optional) - Point color. Default: `'#ff0000'`

**Returns:** `void`

**Example:**
```javascript
GlyphUtilities.drawScatterGlyph(
  ctx, x, y,
  cellData,  // Array of {data, weight, ...} objects
  50,        // cellSize
  '#e74c3c'  // color
);
```

---

#### `drawHeatmapGlyph(ctx, x, y, radius, normalizedValue, colorScale)`

Draw a heatmap-style glyph with color intensity based on normalized value.

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `radius` (number) - Circle radius in pixels
- `normalizedValue` (number) - Normalized value (0-1)
- `colorScale` (Function) - Function that maps value to color: `(value: number) => string`

**Returns:** `void`

**Example:**
```javascript
GlyphUtilities.drawHeatmapGlyph(
  ctx, x, y,
  15,        // radius
  0.75,      // normalizedValue
  (v) => `hsl(${v * 240}, 70%, 50%)`  // colorScale
);
```

---

#### `drawRadialBarGlyph(ctx, x, y, values, maxValue, maxRadius, color)`

Draw a radial bar glyph (bars radiating from center, like a radar chart).

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `values` (Array<number>) - Array of values
- `maxValue` (number) - Maximum value for scaling
- `maxRadius` (number) - Maximum bar length (radius)
- `color` (string, optional) - Bar color. Default: `'#ff0000'`

**Returns:** `void`

**Example:**
```javascript
GlyphUtilities.drawRadialBarGlyph(
  ctx, x, y,
  [10, 20, 15, 25],  // values
  30,                 // maxValue
  20,                 // maxRadius
  '#3498db'          // color
);
```

---

#### `drawTimeSeriesGlyph(ctx, x, y, timeSeriesData, cellSize, options)`

Draw a time series line chart glyph showing temporal trends.

**Parameters:**
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `x` (number) - Center X coordinate
- `y` (number) - Center Y coordinate
- `timeSeriesData` (Array<Object>) - Array of `{year: number, value: number}` objects, sorted by year
- `cellSize` (number) - Cell size in pixels
- `options` (Object, optional) - Configuration options

**Options Object:**
```javascript
{
  lineColor: string,        // Line color. Default: '#3498db'
  pointColor: string,       // Data point color. Default: '#e74c3c'
  lineWidth: number,        // Line width. Default: 2
  pointRadius: number,      // Point radius. Default: 2
  showPoints: boolean,      // Show data points. Default: true
  showArea: boolean,        // Fill area under line. Default: false
  areaColor: string,       // Area fill color. Default: 'rgba(52, 152, 219, 0.2)'
  padding: number           // Padding as fraction of cellSize. Default: 0.1
}
```

**Returns:** `void`

**Example:**
```javascript
const timeSeriesData = [
  { year: 2020, value: 10 },
  { year: 2021, value: 15 },
  { year: 2022, value: 12 },
  { year: 2023, value: 20 }
];

GlyphUtilities.drawTimeSeriesGlyph(
  ctx, x, y,
  timeSeriesData,
  50,  // cellSize
  {
    lineColor: '#2ecc71',
    pointColor: '#27ae60',
    lineWidth: 2,
    showPoints: true,
    showArea: true,
    areaColor: 'rgba(46, 204, 113, 0.15)',
    padding: 0.15
  }
);
```

---

## ConfigManager

Static utility class for managing configuration with defaults and validation.

### Import

```javascript
import { ConfigManager } from 'screengrid';
```

---

### Methods

#### `create(options)`

Create configuration from user options merged with defaults.

**Parameters:**
- `options` (Object, optional) - User-provided configuration options

**Returns:** `Object` - Merged configuration object

**Example:**
```javascript
const config = ConfigManager.create({
  data: myData,
  cellSizePixels: 60
});
// config now has all defaults plus user options
```

---

#### `update(config, updates)`

Update configuration with partial options.

**Parameters:**
- `config` (Object) - Current configuration
- `updates` (Object) - Partial configuration updates

**Returns:** `Object` - Updated configuration object

**Example:**
```javascript
const updatedConfig = ConfigManager.update(config, {
  cellSizePixels: 80,
  enableGlyphs: true
});
```

---

#### `isValid(config)`

Validate configuration structure.

**Parameters:**
- `config` (Object) - Configuration to validate

**Returns:** `boolean` - `true` if valid, `false` otherwise

**Example:**
```javascript
if (ConfigManager.isValid(config)) {
  // Configuration is valid
}
```

---

## Aggregator

Pure business logic class for aggregating points into grid cells.

### Import

```javascript
import { Aggregator } from 'screengrid';
```

---

### Static Methods

#### `aggregate(projectedPoints, originalData, width, height, cellSizePixels)`

Aggregate projected points into a grid.

**Parameters:**
- `projectedPoints` (Array<Object>) - Array of projected points: `{x: number, y: number, w: number}`
- `originalData` (Array) - Original data array for reference
- `width` (number) - Canvas width in pixels
- `height` (number) - Canvas height in pixels
- `cellSizePixels` (number) - Size of each grid cell

**Returns:** `Object` - Aggregation result:
```javascript
{
  grid: Array<number>,        // Array of aggregated values
  cellData: Array<Array>,    // 2D array of original data points per cell
  cols: number,               // Number of columns
  rows: number,               // Number of rows
  width: number,              // Canvas width
  height: number,             // Canvas height
  cellSizePixels: number      // Cell size used
}
```

**Example:**
```javascript
const projectedPoints = [
  { x: 100, y: 200, w: 1.5 },
  { x: 150, y: 250, w: 2.0 }
];

const result = Aggregator.aggregate(
  projectedPoints,
  originalData,
  800,  // width
  600,  // height
  50    // cellSizePixels
);
```

---

#### `getStats(aggregationResult)`

Get statistics about a grid aggregation.

**Parameters:**
- `aggregationResult` (Object) - Result from `aggregate()` method

**Returns:** `Object` - Statistics:
```javascript
{
  totalCells: number,      // Total number of cells
  cellsWithData: number,   // Number of cells with data
  maxValue: number,        // Maximum value
  minValue: number,        // Minimum value (excluding zeros)
  avgValue: number,        // Average value
  totalValue: number       // Sum of all values
}
```

**Example:**
```javascript
const stats = Aggregator.getStats(result);
console.log(`Found ${stats.cellsWithData} cells with data`);
console.log(`Max value: ${stats.maxValue}`);
```

---

### Instance Methods

#### `aggregate(projectedPoints, originalData, width, height, cellSizePixels)`

Instance method that calls the static method. Same parameters and return value.

#### `getStats(aggregationResult)`

Instance method that calls the static method. Same parameters and return value.

---

## Projector

Pure function class for projecting geographic coordinates to screen space.

### Import

```javascript
import { Projector } from 'screengrid';
```

---

### Static Methods

#### `projectPoints(data, getPosition, getWeight, map)`

Project geographic coordinates to screen space.

**Parameters:**
- `data` (Array) - Array of data points
- `getPosition` (Function) - Function to extract `[lng, lat]` from data point: `(d) => [lng, lat]`
- `getWeight` (Function) - Function to extract weight from data point: `(d) => number`
- `map` (Object) - MapLibre GL map instance

**Returns:** `Array<Object>` - Array of projected points: `{x: number, y: number, w: number}`

**Example:**
```javascript
const projected = Projector.projectPoints(
  myData,
  (d) => d.coordinates,
  (d) => d.value,
  map
);
```

---

### Instance Methods

#### `constructor(map)`

Create a new Projector instance.

**Parameters:**
- `map` (Object, optional) - MapLibre GL map instance

#### `setMap(map)`

Set the map reference.

**Parameters:**
- `map` (Object) - MapLibre GL map instance

#### `project(data, getPosition, getWeight)`

Project points using stored map reference.

**Parameters:**
- `data` (Array) - Data points to project
- `getPosition` (Function) - Position extractor: `(d) => [lng, lat]`
- `getWeight` (Function) - Weight extractor: `(d) => number`

**Returns:** `Array<Object>` - Projected points

**Example:**
```javascript
const projector = new Projector(map);
const projected = projector.project(
  myData,
  (d) => d.coordinates,
  (d) => d.value
);
```

---

## CellQueryEngine

Query engine for finding and accessing grid cells.

### Import

```javascript
import { CellQueryEngine } from 'screengrid';
```

---

### Static Methods

#### `getCellAt(aggregationResult, point)`

Get cell information at a specific point.

**Parameters:**
- `aggregationResult` (Object) - Result from `Aggregator.aggregate()`
- `point` (Object) - Point coordinates: `{x: number, y: number}`

**Returns:** `Object|null` - Cell information object (see `ScreenGridLayerGL.getCellAt`)

---

#### `getCellsInBounds(aggregationResult, bounds)`

Get all cells with data in a rectangular region.

**Parameters:**
- `aggregationResult` (Object) - Aggregation result
- `bounds` (Object) - Bounding rectangle: `{minX: number, minY: number, maxX: number, maxY: number}`

**Returns:** `Array<Object>` - Array of cell information objects

---

#### `getCellsAboveThreshold(aggregationResult, threshold)`

Get all cells with values above a threshold.

**Parameters:**
- `aggregationResult` (Object) - Aggregation result
- `threshold` (number) - Minimum value

**Returns:** `Array<Object>` - Array of cell information objects

---

#### `getCellsByAttribute(aggregationResult, filterFn)`

Get all cells that contain data points matching an attribute filter.

**Parameters:**
- `aggregationResult` (Object) - Aggregation result
- `filterFn` (Function) - Filter function: `(dataPoint) => boolean`
  - Receives the original data point object from `cellData[].data`

**Returns:** `Array<Object>` - Array of cell information objects

**Example:**
```javascript
// Filter cells containing restaurants with rating > 4
const cells = CellQueryEngine.getCellsByAttribute(
  aggregationResult,
  (data) => data.rating > 4
);

// Filter cells containing points in a specific category
const cells = CellQueryEngine.getCellsByAttribute(
  aggregationResult,
  (data) => data.category === 'restaurant'
);
```

---

#### `getCellsByTimeRange(aggregationResult, timeExtractor, minTime, maxTime)`

Get all cells that contain data points within a time range.

**Parameters:**
- `aggregationResult` (Object) - Aggregation result
- `timeExtractor` (Function|string) - Function to extract time from data point, or property name
  - If function: `(dataPoint) => number|Date`
  - If string: property name to access (e.g., `'year'`, `'timestamp'`)
- `minTime` (number|Date) - Minimum time (inclusive)
- `maxTime` (number|Date) - Maximum time (inclusive)

**Returns:** `Array<Object>` - Array of cell information objects

**Example:**
```javascript
// Filter cells with data from 2020-2022
const cells = CellQueryEngine.getCellsByTimeRange(
  aggregationResult,
  (data) => data.year,
  2020,
  2022
);

// Using property name
const cells = CellQueryEngine.getCellsByTimeRange(
  aggregationResult,
  'timestamp',
  new Date('2020-01-01'),
  new Date('2022-12-31')
);
```

---

#### `getCellsByMultipleFilters(aggregationResult, filters)`

Get all cells that match multiple filter criteria. Combines multiple filter types (attribute, time, spatial, value threshold).

**Parameters:**
- `aggregationResult` (Object) - Aggregation result
- `filters` (Object) - Filter configuration object
  - `filters.attribute` (Function, optional) - Attribute filter function: `(dataPoint) => boolean`
  - `filters.time` (Object, optional) - Time range filter: `{extractor: Function|string, min: number|Date, max: number|Date}`
  - `filters.bounds` (Object, optional) - Spatial bounds filter: `{minX: number, minY: number, maxX: number, maxY: number}`
  - `filters.threshold` (number, optional) - Value threshold filter (minimum aggregated value)
  - `filters.matchMode` (string, optional) - How to combine filters: `'all'` (AND) or `'any'` (OR), default: `'all'`

**Returns:** `Array<Object>` - Array of cell information objects

**Example:**
```javascript
// Filter cells matching ALL criteria: high value, in bounds, from 2020-2022
const cells = CellQueryEngine.getCellsByMultipleFilters(aggregationResult, {
  threshold: 50,
  bounds: { minX: 0, minY: 0, maxX: 400, maxY: 300 },
  time: {
    extractor: (data) => data.year,
    min: 2020,
    max: 2022
  },
  matchMode: 'all'
});

// Filter cells matching ANY criteria: high value OR in specific category
const cells = CellQueryEngine.getCellsByMultipleFilters(aggregationResult, {
  threshold: 100,
  attribute: (data) => data.category === 'restaurant',
  matchMode: 'any'
});
```

---

### Instance Methods

#### `constructor(aggregationResult)`

Create a new CellQueryEngine instance.

**Parameters:**
- `aggregationResult` (Object, optional) - Initial aggregation result

#### `setAggregationResult(aggregationResult)`

Set the aggregation result for queries.

**Parameters:**
- `aggregationResult` (Object) - Aggregation result

#### `getCellAt(point)`

Query cell at point using stored result.

**Parameters:**
- `point` (Object) - `{x: number, y: number}`

**Returns:** `Object|null` - Cell information

#### `getCellsInBounds(bounds)`

Query cells in bounds using stored result.

**Parameters:**
- `bounds` (Object) - Bounding rectangle

**Returns:** `Array<Object>` - Cells in bounds

#### `getCellsAboveThreshold(threshold)`

Query cells above threshold using stored result.

**Parameters:**
- `threshold` (number) - Threshold value

**Returns:** `Array<Object>` - Cells above threshold

---

#### `getCellsByAttribute(filterFn)`

Query cells by attribute filter using stored result.

**Parameters:**
- `filterFn` (Function) - Filter function: `(dataPoint) => boolean`

**Returns:** `Array<Object>` - Cells matching attribute filter

---

#### `getCellsByTimeRange(timeExtractor, minTime, maxTime)`

Query cells by time range using stored result.

**Parameters:**
- `timeExtractor` (Function|string) - Time extractor function or property name
- `minTime` (number|Date) - Minimum time (inclusive)
- `maxTime` (number|Date) - Maximum time (inclusive)

**Returns:** `Array<Object>` - Cells within time range

---

#### `getCellsByMultipleFilters(filters)`

Query cells by multiple filters using stored result.

**Parameters:**
- `filters` (Object) - Filter configuration object (see static method documentation)

**Returns:** `Array<Object>` - Cells matching filters

---

## Legend

Main Legend class for rendering data-driven legends.

### Import

```javascript
import { Legend } from 'screengrid';
```

---

### Constructor

```javascript
new Legend(options)
```

**Parameters:**
- `options` (Object) - Configuration options:
  - `layer` (ScreenGridLayerGL) - ScreenGridLayerGL instance to connect to
  - `type` (string, optional) - Legend type: `'color-scale'`, `'categorical'`, `'temporal'`, `'size-scale'`, `'auto'`, `'multi'`. Default: `'auto'`
  - `position` (string, optional) - Position: `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`. Default: `'bottom-right'`
  - `title` (string, optional) - Legend title. Default: `'Legend'`
  - `container` (HTMLElement, optional) - Custom container element
  - `renderOptions` (Object, optional) - Options passed to renderers
  - `categoryExtractor` (Function, optional) - Function to extract category from data (for categorical)
  - `valueExtractor` (Function, optional) - Function to extract value from data
  - `timeExtractor` (Function, optional) - Function to extract time/year from data (for temporal)
  - `sizeExtractor` (Function, optional) - Function to extract size from data (for size-scale)

**Returns:** `Legend` instance

**Example:**
```javascript
const legend = new Legend({
  layer: gridLayer,
  type: 'auto',
  position: 'bottom-right',
  title: 'Data Legend'
});
```

---

### Methods

#### `update(gridData, config)`

Update legend with new data.

**Parameters:**
- `gridData` (Object) - Aggregation result from ScreenGridLayerGL
- `config` (Object) - ScreenGridLayerGL config

**Returns:** `void`

#### `show()`

Show the legend.

**Returns:** `void`

#### `hide()`

Hide the legend.

**Returns:** `void`

#### `remove()`

Remove the legend from DOM.

**Returns:** `void`

#### `setPosition(position)`

Update legend position.

**Parameters:**
- `position` (string) - New position: `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`

**Returns:** `void`

#### `setTitle(title)`

Update legend title.

**Parameters:**
- `title` (string) - New title

**Returns:** `void`

---

## CanvasManager

Manages canvas creation, sizing, and cleanup. Typically used internally by `ScreenGridLayerGL`.

### Import

```javascript
import { CanvasManager } from 'screengrid';
```

---

### Methods

#### `init(map)`

Initialize the canvas overlay.

**Parameters:**
- `map` (Object) - MapLibre GL map instance

**Throws:** `Error` if canvas cannot be initialized

**Returns:** `void`

#### `getContext()`

Get the 2D rendering context.

**Returns:** `CanvasRenderingContext2D`

#### `getCanvas()`

Get the overlay canvas element.

**Returns:** `HTMLCanvasElement`

#### `resize()`

Resize canvas to match map canvas with DPI scaling.

**Returns:** `void`

#### `clear()`

Clear the canvas.

**Returns:** `void`

#### `getDisplaySize()`

Get canvas dimensions in CSS pixels.

**Returns:** `Object` - `{width: number, height: number}`

#### `cleanup()`

Clean up resources.

**Returns:** `void`

---

## Renderer

Canvas drawing logic for grid cells. Typically used internally by `ScreenGridLayerGL`.

### Import

```javascript
import { Renderer } from 'screengrid';
```

---

### Static Methods

#### `render(aggregationResult, ctx, config)`

Render grid cells to canvas.

**Parameters:**
- `aggregationResult` (Object) - Result from `Aggregator.aggregate()`
- `ctx` (CanvasRenderingContext2D) - Canvas 2D context
- `config` (Object) - Configuration:
  - `colorScale` (Function) - Color function: `(normalizedValue) => [r, g, b, a]`
  - `enableGlyphs` (boolean) - Enable glyph rendering
  - `onDrawCell` (Function) - Custom glyph drawing callback
  - `glyphSize` (number) - Glyph size factor

**Returns:** `void`

#### `renderGlyphs(aggregationResult, ctx, onDrawCell, glyphSize)`

Render with glyph mode enabled.

**Parameters:**
- `aggregationResult` (Object) - Aggregation result
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `onDrawCell` (Function) - Glyph drawing callback
- `glyphSize` (number, optional) - Glyph size (0-1). Default: `0.8`

**Returns:** `void`

#### `renderColors(aggregationResult, ctx, colorScale)`

Render with color mode enabled.

**Parameters:**
- `aggregationResult` (Object) - Aggregation result
- `ctx` (CanvasRenderingContext2D) - Canvas context
- `colorScale` (Function) - Color scale function

**Returns:** `void`

---

## EventBinder

Manages event binding and unbinding. Typically used internally by `ScreenGridLayerGL`.

### Import

```javascript
import { EventBinder } from 'screengrid';
```

---

### Methods

#### `bind(map, eventHandlers)`

Bind events to the map.

**Parameters:**
- `map` (Object) - MapLibre map instance
- `eventHandlers` (Object) - Object with handler methods:
  - `handleHover` (Function) - Hover handler
  - `handleClick` (Function) - Click handler
  - `handleZoom` (Function) - Zoom handler
  - `handleMove` (Function) - Move handler

**Returns:** `void`

#### `unbind()`

Unbind events from the map.

**Returns:** `void`

#### `bindEvent(eventName, handler)`

Bind a specific event.

**Parameters:**
- `eventName` (string) - Event name (e.g., `'mousemove'`, `'click'`)
- `handler` (Function) - Handler function

**Returns:** `void`

#### `unbindEvent(eventName)`

Unbind a specific event.

**Parameters:**
- `eventName` (string) - Event name

**Returns:** `void`

---

## EventHandlers

Event handler implementations. Typically used internally by `ScreenGridLayerGL`.

### Import

```javascript
import { EventHandlers } from 'screengrid';
```

---

### Static Methods

#### `handleHover(event, cellQueryEngine, onHover)`

Handle hover events.

**Parameters:**
- `event` (Object) - MapLibre mouse event
- `cellQueryEngine` (CellQueryEngine) - CellQueryEngine instance
- `onHover` (Function) - Hover callback from config

**Returns:** `void`

#### `handleClick(event, cellQueryEngine, onClick)`

Handle click events.

**Parameters:**
- `event` (Object) - MapLibre click event
- `cellQueryEngine` (CellQueryEngine) - CellQueryEngine instance
- `onClick` (Function) - Click callback from config

**Returns:** `void`

#### `handleZoom(map, config, onZoom, previousState)`

Handle zoom events with enhanced callback data.

**Parameters:**
- `map` (Object) - MapLibre map instance
- `config` (Object) - Layer configuration
- `onZoom` (Function) - Callback after zoom handling. Receives enhanced data: `{zoom, center, bounds, previousZoom, previousCenter, previousBounds}`
- `previousState` (Object, optional) - Previous map state: `{zoom, center, bounds}`

**Returns:** `void`

**Note:** The callback receives enhanced data with current and previous map state. Old callbacks that don't expect parameters are backward compatible.

#### `handleMove(map, onMove, previousState)`

Handle move events with enhanced callback data.

**Parameters:**
- `map` (Object) - MapLibre map instance
- `onMove` (Function) - Callback when map moves. Receives enhanced data: `{center, bounds, previousCenter, previousBounds}`
- `previousState` (Object, optional) - Previous map state: `{center, bounds}`

**Returns:** `void`

**Note:** The callback receives enhanced data with current and previous map state. Old callbacks that don't expect parameters are backward compatible.

#### `handleBrush(queryTarget, bounds, onBrush, event)`

Handle brush selection events.

**Parameters:**
- `queryTarget` (Object) - CellQueryEngine instance or ScreenGridLayerGL layer
- `bounds` (Object) - Selection bounds: `{minX: number, minY: number, maxX: number, maxY: number}`
- `onBrush` (Function) - Brush callback. Receives: `{cells, bounds, event}`
- `event` (Object, optional) - MapLibre event

**Returns:** `void`

**Note:** Brush selection UI must be implemented by the user. This method is called from the user's brush implementation via `layer.handleBrush(bounds, event)`.

---

## Data Normalization and Aggregation Procedure

Understanding how ScreenGrid processes data is crucial for effective visualization. This section explains the complete pipeline from raw data to rendered cells.

### Overview

The library processes data through three main stages:

1. **Projection**: Geographic coordinates → Screen coordinates
2. **Aggregation**: Screen points → Grid cells (summing weights)
3. **Normalization**: Raw cell values → Normalized values (0-1) for rendering

---

### Stage 1: Projection

**Purpose:** Transform geographic coordinates `[lng, lat]` to screen pixel coordinates `{x, y}`.

**Process:**
```javascript
// For each data point:
const [lng, lat] = getPosition(dataPoint);
const screenPoint = map.project([lng, lat]);
const weight = getWeight(dataPoint);

// Result: {x: screenPoint.x, y: screenPoint.y, w: weight}
```

**Example:**
```javascript
// Input data:
[
  { coordinates: [-122.4, 37.74], population: 1000 },
  { coordinates: [-122.5, 37.75], population: 2000 }
]

// After projection (example screen coordinates):
[
  { x: 400, y: 300, w: 1000 },
  { x: 450, y: 350, w: 2000 }
]
```

**Key Points:**
- Uses MapLibre's `map.project()` method
- Screen coordinates update automatically when map moves/zooms
- Each point retains its weight value (`w`)

---

### Stage 2: Aggregation

**Purpose:** Assign projected points to grid cells and sum their weights.

**Algorithm:**

1. **Calculate Grid Dimensions:**
   ```javascript
   const cols = Math.ceil(canvasWidth / cellSizePixels);
   const rows = Math.ceil(canvasHeight / cellSizePixels);
   // Example: 800px width, 50px cells → 16 columns
   ```

2. **Determine Cell Assignment:**
   ```javascript
   // For each projected point {x, y, w}:
   const col = Math.floor(x / cellSizePixels);
   const row = Math.floor(y / cellSizePixels);
   const cellIndex = row * cols + col;
   ```

3. **Sum Weights:**
   ```javascript
   // All points in the same cell have their weights summed:
   grid[cellIndex] += weight;
   
   // Original data is also stored:
   cellData[cellIndex].push({
     data: originalDataPoint,
     weight: weight,
     projectedX: x,
     projectedY: y
   });
   ```

**Mathematical Example:**

Given:
- Canvas: 800×600 pixels
- Cell size: 50 pixels
- Grid: 16 columns × 12 rows

Projected points:
```
Point A: {x: 75, y: 125, w: 10}   → Cell [1, 2]
Point B: {x: 80, y: 130, w: 5}    → Cell [1, 2]  (same cell!)
Point C: {x: 200, y: 300, w: 20}  → Cell [4, 6]
```

Result:
```
grid[1 * 16 + 2] = 10 + 5 = 15  // Cell [1, 2]
grid[4 * 16 + 6] = 20           // Cell [4, 6]
```

**Aggregation Function:**

The library uses **summation** as the aggregation function:

```javascript
cellValue = Σ(weights of all points in cell)
```

**Why Summation?**

- Intuitive for counts, populations, totals
- Preserves magnitude information
- Works well with weighted data

**Custom Aggregation:**

If you need different aggregation (average, max, etc.), you can:

1. **Pre-process data** before passing to ScreenGrid:
   ```javascript
   // Convert to per-cell data
   const aggregatedData = preAggregate(data);
   // Then use getWeight to return 1 for each aggregated cell
   ```

2. **Post-process in `onDrawCell`**:
   ```javascript
   onDrawCell: (ctx, x, y, normVal, cellInfo) => {
     const { cellData } = cellInfo;
     // Calculate average instead of sum
     const avg = cellData.reduce((sum, item) => sum + item.data.value, 0) 
                / cellData.length;
     // Use avg for visualization
   }
   ```

---

### Stage 3: Normalization

**Purpose:** Convert raw aggregated cell values to normalized range (0-1) for consistent rendering.

**Process:**

1. **Find Maximum Value:**
   ```javascript
   const maxValue = Math.max(...grid);
   // Example: grid = [0, 5, 10, 15, 20, 0, ...]
   // maxValue = 20
   ```

2. **Normalize Each Cell:**
   ```javascript
   // For each cell with value > 0:
   const normalizedValue = cellValue / maxValue;
   // Cell with value 20 → normalizedValue = 1.0
   // Cell with value 10 → normalizedValue = 0.5
   // Cell with value 5  → normalizedValue = 0.25
   ```

**Important:** Only cells with `value > 0` are normalized. Empty cells (value = 0) are not rendered.

**Example Normalization:**

```
Raw Grid Values:
[0, 5, 10, 15, 20, 0, 8, 12]

Max Value: 20

Normalized Values:
[0, 0.25, 0.5, 0.75, 1.0, 0, 0.4, 0.6]
```

**Where Normalization is Used:**

1. **Color Rendering:**
   ```javascript
   // colorScale receives normalized value (0-1)
   const [r, g, b, a] = colorScale(normalizedValue);
   // Example: normalizedValue = 0.5 → colorScale(0.5) → [127, 50, 100, 200]
   ```

2. **Glyph Rendering:**
   ```javascript
   // onDrawCell receives normalized value
   onDrawCell: (ctx, x, y, normalizedValue, cellInfo) => {
     // Use normalizedValue for size, opacity, etc.
     const radius = glyphRadius * normalizedValue;
   }
   ```

---

### Complete Example

Let's trace a complete example from data to rendering:

**Input Data:**
```javascript
const data = [
  { coordinates: [-122.4, 37.74], population: 1000 },
  { coordinates: [-122.4, 37.74], population: 500 },  // Same location
  { coordinates: [-122.5, 37.75], population: 2000 }
];
```

**Configuration:**
```javascript
const layer = new ScreenGridLayerGL({
  data: data,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.population,
  cellSizePixels: 50
});
```

**Step-by-Step Processing:**

1. **Projection** (geographic → screen):
   ```
   Point 1: [-122.4, 37.74] → {x: 400, y: 300, w: 1000}
   Point 2: [-122.4, 37.74] → {x: 400, y: 300, w: 500}   // Same screen position
   Point 3: [-122.5, 37.75] → {x: 450, y: 350, w: 2000}
   ```

2. **Aggregation** (assign to cells):
   ```
   Canvas: 800×600px, Cell size: 50px
   Grid: 16×12 cells
   
   Point 1: {x: 400, y: 300} → Cell [8, 6]
   Point 2: {x: 400, y: 300} → Cell [8, 6]  // Same cell!
   Point 3: {x: 450, y: 350} → Cell [9, 7]
   
   grid[8 * 16 + 6] = 1000 + 500 = 1500
   grid[9 * 16 + 7] = 2000
   ```

3. **Normalization** (for rendering):
   ```
   maxValue = Math.max(1500, 2000) = 2000
   
   Cell [8, 6]: normalizedValue = 1500 / 2000 = 0.75
   Cell [9, 7]: normalizedValue = 2000 / 2000 = 1.0
   ```

4. **Rendering**:
   ```javascript
   // Cell [8, 6]:
   colorScale(0.75) → [191, 25, 50, 200]  // Example color
   
   // Cell [9, 7]:
   colorScale(1.0) → [255, 100, 200, 200]  // Maximum intensity
   ```

---

### Key Behaviors

#### Empty Cells

Cells with no data points have `value = 0` and are **not rendered**.

```javascript
// Cell contains no points
grid[index] = 0  // Not drawn, skipped in render loop
```

#### Multiple Points in Same Cell

When multiple points fall in the same cell, their weights are **summed**:

```javascript
// 3 points in same cell with weights [10, 5, 15]
cellValue = 10 + 5 + 15 = 30
```

#### Normalization Range

Normalized values are always in range **[0, 1]**:
- `0.0` = Minimum non-zero value (or empty cell, not rendered)
- `1.0` = Maximum value in current grid
- `0.5` = Half of maximum value

**Important:** The normalization is **relative to the current grid**, not global data. When you zoom or filter data, the maximum may change, and normalization adjusts accordingly.

#### Weight Function Impact

The `getWeight` function directly affects aggregation:

```javascript
// Different weight functions produce different aggregations:

// Sum of values
getWeight: (d) => d.value
// Result: Cell value = sum of all values in cell

// Count (each point = 1)
getWeight: () => 1
// Result: Cell value = number of points in cell

// Custom calculation
getWeight: (d) => d.population * d.density
// Result: Cell value = sum of (population × density) for all points
```

---

### Performance Considerations

1. **Grid Size:**
   - Larger cells → fewer cells → faster aggregation
   - Smaller cells → more cells → slower but more detailed

2. **Data Size:**
   - More points → longer projection/aggregation time
   - Consider filtering data based on zoom level

3. **Normalization:**
   - Calculated once per render
   - Requires finding max value: `O(n)` where n = number of cells

---

### Advanced: Custom Normalization

For custom normalization strategies, you can override in `onDrawCell`:

```javascript
onDrawCell: (ctx, x, y, normVal, cellInfo) => {
  const { cellData, value } = cellInfo;
  
  // Use raw value instead of normalized
  const customNormalized = value / customMaxValue;
  
  // Or use percentile-based normalization
  const percentile = calculatePercentile(value, allValues);
  
  // Then use for visualization
}
```

---

## Related Documentation

- [Quick Reference Guide](./QUICK_REFERENCE.md) - Brief API snippets and patterns
- [Architecture Guide](./ARCHITECTURE.md) - Detailed module architecture
- [Glyph Drawing Guide](./GLYPH_DRAWING_GUIDE.md) - Comprehensive glyph visualization guide
- [Usage Guide](./USAGE.md) - Development and troubleshooting
- [Spatio-Temporal Guide](./SPATIO_TEMPORAL_GUIDE.md) - Time series visualization patterns

---

## Version

This API reference is for ScreenGrid Library v2.0.1+

