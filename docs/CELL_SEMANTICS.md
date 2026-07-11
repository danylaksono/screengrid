# Semantic Cells and Migration Guide

ScreenGrid now treats each populated cell as an analytical cartographic object, not only as a rendered bin. Aggregation results expose:

```js
{
  grid,
  cellData,
  cells,
  populatedCells,
  cellSemantics
}
```

`cells[index]` is the preferred public interface. `cellData` and `customData` remain as migration aliases for older glyph callbacks.

## Semantic Cell Shape

Each cell contains:

- `spatial`: cell type, screen bounds, centroid, zoom, cell size, viewport, and aggregation mode.
- `records`: count, denominator, and raw record references.
- `measures`: numeric summaries, categorical distributions, missingness, variance, and weight.
- `reliability`: sample-size class plus warnings for sparse, missing, or heterogeneous cells.
- `comparability`: normalisation mode and whether the cell can support cross-cell, cross-viewport, or cross-zoom claims.
- `custom`: legacy `onAfterAggregate` output.

Glyph callbacks should use the semantic object directly:

```js
onDrawCell: (ctx, x, y, normalised, cell) => {
  const count = cell.records.count;
  const value = cell.measures.fields.score?.mean ?? 0;
  const reliability = cell.reliability.sampleSizeClass;
}
```

## Migration

Older callbacks still work during the migration window:

```js
onDrawCell: (ctx, x, y, normalised, cellInfo) => {
  const records = cellInfo.cellData;
  const legacy = cellInfo.customData;
}
```

New code should prefer `cell.records.rawRefs` and `cell.custom`. The legacy aliases are intentionally redundant so existing examples can be upgraded gradually.

## Cartographic Interpretation

Screen-space cells are viewport-dependent. They are excellent for interactive density, composition, and profile exploration, but should not be described as fixed geographic districts. Use global normalisation or explicit denominators for cross-place claims, and expose reliability warnings when sparse cells carry strong visual emphasis.
