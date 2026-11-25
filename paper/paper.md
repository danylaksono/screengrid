---
title: 'Screengrid: Interactive gridded glyphmaps for MapLibre GL JS'
tags:
  - JavaScript
  - geovisualization
  - cartography
  - multivariate spatial data
  - MapLibre
authors:
  - name: Dany Laksono
    orcid: 0000-0002-8503-5274
    affiliation: 1
  - name: Aidan Slingsby
    orcid: 0000-0003-3941-553X
    affiliation: 2
  - name: Radu Jianu
    orcid: 0000-0002-5834-2658
    affiliation: 2
affiliations:
  - name: Department of Geodetic Engineering, Universitas Gadjah Mada, Indonesia
    index: 1
  - name: giCentre, Department of Computer Science, City St George's, University of London, United Kingdom
    index: 2
date: 24 November 2026
bibliography: paper.bib
---

<!-- Draft metadata. Confirm the author list and affiliations before submission. -->

# Summary

Maps of many observations can become crowded, especially when each observation has several attributes. Screengrid is a JavaScript library for building interactive web maps that group observations into a grid and draw a small chart, or glyph, for each occupied cell. The glyph can show how observations are distributed among categories, how several measurements vary together, or how a combined score changes when the reader adjusts its inputs. As the map moves or zooms, the library recalculates which observations belong to each cell. Readers can inspect a cell to see the records and summaries behind its glyph. Screengrid implements Aidan Slingsby's gridded glyphmap technique in a reusable layer for MapLibre GL JS [@slingsby2023; @maplibre].

# Statement of need

Researchers in geographic visualization and spatial decision support often build interactive maps to compare several attributes jointly. For example, a planning researcher may wish to see how changing the weight assigned to cost changes a suitability score and then inspect the observations behind a selected glyph. A map built for this purpose has to keep grouping, calculation, drawing, and inspection in sync as the view changes. These parts are easy to entangle when the first implementation is built for a single dataset. The meaning of the map can then change when a researcher replaces the data, switches an encoding, or shares the implementation with another team.

With Screengrid, readers can inspect which records enter a summary, and authors can declare which comparisons the map is designed to support. A cell is an analytical bin defined in pixels for the current view. Panning, zooming, or resizing can change its membership, even if the records are unchanged. A fixed color scale can preserve the meaning of a color across views, while the underlying cell may cover different records. This distinction matters when an exploratory pattern is used to select locations or cases for follow-up analysis.

# State of the field

Slingsby's Observable implementation provides a direct precedent for interactive gridded glyphmaps and demonstrates how to adapt the technique to individual research questions [@slingsby2022; @slingsby2023]. Screengrid formalizes common parts of that workflow as a versioned specification and gives MapLibre applications an interface for inspecting the data behind each glyph. Observable remains a practical setting for experimenting with glyph designs and publishing an explanation alongside interactive code.

The deck.gl ScreenGridLayer colors screen-space bins by an aggregate value. Its HexagonLayer can encode summaries in color and height [@deckglscreen; @deckglhex]. A researcher building an interactive glyphmap also needs to decide what happens after a pan. Both the chart and the inspector must use the new set of observations, even if the pointer returns to the same pixel. Screengrid gives the drawing and selection callbacks access to the same aggregation result. This lets applications share the machinery for assigning and retrieving observations while defining their own glyphs and research measures.

# Software design

Screengrid projects input coordinates through MapLibre and assigns the resulting pixel positions to square or hexagonal cells. Defining cell size in pixels keeps glyphs readable as map scale changes. It also makes bin membership dependent on the viewport, which makes this design appropriate for exploration and requires care when comparing maps at different scales. The canvas renderer supports several visual marks within a glyph. The aggregation result retains the contributing records and exposes numeric summaries, category distributions, and flags for sparse cells, missing values, or large within-cell variation. The library computes detailed summaries on demand so simple maps can draw from the basic aggregation without producing a full statistical summary for each cell on every frame.

