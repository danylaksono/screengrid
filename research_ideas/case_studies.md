# Case Studies

The demo should be the paper's evidence platform. The goal is to show that the same grammar supports multiple multivariate cartographic tasks with user-uploaded data.

Data note (July 2026): `examples/data/` now contains only synthetic, deterministic datasets
(seeded generator: `examples/data/generate-synthetic-data.mjs`); the AITL building-stock
data was removed. Paper case studies must use synthetic fixtures, openly licensed data, or
real-data analyses that live outside this repository.

## Case Study 0 (published precedent): Geographic MCDA

Laksono, Slingsby & Jianu (2024), EuroVis Short, doi:10.2312/evs.20241062 — SAW-based MCDA
for decarbonisation planning (Cambridge, LSOA level) with gridded glyphmaps and live
criteria-weight adjustment.

Role in the flagship paper:

- Re-express the published design as a Screengrid spec (weighted multi-criteria profile
  glyph + interaction parameters) to show the grammar covers a real, published use case.
- Demonstrates the `profile-comparison` intent with a denominator/weighting structure.
- Validation angle: weight adjustment changes comparability — a spec claiming cross-cell
  ranking under local normalisation should trigger the corresponding warning.

## Case Study 1: Density and Composition

Purpose:

- Show how points are aggregated into screen-space cells.
- Show how a primary intensity measure can be combined with categorical composition.

Data:

- Use `demo/fixtures/density-composition.geojson` for the paper prototype.
- Later replace or supplement with a more substantial real dataset, such as public transport access, incident reports, service locations, or urban amenities.

Design:

- Background or glyph size: point count or total volume.
- Pie/radial segments: category mix.
- Tooltip: count, category distribution, dominant category, low-count warning.

Research point:

- Demonstrates the semantic cell as a density-plus-composition object.
- Shows why validation matters: too many categories or small cells make composition glyphs unreadable.

Expected figure:

- Map screenshot.
- Adjacent semantic cell inspection panel.
- Validation warnings panel.

## Case Study 2: Temporal Profile Comparison

Purpose:

- Show that Screengrid is not just density mapping.
- Demonstrate compact temporal glyphs within spatial cells.

Data:

- Use `demo/fixtures/temporal-profile.geojson` for the paper prototype.
- Ideally use real data with repeated temporal measures, such as yearly deprivation, hourly accessibility, sensor readings, or mobility counts.

Design:

- Cell background: total count or average level.
- Custom cartesian mini-glyph: line or point sequence over ordered temporal fields.
- Shared global domain across cells.

Research point:

- Shows profile comparison as an intent distinct from density.
- Emphasises the need for global scaling; local scaling can make very different places appear similar.

Expected figure:

- Same map under local vs global scaling.
- Highlighted cell showing semantic time-series summaries.

## Case Study 3: Uncertainty and Reliability

Purpose:

- Show that semantic cells can carry uncertainty and reliability rather than only means.

Data:

- Use `demo/fixtures/uncertainty-reliability.geojson`.
- Later use environmental sensor data, model outputs, forecasts, or survey estimates.

Design:

- Glyph core: mean value.
- Opacity, outline, interval mark, or warning state: confidence, standard deviation, or sample-size class.
- Tooltip: count, mean, variance, confidence, missingness.

Research point:

- Distinguishes Screengrid from purely decorative glyph maps.
- Makes the paper more credible to cartography reviewers, who will care about aggregation and uncertainty.

Expected figure:

- Cells with same mean but different reliability shown differently.
- Evaluation panel warning for low sample size or high heterogeneity.

## Optional Case Study 4: User-Uploaded Data Workflow

Purpose:

- Show authoring and reproducibility.
- Demonstrate that the method is not hard-coded to the paper datasets.

Method:

- Record a workflow: upload CSV/GeoJSON, inspect profile, choose intent, accept or edit glyph suggestion, validate, export spec.

Research point:

- This is the system contribution.
- It connects Screengrid to information visualisation tools and grammars.

Expected figure:

- UI sequence or annotated screenshot.
- JSON spec snippet.

## Optional Case Study 5: Flow Balance

Purpose:

- Explore whether origin/destination or directional summaries fit the grammar.

Design:

- Directional radial bars or wedges.
- Incoming vs outgoing balance.
- Linked flow layer outside Screengrid.

Risk:

- Could overextend the paper. Include only if implementation is mature.

## Recommended Paper Set

For the flagship submission, use three fixture cases plus the published precedent:

1. density/composition
2. temporal profile comparison
3. uncertainty/reliability
4. MCDA re-expression (Case Study 0) — the strongest evidence, because it shows the grammar
   capturing a design that was already peer-reviewed and published

Use the upload workflow as a system vignette rather than a full fifth case.

## Evidence to Collect

For each case:

- input dataset description
- analytical intent
- grammar spec
- screenshot
- validation warnings
- one or two inspected semantic cells
- short comparison with an alternative map, such as heatmap, raw points, or small multiples

This evidence will make the paper feel more rigorous than a gallery of attractive maps.
