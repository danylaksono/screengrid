## Option B: Geometry Input and Placement Plan

### Overview
Extend `ScreenGridLayerGL` to accept non-point GeoJSON (Polygon, MultiPolygon, LineString, MultiLineString) via a built-in placement preprocessor and an optional non-aggregated “feature-anchors” rendering mode. The current point-based, screen-space grid aggregation remains the default and unchanged.

Goals:
- Support geometry inputs without breaking existing point workflows.
- Offer configurable placement strategies that convert geometries to anchor points.
- Allow switching between screen-space aggregation and per-feature geographic glyphs.

Non-Goals (initially):
- True polygon/line rasterization in the layer.
- Server-side or tile-based geometry fetching.

---

### Public API Additions (non-breaking)

Config additions to `new ScreenGridLayerGL({...})`:

```ts
type PlacementStrategy =
  | 'point'          // pass-through points
  | 'centroid'       // one point per feature (polygon/line centroid)
  | 'polylabel'      // better polygon label placement (optional dependency)
  | 'line-sample'    // sample points along line/multiline
  | 'grid-geo'       // sample interior at geodesic spacing (meters)
  | 'grid-screen';   // sample interior at screen-grid centers (pixels)

type PlacementPartition = 'union' | 'per-part'; // multipolygons

type Spacing =
  | { meters: number }
  | { pixels: number }; // pixels are viewport/screen-space dependent

interface PlacementConfig {
  strategy: PlacementStrategy;
  spacing?: Spacing;                // for line-sample, grid-geo, grid-screen
  partition?: PlacementPartition;   // multipolygon handling
  maxPerFeature?: number;           // cap samples to protect perf
  minArea?: number;                 // m^2; below -> fallback to centroid
  minLength?: number;               // meters; below -> fallback to centroid
  jitterPixels?: number;            // avoid exact overlaps
  zoomAdaptive?: boolean;           // convert pixels<->meters using current zoom/lat
}

type RenderMode = 'screen-grid' | 'feature-anchors';

interface LayerOptions extends ExistingOptions {
  // New: GeoJSON input alternative to `data`+`getPosition` (mutually exclusive)
  source?: GeoJSON.FeatureCollection | GeoJSON.Feature[];

  // New: placement preprocessor (used when `source` is provided)
  placement?: PlacementConfig;

  // New: select rendering path
  renderMode?: RenderMode; // default 'screen-grid'

  // New: anchor glyph sizing (only used in 'feature-anchors' mode)
  anchorSizePixels?: number; // default derived from cellSizePixels * glyphSize
}
```

Usage patterns:
- Keep existing behavior (points): use `data` and `getPosition` as today.
- Geometry input with aggregation (default): provide `source` + `placement` with `renderMode: 'screen-grid'` (or omit, default applies).
- Per-feature geographic glyphs: provide `source` + `placement` and set `renderMode: 'feature-anchors'` (bypasses aggregation).

---

### Rendering Modes and How They Interact

- renderMode = 'screen-grid' (default)
  - Placement converts geometries to points.
  - Aggregator bins screen-space cells; glyphs draw per cell (current pipeline).
  - Best for large volumes and density visualization.

- renderMode = 'feature-anchors'
  - Placement yields anchor points (typically 1 per feature for centroid/polylabel, or N for line-sample/grid-*).
  - Aggregation is bypassed; glyphs draw once per anchor (still in screen coordinates via `map.project`).
  - Best when users want “one glyph per geographic unit” or explicitly sampled anchors.

Switching between the two can be done at runtime via `layer.setConfig({ renderMode: 'feature-anchors' })` with internal re-render.

---

### Placement Strategies (initial scope)

1) point
- Pass-through for Point/MultiPoint features. Lines/Polygons are ignored unless a fallback is specified.

2) centroid
- One anchor per feature. For LineString, use line centroid; for Polygon/MultiPolygon, use polygon centroid.
- Multipolygons: `partition` = 'union' (one centroid for all parts) or 'per-part' (one per polygon part).

3) line-sample
- Sample anchors at regular intervals along lines (pixels or meters). Always ensure at least one anchor if the feature is visible.

4) grid-geo
- Fill polygon interior with anchors at geodesic spacing (meters). Respect holes; optionally cap with `maxPerFeature`.

5) grid-screen
- Select anchors from the current viewport’s screen grid whose centers fall inside polygons (or within a band around lines).
- When combined with `renderMode: 'screen-grid'`, ensure we are not double-aggregating unintentionally. See “Risks” below.

6) polylabel (optional, phase 2+)
- Use robust polylabel algorithm (pole of inaccessibility) for better label placement over irregular polygons. Fallback to centroid on failure/timeout.

---

### Lifecycle, Caching, and Triggers

- Placement runs when:
  - `source` or `placement` changes.
  - `renderMode` toggles (may change rendering path).
  - View-dependent strategies require re-run on zoom/pan (grid-screen, zoomAdaptive, pixels spacing).

