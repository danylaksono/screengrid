# Background and Related References

## 1. Direct Lineage: Slingsby's Gridded Glyphmaps

Aidan Slingsby (supervisor) is the main author behind gridded glyphmaps. Three artifacts
define the claimed territory; all Screengrid papers must cite them and position against
them precisely.

### 1a. IEEE VIS 2023 short paper (published)

- Slingsby, A., Reeve, R., & Harris, C. (2023). *Gridded Glyphmaps for Supporting Spatial
  COVID-19 Modelling*. IEEE VIS 2023. DOI: `10.1109/VIS54172.2023.00009`.
  <https://openaccess.city.ac.uk/id/eprint/31115/>

What it claims (from §5 "Issues, Reflections and Further Work" — read the full section, it
is the roadmap of his future work):

- **Glyph complexity vs spatial resolution trade-off**, managed interactively (grid size vs
  zoom as separate controls).
- **Within-cell heterogeneity**: "designing glyphs that convey the heterogeneity within
  cells could alert analysts where to inspect at a finer resolution... Glyph designs and
  interactions for investigating this is good further work." → **his declared future work**.
- **Spatial anomalies**: glyphs that identify anomalies buried by aggregation, using
  locally/temporally weighted statistics. → **his declared future work**.
- **MAUP**: gridded glyphmaps are "particularly vulnerable"; "Glyph stability when
  interactively panning gives a visual indication of the impact of MAUP. There is scope for
  further work in quantifying this and depicting the effects through glyphs."
  → **his declared future work**.
