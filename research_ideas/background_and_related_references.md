# Background and Related References

## 1. Direct Inspiration: Gridded Glyphmaps

The primary intellectual ancestor is Aidan Slingsby's work on gridded glyphmaps, especially the COVID-19 modelling paper:

- Slingsby, A., Reeve, R., & Harris, C. (2023). *Gridded Glyphmaps for Supporting Spatial COVID-19 Modelling*. IEEE VIS 2023. DOI: `10.1109/VIS54172.2023.00009`. City Research Online: <https://openaccess.city.ac.uk/id/eprint/31115/>
- Related public material: *GlyphMaps: Population and COVID*. <https://www.staff.city.ac.uk/~sbbb717/glyphmaps/covid/>

Important similarity:

- Both approaches aggregate spatial data into grid-like spatial units and place glyphs in those cells.
- Both aim to support multivariate spatial reasoning where choropleths, heatmaps, or raw points are insufficient.
- Both are most compelling when the glyph represents local multivariate structure, not only density.

Important distinction to develop:

- Slingsby's work is a technique/design study applied to spatial modelling, with strong domain grounding.
- Screengrid should be framed as a reusable grammar and authoring system for creating gridded glyphmaps from arbitrary uploaded point data.
- Screengrid's distinctive unit is the **semantic cell**: a cell carries spatial metadata, measures, reliability, comparability, and provenance, not merely drawn marks.

## 2. Glyph-Based Visualisation

Core reference:

- Borgo, R., Kehrer, J., Chung, D. H. S., Maguire, E., Laramee, R. S., Hauser, H., Ward, M., & Chen, M. (2013). *Glyph-based Visualization: Foundations, Design Guidelines, Techniques and Applications*. Eurographics State-of-the-Art Reports, 39-63. DOI: `10.2312/conf/EG2013/stars/039-063`. <https://vis.uib.no/publications/Borgo13GlyphBased/>

Use this to position glyphs as multivariate signs with known perceptual and design risks. The paper should draw on this literature to justify why Screengrid needs explicit glyph limits, legends, and validation warnings.

Relevant concepts:

- glyph as a compact multivariate sign
- visual channel capacity
- local spatial context as part of interpretation
- risks of visual complexity, ambiguity, and perceptual overload

## 3. Multivariate Maps and Glyph Placement

Core reference:

- McNabb, L., & Laramee, R. S. (2019). *Multivariate Maps: A Glyph-Placement Algorithm to Support Multivariate Geospatial Visualization*. Information, 10(10), 302. <https://www.mdpi.com/2078-2489/10/10/302>

Use this to position Screengrid within multivariate geospatial visualisation. McNabb and Laramee emphasise glyph placement, overlap, level of detail, interaction, and multivariate map readability.

Screengrid's relationship:

- It solves overlap by using screen-space bins rather than free glyph placement.
- It trades geographic stability for interactive, viewport-dependent legibility.
- It needs to be honest that screen-space cells are not fixed areal units.

## 4. Binned Aggregation and Dense Visualisation

Useful framing:

- Binning is not only an optimisation. It is a visual abstraction that changes the analytical object.
- Screengrid can be presented as a cartographic extension of binned aggregation where each bin becomes a multivariate semantic cell.

Potential references to pursue:

- Work on binned scatterplots and multi-class aggregation.
- Hexbin maps and spatial aggregation.
- Density maps and screen-space aggregation layers such as deck.gl's `ScreenGridLayer`.

## 5. Grammar and Reproducibility

Core references:

- Satyanarayan, A., Moritz, D., Wongsuphasawat, K., & Heer, J. (2017). *Vega-Lite: A Grammar of Interactive Graphics*. IEEE TVCG / InfoVis. DOI: `10.1109/TVCG.2016.2599030`. <https://vis.mit.edu/pubs/vega-lite/>
- Moritz, D., Wang, C., Nelson, G. L., Lin, H., Smith, A. M., Howe, B., & Heer, J. (2018). *Formalizing Visualization Design Knowledge as Constraints: Actionable and Extensible Models in Draco*. InfoVis. <https://dig.cmu.edu/publications/2018-draco.html>

Use Vega-Lite to justify declarative specification: saved, validated, shared, regenerated, and edited by tools.

Use Draco to justify validation rules as design knowledge rather than ad hoc warnings.

Screengrid's grammar contribution should be narrower than Vega-Lite:

- not a general visualisation grammar
- a cartographic grammar for screen-space gridded glyphmaps
- centred on data profiling, semantic cell summaries, glyph mappings, and cartographic validity checks

## 6. Visualisation Design and Evaluation

Core reference:

- Munzner, T. (2009). *A Nested Model for Visualization Design and Validation*. IEEE TVCG / InfoVis. <https://www.cs.ubc.ca/labs/imager/tr/2009/NestedModel/>

Use this to separate contribution layers:

- domain/problem: users need to inspect multivariate point data on maps
- abstraction: screen-space semantic cells
- encoding/interaction: glyph grammar plus map interaction
- algorithm/system: MapLibre layer and browser demo

This separation is important because the paper may otherwise overclaim novelty in the technique layer.

## 7. Where Screengrid Can Contribute

The strongest related-work gap is not "there are no gridded glyphmaps". There are.

The more defensible gap is:

- existing gridded glyphmap examples are compelling but often bespoke
- reusable grammars for constructing them from arbitrary uploaded datasets are less developed
- semantic summaries and validation rules are often implicit
- publication examples rarely make the cell-level assumptions, uncertainty, and comparability constraints inspectable

Screengrid can claim to contribute a reproducible design pattern and authoring workflow for this space.
