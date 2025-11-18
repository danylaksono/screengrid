# Data Utilities Guide

ScreenGrid provides minimal, flexible utility functions for extracting and processing `cellData`. These utilities help with common patterns mentioned in the [Cartography & Multivariate Design](./CARTOGRAPHY_AND_MULTIVARIATE_DESIGN.md) guide.

## Overview

The data utilities are pure functions that help you:
- **Group data** by categories or time periods
- **Extract multiple attributes** from cellData
- **Compute statistics** for uncertainty encoding
- **Process temporal data** for time series visualizations

All utilities are exported from the main module:

```javascript
import { groupBy, extractAttributes, computeStats, groupByTime } from 'screengrid';
```

---

## groupBy

Groups `cellData` by a key and aggregates values. Perfect for category breakdowns (pie charts, bar charts).

### Signature

```javascript
groupBy(cellData, keyExtractor, valueExtractor, aggregator)
```

### Parameters

- `cellData` (Array): Array of `{data, weight, projectedX, projectedY}` objects
- `keyExtractor` (Function|string): Function to extract key from data, or property name
- `valueExtractor` (Function|string, optional): Function to extract value, or property name (default: `weight`)
- `aggregator` (Function, optional): Aggregation function (default: sum)

### Returns

`Map` - Map of `key -> aggregated value`

### Examples

```javascript
import { groupBy } from 'screengrid';

// In your onDrawCell callback
onDrawCell: (ctx, x, y, normVal, cellInfo) => {
  const { cellData } = cellInfo;
  
  // Group by category property and sum values
  const categories = groupBy(cellData, 'category', 'value');
  // Returns: Map { 'A' => 100, 'B' => 200, 'C' => 50 }
  
  // Group by custom extractor function
  const types = groupBy(
    cellData,
    (item) => item.data.type || 'unknown',
    (item) => item.weight
  );
  
  // Group with custom aggregator (mean instead of sum)
  const avgByCategory = groupBy(
    cellData,
    'category',
    'value',
    (values) => values.reduce((sum, v) => sum + v, 0) / values.length
  );
  
  // Use for pie chart
  const values = Array.from(categories.values());
  const labels = Array.from(categories.keys());
  GlyphUtilities.drawPieGlyph(ctx, x, y, values, radius, colors);
}
```

---

## extractAttributes

Extracts multiple attributes from `cellData` in a single call. Useful for multi-attribute aggregation.

### Signature

```javascript
extractAttributes(cellData, extractors)
```

### Parameters

- `cellData` (Array): Array of `{data, weight, ...}` objects
- `extractors` (Object): Object mapping attribute names to extractor functions or property names

### Returns

`Object` - Object with extracted attributes aggregated (sum by default for numeric values)

### Examples

```javascript
import { extractAttributes } from 'screengrid';

onDrawCell: (ctx, x, y, normVal, cellInfo) => {
  const { cellData } = cellInfo;
  
  // Extract multiple attributes
  const attrs = extractAttributes(cellData, {
    total: (item) => item.weight,
    count: () => 1,
    avg: (item) => item.data.value,
    category: (item) => item.data.category  // Collects all values
  });
  
  // attrs = {
  //   total: 150,        // Sum of weights
  //   count: 10,         // Number of items
  //   avg: 15,          // Sum of values
  //   category: ['A', 'B', 'A', ...]  // Array of all categories
  // }
  
  // Use for multi-attribute visualization
  const barValues = [attrs.total, attrs.count, attrs.avg];
  GlyphUtilities.drawBarGlyph(ctx, x, y, barValues, maxValue, cellSize);
}
```

---

## computeStats

Computes basic statistics from `cellData` values. Perfect for uncertainty encoding (error bars, confidence intervals).

### Signature

```javascript
computeStats(cellData, valueExtractor)
```

### Parameters

- `cellData` (Array): Array of `{data, weight, ...}` objects
- `valueExtractor` (Function|string, optional): Function to extract value, or property name (default: `weight`)

### Returns

`Object` - Statistics: `{mean, std, min, max, count, sum}`

### Examples

```javascript
import { computeStats } from 'screengrid';

onDrawCell: (ctx, x, y, normVal, cellInfo) => {
  const { cellData } = cellInfo;
  
  // Compute statistics from weights
  const stats = computeStats(cellData);
  // stats = { mean: 15.5, std: 3.2, min: 10, max: 20, count: 10, sum: 155 }
  
  // Compute statistics from a specific property
  const tempStats = computeStats(cellData, 'temperature');
  
  // Use for error bar glyph
  const mean = stats.mean;
  const error = stats.std;
  
  // Draw bar with error bars
  ctx.fillStyle = '#3498db';
  ctx.fillRect(x - 5, y - mean/2, 10, mean);
  
  // Error bars
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - mean/2 - error);
  ctx.lineTo(x, y - mean/2 + error);
  ctx.stroke();
}
```

---

## groupByTime

Groups `cellData` by time periods. Essential for temporal glyphs (time series, helix glyphs).

