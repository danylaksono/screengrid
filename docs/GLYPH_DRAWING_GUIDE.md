# Glyph Drawing Guide

A comprehensive guide to visualizing multivariate geospatial data using custom glyphs in ScreenGrid.

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding the onDrawCell Callback](#understanding-the-ondrawcell-callback)
3. [Built-in Glyph Utilities](#built-in-glyph-utilities)
4. [Custom Glyph Implementation](#custom-glyph-implementation)
5. [Multivariate Data Visualization](#multivariate-data-visualization)
6. [Time Series Visualization](#time-series-visualization)
7. [Advanced Patterns](#advanced-patterns)
8. [Best Practices](#best-practices)

---

## Introduction

Glyph drawing enables you to create rich, multi-dimensional visualizations that go far beyond simple color encoding. Instead of representing a single aggregated value with color, glyphs allow you to visualize multiple attributes simultaneously within each grid cell.

### Why Use Glyphs?

- **Multivariate Visualization**: Display multiple data attributes in a single cell
- **Temporal Patterns**: Show time series trends and changes over time
- **Categorical Breakdowns**: Visualize proportions and distributions
- **Complex Relationships**: Reveal correlations between different variables
- **Enhanced Information Density**: Pack more information into limited screen space

### When to Use Glyphs

✅ **Good for:**
- Data with multiple correlated attributes
- Temporal/spatio-temporal datasets
- Categorical or hierarchical data
- Comparative analysis across dimensions
- When you need to show distributions, not just aggregates

❌ **Consider alternatives when:**
- Single-value visualization is sufficient
- Screen space is extremely limited
- Performance is critical (glyphs are more expensive to render)
- Users need precise numeric values (consider tooltips instead, or use the onHover method)

---

## Understanding the onDrawCell Callback

The `onDrawCell` callback is invoked for each grid cell when `enableGlyphs: true` is set. It provides everything you need to draw custom visualizations.

When `enableGlyphs: true` and a glyph is active (either via `onDrawCell` or a registered `glyph` plugin), the **default behaviour is now to hide the colored cell background**. You can turn the background back on by setting `aggregationModeConfig.showBackground = true` in your layer config.

### Callback Signature

```javascript
function onDrawCell(ctx, x, y, normVal, cellInfo) {
  // Your drawing code here
}
```

### Parameters

#### `ctx` (CanvasRenderingContext2D)
The 2D canvas rendering context. Use standard Canvas 2D API methods:
- `ctx.fillRect()`, `ctx.strokeRect()` - Rectangles
- `ctx.arc()`, `ctx.beginPath()` - Circles and paths
- `ctx.moveTo()`, `ctx.lineTo()` - Lines
- `ctx.fillStyle`, `ctx.strokeStyle` - Colors
- `ctx.globalAlpha` - Transparency
- `ctx.font`, `ctx.fillText()` - Text rendering

#### `x, y` (number)
The **center coordinates** of the cell in canvas pixel space. Use these as the anchor point for your glyph.

#### `normVal` (number)
Normalized aggregated value (0-1) for the cell, based on the `getWeight` function. Useful for:
- Scaling glyph size proportionally
- Adjusting opacity/color intensity
- Conditional rendering based on data density

#### `cellInfo` (object)
Contains detailed information about the cell:

```javascript
{
  cellData: [        // Array of original data points in this cell
    {
      data: {...},    // Original data object
      position: {...}, // Projected position {x, y}
      weight: 1.0     // Weight value
    },
    // ... more points
  ],
  cellSize: 50,       // Size of the cell in pixels
  glyphRadius: 20,    // Recommended radius (cellSize * glyphSize / 2)
  normalizedValue: 0.75, // Same as normVal
  col: 5,             // Grid column index
  row: 3,             // Grid row index
  value: 150          // Raw aggregated value
}
```

### Basic Example

```javascript
const gridLayer = new ScreenGridLayerGL({
  data: myData,
  getPosition: (d) => d.coordinates,
  getWeight: (d) => d.weight,
  enableGlyphs: true,
  onDrawCell: (ctx, x, y, normVal, cellInfo) => {
    const { cellData, glyphRadius } = cellInfo;
    
    // Simple circle glyph
    ctx.fillStyle = `hsl(${normVal * 360}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(x, y, glyphRadius, 0, 2 * Math.PI);
    ctx.fill();
  }
});
```

---

## Built-in Glyph Utilities

ScreenGrid provides several pre-built glyph functions for common visualization patterns. Import them from the library:

```javascript
import { GlyphUtilities } from 'screengrid';
// Or use as static methods:
// ScreenGridLayerGL.drawCircleGlyph(...)
```

### Available Utilities

#### 1. Circle Glyph
Simple circle with configurable color and opacity.

```javascript
GlyphUtilities.drawCircleGlyph(ctx, x, y, radius, color, alpha);
```

**Use cases:** Single-value encoding, heatmap-style visualization

#### 2. Bar Chart Glyph
Horizontal or vertical bars showing multiple values.

```javascript
GlyphUtilities.drawBarGlyph(ctx, x, y, values, maxValue, cellSize, colors);
```

**Parameters:**
- `values`: Array of numeric values `[10, 25, 15]`
- `maxValue`: Maximum value for scaling
- `cellSize`: Cell size in pixels
- `colors`: Array of colors `['#ff0000', '#00ff00', '#0000ff']`

**Use cases:** Comparing multiple attributes, categorical breakdowns

#### 3. Pie Chart Glyph
Circular pie chart showing proportions.

```javascript
GlyphUtilities.drawPieGlyph(ctx, x, y, values, radius, colors);
```

**Use cases:** Proportions, categorical distributions, percentage breakdowns

#### 4. Donut Chart Glyph
Pie chart with a central hole.

```javascript
GlyphUtilities.drawDonutGlyph(ctx, x, y, values, outerRadius, innerRadius, colors);
```

**Use cases:** Similar to pie chart, but allows additional information in center

#### 5. Scatter Plot Glyph
Shows individual data points within a cell.

```javascript
GlyphUtilities.drawScatterGlyph(ctx, x, y, points, cellSize, color);
```

**Parameters:**
- `points`: Array of point objects with `weight` property

**Use cases:** Density visualization, showing individual records

#### 6. Heatmap Glyph
Color intensity based on normalized value.

```javascript
GlyphUtilities.drawHeatmapGlyph(ctx, x, y, radius, normalizedValue, colorScale);
```

**Parameters:**
- `colorScale`: Function `(value) => colorString`

**Use cases:** Intensity mapping, single-value heatmaps

#### 7. Radial Bar Glyph
Bars radiating from center (like a radar/spider chart).

```javascript
GlyphUtilities.drawRadialBarGlyph(ctx, x, y, values, maxValue, maxRadius, color);
```

**Use cases:** Multi-dimensional comparison, radar-style visualizations

#### 8. Time Series Glyph ⭐
Line chart showing temporal trends.

```javascript
GlyphUtilities.drawTimeSeriesGlyph(ctx, x, y, timeSeriesData, cellSize, options);
```

**Parameters:**
- `timeSeriesData`: Array of `{year, value}` objects, sorted by year
- `options`: Configuration object

**Options:**
```javascript
{
  lineColor: '#3498db',        // Line color
  pointColor: '#e74c3c',      // Data point color
  lineWidth: 2,                // Line width
  pointRadius: 2,              // Point radius
  showPoints: true,            // Show data points
  showArea: false,             // Fill area under line
  areaColor: 'rgba(52, 152, 219, 0.2)', // Area fill color
  padding: 0.1                 // Padding as fraction of cellSize
}
```

**Use cases:** Temporal trends, spatio-temporal data, change over time

### Example: Using Built-in Utilities

```javascript
const gridLayer = new ScreenGridLayerGL({
  data: bikeData,
  getPosition: (d) => d.COORDINATES,
  getWeight: (d) => d.SPACES,
  enableGlyphs: true,
  onDrawCell: (ctx, x, y, normVal, cellInfo) => {
    const { cellData, cellSize } = cellInfo;
    
    // Aggregate multiple attributes
    const totalRacks = cellData.reduce((sum, item) => sum + item.data.RACKS, 0);
    const totalSpaces = cellData.reduce((sum, item) => sum + item.data.SPACES, 0);
    const totalCapacity = totalRacks + totalSpaces;
    
    // Use bar chart to show both values
    GlyphUtilities.drawBarGlyph(
      ctx, x, y,
      [totalRacks, totalSpaces],
      Math.max(totalRacks, totalSpaces),
      cellSize,
      ['#3498db', '#2ecc71']
    );
  }
});
```

---

## Custom Glyph Implementation

While built-in utilities cover common cases, custom glyphs give you complete control. Here's how to build your own.

### Step 1: Extract and Aggregate Data

First, extract the data you need from `cellInfo.cellData`:

```javascript
function myCustomGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize, glyphRadius } = cellInfo;
  
  if (!cellData || cellData.length === 0) return;
  
  // Extract and aggregate your data
  const aggregated = {
    value1: 0,
    value2: 0,
    value3: 0
  };
  
  cellData.forEach(item => {
    aggregated.value1 += item.data.attribute1 || 0;
    aggregated.value2 += item.data.attribute2 || 0;
    aggregated.value3 += item.data.attribute3 || 0;
  });
  
  // Continue with drawing...
}
```

### Step 2: Calculate Dimensions

Use `cellSize` and `glyphRadius` to size your glyph appropriately:

```javascript
const padding = 0.1; // 10% padding
const chartWidth = cellSize * (1 - 2 * padding);
const chartHeight = cellSize * (1 - 2 * padding);
const chartX = x - chartWidth / 2;
const chartY = y - chartHeight / 2;
```

### Step 3: Normalize Values

Scale your values to fit the available space:

```javascript
const maxValue = Math.max(...[aggregated.value1, aggregated.value2, aggregated.value3]);
const scale = chartHeight / maxValue; // Or use a predefined max
```

### Step 4: Draw Your Visualization

Use Canvas 2D API to draw:

```javascript
// Example: Draw three horizontal bars
const barHeight = chartHeight / 3;
const barSpacing = barHeight * 0.1;

[aggregated.value1, aggregated.value2, aggregated.value3].forEach((value, i) => {
  const barY = chartY + i * (barHeight + barSpacing);
  const barWidth = (value / maxValue) * chartWidth;
  
  ctx.fillStyle = ['#e74c3c', '#3498db', '#2ecc71'][i];
  ctx.fillRect(chartX, barY, barWidth, barHeight - barSpacing);
});
```

### Complete Custom Glyph Example

```javascript
function drawCustomBikeGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, glyphRadius, cellSize } = cellInfo;
  
  if (cellData.length === 0) return;
  
  // Aggregate data
  const totalRacks = cellData.reduce((sum, item) => sum + item.data.RACKS, 0);
  const totalSpaces = cellData.reduce((sum, item) => sum + item.data.SPACES, 0);
  
  // Draw background circle
  ctx.globalAlpha = Math.min(0.8, normVal * 0.8 + 0.2);
  ctx.fillStyle = `hsl(${200 + normVal * 60}, 70%, 50%)`;
  ctx.beginPath();
  ctx.arc(x, y, glyphRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw inner circle for racks
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#2c3e50';
  const innerRadius = glyphRadius * 0.6;
  ctx.beginPath();
  ctx.arc(x, y, innerRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw rack indicators (small circles around perimeter)
  const rackCount = Math.min(totalRacks, 8);
  const angleStep = (2 * Math.PI) / rackCount;
  const rackRadius = innerRadius * 0.7;
  
  ctx.fillStyle = '#ecf0f1';
  for (let i = 0; i < rackCount; i++) {
    const angle = i * angleStep;
    const rackX = x + Math.cos(angle) * rackRadius;
    const rackY = y + Math.sin(angle) * rackRadius;
    ctx.beginPath();
    ctx.arc(rackX, rackY, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  
  // Draw text label for spaces
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(totalSpaces.toString(), x, y);
  
  ctx.globalAlpha = 1.0; // Reset
}
```

---

## Multivariate Data Visualization

Visualizing multiple attributes simultaneously is one of glyphs' greatest strengths. Here are common patterns:

### Pattern 1: Split-Screen Layout

Divide the cell into regions, each showing different attributes:

```javascript
function drawSplitScreenGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  if (!cellData || cellData.length === 0) return;
  
  // Aggregate multiple attributes
  const attr1 = cellData.reduce((sum, item) => sum + (item.data.attr1 || 0), 0);
  const attr2 = cellData.reduce((sum, item) => sum + (item.data.attr2 || 0), 0);
  const attr3 = cellData.reduce((sum, item) => sum + (item.data.attr3 || 0), 0);
  
  const padding = 0.1;
  const chartWidth = cellSize * (1 - 2 * padding);
  const chartHeight = cellSize * (1 - 2 * padding);
  const chartX = x - chartWidth / 2;
  const chartY = y - chartHeight / 2;
  
  // Split into three horizontal sections
  const sectionHeight = chartHeight / 3;
  
  // Top section: attr1 as bar
  const max1 = Math.max(attr1, 1);
  const bar1Width = (attr1 / max1) * chartWidth;
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(chartX, chartY, bar1Width, sectionHeight);
  
  // Middle section: attr2 as bar
  const max2 = Math.max(attr2, 1);
  const bar2Width = (attr2 / max2) * chartWidth;
  ctx.fillStyle = '#3498db';
  ctx.fillRect(chartX, chartY + sectionHeight, bar2Width, sectionHeight);
  
  // Bottom section: attr3 as bar
  const max3 = Math.max(attr3, 1);
  const bar3Width = (attr3 / max3) * chartWidth;
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(chartX, chartY + 2 * sectionHeight, bar3Width, sectionHeight);
}
```

### Pattern 2: Layered Visualization

Overlay multiple visualizations:

```javascript
function drawLayeredGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, glyphRadius } = cellInfo;
  
  // Outer ring: total value
  const total = cellData.reduce((sum, item) => sum + item.data.total, 0);
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, glyphRadius, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Middle ring: category A
  const categoryA = cellData.reduce((sum, item) => sum + item.data.categoryA, 0);
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, glyphRadius * 0.7, 0, 2 * Math.PI);
  ctx.stroke();
  
  // Inner circle: category B
  const categoryB = cellData.reduce((sum, item) => sum + item.data.categoryB, 0);
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(x, y, glyphRadius * 0.4, 0, 2 * Math.PI);
  ctx.fill();
}
```

### Pattern 3: Multi-Series Chart

Show multiple time series or categories side-by-side:

```javascript
function drawMultiSeriesGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  // Group data by category
  const categories = {};
  cellData.forEach(item => {
    const cat = item.data.category;
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(item.data.value);
  });
  
  // Calculate chart dimensions
  const padding = 0.15;
  const chartWidth = cellSize * (1 - 2 * padding);
  const chartHeight = cellSize * (1 - 2 * padding);
  const chartX = x - chartWidth / 2;
  const chartY = y - chartHeight / 2;
  
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
  let colorIndex = 0;
  
  // Draw each category as a horizontal bar
  const categoryCount = Object.keys(categories).length;
  const barHeight = chartHeight / categoryCount;
  
  Object.entries(categories).forEach(([category, values], i) => {
    const total = values.reduce((sum, v) => sum + v, 0);
    const maxTotal = Math.max(...Object.values(categories).map(vals => 
      vals.reduce((sum, v) => sum + v, 0)
    ));
    
    const barWidth = (total / maxTotal) * chartWidth;
    const barY = chartY + i * barHeight;
    
    ctx.fillStyle = colors[colorIndex % colors.length];
    ctx.fillRect(chartX, barY, barWidth, barHeight * 0.8);
    
    colorIndex++;
  });
}
```

### Pattern 4: Matrix/Grid Layout

Arrange multiple mini-visualizations in a grid:

```javascript
function drawMatrixGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  // Extract 4 attributes
  const attrs = ['attr1', 'attr2', 'attr3', 'attr4'].map(attr =>
    cellData.reduce((sum, item) => sum + (item.data[attr] || 0), 0)
  );
  
  const maxValue = Math.max(...attrs);
  const gridSize = 2; // 2x2 grid
  const padding = 0.1;
  const cellArea = cellSize * (1 - 2 * padding) / gridSize;
  
  attrs.forEach((value, i) => {
    const col = i % gridSize;
    const row = Math.floor(i / gridSize);
    const cellX = x - cellSize / 2 + padding * cellSize + col * cellArea;
    const cellY = y - cellSize / 2 + padding * cellSize + row * cellArea;
    
    // Draw mini visualization (e.g., circle size based on value)
    const radius = (value / maxValue) * (cellArea / 2);
    ctx.fillStyle = `hsl(${i * 90}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(cellX + cellArea / 2, cellY + cellArea / 2, radius, 0, 2 * Math.PI);
    ctx.fill();
  });
}
```

---

## Time Series Visualization

Time series glyphs are perfect for spatio-temporal data. They show how values change over time within each spatial cell.

### Basic Time Series Glyph

```javascript
function drawTimeSeriesGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  if (!cellData || cellData.length === 0) return;
  
  // Group data by year
  const yearData = {};
  cellData.forEach(item => {
    const year = item.data.year;
    const value = item.data.value;
    
    if (year == null || value == null || isNaN(value)) return;
    
    if (!yearData[year]) {
      yearData[year] = { total: 0, count: 0 };
    }
    yearData[year].total += value;
    yearData[year].count += 1;
  });
  
  // Convert to array format
  const timeSeriesData = Object.entries(yearData)
    .map(([year, data]) => ({
      year: parseInt(year),
      value: data.total // or data.total / data.count for average
    }))
    .sort((a, b) => a.year - b.year);
  
  if (timeSeriesData.length === 0) return;
  
  // Use built-in utility
  GlyphUtilities.drawTimeSeriesGlyph(
    ctx, x, y, timeSeriesData, cellSize,
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
}
```

### Multivariate Time Series

Show multiple variables over time in a single glyph:

```javascript
function drawMultivariateTimeSeriesGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  if (!cellData || cellData.length === 0) return;
  
  // Group by year and aggregate multiple variables
  const yearData = {};
  cellData.forEach(item => {
    const year = item.data.year;
    if (year == null) return;
    
    if (!yearData[year]) {
      yearData[year] = {
        var1: 0,
        var2: 0,
        var3: 0
      };
    }
    
    yearData[year].var1 += item.data.variable1 || 0;
    yearData[year].var2 += item.data.variable2 || 0;
    yearData[year].var3 += item.data.variable3 || 0;
  });
  
  const years = Object.keys(yearData).map(y => parseInt(y)).sort((a, b) => a - b);
  if (years.length === 0) return;
  
  // Build series arrays
  const series = [
    {
      data: years.map(year => ({
        year: year,
        value: yearData[year].var1
      })),
      color: '#e74c3c'
    },
    {
      data: years.map(year => ({
        year: year,
        value: yearData[year].var2
      })),
      color: '#3498db'
    },
    {
      data: years.map(year => ({
        year: year,
        value: yearData[year].var3
      })),
      color: '#2ecc71'
    }
  ];
  
  // Draw chart dimensions
  const padding = 0.12;
  const chartWidth = cellSize * (1 - 2 * padding);
  const chartHeight = cellSize * (1 - 2 * padding);
  const chartX = x - chartWidth / 2;
  const chartY = y - chartHeight / 2;
  
  // Find global min/max for consistent scaling
  const allValues = series.flatMap(s => s.data.map(d => d.value));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearRange = maxYear - minYear || 1;
  
  // Draw each series
  series.forEach(serie => {
    const points = serie.data
      .filter(d => d.value != null && !isNaN(d.value))
      .map(d => {
        const px = chartX + ((d.year - minYear) / yearRange) * chartWidth;
        const py = chartY + chartHeight - ((d.value - minValue) / valueRange) * chartHeight;
        return { px, py, value: d.value, year: d.year };
      });
    
    if (points.length < 2) return;
    
    // Draw area
    ctx.fillStyle = serie.color.replace('rgb', 'rgba').replace(')', ', 0.15)');
    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartHeight);
    points.forEach(p => ctx.lineTo(p.px, p.py));
    ctx.lineTo(points[points.length - 1].px, chartY + chartHeight);
    ctx.closePath();
    ctx.fill();
    
    // Draw line
    ctx.strokeStyle = serie.color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(points[0].px, points[0].py);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].px, points[i].py);
    }
    ctx.stroke();
  });
}
```

### Split-Screen Time Series

Show different variable groups in top/bottom halves:

```javascript
function drawSplitTimeSeriesGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  // ... aggregate data into two groups ...
  
  const padding = 0.12;
  const chartWidth = cellSize * (1 - 2 * padding);
  const chartHeight = cellSize * (1 - 2 * padding);
  const chartX = x - chartWidth / 2;
  const chartY = y - chartHeight / 2;
  
  const halfHeight = chartHeight / 2;
  
  // Top half: group 1
  drawSeriesGroup(ctx, group1Series, chartX, chartY, chartWidth, halfHeight);
  
  // Divider line
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chartX, chartY + halfHeight);
  ctx.lineTo(chartX + chartWidth, chartY + halfHeight);
  ctx.stroke();
  
  // Bottom half: group 2 (mirrored)
  drawSeriesGroup(ctx, group2Series, chartX, chartY + halfHeight, chartWidth, halfHeight, true);
}
```

### Interactive Time Series with Reference Lines

Add hover/year selection to highlight specific time periods:

```javascript
let hoveredYear = null; // Set from external UI

function drawInteractiveTimeSeriesGlyph(ctx, x, y, normVal, cellInfo) {
  // ... draw time series as before ...
  
  // Draw reference line for hovered year
  if (hoveredYear !== null && hoveredYear >= minYear && hoveredYear <= maxYear) {
    const yearX = chartX + ((hoveredYear - minYear) / yearRange) * chartWidth;
    
    // Vertical reference line
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(yearX, chartY);
    ctx.lineTo(yearX, chartY + chartHeight);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Highlight point at intersection
    const yearValue = timeSeriesData.find(d => d.year === hoveredYear);
    if (yearValue) {
      const valueY = chartY + chartHeight - 
        ((yearValue.value - minValue) / valueRange) * chartHeight;
      
      ctx.fillStyle = 'rgba(150, 150, 150, 0.9)';
      ctx.beginPath();
      ctx.arc(yearX, valueY, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
```

---

## Advanced Patterns

### Pattern 1: Animated Glyphs

Update glyph appearance based on external state (e.g., selected time period):

```javascript
let currentTimePeriod = 2020;

function drawAnimatedGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData } = cellInfo;
  
  // Filter data for current time period
  const periodData = cellData.filter(item => 
    item.data.year === currentTimePeriod
  );
  
  // Draw glyph based on filtered data
  // ...
}
```

### Pattern 2: Conditional Glyph Types

Switch glyph types based on data characteristics:

```javascript
function drawAdaptiveGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData } = cellInfo;
  
  // Determine glyph type based on data
  const hasTimeData = cellData.some(item => item.data.year != null);
  const categoryCount = new Set(cellData.map(item => item.data.category)).size;
  
  if (hasTimeData) {
    // Draw time series
    drawTimeSeriesGlyph(ctx, x, y, normVal, cellInfo);
  } else if (categoryCount > 1) {
    // Draw pie chart
    drawPieGlyph(ctx, x, y, normVal, cellInfo);
  } else {
    // Draw simple circle
    drawCircleGlyph(ctx, x, y, normVal, cellInfo);
  }
}
```

### Pattern 3: Composite Glyphs

Combine multiple visualization techniques:

```javascript
function drawCompositeGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize, glyphRadius } = cellInfo;
  
  // Background: circle with opacity based on total
  const total = cellData.reduce((sum, item) => sum + item.data.total, 0);
  ctx.globalAlpha = Math.min(0.6, total / 100);
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.arc(x, y, glyphRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Foreground: pie chart for categories
  const categories = extractCategories(cellData);
  GlyphUtilities.drawPieGlyph(ctx, x, y, categories.values, glyphRadius * 0.7, categories.colors);
  
  // Center: text label
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(total.toString(), x, y);
}
```

### Pattern 4: Statistical Glyphs

Show statistical measures (mean, median, distribution):

```javascript
function drawStatisticalGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  const values = cellData.map(item => item.data.value).filter(v => v != null);
  if (values.length === 0) return;
  
  // Calculate statistics
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // Draw box plot
  const padding = 0.15;
  const chartWidth = cellSize * (1 - 2 * padding);
  const chartHeight = cellSize * (1 - 2 * padding);
  const chartX = x - chartWidth / 2;
  const chartY = y - chartHeight / 2;
  
  const valueRange = max - min || 1;
  const xMin = chartX + ((min - min) / valueRange) * chartWidth;
  const xMedian = chartX + ((median - min) / valueRange) * chartWidth;
  const xMean = chartX + ((mean - min) / valueRange) * chartWidth;
  const xMax = chartX + ((max - min) / valueRange) * chartWidth;
  
  // Box (Q1 to Q3 would be better, but using min-max for simplicity)
  ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
  ctx.fillRect(xMin, chartY, xMax - xMin, chartHeight);
  
  // Median line
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xMedian, chartY);
  ctx.lineTo(xMedian, chartY + chartHeight);
  ctx.stroke();
  
  // Mean marker
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(xMean, chartY + chartHeight / 2, 3, 0, 2 * Math.PI);
  ctx.fill();
}
```

---

## Best Practices

### 1. Performance Optimization

- **Minimize calculations**: Cache aggregated values when possible
- **Early returns**: Check for empty data before processing
- **Efficient loops**: Use `reduce()` for aggregations
- **Limit complexity**: Avoid nested loops and complex computations

```javascript
// ✅ Good: Early return
function efficientGlyph(ctx, x, y, normVal, cellInfo) {
  if (!cellInfo.cellData || cellInfo.cellData.length === 0) return;
  // ... rest of code
}

// ❌ Bad: Processing empty data
function inefficientGlyph(ctx, x, y, normVal, cellInfo) {
  const data = cellInfo.cellData || [];
  // ... processes even when empty
}
```

### 2. Handling Edge Cases

Always handle:
- Empty cells (`cellData.length === 0`)
- Null/undefined values
- Missing attributes
- Zero or negative values
- Single data point scenarios

```javascript
function robustGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData } = cellInfo;
  
  // Check for empty data
  if (!cellData || cellData.length === 0) return;
  
  // Filter valid values
  const validData = cellData.filter(item => 
    item.data && 
    item.data.value != null && 
    !isNaN(item.data.value) &&
    item.data.value > 0
  );
  
  if (validData.length === 0) return;
  
  // ... rest of code
}
```

### 3. Consistent Scaling

For comparisons across cells:
- Use global min/max when available
- Normalize values consistently
- Maintain aspect ratios
- Use proportional sizing

```javascript
// Use global stats if available
const globalMax = gridLayer.getGridStats()?.maxValue || localMax;
const normalized = value / globalMax;
```

### 4. Color and Styling

- **Accessibility**: Ensure sufficient contrast
- **Consistency**: Use color schemes consistently
- **Meaning**: Map colors to semantic meaning
- **Transparency**: Use `globalAlpha` for layering

```javascript
// ✅ Good: Semantic colors
const colors = {
  positive: '#2ecc71',
  negative: '#e74c3c',
  neutral: '#95a5a6'
};

// ❌ Bad: Arbitrary colors
const colors = ['#ff0000', '#00ff00', '#0000ff']; // What do they mean?
```

### 5. Documentation

Document your custom glyphs:
- What data they expect
- What they visualize
- How to interpret them
- Any special requirements

```javascript
/**
 * Draws a multivariate time series glyph showing carbon savings and costs.
 * 
 * Expected data structure:
 * - year: number (required)
 * - ashp_carbonsaved: number
 * - ev_carbonsaved: number
 * - pv_carbonsaved: number
 * - labour_cost: number
 * - material_cost: number
 * 
 * Layout:
 * - Top half: Carbon savings (green, blue, purple lines)
 * - Bottom half: Costs (red, orange lines)
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} normVal - Normalized value
 * @param {Object} cellInfo - Cell information object
 */
function drawMultivariateTimeSeriesGlyph(ctx, x, y, normVal, cellInfo) {
  // ... implementation
}
```

### 6. Testing Your Glyphs

Test with:
- Empty data
- Single data point
- Extreme values (very large, very small)
- Missing attributes
- Different cell sizes
- Various zoom levels

### 7. Reusability

Create reusable glyph functions:

```javascript
// Generic time series drawer
function createTimeSeriesGlyph(options = {}) {
  return function(ctx, x, y, normVal, cellInfo) {
    const { cellData, cellSize } = cellInfo;
    const timeSeriesData = extractTimeSeries(cellData, options.valueExtractor);
    
    GlyphUtilities.drawTimeSeriesGlyph(
      ctx, x, y, timeSeriesData, cellSize, options.chartOptions
    );
  };
}

// Use it
const myGlyph = createTimeSeriesGlyph({
  valueExtractor: (item) => item.data.carbon,
  chartOptions: { lineColor: '#2ecc71', showArea: true }
});
```

---

## Examples Reference

See the following example files for complete implementations:

- **`examples/index.html`**: Basic glyph examples (bike parking, bar charts, pie charts)
- **`examples/timeseries.html`**: Single-variable time series visualization
- **`examples/multivariate-timeseries.html`**: Complex multivariate time series with split-screen layout
- **`examples/legend-example.html`**: Glyphs combined with legend system

---

## Conclusion

Glyph drawing opens up powerful possibilities for multivariate geospatial visualization. By combining the built-in utilities with custom implementations, you can create rich, informative visualizations that reveal patterns and relationships in your data.

Start simple with built-in utilities, then gradually add custom logic as your needs become more specific. Remember to test edge cases, optimize for performance, and document your glyphs for future reference.

Happy visualizing! 🎨

