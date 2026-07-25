# AGENTS.md — Screengrid

Operational guidance for coding agents working with **Screengrid**, a screen-space gridded
glyphmap library for MapLibre GL JS. This file encodes the Screengrid **grammar** and its
**cartographic validation rules** as guardrails: follow them and the maps you build will be
reproducible and defensible; ignore them and the maps may render fine while quietly
misleading their readers.

Two audiences:

- **Map-authoring agents** — asked to build a gridded glyphmap from point data
  (sections 1–8). Everything you produce should be driven by a declarative *spec*, not by
  ad-hoc rendering code.
- **Library-contributing agents** — asked to change Screengrid itself (section 9).

Grammar spec format: **version 0.2.0** (`SPEC_VERSION` in `src/grammar/validateSpec.js`).
The executable reference for everything below is `tests/unit/GrammarSpec.test.js`.

---

## 1. What a gridded glyphmap is (and what to credit)

A gridded glyphmap aggregates point data into regularly tessellated **screen-space cells**
(square or hex, sized in pixels) and draws a **glyph** in each cell summarising the cell's
multivariate data. The technique and its design space are due to **Aidan Slingsby**
(IEEE VIS 2023, doi:10.1109/VIS54172.2023.00009, and the gridded-glyphmap design-space
manuscript). Screengrid contributes the **executable formalization**: a declarative
grammar, machine-checkable validation, and semantic cells that carry provenance,
reliability, and comparability. When documenting or publishing anything built here, credit
the technique to Slingsby and describe Screengrid's role as formalization.

**The one fact that governs everything:** screen-space cells are **viewport-dependent**.
Panning, zooming, or resizing re-aggregates the data into different cells. Cells are
*interactive analytical bins*, never stable geographic districts. Every design decision
below exists to stop that property from misleading readers.

## 2. The authoring workflow (always in this order)

```text
dataset profile -> analytical intent -> spatial aggregation contract
-> semantic cell model -> glyph grammar -> cartographic validation
-> rendering + interaction
```

1. **Profile the data** — field names/types/ranges, missingness, categorical cardinality,
   coordinate candidates. The profile is embedded in the spec (`datasetProfile`) so specs
   are self-describing.
2. **Declare the intent** — `intent.task` (what question the map answers) and
   `intent.comparison` (what the reader will compare). Validation rules key off these:
   an undeclared intent cannot be checked.
3. **Write the spec** — a single JSON document conforming to
   `src/grammar/schemas/screengrid-spec.schema.json`.
4. **Validate** — `validateSpec(spec)`. **Errors are blockers.** Warnings are cartographic
   risks: fix them, or state in your output why each remaining warning is acceptable for
   the stated intent. Never silently ignore a warning.
5. **Compile and render** — `compileSpec(spec)` returns `ScreenGridLayerGL` options; pass
   your data and add the layer to the map.
6. **Save the spec** — the spec (JSON, with its `version`) is the deliverable that makes
   the map reproducible. Hand it over alongside any screenshot.

```js
import { validateSpec, compileSpec, ScreenGridLayerGL } from 'screengrid';

const report = validateSpec(spec);
if (!report.valid) throw new Error(report.errors.join('\n'));
report.warnings.forEach((w) => console.warn('[cartographic]', w));

const { layerOptions } = compileSpec(spec, { parameters: { w_access: 0.7 } });
map.addLayer(new ScreenGridLayerGL({ id: 'glyphmap', data, ...layerOptions }));
```

## 3. The spec, minimally

Required top-level keys: `version`, `datasetProfile`, `intent`, `screengrid`, `glyph`,
`interaction`. Key fields:

```jsonc
{
  "version": "0.2.0",
  "datasetProfile": { "rowCount": 0, "fields": [], "coordinateCandidates": [] },
  "intent": { "task": "density", "comparison": "within-cell" },
  "parameters": [],
  "screengrid": {
    "coordinateSystem": "lonlat",
    "coordinateFields": { "x": "lon", "y": "lat" },
    "aggregationMode": "screen-grid",          // or "screen-hex"
    "aggregation": { "function": "count" },    // count|sum|mean|max|min|derived|custom
    "derivedMeasures": [],
    "cellSizePixels": 48,                      // 12..180
    "summaries": [{ "name": "count", "role": "primary", "op": "count",
                    "reliability": { "warnBelowCount": 5 } }],
    "normalization": "max-local"               // max-local|max-global|z-score|percentile
  },
  "glyph": { "type": "heatmap", "channels": {}, "scales": {}, "palette": "ember",
             "legend": { "enabled": true } },
  "interaction": { "hover": true, "click": true }
}
```

Intent vocabulary: `density`, `composition`, `profile-comparison`, `temporal-trend`,
`anomaly`, `uncertainty`, `flow-balance`, `suitability`.
Comparison vocabulary: `within-cell`, `across-cells`, `across-viewports`, `across-zoom`.

## 4. Derived measures and parameters (composite scores done right)

For weighted composites (MCDA/suitability), rates, and differences, **never** hide the
computation in custom code. Declare it:

```jsonc
"parameters": [
  { "name": "w_cost",   "domain": [0, 1], "default": 0.5 },
  { "name": "w_access", "domain": [0, 1], "default": 0.5 }
],
"screengrid": {
  "aggregation": { "function": "derived", "measure": "suitability" },
  "derivedMeasures": [{
    "name": "suitability",
    "op": "weighted-sum",                     // or "ratio", "difference"
    "aggregate": "mean",
    "terms": [
      { "field": "cost",   "weight": { "param": "w_cost" },
        "normalize": "global", "invert": true },   // cost-like: lower is better
      { "field": "access", "weight": { "param": "w_access" },
        "normalize": "global" }
    ]
  }],
  "normalization": "max-global"
}
```

Rules the validator enforces here:

- Multi-term weighted sums over raw (unnormalized) fields are flagged: criteria in
  different units are **not commensurable**. Use `"normalize": "global"` per term.
- A derived measure compared `across-cells`/`across-viewports` under `max-local`
  normalization is flagged: composite scores are only comparable under global scaling.
- `ratio` requires an **explicit denominator**: `{"type": "count" | "field" | "area" |
  "external"}`. Rates without declared denominators are unfalsifiable.
- Weight `{"param": ...}` must reference a declared parameter; runtime overrides are
  clamped to the parameter's domain.

Escape hatch: `aggregation: {"function": "custom", "ref": "<registered-name>"}` is legal,
but the spec becomes `checkability: "partial"` — the validator cannot see the design logic,
so reproducibility and validation guarantees weaken. Use it only when the declarative ops
genuinely cannot express the computation, and say so in your output.

## 5. Cartographic guardrails (the design knowledge)

These mirror `validateSpec` — errors first, then warnings. Each warning encodes a known
failure mode of gridded glyphmaps.

**Hard errors (spec will not compile/render honestly):**

- Missing/invalid `version`; unknown intent; unknown coordinate/summary/channel fields;
  non-numeric fields in numeric roles; cell size outside 12–180 px; unsupported
  glyph/palette/normalization; uncertainty marks without `data.lower`/`data.upper`;
  derived measures with unknown fields, parameters, or missing denominators.

**Warnings (renders, but risks misleading — fix or justify):**

| Rule | Why it exists |
| --- | --- |
| Local normalization + cross-cell/viewport comparison claim | Under `max-local`, every view rescales; two identical cells in different views look different. Use `max-global` for comparison claims. |
| Glyph smaller than ~18 px | Sub-legible glyphs invite shape-reading errors (Borgo et al.). Increase `cellSizePixels` or simplify the glyph. |
| More than ~6 categories in pie/ring/radial glyphs | Angle + hue discrimination collapses; aggregate long tails first. |
| Composition intent without a categorical segment field | The glyph cannot answer the stated question. |
| Temporal intent without a custom profile glyph | Single-value glyphs hide trajectories. |
| Uncertainty/anomaly intent without an uncertainty encoding | Showing a mean without spread invites overconfidence. Use `band`/`interval`/`whisker` marks or bind `opacity` to a reliability field. |
| No low-count reliability threshold | Sparse cells (1–4 points) render as confidently as dense ones; readers over-interpret them. Set `reliability.warnBelowCount`. |
| `mean` summaries without `variance`/`missingness` | Means hide within-cell heterogeneity — cells can aggregate very diverse distributions. |
| Cross-viewport claim without a denominator | Absolute screen-cell values change with the view; only rates/shares survive it. |
| Screen-space mode (always emitted) | The viewport-dependence reminder. Carry it into captions and legends. |