- Caching:
  - Cache per strategy and inputs with a key that includes: strategy, placement config, zoom bucket, viewport hash (for screen-grid), and a source version.
  - Reuse previous results when pan deltas are small (grid-screen) via partial recompute over newly exposed regions.

- Workers:
  - Offload heavy placement (dense grid-geo, polylabel) to a Web Worker.
  - Main thread receives anchors + lightweight metadata only.

---

### Event Model and Legend

- 'screen-grid' mode: events/hit-tests remain cell-based (existing behavior).
- 'feature-anchors' mode: events target nearest anchor within a pixel radius; expose underlying feature properties in callbacks.
- Legends:
  - 'screen-grid' continues to show aggregations.
  - 'feature-anchors' can show categorical or size/color mappings for anchors. Provide an automatic mode in the Legend module keyed off `renderMode`.

---

### What Might Go Wrong (Risks) and Mitigations

1) Double aggregation with `grid-screen` + 'screen-grid' mode
- Risk: sampling screen-grid centers inside polygons then binning them again into the same screen grid yields sparse, misleading counts.
- Mitigation: when `placement.strategy === 'grid-screen'`, enforce `renderMode: 'feature-anchors'` or auto-align spacing to exactly 1:1 with `cellSizePixels` and treat each anchor as a pre-aggregated cell (skip aggregator).

2) Performance regressions on large polygons or dense sampling
- Risk: grid-geo/grid-screen may produce many anchors; polylabel can be expensive.
- Mitigation: cap `maxPerFeature`, use workers, add timeouts/fallbacks (e.g., fallback to centroid on timeout), and throttle recomputation on pan/zoom.

3) Hit-testing semantics diverge
- Risk: users expect cell data in 'feature-anchors' mode.
- Mitigation: document event payloads per mode and provide consistent fields: `{ mode, anchor | cell, featureProps | aggregatedStats }`.

4) Visual overlap and z-order in 'feature-anchors'
- Risk: anchors cluster visually and hide each other.
- Mitigation: introduce optional `jitterPixels`, small declutter, and draw order configs (e.g., sort by weight).

5) Multipolygon ambiguity
- Risk: placing a single anchor for distant parts is misleading.
- Mitigation: `partition: 'per-part'` to place anchors per polygon part; default 'union' for administrative areas that are close-knit.

6) Dateline/projection edge cases
- Risk: centroid/polylabel across antimeridian.
- Mitigation: normalize longitudes, rely on `map.project/unproject`, clip to viewport for sampling strategies.

7) Legend mismatch when switching modes
- Risk: legend shows grid-scale while rendering per-feature.
- Mitigation: Legend auto-detects `renderMode` and adjusts type; allow override via Legend options.

8) API complexity
- Risk: too many knobs overwhelm users.
- Mitigation: sensible defaults (`centroid`, 'union', no jitter, autosized anchors) and presets; validate configs with clear error messages.

9) Memory bloat from caches
- Risk: multiple zoom/view caches balloon.
- Mitigation: LRU per strategy; clear on layer removal; size-aware cache eviction.

---

### Geographic vs Screen-Space Considerations

- Implementing centroid/polylabel is straightforward: compute geographic anchors, then draw them by projecting to screen (`map.project`)—no new MapLibre layers are required.
- 'feature-anchors' uses the same Canvas 2D renderer; glyphs are positioned at anchor pixel coordinates.
- For constant visual size, use pixel-sized glyphs; for scale-by-zoom, introduce a pixels-per-meter helper if needed.
- Conclusion: there is no architectural blocker to supporting simple geographic anchors even though rendering remains in screen space.

---

### Phased Implementation Plan

#### ✅ Phase 0: Scaffolding (COMPLETED)
- ✅ Added config parsing/validation for `source`, `placement`, and `renderMode` in `ConfigManager.js`
- ✅ Created `PlacementValidator.js` with comprehensive validation rules
- ✅ Prepared interfaces and internal state for placement outputs and caching in `ScreenGridLayerGL.js`
- ✅ Created geometry utility module (`GeometryUtils.js`) for centroid calculations, distance, and coordinate conversions

#### ✅ Phase 1: Placement core (centroid, line-sample) (COMPLETED)
- ✅ Implemented pure placement module (`src/core/geometry/PlacementEngine.js`) that accepts GeoJSON and returns anchors
- ✅ Implemented `CentroidStrategy.js` for polygon/line centroid placement with multipart support
- ✅ Implemented `LineSampleStrategy.js` for sampling points along lines with configurable spacing
- ✅ Implemented `PointStrategy.js` for pass-through point features
- ✅ Created `PlacementStrategyRegistry.js` for strategy management
- ✅ Wired `source`+`placement` → anchors → existing pipeline by converting anchors to `data` for 'screen-grid' mode
- ✅ Added view-dependent caching with zoom/pan threshold detection
- ✅ Example file created: `examples/admin-centroid.html` (ready for testing once build is complete)

