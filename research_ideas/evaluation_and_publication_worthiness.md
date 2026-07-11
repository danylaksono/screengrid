# Evaluation and Publication Worthiness

## Short Answer

Yes, this can be publication worthy, but not if it is presented simply as another implementation of gridded glyphmaps.

The publishable contribution is not "we put glyphs in grid cells." Slingsby et al. have already shown the power of gridded glyphmaps very clearly. The publishable contribution is:

- a reusable grammar for constructing them
- a semantic cell abstraction that exposes aggregation assumptions
- a validation model that captures cartographic design knowledge
- a browser workflow where users upload their own data and produce reproducible specs
- evidence across several case studies

If those pieces are clear, the work could fit information visualisation venues as a systems/grammar/design-pattern contribution.

## Likely Reviewer Objections

### "This is too close to gridded glyphmaps."

Answer:

- Agree and cite Slingsby prominently.
- Position Screengrid as a generalised grammar and authoring system.
- Show examples where the same grammar supports multiple datasets and intents.
- Emphasise semantic cell summaries, reproducibility, and validation.

### "This is an engineering system, not a research contribution."

Answer:

- Use Munzner's nested model to state contribution layers.
- Make the semantic cell model the conceptual abstraction.
- Make validation rules explicit and grounded in literature.
- Include comparative case evidence, not only screenshots.

### "Glyph maps can be perceptually overloaded."

Answer:

- Acknowledge this as a known risk.
- Use validation rules and glyph limits.
- Show that the system warns users rather than encouraging arbitrary complexity.

### "Screen-space cells are not stable geographic units."

Answer:

- Treat this as a design trade-off, not a hidden flaw.
- State that Screengrid supports interactive exploration of dense point distributions.
- Include comparability metadata and viewport-dependence warnings.

### "Why not just use Vega-Lite or deck.gl?"

Answer:

- Vega-Lite is a general grammar but not a specialised cartographic grammar for semantic gridded glyphmaps.
- deck.gl provides powerful rendering layers but not a semantic-cell grammar, cartographic validation model, or reproducible glyph-map authoring workflow.

## Evaluation Strategy

### 1. Expressiveness Evaluation

Show that the grammar can express several design intents:

- density
- composition
- temporal trend
- uncertainty/reliability

For each, provide:

- dataset
- spec
- screenshot
- semantic cell example
- validation output

### 2. Comparison Against Baselines

Use lightweight comparisons:

- raw point map
- heatmap/screen grid only
- choropleth if an areal aggregation is available
- small multiples or linked chart

The claim should not be "Screengrid is always better." The claim should be "Screengrid preserves spatial context while exposing multivariate local structure."

### 3. Expert Review

A small expert review would strengthen the paper substantially.

Participants:

- 3-6 cartography/geovis/information-vis researchers or practitioners

Tasks:

- inspect maps generated from provided datasets
- critique interpretability and validation warnings
- assess whether the grammar captures meaningful design decisions

Outputs:

- qualitative themes
- design changes made after feedback
- limitations

This is more realistic than a large controlled user study for a first paper.

### 4. Reproducibility Package

Include:

- source code
- demo
- fixture datasets
- saved grammar specs
- screenshots
- validation outputs

This will help with InfoVis-style expectations around systems papers.

## Publication Venues

Possible fit:

- IEEE VIS short paper if the contribution is compact and well evidenced.
- EuroVis short/full paper depending on maturity.
- IEEE Computer Graphics and Applications for a practice/system-oriented article.
- GIScience or cartography venues if the framing leans more geovis/cartographic.
- VIS workshop first, if the evaluation is not yet strong enough.

For a full InfoVis paper, the work likely needs:

- a more formal grammar definition
- stronger evaluation
- clearer theoretical contribution
- multiple polished case studies

For a short paper or systems/demo paper, the current direction is more plausible.

## What Must Be True Before Submission

Minimum bar:

- The demo reliably supports upload, profile, intent, glyph choice, validation, and export/save spec.
- The paper has three coherent case studies.
- The grammar is documented in a concise formal section.
- The related work openly credits Slingsby's gridded glyphmaps.
- The contribution claims avoid overstating novelty.

Stronger bar:

- Expert review or structured design critique.
- Saved reproducibility package.
- Quantitative checks for validation rules across fixtures.
- Polished visual examples with clear legends and cell inspection.

## Verdict

Publication worthy: **potentially yes**.

Current likely status: **promising workshop / short-paper material if the demo is stable and the grammar is well written**.

Full-paper worthy: **only if the semantic-cell grammar and validation model are made central, with convincing case studies and some evaluation beyond implementation**.

The core idea is worth pursuing because it can occupy a useful space between:

- bespoke gridded glyphmap design studies
- general visualisation grammars
- map rendering libraries
- automated visualisation recommendation systems

That space is real. The paper just needs to be very careful about claiming it.