- **Implementation**: original Java app + open-source JavaScript in Observable notebooks
  (<https://observablehq.com/collection/@aidans/covid-19-modelling>), offered for others
  "to explore and experiment with".

### 1b. Design-space manuscript (unpublished; local copy `docs/2023GriddedGlyphmapsDesignSpace.pdf`)

*A Gridded Glyphmap Design Space for Multivariate Area-Based Cartography.* This claims the
**design space** comprehensively:

- **§4.1 Discretisation**: spatial data, projection, cell size/shape/**offset**, smoothing.
- **§4.2 Summarisation**: summarising distributions, **denominators**, numerical binning —
  deliberately separated from glyph design ("same summarisation can be used for a lot of
  different glyphs").
- **§4.3 Glyph design**: visual comparison, scaling, demarcating cells, denominators and
  sample size, geographical reference points.
- **§4.4 Interaction**: zooming/panning, interactive scaling parameters, interactive
  comparison, animation.
- **§5 Implementation**: functional-programming JavaScript idiom in Observable — user
  supplies aggregation and draw functions; `global` and `cell` variable spaces; interactive
  parameters auto-registered in a small GUI. This is a *programmatic* idiom, not a
  declarative grammar.
- **§6.2.1 MAUP**: explicit discussion — zoning vs scale effects (Openshaw), interactive
  assessment by panning/offset adjustment, and a sketched systematic assessment: adjust
  offsets/cell size, render the distribution per cell, "we are interested in the width of
  the distribution with respect to the magnitude of the chosen summary value".
- **§6.2.2** density skew (most points in few cells), **§6.2.3** cognitive overload.

Also relevant: the Observable idiom notebook
<https://observablehq.com/@aidans/rampvis-idiom-gridded-glyphmaps> — genuinely
screen-space aggregation, doing most of what Screengrid's rendering layer does, but hard to
track, version, and reproduce outside Observable.

### 1c. Supervisor discussion notes (review-response correspondence, 2023)

Points Aidan has raised that stake further territory or offer collaboration hooks:

- **Cursor-anchored gridding** prototype (grid origin follows the mouse) to stabilise glyphs
  while panning: <https://observablehq.com/d/05b119b94705f4bf#cell-1075>. Worth
  *implementing in Screengrid as a credited feature* (interaction-stability), not claiming.
- **MAUP offset-ensemble glyphs**: systematic cell-offset sweeps rendered as per-cell
  histograms (#cell-726); he intends to summarise as e.g. a standard-deviation border
  "in the full paper if accepted". → **do not lead on this**.
- Glyph instability under panning is itself useful information ("where glyphs are
  'unstable', it's useful information to know you can't trust them").
- **Regional denominators** (e.g. normalise by the country a cell falls in) are possible in
  his implementation but absent from the design space "because there's no concept of
  'country', only cells". → a genuine gap Screengrid's semantic cell could fill
  (denominator provenance), framed as provenance not MAUP.
- **Observational study of how people use gridded glyphmaps**: "Absolutely. Would like to
  be involved in doing this." → collaborative lane, not solo.

### Positioning consequence

The technique, the design space, MAUP treatment, and the named future-work items
(heterogeneity, anomaly, MAUP glyphs, usage study) are **his**. Screengrid papers must
contribute at the formalization/system/provenance layer and cite 1a/1b as the source of the
encoded design knowledge.

## 2. Own Prior Work: MCDA Application Paper (published)

- Laksono, D., Slingsby, A., & Jianu, R. (2024). *Gridded-glyphmaps for supporting
  Geographic Multicriteria Decision Analysis*. EuroVis Short Papers 2024.
  DOI: `10.2312/evs.20241062`. <https://openaccess.city.ac.uk/id/eprint/33111/>

Uses Simple Additive Weighting MCDA over LSOA-level data for decarbonisation planning in
Cambridge, with gridded glyphmaps for interactive weight adjustment and criteria
transparency (data via Advanced Infrastructure Ltd.). This paper **is** the application-lane
evidence: it shows the technique carrying a real decision-analysis workload. Future papers
should cite it as the applied precedent, and it supplies a ready-made case study
(multi-criteria profile glyphs, weight interaction) for the flagship methods paper.

## 3. MAUP-Aware Visualization (competing/adjacent — do not lead here)

- Kawakami, Y., Yuniar, S., & Ma, K.-L. (2024). *HexTiles and Semantic Icons for MAUP-Aware
  Multivariate Geospatial Visualizations*. arXiv:2407.16897.
  Hexagonal tiling + semantic icons; **explicit MAUP mitigation via per-tile confidence
  encoding** (weighted variance per channel); evaluated with a user study and domain
  experts (ecology/hydrology).
- Trautner, T., Sbardellati, M., Stoppel, S., & Bruckner, S. (2022). *Honeycomb Plots:
  Visual Enhancements for Hexagonal Maps*. Eurographics/EuroVis.
  Encodes distributional information within hexagonal bins.

Consequence: MAUP-confidence encoding on regular tessellations is an active, occupied
space (Slingsby's declared future work + HexTiles). Screengrid's comparability/reliability
metadata should be framed as **provenance and auditability infrastructure** that *could
carry* such encodings, not as a MAUP-visualization contribution.

## 4. Glyph-Based Visualisation

- Borgo, R., Kehrer, J., Chung, D. H. S., Maguire, E., Laramee, R. S., Hauser, H., Ward, M.,
  & Chen, M. (2013). *Glyph-based Visualization: Foundations, Design Guidelines, Techniques
  and Applications*. Eurographics STARs. DOI: `10.2312/conf/EG2013/stars/039-063`.

Use to justify glyph limits, legends, and validation warnings (visual channel capacity,
perceptual overload). Note: glyph *design* guidance belongs to this literature and to
Slingsby §4.3 — Screengrid encodes it as rules, it does not claim it.

## 5. Multivariate Maps and Glyph Placement

- McNabb, L., & Laramee, R. S. (2019). *Multivariate Maps: A Glyph-Placement Algorithm to
  Support Multivariate Geospatial Visualization*. Information, 10(10), 302.

Screengrid avoids free-placement overlap via screen-space bins; trades geographic stability
for interactive legibility; must state that screen-space cells are not fixed areal units.

## 6. Binned Aggregation Systems

Needed to defend the semantic cell against "this is just a bin with stats":

- imMens (Liu, Jiang & Heer 2013), Nanocubes (Lins, Klosowski & Scheidegger 2013),
  Hashedcubes (Pahins et al. 2016), and data-tile approaches — binned aggregation for
  *scalability*. Screengrid's cells differ in purpose: they attach **validity semantics**
  (provenance, reliability, comparability contract), not just precomputed aggregates.
- deck.gl `ScreenGridLayer` — screen-space binning as rendering; no semantic layer. Make
  this comparison a first-class table in any paper.

## 7. Grammars, Design Knowledge as Constraints, and Guided Authoring

- Satyanarayan, A., Moritz, D., Wongsuphasawat, K., & Heer, J. (2017). *Vega-Lite: A Grammar
  of Interactive Graphics*. IEEE TVCG. DOI: `10.1109/TVCG.2016.2599030`.
- Moritz, D., et al. (2018). *Formalizing Visualization Design Knowledge as Constraints:
  Draco*. IEEE InfoVis.
- Follow-ups worth citing: Draco 2, Dziban, Mackinlay's APT / Show Me lineage.

Screengrid's grammar claim is narrower than Vega-Lite (specialised cartographic grammar)
and its validation claim is Draco-shaped but **cartographic**: the constraints are derived
from Slingsby's design space + Borgo's glyph guidance + cartographic practice, and they are
evaluated for whether they catch invalid designs. To our knowledge no one has
operationalized a *cartographic* design space as executable constraints — this is the
flagship gap (verify with a fresh search before submission).

## 8. Uncertainty and Geo-Semantics (supporting the semantic cell)

- MacEachren, A. M., et al. — visualizing geospatial information uncertainty (framework
  papers). Kinkeldey, C., MacEachren, A. M., & Schiewe, J. (2014) — review of uncertainty
  visualization evaluation.
- Cite for the reliability/comparability fields of the semantic cell. The cell contract is
  *infrastructure that carries* uncertainty semantics; the encoding of uncertainty into
  glyphs is Slingsby/HexTiles territory.

## 9. Visualisation Design and Evaluation

- Munzner, T. (2009). *A Nested Model for Visualization Design and Validation*. IEEE TVCG.

Layer separation, and the key positioning device:

- domain/problem + technique + encoding design space → **Slingsby**
- application evidence (MCDA) → **Laksono et al. 2024 (done)**
- abstraction (semantic cell contract) + algorithm/system (grammar, validation engine,
  reproducible library, agent guidance) → **Screengrid's lane**

## 10. Where Screengrid Contributes (revised)

The defensible gap is **not** "there are no gridded glyphmaps" and **not** "glyphmaps need
MAUP awareness" (both claimed). It is:

- the technique exists as bespoke, hard-to-reproduce notebook code; no versioned, tested,
  declarative, schema-validated implementation exists → reproducibility/artifact gap (JOSS,
  AGILE reproducibility track);
- the design knowledge exists as prose; no machine-checkable formalization exists →
  executable-design-knowledge gap (flagship);
- aggregation provenance (which records, which denominator, which normalisation, valid for
  which comparisons) is implicit in all existing implementations → semantic cell /
  auditability gap (flagship supporting claim);
- nobody guides *coding agents* with cartographic design constraints → agent-guardrails gap
  (flagship evaluation + follow-up paper).
