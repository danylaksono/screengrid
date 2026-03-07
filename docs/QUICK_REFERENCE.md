# ScreenGrid Quick Reference Guide

> 📖 **For complete API documentation with detailed parameter descriptions, return types, and comprehensive examples, see [API_REFERENCE.md](./API_REFERENCE.md)**

This guide provides quick lookup snippets and common patterns. Use it when you know what you're looking for and need a quick reminder.

## 📦 Module Import Paths

```javascript
// Main class (unchanged API)
import { ScreenGridLayerGL } from 'screengrid';

// Core modules (pure business logic)
import { Aggregator } from 'screengrid';        // Grid aggregation
import { Projector } from 'screengrid';         // Coordinate projection
import { CellQueryEngine } from 'screengrid';   // Spatial queries

// Canvas modules
import { CanvasManager } from 'screengrid';     // Canvas lifecycle
import { Renderer } from 'screengrid';          // Drawing logic

// Event modules
import { EventBinder } from 'screengrid';       // Event attachment
import { EventHandlers } from 'screengrid';     // Event logic

// Utilities
import { GlyphUtilities } from 'screengrid';    // Glyph drawing
import { ConfigManager } from 'screengrid';     // Configuration
```

---

## 🎯 Quick Module Reference

### ConfigManager
**What:** Configuration defaults and merging  
**When:** Use when creating or updating layer config  
**API:**
```javascript
ConfigManager.create(options)
ConfigManager.update(config, updates)
ConfigManager.isValid(config)
```

### Projector
**What:** Geographic → Screen space transformation  
**When:** Need to project coordinates  
**API:**
```javascript
Projector.projectPoints(data, getPos, getWeight, map)
projector.project(data, getPos, getWeight)
```

### Aggregator
**What:** Grid aggregation algorithm (pure)  
**When:** Aggregate points into grid cells  
**API:**
```javascript
Aggregator.aggregate(points, data, width, height, cellSize, aggFn, onAfterAggregate)
aggregator.getStats(result)
```

---

## 🛠️ Advanced Hooks Reference

### `onAfterAggregate` (Multivariate)
**What:** Calculate complex stats per cell once per render.  
**Use case:** Averages, medians, or multi-attribute scores.
```javascript
onAfterAggregate: (cellPoints, aggVal, idx, grid) => ({
  avg: cellPoints.reduce((s, p) => s + p.data.v, 0) / cellPoints.length,
  maxScore: Math.max(...cellPoints.map(p => p.data.score))
})
```

### `onDrawCell` (Context)
**What:** Draw to canvas with enriched context.
```javascript
onDrawCell: (ctx, x, y, normVal, cellInfo) => {
  const { customData, isHovered, zoomLevel } = cellInfo;
  // Use customData from onAfterAggregate
  if (isHovered) { /* Highlight effect */ }
}
```

---

### CellQueryEngine
**What:** Spatial queries on grid  
**When:** Find cells at point, in bounds, or above threshold  
**API:**
```javascript
CellQueryEngine.getCellAt(result, point)
CellQueryEngine.getCellsInBounds(result, bounds)
CellQueryEngine.getCellsAboveThreshold(result, threshold)
```

### CanvasManager
**What:** Canvas lifecycle (create, size, cleanup)  
**When:** Managing canvas overlay  
**API:**
```javascript
canvasManager.init(map)
canvasManager.getContext()
canvasManager.resize()
canvasManager.cleanup()
canvasManager.getDisplaySize()
```

### Renderer
**What:** Draw grid to canvas  
**When:** Rendering grid cells  
**API:**
```javascript
Renderer.render(result, ctx, config)
renderer.renderColors(result, ctx, colorScale)
renderer.renderGlyphs(result, ctx, onDrawCell, size)
```

### EventBinder
**What:** Attach/detach events  
**When:** Managing event lifecycle  
**API:**
```javascript
eventBinder.bind(map, handlers)
eventBinder.unbind()
eventBinder.bindEvent(name, handler)
eventBinder.unbindEvent(name)
```

### EventHandlers
**What:** Event handler logic  
**When:** Processing map events  
**API:**
```javascript
EventHandlers.handleHover(event, engine, callback)
EventHandlers.handleClick(event, engine, callback)
EventHandlers.handleZoom(map, config, callback)
EventHandlers.handleMove(callback)
```

