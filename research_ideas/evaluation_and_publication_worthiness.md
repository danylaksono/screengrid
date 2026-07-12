# Evaluation and Publication Worthiness

Revised July 2026. Venue strategy now leans cartography/GIScience (matching background and
the contribution type), with JOSS as the artifact register. See
[publication_roadmap.md](./publication_roadmap.md) for sequencing.

## Short Answer

Publication-worthy: **yes, in the revised framing** — executable design knowledge +
provenance contract + reproducible artifact, evaluated. Not publication-worthy: another
gridded-glyphmap implementation, or any MAUP-led claim (occupied by the supervisor's
declared future work and by HexTiles).

## Likely Reviewer Objections (updated)

### "This is Slingsby's technique."

- Agree, cite prominently, and separate layers via Munzner: technique + design space are
  his; formalization, validation, provenance, and reproducibility are this work. The
  design space is the *input* our rules encode.
- Co-authorship with him makes this a feature, not a bug: the design-space authors endorse
  the operationalization.

### "This is an engineering system, not a research contribution."

- The research object is the **validation model**, not the library. Evaluate it directly
  (rule coverage/precision on a broken-design corpus; expert agreement).
- The semantic cell is the conceptual abstraction; the grammar is the reusable artifact.
- The agent-with/without-guardrails comparison shows the design knowledge *does work*
  detached from any particular UI.

### "Why not Vega-Lite / Draco / deck.gl?"

- Vega-Lite: general chart grammar; does not model spatial aggregation semantics
  (denominators, normalisation-comparability, screen-space view dependence).
- Draco: chart-level constraints; ours are cartographic and aggregation-aware. Cite as the
  methodological template, differ in domain.
- deck.gl `ScreenGridLayer`: bins for rendering; no provenance, no validity semantics, no
  grammar. Provide a feature-comparison table.

### "How is this different from HexTiles?"

- HexTiles contributes a MAUP-aware *encoding design* with confidence values; we contribute
  the *authoring/validation infrastructure* and provenance contract that such encodings can
  sit on. No perceptual-encoding novelty is claimed.

### "Screen-space cells are not stable geographic units."

- Acknowledged as a property of the technique (per Slingsby §6.2.1). Screengrid's
  contribution is that the **comparability contract makes the limitation explicit and
  machine-checkable** (e.g. a warning when a spec claims cross-viewport comparison under
  local normalisation). Do not extend into MAUP-visualization claims.

## Evaluation Strategy (revised — this is the make-or-break)

### 1. Validation-rule evaluation (new; highest leverage)

Build a corpus: each fixture × {sound spec, deliberately-broken variants}. Broken variants
cover every rule: local-norm cross-cell claims, >6 categories in composition glyphs,
sub-legible glyph sizes, sparse cells with strong emphasis, mean-only summaries with high
within-cell variance, unordered temporal fields, missing uncertainty channel for an
uncertainty intent. Report per-rule coverage and false-positive behaviour. Cheap,
systematic, converts "system" into "evaluated design knowledge".

### 2. Expressiveness across intents

Same grammar expressing density, composition, temporal profile, uncertainty/reliability —
plus the **MCDA case from Laksono et al. 2024** re-expressed as a spec (weighted
multi-criteria profile), which shows the grammar covering a published real use. For each:
dataset, spec, screenshot, one inspected semantic cell, validation output.

### 3. Expert review

3–6 cartography/geovis researchers or practitioners: inspect generated maps + warnings;
judge whether warnings match expert concerns; identify missed problems. Report qualitative
themes + design changes. More realistic than a controlled perceptual study for this paper,
and better matched to what cartography venues value.

### 4. Agent with/without guardrails

Fixed authoring tasks ("make a composition map of X", "compare temporal profiles of Y")
given to a coding agent with and without `AGENTS.md`/grammar constraints. Measure:
validation errors in produced specs, task completion, expert rating of outputs. This is the
novel evaluation angle nobody else has.

### 5. Reproducibility package

Source, demo, deterministic synthetic fixtures (already in `examples/data/` with a seeded
generator), saved specs, screenshots, validation outputs, archived release. Target AGILE's
reproducible-research review explicitly.

## Venues (revised, in strategy order)

1. **JOSS** — library artifact paper. Near-term.
2. **AGILE full paper** — flagship, if timing fits: reproducibility track is a tailor-made
   fit; GIScience community; European.
3. **CaGIS** or **Transactions in GIS** — journal version of the flagship (or first target
   if AGILE timing misses). CaGIS for the cartographic-methods framing; TGIS for
   systems/GIScience framing.
4. **ICC / International Journal of Cartography** — cartography-community alternative.
5. **IJGIS** — stretch target; only with strong evaluation results.
6. **IEEE VIS / EuroVis short** — fallback if the contribution is recut toward InfoVis;
   note the EuroVis short slot is partially spent on the MCDA paper, so any VIS-community
   submission must be clearly distinct from it.
7. Workshop/poster (VIS, GIScience) — de-risking option to harvest expert critique early.

## What Must Be True Before Flagship Submission

Minimum bar:

- Grammar documented formally and **byte-consistent** with `SemanticCellSummarizer` /
  `CELL_SEMANTICS.md`.
- Validation engine runs against specs and produces the rule outputs the paper claims.
- Broken-design corpus + results table exists.
- Three intent case studies + the MCDA re-expression.
- Aidan aligned on scope (operationalizes his design space; he is a co-author).
- Related work covers: Slingsby (both), HexTiles, Honeycomb, Draco/Vega-Lite, binned
  aggregation systems, uncertainty-vis, deck.gl comparison table.

Stronger bar:

- Expert review completed.
- Agent with/without comparison completed.
- JOSS paper accepted (citable artifact).

## Verdict (revised)

- **JOSS**: ready lane, submit early.
- **Flagship as scoped above**: credible AGILE/CaGIS/TGIS paper — the validation-model
  evaluation is what lifts it above "system description".
- **Agent-guardrails follow-up**: highest novelty ceiling, blocked on flagship groundwork.
- **Any MAUP-led framing**: retired. Collaborative lane only.
