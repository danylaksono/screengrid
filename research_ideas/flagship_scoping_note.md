# Scoping Note: Flagship Methods Paper (for discussion with Aidan)

*Dany Laksono — July 2026. One page. Purpose: agree scope, territory, and authorship
before the paper is written.*

## Working title

**From Design Space to Design Rules: An Executable Grammar for Screen-Space Gridded
Glyphmaps** *(alternatives: "Executable Cartographic Design Knowledge for Gridded
Glyphmaps"; "Screengrid: A Validated, Reproducible Grammar for Gridded Glyphmaps")*

## The claim, in one sentence

Gridded glyphmaps are a demonstrated technique with a described design space, but the
design knowledge lives in prose and the implementations in bespoke notebooks; we
contribute an **executable formalization** — a declarative grammar and machine-checkable
cartographic validation rules derived from that design space, over a semantic cell
contract carrying provenance, reliability, and comparability — and we evaluate whether
the encoded rules actually catch invalid designs.

## Relationship to your work (explicit, by design)

This paper **operationalizes** the gridded-glyphmap design space; it does not compete
with it. Layer separation via Munzner: technique + design space + encoding knowledge are
yours (VIS 2023; design-space manuscript); formalization, validation engine, provenance
contract, and reproducible artifact are this paper. Your design space is cited as the
source of the encoded rules throughout. Deliberately **out of scope** (your declared
future work, referenced not claimed): MAUP quantification/depiction glyphs,
within-cell-heterogeneity glyphs, anomaly glyphs, usage studies.

## Contributions

1. **A declarative grammar** (spec format v0.2.0) for screen-space gridded glyphmaps:
   dataset profile → analytical intent → aggregation contract → semantic cell model →
   glyph grammar → validation. Includes derived measures (weighted composites, ratios
   with explicit denominators) and declared interactive parameters — the declarative
   counterpart of your functional idiom's parameters. Custom-code escape hatch retained;
   specs using it are marked *partially checkable* (the grammar's coverage boundary is a
   result, not a limitation to hide).
2. **Cartographic validation rules as executable design knowledge** (Draco-shaped,
   cartographic in content): local-normalization vs cross-cell claims, category overload,
   sub-legible glyphs, mean-hiding-heterogeneity, sparse-cell emphasis, missing
   denominators for cross-view claims, non-commensurable weighted sums.
3. **The semantic cell contract**: each cell as an analytical object with record
   provenance, summaries, reliability class, and a comparability statement — framed as
   auditability for interactive aggregation.

## Status: already built and tested

Grammar, validator, and spec compiler are implemented in the library (`src/grammar/`,
15/15 test files passing). Proof-of-expressiveness exists: our EuroVis MCDA design
(Laksono, Slingsby & Jianu 2024) is re-expressed as a spec — weights as parameters,
SAW as a derived measure — validates, compiles, and reproduces expected values in tests;
the validator correctly flags the classic MCDA mistakes (raw-unit criteria; composite
scores compared across cells under local scaling). An `AGENTS.md` encodes the rules as
authoring guardrails, version-locked to the grammar by CI.

## Evaluation plan

1. **Broken-design corpus**: fixtures × {sound spec, per-rule invalid variants} → rule
   coverage/precision table.
2. **Expert review** (3–6 cartography/geovis practitioners): do warnings match expert
   judgment; what do the rules miss?
3. **Agent with/without guardrails**: identical authoring tasks given to a coding agent
   with and without the encoded rules; count validity errors, expert-rate outputs. (Novel
   evaluation angle; also seeds a follow-up paper.)
4. Case studies: density/composition, temporal profile, uncertainty, + the MCDA
   re-expression. Reproducibility package: specs, fixtures (synthetic, seeded), code, DOI.

## Venue and sequence

Preference order: **AGILE full paper** (reproducible-research track fits exactly; check
deadline) → **CaGIS** or **Transactions in GIS** as journal target/fallback. JOSS software
paper for the library runs in parallel (makes the artifact citable). EuroVis-short slot
already used by the MCDA paper, so any VIS-community submission stays clearly distinct.

## Questions for you

1. Does this layer separation feel right, and is anything here too close to the
   design-space paper's planned journal version?
2. Rule set: which encoded rules would you contest or add (esp. denominators, §4.2.2)?
3. Expert review: would you nominate reviewers? Would you want the usage-study thread
   kept separate (your lead) as discussed?
4. Authorship: proposed Laksono, Slingsby, Jianu — comfortable?
5. Timing vs the design-space manuscript: should this wait for / cite a preprint of it?
