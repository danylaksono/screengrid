## Placement Configuration: Validation Shape and Rules

This document defines the configuration shape for geometry placement and the validation rules the layer should enforce.

The goal is to keep defaults sensible, ensure errors are actionable, and make it clear when view-dependent recomputation will occur.

---

### Types

```ts
type PlacementStrategy =
  | 'point'          // Pass-through points
  | 'centroid'       // One anchor per feature (polygon/line centroid)
  | 'polylabel'      // Better polygon label placement (optional dependency; falls back to centroid)
  | 'line-sample'    // Sample points along line/multiline
  | 'grid-geo'       // Sample polygon interior at geodesic spacing (meters; respects holes)
  | 'grid-screen';   // Sample polygon interior at screen-grid centers (pixels; view-dependent)

type PlacementPartition = 'union' | 'per-part'; // Multipolygons

type Spacing =
  | { meters: number }
  | { pixels: number };

interface PlacementConfig {
  strategy: PlacementStrategy;
  spacing?: Spacing;
  partition?: PlacementPartition;
  maxPerFeature?: number;
  minArea?: number;        // m²; polygons smaller than this may fallback
  minLength?: number;      // meters; lines shorter than this may fallback
  jitterPixels?: number;
  zoomAdaptive?: boolean;  // Convert pixels<->meters using current zoom/lat
}

type RenderMode = 'screen-grid' | 'feature-anchors';

interface LayerOptionsExtension {
  // Mutually exclusive with existing `data` + `getPosition`
  source?: GeoJSON.FeatureCollection | GeoJSON.Feature[];
  placement?: PlacementConfig;
  renderMode?: RenderMode;         // default: 'screen-grid'
  anchorSizePixels?: number;       // only in 'feature-anchors' mode
}
```

---

### Validation Rules

1) Mutual exclusivity
- Either `data` + `getPosition` (current behavior) OR `source` + `placement`. If both are set, throw an error:
  - "Provide either `data`/`getPosition` or `source`/`placement`, not both."

2) Required fields for geometry input
- When `source` is provided:
  - `placement.strategy` is required.
  - `renderMode` defaults to `'screen-grid'` if omitted.

3) Strategy-specific requirements
- `'centroid'`:
  - No `spacing` required.
  - Optional: `partition` for multipolygons. Default `'union'`.

- `'polylabel'`:
  - No `spacing` required.
  - Optional: `partition`. Default `'union'`.
  - If polylabel dependency unavailable, warn and fallback to `'centroid'` unless `strict` mode is added later.

- `'line-sample'`:
  - `spacing` is required (either `{ meters }` or `{ pixels }`).
  - Optional: `minLength`, `maxPerFeature`, `zoomAdaptive`.

- `'grid-geo'`:
  - `spacing` is required with `{ meters }`.
  - Optional: `minArea`, `maxPerFeature`, `zoomAdaptive` (ignored; spacing already meters-based).

- `'grid-screen'`:
  - `spacing` is required with `{ pixels }`.
  - Optional: `maxPerFeature`, `jitterPixels`.
  - Caution: see double-aggregation rule below.
  - View-dependent: recomputes anchors on pan/zoom; caching reduces churn.

4) Spacing constraints
- For any `spacing`:
  - Value must be a finite positive number: `> 0 && isFinite(value)`.
  - Reject config if both `meters` and `pixels` are present at once.

5) Numeric bounds
- `maxPerFeature`: integer `>= 1`. If set to a very high number, log a performance warning.
- `minArea`: `>= 0`. Units m².
- `minLength`: `>= 0`. Units meters.
- `jitterPixels`: `>= 0`.
- `anchorSizePixels`: `> 0` (only used in 'feature-anchors').

6) Partition
- `partition` must be `'union' | 'per-part'`. Default `'union'`.