### GlyphUtilities
**What:** Glyph drawing functions  
**When:** Custom visualization in cells  
**API:**
```javascript
GlyphUtilities.drawCircleGlyph(ctx, x, y, r, color, alpha)
GlyphUtilities.drawBarGlyph(ctx, x, y, vals, max, size, colors)
GlyphUtilities.drawPieGlyph(ctx, x, y, vals, radius, colors)
GlyphUtilities.drawScatterGlyph(ctx, x, y, points, size, color)
GlyphUtilities.drawDonutGlyph(ctx, x, y, vals, outer, inner, colors)
GlyphUtilities.drawHeatmapGlyph(ctx, x, y, r, normVal, colorScale)
GlyphUtilities.drawRadialBarGlyph(ctx, x, y, vals, max, radius, color)
```

### ScreenGridLayerGL
**What:** Orchestrator (main class)  
**When:** Using the library normally  
**API:**
```javascript
layer = new ScreenGridLayerGL(options)
layer.setData(newData)
layer.setConfig(updates)
layer.getCellAt(point)
layer.getCellsInBounds(bounds)
layer.getGridStats()
```

---

## 💼 Use Case Examples

### Basic Grid Visualization
```javascript
import { ScreenGridLayerGL } from 'screengrid';

const layer = new ScreenGridLayerGL({
  data: myData,
  cellSizePixels: 50
});
map.addLayer(layer);
```

### Independent Aggregation (e.g., for analysis)
```javascript
import { Projector, Aggregator } from 'screengrid';

const projector = new Projector(map);
const aggregator = new Aggregator();

const points = projector.project(data, d => d.coords, d => d.value);
const grid = aggregator.aggregate(points, data, 800, 600, 50);
const stats = aggregator.getStats(grid);
console.log(`Found ${stats.cellsWithData} cells with data`);
```

### Advanced Hover/Click
```javascript
import { CellQueryEngine } from 'screengrid';

const engine = new CellQueryEngine(gridData);

map.on('mousemove', (e) => {
  const cell = engine.getCellAt({ x: e.point.x, y: e.point.y });
  if (cell) {
    console.log(`Cell [${cell.col}, ${cell.row}] = ${cell.value}`);
  }
});
```

### Custom Glyph Drawing
```javascript
import { ScreenGridLayerGL, GlyphUtilities } from 'screengrid';

const layer = new ScreenGridLayerGL({
  enableGlyphs: true,
  onDrawCell: (ctx, x, y, norm, info) => {
    GlyphUtilities.drawPieGlyph(
      ctx, x, y,
      [10, 20, 30], 15,
      ['#ff0000', '#00ff00', '#0000ff']
    );
  }
});
map.addLayer(layer);
```

### Region Analysis
```javascript
import { CellQueryEngine } from 'screengrid';

const engine = new CellQueryEngine(gridData);

// Get all cells in a region
const cells = engine.getCellsInBounds({
  minX: 100, minY: 100, maxX: 300, maxY: 300
});

// Get high-value hotspots
const hotspots = engine.getCellsAboveThreshold(50);
console.log(`Found ${hotspots.length} hotspots`);
```

---

## 📊 Module Dependency Graph

```
┌─────────────────────────────────┐
│    ScreenGridLayerGL            │
│    (Main Class - Orchestrator)  │
└──────────────┬──────────────────┘
               │
    ┌──────────┼──────────┬─────────────┬──────────┐
    │          │          │             │          │
    ▼          ▼          ▼             ▼          ▼
┌────────┐ ┌───────┐ ┌──────────┐ ┌────────┐ ┌──────────┐
│Config  │ │Canvas │ │Events    │ │Core    │ │Glyphs    │
│Manager │ │Mgr    │ │Binder    │ │Logic   │ │Utilities │
└────────┘ └───┬───┘ └────┬─────┘ └───┬────┘ │          │
              │           │           │      │          │
              └───────────┼───────────┘      │          │
                          │                  │          │
                    ┌─────▼──────┐          │          │
                    │Renderer    │ ◄────────┘          │
                    │Event       │                     │
                    │Handlers    │ ◄─────────────────┬─┘
                    └────────────┘                   │
                                               ┌─────▼────┐
                                               │Cell Query│
                                               │Engine    │
                                               └──────────┘

Legend:
┌─────┐ = Single responsibility module
└─────┘ = Composed by orchestrator
  │
  ▼ = Dependency arrow
```

