# Positioning and Contribution Claims

Revised July 2026 after reviewing Slingsby's design-space manuscript, the VIS23 Issues
section, and MAUP-aware related work. The core discipline: **contribute at a different
layer than the supervisor's line, and cite his work as the source of the encoded design
knowledge.**

## Territory Map

| Territory | Status | Screengrid stance |
| --- | --- | --- |
| Gridded glyphmap technique (screen-space aggregation + glyphs) | Slingsby (VIS23; Observable idiom) | Cite; implement; never claim |
| Design space (discretisation, summarisation, glyph design, interaction) | Slingsby (unpublished manuscript) | Cite as the knowledge source our rules encode |
| MAUP discussion, offset-ensemble assessment, stability-as-signal | Slingsby (§6.2.1 + prototypes) | Do not lead; keep comparability metadata as infrastructure |
| MAUP quantification/depiction glyphs | Slingsby declared future work; HexTiles adjacent | Collaborative lane only |
| Heterogeneity glyphs, anomaly glyphs | Slingsby declared future work (VIS23 §5) | Collaborative lane only |
| Observational usage study | Slingsby wants involvement | Joint paper; Screengrid is the instrument |
| Application to MCDA | Laksono, Slingsby & Jianu 2024 (published) | Done; cite as applied precedent |
| Declarative grammar + JSON schemas + validation engine | **Open — ours** | Flagship claim |
| Semantic cell as provenance/reliability/comparability contract | **Open — ours** (not in either Slingsby paper; his `cell` is a summary variable-space) | Flagship supporting claim |
| Reproducible, versioned, tested library (vs Observable notebooks) | **Open — ours** | JOSS + reproducibility framing |
| Cartographic design knowledge as guardrails for coding agents | **Open — nobody's** | Flagship evaluation + follow-up paper |

## Recommended Paper Framing (flagship)

Do not frame as:

> We introduce gridded glyphmaps. / We make glyphmaps MAUP-aware.

Frame instead as:

> Gridded glyphmaps are a demonstrated technique with a described design space, but the
> design knowledge lives in prose and the implementations in bespoke notebooks. We
> contribute an executable formalization: a declarative grammar and machine-checkable
> cartographic validation rules derived from that design space, over a semantic cell
> contract that records provenance, reliability, and comparability. We evaluate whether the
> encoded rules catch invalid designs, and demonstrate that the same rules can guide both
> human authoring and coding-agent authoring.

## Potential Title Directions (revised)

- *Executable Design Knowledge for Gridded Glyphmaps*
- *From Design Space to Design Rules: A Validated Grammar for Screen-Space Gridded Glyphmaps*
- *Semantic Cells: Provenance and Comparability Contracts for Interactive Spatial Aggregation*
- *Screengrid: A Reproducible Grammar for Gridded Glyphmaps* (JOSS/artifact register)

## Contribution Claims (revised)

### Contribution 1: Declarative Screengrid Grammar (lead)

A saved specification covering dataset profile, analytical intent, spatial aggregation
contract, semantic cell settings, glyph mappings, interaction, and validation constraints.
JSON-schema validated (`demo/schema/`). Deliberately narrower than Vega-Lite: a
specialised cartographic grammar. The key move vs Slingsby's implementation: his idiom is
*programmatic* (user-supplied aggregation/draw functions, Observable-bound); ours is
*declarative*, hence shareable, diffable, regenerable, and checkable.

### Contribution 2: Cartographic Validation Rules as Executable Design Knowledge (lead)

Draco-shaped but cartographic: constraints derived from Slingsby's design space, Borgo's
glyph guidance, and cartographic practice — e.g. local normalisation used for cross-cell
claims, category overload in composition glyphs, sub-legible glyph sizes, sparse cells with
strong visual emphasis, mean-only summaries hiding within-cell heterogeneity, screen-space
cells presented as stable geography. The research question is evaluable: **do the encoded
rules catch invalid designs, and do experts agree with the warnings?**

### Contribution 3: Semantic Cell Contract (supporting)

A cell is a structured analytical object: spatial metadata, record provenance
(`records.rawRefs`, denominator), numeric/categorical summaries, missingness and
heterogeneity indicators, reliability class, and a **comparability contract** (which
comparisons — cross-cell, cross-viewport, cross-zoom — the chosen normalisation supports).
Framed as **provenance and auditability for interactive aggregation** — *not* as MAUP
mitigation. Implemented and shipped (`src/core/SemanticCellSummarizer.js`,
`docs/CELL_SEMANTICS.md`); the paper's formal definition must stay byte-consistent with
the code. Fills a gap Slingsby himself noted (denominator/regional context is absent from
his design space "because there's no concept of 'country', only cells").

### Contribution 4: Reproducibility Artifact (register separately)

Versioned, tested (unit + rendered-example verification), npm-distributed library with
deterministic synthetic fixtures — against the current state of the art (Observable
notebooks that are "hard to track and reproduce"). This is the JOSS paper and the AGILE
reproducible-research angle; in the flagship it is one paragraph plus a footnote.

### Contribution 5: Agent-Guided Authoring (evaluation vehicle now, paper later)

`AGENTS.md` encodes the grammar + validation rules as guidance for coding agents building
gridded glyphmaps. In the flagship, this powers the strongest evaluation: same authoring
tasks, agent with vs without the encoded constraints, measured by validation-error counts
and expert rating. As a standalone claim ("cartographic design knowledge as agent
guardrails") it is a follow-up paper once results exist. No in-app LLM co-pilot claims in
v1 papers.

## How to Answer the Community

Cartography/GIScience reviewers will ask:

- *What is new over Slingsby?* — Layer separation (Munzner): he contributes technique +
  design space; we contribute formalization, validation, provenance, reproducibility. The
  design space is our input, not our claim.
- *What is new over Draco/Vega-Lite?* — Domain: cartographic constraints over spatial
  aggregation semantics (denominators, normalisation-comparability, sample-size reliability,
  view-dependence), which chart grammars do not model.
- *What is new over deck.gl ScreenGridLayer?* — Bins vs semantic cells: rendering vs
  checkable analytical objects with provenance. Include as a comparison table.
- *What is new over HexTiles?* — They contribute a MAUP-aware *encoding design*; we
  contribute the *infrastructure and validation layer* such encodings can sit on.

## Risky Claims to Avoid (updated)

- "First gridded glyphmap technique" — false; Slingsby.
- Any MAUP-novelty claim — his declared future work + HexTiles.
- Glyph-design novelty — his design space §4.3 + Borgo.
- "LLM-designed cartography" — out of scope for v1; agent claims only with evaluation.
- "General solution for multivariate mapping" — scope discipline.
- "Geographic aggregation" without stating screen-space view-dependence.
