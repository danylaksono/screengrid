# Case studies

Longer, more expressive worked examples aimed at data-visualisation practitioners
— showing how the library carries a real multivariate design, not just a single
encoding. All data is synthetic (see [`../data/`](../data/)).

## `od-flows.html` — origin–destination flow glyphmap

Aggregates ~9,000 synthetic London trips by their **origin** into screen-space
cells and draws a **flow rose** in each cell: one petal per 16-point compass
direction, petal length proportional to the number of trips heading that way,
petal colour the mean trip length in that direction. A dashed outline marks
sparse cells (fewer than 5 trips) so they are not over-read.

It demonstrates:

- **Gridded glyphmaps** in the sense of **Aidan Slingsby** (IEEE VIS 2023) — the
  technique this library formalises: a multivariate glyph per screen-space cell.
- **Global vs local reference scaling**, following **Wickham, Hofmann, Wickham &
  Cook**, *Glyph-maps for visually exploring temporal patterns in climate data*
  (2012). *Global* scales every rose to the busiest single direction across the
  whole view, so cells are comparable in magnitude; *local* scales each rose to
  its own busiest direction, so only the *shape* of each cell reads. Toggle it
  and watch the busy centre either dominate (global) or flatten to shape (local).
- **Time-period facets** (all / AM peak / PM peak / off-peak) — commutes flow
  residential → employment in the morning and reverse in the evening, so the
  roses swing direction between facets.

### How it uses the library efficiently

- **Per-cell precompute via `onAfterAggregate`.** The bearing histogram for each
  cell is computed once per aggregation and stored as the cell's `customData`.
  The per-frame glyph reads that array and does **no** trigonometry or re-tally.
- **Global reference via `onAggregate`.** The busiest-direction reference is
  computed once per aggregation from the per-cell maxima (which
  `onAfterAggregate` already produced). Because the layer's update cycle is
  *aggregate → onAggregate → draw*, the glyph always sees a fresh reference.
- **`hoverRepaint: false`.** The rose doesn't change on hover, so moving the
  cursor never forces a redraw; the tooltip still updates via `onHover`.
- **Semantic route only where it belongs.** Per-frame drawing takes the cheap
  raw route; the hover tooltip (one cell, occasionally) reads the semantic cell's
  `reliability` facet for the sample-size caveat. This is exactly the split
  described in [`../../AGENTS.md`](../../AGENTS.md) §7.

### Verify without a browser

```bash
node examples/case-studies/smoke-test.mjs
```

Drives the real `ScreenGridMode.aggregate` pipeline with the page's binning and
asserts the histogram reaches the glyph via `customData` and that the semantic
cell exposes it (plus `reliability` for the tooltip).

## `inter-cell-flows.html` — inter-cell flow lines

A different glyph idea: rather than summarising each cell *in place*, each cell
draws **arcs to the other cells its trips connect to**. Origin cells reach toward
the cells their trips arrive in (or the reverse — there's an origin/destination
toggle). Both endpoints snap to cell centroids, so the entire flow network
re-forms as you pan and zoom: coarser cells merge many trips into fewer, thicker
arcs; finer cells split them apart. A *min trips per arc* slider declutters from
full jumble down to the backbone.

The point of interest for library users: **inter-cell glyphs need no special
support.** Screen-space glyphs render onto one shared, unclipped canvas, so a
cell's `onDrawCell` can draw a line from its own centroid to anywhere. Each origin
cell's destination cells are precomputed in `onAfterAggregate` (projecting the far
endpoint with `map.project` — the same pixel space cells are binned in — and
snapping to a cell centroid), stored as `customData`, then drawn as curved arcs.
Arc width/opacity encode flow volume (global or local reference), colour encodes
mean trip length.

```bash
node examples/case-studies/inter-cell-smoke.mjs
```

asserts the arc endpoints land on cell centroids and that trip counts are
conserved across the destination cells.

## `od-bundling.html` — grid-routed OD bundling

The inter-cell network, but each cell-to-cell arc is **routed through a coarse
intermediate grid** rather than drawn straight. Each arc is sampled and its
samples snapped to the nearest coarse grid node; arcs travelling the same way
snap to the same nodes and so **merge into bundles** along shared corridors. A
*bundling grid* slider (a multiple of the cell size) trades detail for structure:
higher gathers more flows onto fewer corridors, lower relaxes toward straight
lines.

It is a deliberately cheap approximation of edge bundling with **no cross-cell
state**: the coarse routing grid is deterministic screen-space, so the corridors
emerge purely geometrically as arcs share nodes. Like the other flow examples,
the arcs connect analytical bins and re-form on pan/zoom — they are not real
routes.

```bash
node examples/case-studies/od-bundling-smoke.mjs
```

checks the router: endpoints preserved, interior waypoints on coarse-grid nodes,
and parallel arcs sharing nodes (which is what makes them bundle).

## `edge-bundling.html` — force-directed OD edge bundling

The cell-to-cell arc set bundled with **force-directed edge bundling** (Holten &
van Wijk, 2009): compatible edges — similar in angle, length, position and
visibility — attract each other, subdivision point by subdivision point, and
relax into organic bundles. The algorithm lives in
[`fdeb.js`](fdeb.js) (`bundleEdges(edges, opts)`), a compact self-contained port.

Because FDEB is global and O(E²), two things keep it usable inside a screen-space
layer that re-aggregates every frame:

- **Bundle on settle.** While the map moves, arcs draw straight (fast). On
  `moveend` a `bundleNow` flag lets FDEB run **once**, and the result is cached
  against a *view signature* (zoom, centre, cell size, facet, threshold) so
  unrelated repaints — e.g. toggling width scaling — reuse the cached polylines
  instead of reverting to straight.
- **Bounded edge count.** A min-trips declutter plus a hard cap (top 200 by
  volume) keep the pairwise force computation cheap. A *bundling strength* slider
  lowers the compatibility threshold to bundle more aggressively (0 = off).

```bash
node examples/case-studies/fdeb-test.mjs            # the bundling core (convergence, fixed endpoints, stability)
node examples/case-studies/edge-bundling-smoke.mjs  # real aggregation → edge set → FDEB, endpoints pinned
```