### Signature

```javascript
groupByTime(cellData, timeExtractor, valueExtractor, period, aggregator)
```

### Parameters

- `cellData` (Array): Array of `{data, weight, ...}` objects
- `timeExtractor` (Function|string): Function to extract time from data, or property name
- `valueExtractor` (Function|string, optional): Function to extract value, or property name (default: `weight`)
- `period` (string, optional): Time period: `'year'`, `'month'`, `'day'`, `'hour'` (default: `'year'`)
- `aggregator` (Function, optional): Aggregation function per period (default: sum)

### Returns

`Array` - Array of `{time, value}` objects sorted by time

### Examples

```javascript
import { groupByTime } from 'screengrid';

onDrawCell: (ctx, x, y, normVal, cellInfo) => {
  const { cellData } = cellInfo;
  
  // Group by year and sum values
  const timeSeries = groupByTime(cellData, 'year', 'value', 'year');
  // Returns: [{time: 2024, value: 100}, {time: 2025, value: 150}, ...]
  
  // Group by month
  const monthly = groupByTime(cellData, 'date', 'temperature', 'month');
  
  // Group by custom time extractor
  const hourly = groupByTime(
    cellData,
    (item) => new Date(item.data.timestamp),
    (item) => item.data.count,
    'hour'
  );
  
  // Use with built-in time series glyph utility
  GlyphUtilities.drawTimeSeriesGlyph(
    ctx, x, y,
    timeSeries,
    cellSize,
    { lineColor: '#2ecc71', showArea: true }
  );
}
```

---

## Common Patterns

### Pattern 1: Category Breakdown (Pie/Bar Chart)

```javascript
import { groupBy } from 'screengrid';

const categories = groupBy(cellData, 'category', 'value');
const values = Array.from(categories.values());
const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1'];

GlyphUtilities.drawPieGlyph(ctx, x, y, values, radius, colors);
```

### Pattern 2: Multi-Attribute Visualization

```javascript
import { extractAttributes } from 'screengrid';

const attrs = extractAttributes(cellData, {
  total: (item) => item.weight,
  count: () => 1,
  avg: (item) => item.data.value
});

// Use attrs.total, attrs.count, attrs.avg in your glyph
```

### Pattern 3: Uncertainty Encoding

```javascript
import { computeStats } from 'screengrid';

const stats = computeStats(cellData, 'temperature');
// Draw mean ± std as error bars
drawErrorBarGlyph(ctx, x, y, stats.mean, stats.std);
```

### Pattern 4: Time Series

```javascript
import { groupByTime } from 'screengrid';

const timeSeries = groupByTime(cellData, 'date', 'value', 'year');
GlyphUtilities.drawTimeSeriesGlyph(ctx, x, y, timeSeries, cellSize);
```

### Pattern 5: Combining Utilities

```javascript
import { groupByTime, computeStats } from 'screengrid';

// Group by time, then compute stats for each period
const timeSeries = groupByTime(cellData, 'year', 'temperature', 'year');
const stats = timeSeries.map(period => ({
  time: period.time,
  stats: computeStats(
    cellData.filter(item => {
      const year = typeof item.data.year === 'number' 
        ? item.data.year 
        : new Date(item.data.date).getFullYear();
      return year === period.time;
    }),
    'temperature'
  )
}));

// Now you have mean ± std for each time period
```

---

## Comparison with Manual Implementation

These utilities simplify common patterns. Compare:

**Before (manual):**
```javascript
const yearData = {};
cellData.forEach(item => {
  const year = item.data.year;
  const value = item.data.value;
  if (!yearData[year]) {
    yearData[year] = { total: 0, count: 0 };
  }
  yearData[year].total += value;
  yearData[year].count += 1;
});
const timeSeries = Object.values(yearData).map(d => ({
  year: d.year,
  value: d.total
}));
```

**After (with utility):**
```javascript
const timeSeries = groupByTime(cellData, 'year', 'value', 'year');
```

The utility handles:
- Null/undefined filtering
- Type checking
- Sorting
- Flexible extractors (function or property name)

---

## Best Practices

1. **Use property names for simple cases**: `groupBy(cellData, 'category')` is cleaner than `groupBy(cellData, (item) => item.data.category)`

2. **Combine utilities**: Use `groupByTime` then `computeStats` for statistical time series

3. **Handle empty data**: Always check if `cellData` is empty before using utilities

4. **Custom aggregators**: Provide custom aggregators when you need mean, max, or other functions instead of sum

5. **Type safety**: Utilities filter out null/undefined/NaN values automatically, but ensure your extractors return the expected types

---

## See Also

- [Glyph Drawing Guide](./GLYPH_DRAWING_GUIDE.md) - Complete guide to glyph visualization
- [Cartography & Multivariate Design](./CARTOGRAPHY_AND_MULTIVARIATE_DESIGN.md) - Design patterns and use cases
- [Spatio-Temporal Guide](./SPATIO_TEMPORAL_GUIDE.md) - Time series visualization patterns