**Beyond the validator (not machine-checked — your judgment):**

- Prefer the **simplest glyph that answers the intent**; complexity is a cost, not a
  feature.
- Always render a legend; label what the normalization means ("scaled to view maximum"
  vs "scaled to dataset maximum").
- In captions/tooltips, describe cells as "screen cells at the current view", never as
  neighborhoods, districts, or areas.
- Glyph instability while panning is *information*: if glyphs change a lot under small
  pans, the pattern is aggregation-sensitive — say so rather than hiding it.

## 6. Intent → design quick reference

| Intent | Typical design | Must check |
| --- | --- | --- |
| density | heatmap cell or sized circle | normalization scope, low-count threshold |
| composition | pie/ring segments over count background | category count ≤ 6, denominator |
| profile-comparison | bar glyph or radial profile | shared global scale across cells |
| temporal-trend | custom cartesian `line`/`point`, `order: "temporal"`, `domain: "global"` | ordered fields, global domain, sample size |
| uncertainty | central mark + `band`/`interval`/`whisker`, or opacity=reliability | lower/upper fields present |
| anomaly | value vs baseline (e.g. `difference` measure) + reliability cue | baseline definition, sparse-cell noise |
| suitability (MCDA) | derived `weighted-sum` + parameter weights | per-term normalization, global normalization, weights as parameters |
| flow-balance | directional wedges (limited support) | denominator; do not imply routes |

## 7. Semantic cells (what interaction/tooltips should use)

Aggregation results expose `cells` / `populatedCells`: each populated cell is a structured
object (see `docs/CELL_SEMANTICS.md`):

- `records` — count, denominator, raw record refs (provenance)
- `measures` — per-field numeric stats and category distributions (computed lazily)
- `reliability` — `sampleSizeClass` + warnings (`low-sample-size`, `missing-values`,
  `high-within-cell-heterogeneity`)
- `comparability` — whether the current normalization supports cross-cell / cross-viewport
  / cross-zoom claims

Use these in glyph callbacks and tooltips: surface `reliability.warnings` for sparse cells,
and gate any comparative wording on `comparability`. Do not recompute per-cell statistics
by hand — read them from the cell.

**Pick the lightest route that serves the intent (matters at scale).** Semantic cells are
lazy: the default colour aggregation and render path read only `grid`/`cellData` and never
build them. The cost is in a cell's `measures`/`reliability` (per-field stats), computed on
first read. Screen-space maps **re-aggregate on every pan/zoom frame**, so anything read per
cell *per frame* is paid per frame. Decide the render route accordingly:

- **Efficient route** — density/colour, or a glyph that needs only a value or two: read
  `cell.cellData` (the raw records) directly in the draw callback and compute just what you
  draw (e.g. a sum for a bar height). Do **not** touch `cell.measures` in a per-frame glyph
  over a large dataset — that materialises the full per-field summary for every cell every
  frame. This is not "recomputing statistics by hand" (above); it is drawing a raw value.
- **Full semantic route** — reserve `cell.measures` / `cell.reliability` / `cell.comparability`
  for **interaction** (hover/click tooltips, inspectors) and for glyphs whose whole point is
  the multivariate summary or its reliability. There they are read occasionally (one cell),
  not every frame — and there you *must* read them rather than hand-roll the stats.
- For dense glyph maps that don't highlight on hover, set `hoverRepaint: false` so moving the
  cursor doesn't force a full-canvas redraw each time it crosses a cell (`onHover` still fires).
