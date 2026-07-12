# Reproducible Grammar

## Purpose

The grammar should make Screengrid designs reproducible, inspectable, and comparable. A paper should argue that gridded glyphmaps are often powerful but bespoke; Screengrid turns them into a repeatable design pattern.

## Positioning (added July 2026)

The grammar **operationalizes Slingsby's gridded-glyphmap design space** (see
`docs/2023GriddedGlyphmapsDesignSpace.pdf`); it does not claim the design space itself.
The key contrast with his implementation idiom: his is *programmatic* (user-supplied
aggregation and draw functions, `global`/`cell` variable spaces, Observable-bound); ours is
*declarative* (JSON specs, JSON-schema validated in `demo/schema/`), hence shareable,
diffable, regenerable, and machine-checkable. That difference — prose design space and
functional idiom vs executable spec and validation rules — is the entire contribution
claim. See [positioning_and_contribution_claims.md](./positioning_and_contribution_claims.md).

Two standing constraints:

- The semantic-cell shape below must stay **byte-consistent** with the shipped
  implementation (`src/core/SemanticCellSummarizer.js`, `docs/CELL_SEMANTICS.md`). The
  paper's formal section should be generated from, or CI-checked against, the code.
- An **`AGENTS.md`** should encode this grammar plus the validation rules as guidance for
  coding agents building gridded glyphmaps. It doubles as (a) the forcing function for
  formalizing the grammar precisely and (b) the instrument for the agent-with/without-
  guardrails evaluation in the flagship paper.

## Proposed Grammar Layers

```text
dataset profile
-> analytical intent
-> spatial aggregation contract
-> semantic cell model
-> glyph grammar
-> cartographic validation
-> rendering + interaction
```

## 1. Dataset Profile

Captures what can be inferred from user-uploaded data:

- source type: CSV, GeoJSON
- row count
- coordinate candidates
- field types
- numeric ranges
- categorical cardinality
- missingness
- likely temporal fields

This layer keeps the grammar data-agnostic.

## 2. Analytical Intent

The paper should treat intent as first-class, because the same dataset can support different maps.

Initial intent vocabulary:

- `density`
- `composition`
- `profile-comparison`
- `temporal-trend`
- `anomaly`
- `uncertainty`
- `flow-balance`

Each intent implies different validation rules. For example, composition requires categorical summaries; profile comparison requires shared scales; uncertainty requires reliability or interval encoding.

## 3. Spatial Aggregation Contract

This declares what the cell means.

Key fields:

- aggregation mode: `screen-grid`, `screen-hex`, `feature-anchor`
- cell size in pixels
- normalisation strategy
- empty-cell policy
- filters
- denominator
- whether raw record references are retained

The paper must be explicit that screen-space cells are view-dependent. This is not a weakness if the intended task is interactive exploration, but it must be acknowledged.

## 4. Semantic Cell Model

The semantic cell is the paper's conceptual abstraction, framed as **provenance and
auditability for interactive aggregation** — which records, which denominator, which
normalisation, valid for which comparisons. Do not frame it as MAUP mitigation (that
framing collides with Slingsby's declared future work and HexTiles; see the territory map).
It fills a gap he has acknowledged: denominators with regional context are possible in his
implementation but absent from the design space "because there's no concept of 'country',
only cells" — the cell contract is where such provenance lives.

Example shape:

```js
{
  id,
  spatial: {
    type,
    bounds,
    centroid,
    zoom,
    cellSizePixels,
    aggregationMode
  },
  records: {
    count,
    denominator,
    rawRefs
  },
  measures: {
    count,
    weight,
    fields: {
      value: { mean, sum, min, max, variance, missing },
      category: { mode, distinct, categories }
    }
  },
  reliability: {
    sampleSizeClass,
    warnings
  },
  comparability: {
    normalization,
    viewportDependent,
    validAcrossZoom,
    comparableAcrossCells
  }
}
```

This is the bridge between cartography and information visualisation: it exposes the analytical assumptions behind a compact glyph map.

## 5. Glyph Grammar

The glyph grammar should describe marks and channels, not arbitrary drawing code.

Minimum vocabulary:

- glyph type: heatmap, circle, bar, pie, ring, custom
- channels: size, colour, opacity, segments, measures
- custom marks: line, point, wedge, ring
- layout: cartesian mini-chart, radial
- scales: linear, square-root, categorical, sequential
- limits: max categories, minimum glyph size, temporal support, uncertainty support

The grammar should deliberately be narrower than Vega-Lite. That is acceptable because it serves a specialised cartographic technique.

## 6. Cartographic Validation

Validation should be described as design-knowledge constraints, inspired by systems such as Draco but adapted to gridded glyphmaps.

Hard errors:

- unknown fields
- incompatible field type
- unsupported glyph type
- missing coordinate fields

Warnings:

- local normalisation used for cross-cell comparison
- screen-space cells presented as stable geography
- too many categories
- glyph too small
- sparse cells with strong visual emphasis
- mean-only summaries hiding variance
- uncertainty task without uncertainty channel

## 7. Reproducibility Claim

A Screengrid paper can claim reproducibility if a saved spec can:

- regenerate the same map structure from the same data
- explain which fields map to which visual channels
- expose cell-level measures and reliability
- report validation warnings
- be shared as JSON independent of a particular UI session

The paper should include saved specs as supplementary material.

## Suggested Figure

Create a pipeline figure with six boxes:

1. Uploaded point data
2. Dataset profile
3. Screengrid grammar
4. Semantic cells
5. Glyph map
6. Evaluation report

Add a side arrow from "cartographic validation rules" into both grammar and evaluation report.
