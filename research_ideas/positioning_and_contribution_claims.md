# Positioning and Contribution Claims

## Recommended Paper Framing

Do not frame the paper as:

> We introduce gridded glyphmaps.

That is too close to Slingsby et al. and will invite an obvious prior-art critique.

Frame it instead as:

> We contribute a reproducible grammar and browser-based authoring workflow for screen-space gridded glyphmaps, enabling users to upload arbitrary point datasets, construct semantic cell summaries, select glyph encodings, and receive cartographic validation feedback.

## Potential Title Directions

- *Screengrid: A Reproducible Grammar for Screen-Space Gridded Glyphmaps*
- *Semantic Cells for Multivariate Cartographic Glyphmaps*
- *Authoring and Validating Multivariate Gridded Glyphmaps from User-Uploaded Spatial Data*
- *From Points to Semantic Cells: A Grammar for Reproducible Multivariate Glyphmaps*

## Contribution Claims

### Contribution 1: Semantic Cell Model

A cell is not only a rendered bin. It is a structured analytical object with:

- spatial metadata
- raw record provenance
- numeric and categorical summaries
- missingness and heterogeneity indicators
- reliability warnings
- comparability metadata

This is the strongest conceptual contribution because it makes the assumptions of screen-space cartographic aggregation explicit.

### Contribution 2: Declarative Screengrid Grammar

The design pattern is captured as a saved specification:

- analytical intent
- aggregation mode
- measure definitions
- semantic cell settings
- glyph mappings
- interaction settings
- validation constraints

This supports reproducibility, sharing, automated suggestions, and comparison between designs.

### Contribution 3: Cartographic Validation Rules

The system surfaces risks such as:

- local normalisation used for cross-cell comparison
- too many categories in a pie/radial glyph
- small glyphs below legible size
- low sample size with strong visual emphasis
- mean-only summaries hiding within-cell heterogeneity
- screen-space cells being mistaken for stable geographic units

This is a bridge between information visualisation grammars and cartographic reasoning.

### Contribution 4: Data-Agnostic Browser Demonstrator

The demo should show that the method is not a one-off dataset visualisation. Users can upload CSV/GeoJSON point data and produce a validated multivariate map through the same grammar.

### Contribution 5: Case-Based Evidence

The paper should include several case studies showing the same grammar used across different tasks:

- density and composition
- temporal profile comparison
- uncertainty/reliability
- optionally flow balance or accessibility

## How to Position Against Information Visualisation

The information visualisation community will ask:

- What is the abstraction?
- What is reusable?
- What design knowledge is encoded?
- What can users do that they could not do before?
- How is this evaluated?

Answer:

- The abstraction is the semantic screen-space cell.
- The reusable artefact is the Screengrid grammar and validation model.
- The design knowledge is encoded as task-to-grammar mappings and cartographic validation rules.
- Users can author gridded glyphmaps from arbitrary point data without writing bespoke glyph-map code.
- Evaluation is through case studies, grammar expressiveness checks, validation scenarios, and ideally a small expert review.

## What This Is Not

This is not:

- a replacement for general visualisation grammars such as Vega-Lite
- a new theory of glyph perception
- a new map projection or spatial indexing method
- a proof that gridded glyphmaps are universally better than choropleths, heatmaps, or small multiples

The paper should stay disciplined: Screengrid is a specialised, reproducible authoring grammar for a specific but useful family of multivariate cartographic visualisations.

## Main Differentiation from Slingsby

| Dimension | Slingsby-style gridded glyphmaps | Screengrid positioning |
| --- | --- | --- |
| Primary claim | Technique/design study for spatial modelling | Reproducible grammar and authoring workflow |
| Data scope | Bespoke modelling context | User-uploaded point datasets |
| Cell model | Implied by design | Explicit semantic cell object |
| Validation | Expert design judgement | Encoded cartographic checks |
| Reproducibility | Examples and source context | Saved spec plus generated cell semantics |
| Community fit | Geovis / visual analytics | InfoVis grammar, systems, and design-knowledge framing |

## Risky Claims to Avoid

- "First gridded glyphmap technique"
- "General solution for multivariate mapping"
- "LLM-designed cartography" unless the paper actually evaluates the assistant
- "Objective best glyph recommendation" unless there is perceptual evidence
- "Geographic aggregation" without clarifying screen-space view dependence