- Prefer `screen-grid` over `screen-hex` for the largest datasets — the square grid bins into
  a flat array; hex bins into a keyed map (more work per frame).
- The grammar itself is cheap: **validate every spec** (it runs once, not per frame). Scale
  never justifies skipping validation — only a lighter *render* route.

Rule of thumb: full semantic/grammar route when the map's job *is* the per-cell summary or its
reliability/comparability; the efficient raw route when it isn't. `examples/grammar/` shows the
semantic route; `examples/stress-test/` shows the raw route on up to 500k points.

**Glyphs can draw beyond one cell (advanced — via the generic hooks, not the grammar).** The
declarative grammar describes a glyph *inside* each cell, but screen-space glyphs render onto one
shared, unclipped canvas, so an `onDrawCell` callback may draw anywhere — including lines or arcs
from its cell to *other* cells. This makes inter-cell and networked glyphs possible with no library
change (origin–destination flow maps, cell-to-cell connections, grid-routed bundling): precompute
each cell's far endpoints in `onAfterAggregate` (project them with `map.project` — the same pixel
space cells are binned in — and snap to cell centroids), store them as the cell's `customData`, and
draw them in `onDrawCell`. Because both ends are cells, the network re-forms under pan and zoom.
This lives in application code (the generic hooks), not in `validateSpec`/`compileSpec`, so its
guarantees are the application's — and the honesty rules still hold: these arcs connect *analytical
bins*, not places, and imply no real route (say so, as with `flow-balance` in §6).
`examples/case-studies/` shows OD roses, inter-cell lines, and grid-routed / force-directed bundling.

## 8. Out of scope — do not fake

The grammar deliberately does **not** cover: cell offset control, kernel smoothing,
histogram/quantile summary ops, a typed filter grammar, comparison-to-reference
interaction, animation. If a task needs one of these, say it is out of the grammar's
current scope rather than approximating it with misleading substitutes. (Offset/stability
analysis in particular is active research territory — flag it, don't improvise it.)

## 9. Contributing to the library itself

- **Run `npm test`** (builds, then runs `tests/run-unit-tests.js`); all test files must
  pass. Grammar changes must extend `tests/unit/GrammarSpec.test.js`.
- **Performance is a headline feature.** Render-path rules established by profiling:
  - Never eagerly read `result.cells` (it is a lazy, non-enumerable getter) in per-frame
    code; access it only inside glyph branches.
  - Never spread (`{...cell}`) a semantic cell in a hot path — it defeats the lazy
    `measures`/`reliability` getters. Inherit (`Object.create`) or pass the cell itself.
  - Never use `Math.max(...arr)`/`Math.min(...arr)` on unbounded arrays (stack overflow on
    dense cells); use a loop or reduce.
  - No per-glyph object allocation in render loops.
  - In a per-frame glyph callback, read `cell.cellData` for the one or two values you draw;
    reading `cell.measures` forces the full per-field summary for every cell every frame.
    Keep `measures`/`reliability` for interaction and summary glyphs (see §7).
  - Sort/compute per-frame stats only when needed (e.g. `sortedValues` is for percentile
    normalization only); keep hover from repainting unless a glyph reflects `isHovered`
    (`hoverRepaint`).
- **Grammar/code sync contract:** the spec vocabulary in this file, the JSON Schemas
  (`src/grammar/schemas/`), `validateSpec`, and `docs/CELL_SEMANTICS.md` must agree. Bump
  `SPEC_VERSION` on any grammar change and update this file — a test asserts this file
  mentions the current version.
- **Data policy:** everything under `examples/` must be synthetic
  (see `examples/data/generate-synthetic-data.mjs`) or openly licensed. Never commit
  proprietary datasets.
- The library core stays **domain-agnostic**: domain logic (MCDA, accessibility, energy)
  belongs in specs and applications, entering the library only through the grammar or the
  generic hooks (`aggregationFunction`, `onAfterAggregate`, `onDrawCell`).