The versioned JSON specification describes the dataset fields, analytical intent, aggregation, normalization, glyph, and interaction. The validator distinguishes invalid configurations, such as references to unknown fields, from interpretation risks, such as comparing weighted suitability scores under view-relative normalization. The compiler turns the analytical declarations into layer options. Applications supply the drawing code, including the binding between glyph declarations and marks. This boundary allows a project to implement a specialized glyph while keeping its aggregation inspectable. The validator reports partial checkability when a specification delegates aggregation to a registered custom function, since it cannot inspect that function's semantics.

The suitability example illustrates what the specification makes reproducible. Its two criteria are access and rent. Each is scaled against its dataset range, and the rent scale is inverted so that lower costs receive higher scores. On the same 40 synthetic records used in the example test, assigning all weight to access gives a mean score of 0.690. Assigning all weight to cost gives 0.449. A separate change to view-relative display normalization triggers a warning because the specification declares an intent to compare scores across cells. The weights affect the computed score, whereas the display setting affects its interpretation.

# Research impact statement

We used successive implementations of Screengrid in three studies of local energy planning. The 2024 Cambridge study used time-series glyphs to show when retrofit costs and carbon savings arose under different budgets [@cgvc2024]. In the 2025 planner, the map formed part of a workflow in which analysts composed interventions, simulated their effects, and examined outcomes across scales [@cgvc2025]. The subsequent journal study used multivariate glyphs and streamgraphs to explore how energy scenarios respond to planning choices [@steering2026]. In this setting, installation costs and avoided emissions are application measures, while the library handles the spatial grouping.

The Kopdes investigation uses Screengrid 3.1.1 to explore 83,379 Indonesian village and urban ward cooperatives [@laksono2026kopdes]. One question is how many cooperatives lie more than about 500 m from a mapped made road. After each aggregation, Kopdes counts cooperatives in the relevant road-distance classes and divides by the number with a known class. The drawing callback uses that summary for the road-access bar. When a reader clicks the glyph, the selection callback passes the same summary and contributing records to the inspector. In the outlined cell in Figure 1, 1 of 21 cooperatives meet the criterion (4.8%), compared with 22,908 of 83,379 nationally (27.5%). The threshold describes distance to roads identified in the source mapping.

![A selected screen cell in the Kopdes report near Blora, Indonesia. Both panels are crops of one screenshot. The red outline marks the clicked glyph. The four bars show the shares of cooperatives with sparse surrounding population, distant roads, a nearby cooperative, and distant mapped buildings, in the order shown in the inspector. The orange row (Jauh dari jalan) gives the road-distance share for the cell and the national reference beneath it. Cell membership depends on the current view. Basemap: OpenFreeMap, OpenMapTiles and OpenStreetMap contributors.](kopdes-inspector.png)

Screengrid is distributed as an MIT-licensed [npm package](https://www.npmjs.com/package/screengrid/v/3.1.1). Its [worked examples](https://github.com/danylaksono/screengrid/tree/d34b23866a68a29617935fb70d2e1fad7b4e1f94/examples/grammar) use seeded synthetic London data to illustrate density, land-use composition, and suitability. The suitability example adapts an interactive weighting workflow from earlier research on geographic multicriteria decision analysis [@laksono2024]. Researchers can rerun the example test to check both the influence of the weights and the validator's response to a change in normalization.

The Screengrid Co-Pilot demonstrator uses the grammar in an authoring workflow. A researcher uploads point data and describes a map. The application validates proposed edits to the specification, records the researcher's decision, and can export the specification and session log. This gives a researcher a record of which design changes were proposed and accepted.

The unit tests exercise square and hexagonal aggregation, the contents and queries of semantic cells, and specification validation. A separate interactive stress example lets researchers vary the number of input points up to 500,000 and inspect first-update timing and frame rate on their own hardware. The stress example reports measurements for the reader's browser and hardware.

# AI usage disclosure

OpenAI Codex (GPT-6) assisted with drafting the manuscript and bibliography and with capturing and cropping the Kopdes interface for Figure 1. Technical descriptions were cross-checked against the implementation and documentation, and bibliographic details were checked against the cited publications and software documentation.

<!-- Before submission, document any generative AI use in developing, reviewing, or documenting the software and record the author's verification. -->

# Acknowledgements

*Draft note. Confirm funding and contributor acknowledgements before submission.*

# References