#### ✅ Phase 2: Feature-anchors rendering mode (COMPLETED)
- ✅ Added 'feature-anchors' path that bypasses aggregation in `_aggregate()`
- ✅ Implemented `_drawFeatureAnchors()` method for direct glyph rendering at anchor positions
- ✅ Implemented anchor hit-testing via `_getAnchorAt()` method
- ✅ Updated `getCellAt()` to support both screen-grid and feature-anchors modes
- ✅ Event handlers automatically work with feature-anchors mode (backward compatible payloads)
- ✅ View-dependent placement recomputation on zoom/pan for strategies that need it
- ✅ Auto-calculated `anchorSizePixels` based on `cellSizePixels * glyphSize`

#### ✅ Phase 3: grid-geo and grid-screen strategies (COMPLETED)
- ✅ Implemented interior sampling for polygons using geodesic grid
- ✅ Handle polygon holes via `pointInPolygonWithHoles` utility
- ✅ Implemented screen-grid center selection for `grid-screen` strategy
- ✅ View-dependent recomputation on pan/zoom for grid-screen (via cache invalidation)
- ✅ Example created: `examples/admin-grid-screen.html`
- ⏳ Worker support for heavy strategies (deferred - can be added later if needed)
- ⏳ Partial recompute on pan/zoom (deferred - current full recompute works well)

#### ✅ Phase 4: polylabel (optional, behind flag) (COMPLETED)
- ✅ Integrated polylabel library with timeout/fallback to centroid
- ✅ Graceful fallback when polylabel package is not installed
- ✅ Supports precision and timeout configuration
- ⏳ Test cases for pathological polygons (deferred - can be added in test suite)

### Implementation Status Summary

**Completed:**
- ✅ Configuration validation and management
- ✅ Geometry utilities (centroid, distance, coordinate conversion)
- ✅ Placement strategies: `point`, `centroid`, `line-sample`
- ✅ Placement engine with caching
- ✅ Feature-anchors rendering mode
- ✅ Event handling for feature-anchors
- ✅ View-dependent recomputation
- ✅ Integration with existing screen-grid pipeline

**Completed (All Phases):**
- ✅ `grid-geo` strategy (polygon interior sampling with geodesic spacing)
- ✅ `grid-screen` strategy (screen-grid center selection)
- ✅ `polylabel` strategy (optional, with fallback)
- ✅ Polygon hole handling in all grid strategies
- ✅ Point-in-polygon utilities (ray-casting algorithm)
- ✅ View-dependent caching and recomputation

**Future Enhancements (Optional):**
- ⏳ Worker offloading for heavy strategies (performance optimization)
- ⏳ Partial recompute on pan/zoom for grid-screen (performance optimization)
- ⏳ Legend mode switching (auto-detect renderMode)
- ⏳ Comprehensive test suite
- ⏳ More sophisticated polygon area calculation for better centroid

---

### Testing and Quality

- Unit tests: placement strategies with small synthetic geometries; edge cases (tiny polygons, multiparts, dateline).
- Integration tests: event payloads for both modes; legends; mode toggling.
- Performance: benchmark anchors count, worker offloading, and pan/zoom responsiveness.

---

### Open Questions

- Should `grid-screen` auto-switch to 'feature-anchors' to avoid double aggregation, or warn and proceed?
- Default `partition` for multipolygons: 'union' or 'per-part'?
- Provide `anchorSizeMeters` for zoom-stable geographic sizing?
- Expose a convenience `layer.setSource(geojson, placement)` API?

---

### Example Configs

1) Admin boundaries, one glyph per polygon centroid:
```js
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

2) Roads with sampled anchors, still aggregated in screen grid:
```js
const layer = new ScreenGridLayerGL({
  source: roadsGeoJSON,
  placement: { strategy: 'line-sample', spacing: { meters: 200 }, zoomAdaptive: true },
  renderMode: 'screen-grid',
  cellSizePixels: 60,
  colorScale: v => [255 * v, 200 * (1 - v), 50, 220]
});
```

3) Admin areas filled with screen-grid anchors, drawn directly (avoid double aggregation):
```js
const layer = new ScreenGridLayerGL({
  source: adminGeoJSON,
  placement: { strategy: 'grid-screen', spacing: { pixels: 60 } },
  renderMode: 'feature-anchors', // draw per anchor
  anchorSizePixels: 14,
  glyph: 'heatmap',
  enableGlyphs: true
});
```

---

### Documentation and Examples

- Add a “Geometry Input & Placement” section to README and docs with the above usage patterns.
- New examples under `examples/`:
  - `admin-centroid.html` (feature-anchors + centroid)
  - `roads-sampled.html` (screen-grid + line-sample)
  - `admin-grid-screen.html` (feature-anchors + grid-screen)

---

### Summary
This plan enables geometry inputs with a flexible placement system and a clear switch between the current screen-space aggregation and simple geographic glyphs. It preserves backward compatibility, isolates complexity in a pure placement module, and offers staged delivery to manage risk and performance. 


