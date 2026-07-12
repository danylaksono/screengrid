# Publication Roadmap

Sequenced plan agreed July 2026. Background: GIS/geoinformatics; supervisor: Aidan Slingsby
(originator of gridded glyphmaps). Strategy: lead where the territory is open
(formalization, provenance, reproducibility, agents), collaborate where it is his
(MAUP glyphs, heterogeneity, anomaly, usage studies), and keep application work flowing in
GIS venues.

## Already Published

- **Laksono, D., Slingsby, A., & Jianu, R. (2024).** *Gridded-glyphmaps for supporting
  Geographic Multicriteria Decision Analysis.* EuroVis Short 2024,
  doi:10.2312/evs.20241062. SAW MCDA, decarbonisation planning (Cambridge, LSOA), live
  weight adjustment. Serves as the application-lane precedent and a case study for the
  flagship.

## 1. JOSS — Screengrid library (near-term)

- **What**: software paper for the library: screen-space gridded glyphmap aggregation +
  glyph rendering for MapLibre; semantic cells; tested; versioned; deterministic synthetic
  example data.
- **Why now**: nearly submission-ready; makes the artifact citable; underwrites every later
  reproducibility claim. Positioned against the Observable-notebook state of the art.
- **Checklist**: OSI licence visible, archived release (Zenodo DOI), statement-of-need
  section, API docs (exists), tests in CI, contribution guidelines.

## 2. Flagship methods paper — executable design knowledge (main dissertation paper)

- **Claim**: declarative grammar + machine-checkable cartographic validation rules
  (derived from Slingsby's design space) + semantic cell provenance/comparability contract.
- **Evaluation** (the part that makes it research, not engineering):
  1. **Broken-design corpus**: fixtures × {sound design, deliberately-invalid variants
     (local-norm cross-cell claim, category overload, sub-legible glyphs, mean-hiding-
     variance, sparse-cell emphasis)} → rule coverage/precision.
  2. **Expert review**: 3–6 cartography/geovis practitioners judge whether warnings match
     expert judgement (agreement, missed problems, false alarms).
  3. **Agent with/without guardrails**: same authoring tasks given to a coding agent with
     and without `AGENTS.md` constraints; count validity errors, expert-rate outputs.
- **Venues (in preference order)**: AGILE full paper (reproducible-research review track
  fits perfectly), CaGIS, Transactions in GIS; ICC as conference-community option.
  IJGIS only if the conceptual framing and evaluation come out strong.
- **Prerequisite**: talk to Aidan before scoping — the paper *operationalizes* his design
  space, so alignment (and his co-authorship) should be explicit and comfortable.

## 3. Follow-up — agent-guided cartographic authoring

- **Claim**: cartographic design knowledge as guardrails for agentic map authoring;
  extends the flagship's third evaluation into a full study.
- **Blocked on**: flagship results; a stable `AGENTS.md`; a task battery.
- **Venues**: depends on results — VIS/EuroVis short, or GIScience/AGILE.

## 4. Collaborative lane (Aidan-led or joint; Screengrid as platform)

Do not lead these; they are his declared future work (VIS23 §5, design-space §6.2.1,
correspondence):

- MAUP quantification and offset-ensemble depiction glyphs (he has prototypes; intends
  stddev-border summaries).
- Within-cell heterogeneity glyphs; anomaly glyphs.
- Observational study of how analysts use gridded glyphmaps ("would like to be involved").
- Cursor-anchored gridding: implement in Screengrid as a credited feature regardless —
  engineering contribution, useful for the library, not a paper claim.

## 5. Optional application papers (GIS identity, low conflict)

Using Screengrid as the instrument on real analyses, for domain venues:

- Public-transport accessibility (Verduzco et al. data lineage; example already exists) —
  *Journal of Transport Geography*, *Findings* (short), *Environment & Planning B*.
- Energy retrofit / decarbonisation follow-on to the EuroVis short — *CEUS*,
  *Energy and Buildings*, *Buildings & Cities*.

## Standing Constraints

- Semantic cell definitions in papers must match `src/core/SemanticCellSummarizer.js` and
  `docs/CELL_SEMANTICS.md` exactly — generate or check the paper's formal section against
  the code.
- Example/demo data must remain synthetic or openly licensed (AITL building-stock data was
  removed from examples in July 2026; real-data analyses live outside the repo).
- Every paper cites Slingsby's VIS23 paper and (when citable) the design-space manuscript
  prominently; framing is "operationalizing", never "improving on".
