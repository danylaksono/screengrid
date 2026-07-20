# Cartographic Evaluation Rubric

Use this rubric to assess Screengrid designs before presenting them as multivariate cartographic evidence.

| Intent | Good Fit | Required Checks | Common Failure |
| --- | --- | --- | --- |
| Density | Locating concentrations or hotspots | cell size, normalisation, low-count warnings | treating screen cells as stable geography |
| Composition | Comparing category mix by place | category count, palette capacity, denominator | too many pie/radial slices |
| Profile comparison | Comparing multivariate signatures | shared scale, glyph size, missingness | local scaling hides differences |
| Temporal trend | Comparing local trajectories | ordered temporal fields, global domain, sample size | tiny sparklines with no reliability cue |
| Anomaly | Finding outliers | baseline, variance, uncertainty | highlighting noise from sparse cells |
| Uncertainty | Communicating confidence or error | interval/opacity/reliability encoding | showing mean without uncertainty |
| Flow balance | Summarising origin/destination tendencies | direction categories, denominator, linked flow detail | implying complete routes from cell summaries |

## Validation Levels

- **Error**: the grammar cannot render or references incompatible fields.
- **Warning**: the design can render but may mislead for the stated intent.
- **Note**: the design is acceptable but has interpretation limits.

## Fixture Scenarios

The demo fixtures (density/category composition, temporal profile comparison, sparse/uncertain sensor summaries) live in the [screengrid-demo](https://github.com/danylaksono/screengrid-demo) repo.

For each fixture, load the GeoJSON in the demo, inspect the Cartographic Evaluation panel, request a local suggestion, and confirm that warnings change when intent, glyph type, or normalisation changes.
