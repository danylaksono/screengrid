## Geometry Input & Placement Guide

This guide explains how to use non-point geometries (Polygon, MultiPolygon, LineString, MultiLineString) with the ScreenGrid layer via the built-in placement preprocessor and the new rendering mode for per-feature glyphs.

The current point-based, screen-space grid aggregation remains supported and is the default.

---

### New Concepts

- `source`: Provide GeoJSON Features instead of an array of points. Mutually exclusive with `data`/`getPosition`.
- `placement`: Configure how geometry features are converted to “anchors” (points) for rendering or aggregation.
- `renderMode`:
  - `screen-grid` (default): anchors are aggregated into screen-space cells (current pipeline).
  - `feature-anchors`: anchors are drawn directly (one glyph per anchor).

---

### Quick Start

```js
import { ScreenGridLayerGL } from 'screengrid';

// Example: Admin areas with centroid anchors, drawn once per feature
const layer = new ScreenGridLayerGL({
  source: adminGeoJSON,
  placement: { strategy: 'centroid', partition: 'union' },
  renderMode: 'feature-anchors',
  anchorSizePixels: 18,
  glyph: 'circle',
  glyphConfig: { color: '#3498db', alpha: 0.9 },
  enableGlyphs: true
});
```

---

### Placement Strategies

- `point` (Point/MultiPoint pass-through)
- `centroid` (one anchor per feature; line/polygon centroid)
- `line-sample` (sample points at regular intervals along lines)
- `grid-geo` (sample polygon interior at geodesic spacing in meters; respects holes)
- `grid-screen` (screen-grid center selection for anchors inside polygons; pixels)
- `polylabel` (optional; better polygon label placement, falls back to centroid)

See also: `docs/PLACEMENT_CONFIG.md` for the full schema and validation rules.

---

### Rendering Modes

- `screen-grid` (default):
  - `source + placement` produce anchors → anchors aggregated to cells → glyphs per cell.
  - Works well for density visualizations and large datasets.

- `feature-anchors`:
  - `source + placement` produce anchors → anchors drawn directly with glyphs.
  - Best for one-glyph-per-feature or controlled sampling like `grid-screen`.

Note: When using `grid-screen`, the system auto-switches to `feature-anchors` to avoid double aggregation.

---

### Examples

1) One glyph per polygon centroid:
```js
new ScreenGridLayerGL({
  source: adminGeoJSON,
  placement: { strategy: 'centroid' },
  renderMode: 'feature-anchors',
  anchorSizePixels: 18,
  glyph: 'circle',
  enableGlyphs: true
});
```

2) Lines sampled every 200 meters and then aggregated into the grid:
```js
new ScreenGridLayerGL({
  source: roadsGeoJSON,
  placement: { strategy: 'line-sample', spacing: { meters: 200 }, zoomAdaptive: true },
  renderMode: 'screen-grid',
  cellSizePixels: 60
});
```

3) Polygons filled with screen-grid anchors, drawn directly:
```js
new ScreenGridLayerGL({
  source: adminGeoJSON,
  placement: { strategy: 'grid-screen', spacing: { pixels: 60 }, maxPerFeature: 200 },
  renderMode: 'feature-anchors',
  anchorSizePixels: 10,
  glyph: 'circle',
  enableGlyphs: true
});
```

---

### Performance & Pitfalls

- Avoid double aggregation: `grid-screen` should be used with `feature-anchors`.
- Use `maxPerFeature` to limit dense grids.
- For heavy strategies (`grid-geo`, `polylabel`), consider larger spacing or fewer features.
- View-dependent recomputation: `grid-screen` and pixel-based spacing will recompute on pan/zoom; caching reduces churn.

---

### Optional Dependency: polylabel

To enable `polylabel` placement with pole-of-inaccessibility, install the package:

```bash
npm install polylabel
```

If it’s not installed, the library falls back to `centroid` with a console warning.

---

### Events & Legend

- `feature-anchors`: hover/click events return the nearest anchor and its feature props in a backward-compatible “cell-like” payload.
- `screen-grid`: events remain cell-based as before.
- Legends can be configured similarly; auto-detection by `renderMode` can be added in the legend module.