**Key Points:**
- Core modules (bottom) have NO dependencies on canvas/UI
- Orchestrator (top) composes all modules
- Glyphs are pure drawing utilities
- Clear separation of concerns

---

## 🔍 File Location Reference

```
src/
├── index.js
│   └── Exports all modules
│
├── ScreenGridLayerGL.js
│   └── Main orchestrator class
│
├── config/
│   └── ConfigManager.js
│
├── core/
│   ├── Projector.js
│   ├── Aggregator.js
│   └── CellQueryEngine.js
│
├── canvas/
│   ├── CanvasManager.js
│   └── Renderer.js
│
├── events/
│   ├── EventBinder.js
│   └── EventHandlers.js
│
└── glyphs/
    └── GlyphUtilities.js
```

---

## ✨ New Methods & Features

### Added to Aggregator
```javascript
aggregator.getStats(result)
// Returns: {totalCells, cellsWithData, maxValue, minValue, avgValue, totalValue}
```

### Added to CellQueryEngine
```javascript
engine.getCellsInBounds(bounds)
engine.getCellsAboveThreshold(threshold)
```

### Added to GlyphUtilities (3 new types)
```javascript
GlyphUtilities.drawDonutGlyph(...)        // Donut chart
GlyphUtilities.drawHeatmapGlyph(...)      // Heat map
GlyphUtilities.drawRadialBarGlyph(...)    // Radial bar chart
```

### Added to ScreenGridLayerGL
```javascript
layer.getGridStats()        // Get aggregation statistics
layer.getCellsInBounds(...) // Region query
```

---

## 🎓 Common Patterns

### Pattern 1: Basic Layer Setup
```javascript
const layer = new ScreenGridLayerGL(options);
map.addLayer(layer);
```

### Pattern 2: Real-time Data Updates
```javascript
layer.setData(newData);
layer.render();
```

### Pattern 3: Interactive Queries
```javascript
map.on('mousemove', (e) => {
  const cell = layer.getCellAt({x: e.point.x, y: e.point.y});
  if (cell) updateUI(cell);
});
```

### Pattern 4: Module Composition
```javascript
const projector = new Projector(map);
const aggregator = new Aggregator();
const engine = new CellQueryEngine();

// Use independently
const points = projector.project(data, pos, weight);
const result = aggregator.aggregate(points, data, w, h, size);
engine.setAggregationResult(result);
```

### Pattern 5: Custom Rendering
```javascript
const layer = new ScreenGridLayerGL({
  enableGlyphs: true,
  onDrawCell: (ctx, x, y, norm, info) => {
    // Draw custom visualization
  }
});
```

---

## 🚀 Performance Tips

1. **Use Aggregator independently** for calculations without rendering
2. **Reuse CellQueryEngine** instead of recalculating queries
3. **Cache aggregation results** if data hasn't changed
4. **Use getStats()** for analytics without full rendering

---

## 📚 Documentation

- **Complete API Reference:** `docs/API_REFERENCE.md` - Comprehensive API documentation with all methods, parameters, and examples
- **Architecture Guide:** `docs/ARCHITECTURE.md` - Module design and architecture details
- **Usage Guide:** `docs/USAGE.md` - Development and troubleshooting
- **Glyph Drawing Guide:** `docs/GLYPH_DRAWING_GUIDE.md` - Comprehensive glyph visualization guide
- **Spatio-Temporal Guide:** `docs/SPATIO_TEMPORAL_GUIDE.md` - Time series visualization patterns

---

## ✅ Backward Compatibility

**Good news:** All original code works unchanged!

```javascript
// All of this still works exactly the same:
const layer = new ScreenGridLayerGL({...});
map.addLayer(layer);
layer.setData(newData);
layer.setConfig(updates);
ScreenGridLayerGL.drawCircleGlyph(...);  // Static method still available
```

The refactoring is **100% backward compatible** with the original API.