7) Double aggregation safeguard
- If `placement.strategy === 'grid-screen'` and `renderMode === 'screen-grid'`:
  - The library auto-switches `renderMode` to `'feature-anchors'` to avoid double aggregation and logs a single, deduplicated console warning to inform users of the switch.
  - This auto-switch is non-breaking and intended to prevent unintended double-aggregation when sampling polygon interiors using screen-space grid centers.

8) View-dependent recomputation
- If `spacing` uses `{ pixels }` or `zoomAdaptive: true`, mark placement as view-dependent.
- On `move`, `zoom`, or `resize`, recompute anchors only when a threshold is exceeded:
  - Zoom changed enough to alter pixel/meter scale bucket.
  - Pan exceeds X% of viewport width/height (e.g., 25%). These thresholds should be tunable internally.

9) Fallbacks
- Tiny polygons (below `minArea`) and short lines (below `minLength`) should fallback to a single `'centroid'` anchor unless `maxPerFeature` is forcing at least one sample.
- In any placement failure (invalid geometry, numerical issues), fallback to centroid and log a warning.

10) Source validation
- `source` must be FeatureCollection or array of Features.
- Each Feature must have a supported `geometry.type`:
  - Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon.
  - Unknown types (GeometryCollection) are skipped with a warning (optionally expand later).

---

### Error and Warning Messages (Proposed)

- Mutual exclusivity:
  - "Invalid config: Provide either `data`/`getPosition` or `source`/`placement`, not both."

- Missing strategy:
  - "Invalid placement: `placement.strategy` is required when `source` is provided."

- Missing spacing:
  - "Invalid placement: `spacing` is required for strategy '{strategy}'."

- Spacing units conflict:
  - "Invalid spacing: Specify exactly one of `{ meters }` or `{ pixels }`."

- Non-positive or non-finite numeric:
  - "Invalid value: `{key}` must be a finite positive number."

- Double aggregation:
  - "Placement 'grid-screen' with renderMode 'screen-grid' may double-aggregate. Auto-switching to 'feature-anchors'."

- Unsupported geometry:
  - "Unsupported geometry type '{type}'. Skipping feature id={id}."

- Polylabel fallback:
  - "Polylabel unavailable or timed out; falling back to 'centroid' for feature id={id}."

---

### Defaulting Strategy

- When `source` is present:
  - `placement.strategy` has no default (must be explicit).
  - `placement.partition` defaults to `'union'`.
  - `renderMode` defaults to `'screen-grid'` (for `grid-screen`, the system auto-switches to `'feature-anchors'` to avoid double aggregation and logs a warning).
  - `anchorSizePixels` defaults to `Math.round(cellSizePixels * glyphSize * 0.9)` for visual parity.

---

### Sample Valid Configs

```js
// 1) Admin boundaries, one glyph per polygon (centroid)
{
  source: adminGeoJSON,
  placement: { strategy: 'centroid', partition: 'union' },
  renderMode: 'feature-anchors',
  anchorSizePixels: 18,
  glyph: 'circle',
  enableGlyphs: true
}

// 2) Roads sampled every 200 meters, still aggregated into screen grid
{
  source: roadsGeoJSON,
  placement: { strategy: 'line-sample', spacing: { meters: 200 }, zoomAdaptive: true },
  renderMode: 'screen-grid',
  cellSizePixels: 60
}

// 3) Admin areas filled with anchors from screen grid centers; drawn per anchor
{
  source: adminGeoJSON,
  placement: { strategy: 'grid-screen', spacing: { pixels: 60 } },
  renderMode: 'feature-anchors',
  anchorSizePixels: 14,
  glyph: 'heatmap',
  enableGlyphs: true
}
```

---

### Notes for Implementers

- Keep the validator small and pure; run it at construction and on `setConfig` updates.
- Emit warnings once per session (de-duplicate) to avoid noisy consoles.
- Use map's `project/unproject` to maintain consistency between placement and rendering coordinates.
- For `polylabel`, treat the dependency as optional; if not present or if computation times out, fallback to `centroid` and warn.

### See Also

- Geometry Input & Placement Guide: `docs/GEOMETRY_INPUT_AND_PLACEMENT.md`



