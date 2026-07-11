# Glyph Designs

## Design Principle

Glyphs should be treated as task-specific encodings over semantic cells, not as decorative mini-charts. Each glyph must answer a clear question and expose enough reliability information to avoid over-interpretation.

## Baseline Glyphs

### Heatmap Cell

Use for:

- density
- primary intensity
- anomaly overview

Channels:

- colour value: normalised count or measure
- opacity: reliability or count

Risks:

- cannot show composition
- local normalisation can mislead cross-cell comparison
- may hide sparse-cell uncertainty

### Sized Circle

Use for:

- magnitude
- count
- single primary measure

Channels:

- area: count or mean
- colour: secondary measure or category mode
- opacity: reliability

Risks:

- area comparison is approximate
- overlapping meaning if both size and colour encode similar concepts

### Bar Glyph

Use for:

- comparing 2-5 numeric measures within each cell
- profile comparison where variables are unordered

Channels:

- bar height: measure value
- bar colour: variable identity
- outline/opacity: reliability

Risks:

- too many bars become unreadable
- local scaling hides differences

### Pie / Donut / Ring

Use for:

- categorical composition
- shares or proportions

Channels:

- angle/arc length: category share
- radius or background: total count
- opacity or border: reliability

Risks:

- too many categories
- small cells make angle comparison poor
- category colours may exceed palette capacity

Validation rule:

- warn when visible category count exceeds 5-6
- warn when count is low

### Cartesian Mini-Line

Use for:

- temporal profile comparison
- ordered sequences
- trend shape

Channels:

- x position: ordered time or sequence
- y position: value
- line colour: series identity
- opacity/band: confidence or sample size

Risks:

- tiny trends may be hard to read
- local y-scale can obscure cross-cell comparison
- missing values need explicit handling

Validation rule:

- warn when temporal fields are unordered or domain is local for comparison tasks

### Radial Wedge / Nightingale Rose

Use for:

- cyclic time
- directional summaries
- category profiles where order matters

Channels:

- angle: time/direction/category order
- radius: value
- colour: group or status

Risks:

- easy to overread shape
- poor for precise comparison
- can become visually busy

## Proposed Glyph Grammar

```js
{
  type: "custom",
  channels: {
    size: { field: "count", aggregate: "count" },
    color: { field: "category", aggregate: "mode" },
    opacity: { field: "confidence", aggregate: "mean" },
    segments: { field: "mode", aggregate: "category-distribution" },
    measures: [
      { field: "score", aggregate: "mean", label: "Score" }
    ]
  },
  custom: {
    layout: "cartesian-mini",
    domain: "global",
    marks: [
      { mark: "line", data: { fields: ["y2021", "y2022", "y2023"], order: "temporal" } }
    ]
  },
  limits: {
    maxCategories: 6,
    minSizePixels: 18,
    supportsUncertainty: true
  }
}
```

## Design Space Figure

A useful paper figure would show glyph families arranged by task:

- density: heatmap, circle
- composition: pie, donut, stacked bar, radial wedge
- profile: bar, line, radar/radial
- temporal: line, rose, cyclic radial
- uncertainty: opacity, outline, whisker, band

Each glyph should have a short "use when / avoid when" label.

## Important Argument

The paper should not imply that more complex glyphs are better. The stronger argument is that the grammar helps users choose the simplest glyph capable of answering the intended multivariate spatial question while making reliability and comparability constraints explicit.
