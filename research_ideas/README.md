# Screengrid Research Ideas

This folder collects paper-planning notes for positioning Screengrid research. It was
substantially revised in July 2026 after reviewing Aidan Slingsby's unpublished design-space
manuscript ([docs/2023GriddedGlyphmapsDesignSpace.pdf](../docs/2023GriddedGlyphmapsDesignSpace.pdf)),
the Issues section of the IEEE VIS 2023 paper, and related MAUP-aware visualization work
(HexTiles, Honeycomb Plots). The earlier framing — leading with MAUP-honesty or a
"dynamic MAUP" claim — is retired: that territory is explicitly claimed as future work in
Slingsby's papers and is being colonised by others. See
[Positioning and Contribution Claims](./positioning_and_contribution_claims.md) for the
territory map.

## Working Thesis (revised)

Screengrid research should not be positioned as "a new glyph map", nor as a MAUP
visualization contribution. The defensible thesis is:

> Gridded glyphmaps exist as a demonstrated technique and a described design space
> (Slingsby), but the design knowledge is prose and the implementations are bespoke
> notebooks. Screengrid contributes an **executable formalization**: a declarative grammar,
> machine-checkable cartographic validation rules, and a semantic cell contract that carries
> provenance, reliability, and comparability — making gridded glyphmaps reproducible,
> auditable, and safely authorable by people and by coding agents.

The intellectual lineage explicitly credits Slingsby's gridded glyphmaps (technique, design
space, and implementation idiom). The novelty is argued at a different layer of Munzner's
nested model: formalization, validation-as-design-knowledge, provenance, reproducibility,
and (later) agent-guided authoring — not technique or glyph design.

## Publication Lanes

1. **Application lane** — *already realized*: Laksono, Slingsby & Jianu (2024),
   gridded-glyphmaps for geographic MCDA, EuroVis Short (doi:10.2312/evs.20241062).
   Further application papers remain possible (accessibility, energy) in GIS venues.
2. **Artifact lane** — JOSS paper for the Screengrid library (near-term, low-risk,
   makes everything else citable).
3. **Flagship methods lane** — executable cartographic design knowledge: declarative
   grammar + validation constraints + semantic cell provenance, evaluated with a
   broken-design corpus, expert review, and agent-with/without-guardrails comparison.
   Target: CaGIS / Transactions in GIS / AGILE.
4. **Collaborative lane (Slingsby-led or joint)** — MAUP quantification/depiction glyphs,
   within-cell heterogeneity glyphs, anomaly glyphs, observational usage study. These are
   his declared future work; Screengrid contributes the platform, not the lead claim.

## Notes

- [Background and Related References](./background_and_related_references.md)
- [Positioning and Contribution Claims](./positioning_and_contribution_claims.md)
- [Publication Roadmap](./publication_roadmap.md)
- [Reproducible Grammar](./reproducible_grammar.md)
- [Case Studies](./case_studies.md)
- [Glyph Designs](./glyph_designs.md)
- [Evaluation and Publication Worthiness](./evaluation_and_publication_worthiness.md)

## Central Risks (revised)

1. **Proximity to the supervisor's line.** Slingsby has the technique (VIS23), the design
   space (unpublished manuscript), and declared future work on MAUP glyphs, heterogeneity
   glyphs, anomaly glyphs, and usage studies. Any Screengrid paper must contribute at a
   different layer (formalization/system/provenance/agents) and cite the design space as its
   source of encoded knowledge, not compete with it.
2. **"Engineering, not research."** The answer is evaluation of the *validation model itself*
   (does encoded design knowledge catch bad designs?) plus expert review — not more features.
3. **Grammar scope creep.** The grammar is deliberately narrower than Vega-Lite: a
   specialised cartographic grammar for screen-space gridded glyphmaps. Say so.
