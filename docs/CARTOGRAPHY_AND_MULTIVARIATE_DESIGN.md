# Cartography & Multivariate Design with ScreenGrid

This document explains the cartographic philosophy behind ScreenGrid and how to use its grid and glyph model to design multivariate, interactive maps.

## 1. Conceptual Model

- **Screen-space grid, not geographic tessellation**: ScreenGrid aggregates data into a regular grid *in screen coordinates*. Cells are sized in pixels, and move/resize with the map view.
- **Glyphs as carriers of multivariate information**: Each cell (or feature anchor) is a small canvas where you can draw arbitrary marks that encode multiple attributes.
- **Two core roles**:
  - **Density / intensity**: how much of something is present in this part of the map.
  - **Composition / structure**: how that quantity breaks down across categories, time, or attributes.

This is closer to density-based glyph maps than to traditional polygon choropleths. It is most effective when you want to:

- Reveal *patterns in distributions* (e.g. where flows originate/terminate, where events cluster).
- Compare *profiles* of different places (e.g. temporal trajectories, category mixes) rather than just their totals.

## 2. What ScreenGrid is Good At

### 2.1 Multivariate Point-Based Visualisation

With classic `renderMode: 'screen-grid'` and point input (`data` + `getPosition`), you can:

- Aggregate multiple attributes per cell and encode them as:
  - **Bars, pies, donuts, radial bars** (category breakdowns).
  - **Time-series glyphs** (temporal evolution per cell).
  - **Composite glyphs** that overlay multiple marks (e.g. background intensity + pie + label).
- Use the **plugin system** to package these glyphs as reusable designs.
- Drive **interactive exploration** via hover/click callbacks that expose the full set of underlying records per cell.

Good use cases:

- Multivariate crime / incident grids.
- Environmental sensor grids with multiple pollutants.
- Socio-demographic indicators stacked or decomposed into components.
- Epidemiology and public health modeling (e.g., disease spread with temporal trends, inspired by Slingsby's Gridded Glyphmaps for COVID-19).
- Urban mobility and transport planning (e.g., commuter flows, congestion, multimodal transport with uncertainty encoding).
- Environmental monitoring with uncertainty (e.g., air/water quality forecasts with probabilistic glyphs).
- Comparative and scenario analysis (e.g., "what-if" urban development impacts on demographics).
- Network and infrastructure analysis (e.g., utility grids with load/demand summaries).

### 2.2 Geometry-Based Visualisation (Anchors)

With `source` (GeoJSON) + `placement` + `renderMode: 'feature-anchors'`, you can:

- Place one or more anchors **per polygon or line**, and draw one glyph per anchor.
- Use glyphs as **symbolic summaries of polygon attributes** instead of filling the polygon surface.

Good use cases:

- IMD / deprivation profiles per LSOA/MSOA shown as small multivariate glyphs sitting on the area.
- Regional statistics where the polygon is only a carrier for the glyph (the polygon fill comes from MapLibre styles; ScreenGrid adds the multivariate symbol).

### 2.3 Spatio-Temporal Design

Combining the grid and glyph systems, you can:

- Show **time series per cell** (or per feature anchor) using the time-series glyphs.
- Link glyph appearance to an external **time slider**, by filtering or weighting data before aggregation.
- Use **split-screen or layered glyphs** to show multiple temporal dimensions (e.g. past vs future, weekday vs weekend).

Good use cases:

- Spatio-temporal OD patterns (e.g. departures vs arrivals over hours of day).
- Evolution of activity intensity per grid cell.

## 3. Things ScreenGrid is *Not* Designed For

- **True polygon hatching or dot-density within polygon boundaries**: ScreenGrid does not rasterize and clip textures inside arbitrary polygons. For such cases, MapLibre styles or a dedicated polygon renderer are more appropriate.
- **Per-pixel continuous surfaces**: it works on cells (discrete) rather than continuous rasters; for smooth surfaces, a traditional raster heatmap may fit better.

You can still *approximate* some of these techniques symbolically using glyphs (e.g. a hatched glyph that *represents* a hatched area), but they remain symbols anchored in space, not literal fills.

## 4. Cartographic Design Patterns

This section sketches design patterns for multivariate and cartographic use, so you can decide when ScreenGrid is an appropriate tool.

### 4.1 Bivariate / Trivariate Grids

Use **color + glyph** or **multiple glyph components**:

- Map one variable to **cell background intensity** (if `aggregationModeConfig.showBackground === true`). This is effective for showing a primary variable like density, total volume, or a statistical measure like a Z-score.
- Map other variables to glyph components (bar heights, pie slices, inner/outer rings, radial bars).

**Pattern:**

- Variable A → cell background (e.g. total population density).
- Variable B, C, D → pie or bar glyph at the cell center showing demographic breakdown (e.g., by age cohort).
- Hover → show full numbers / proportions in a tooltip.

This yields a grid where you can read both overall magnitude and internal composition simultaneously, a common and powerful technique in geovisualization.

### 4.2 Spatio-Temporal Grids

Use the time-series utilities or custom glyphs:

- Group per-cell records by time (hour/day/year) and draw a line chart within each cell.
- Optionally, split the cell into top/bottom halves to show two related temporal variables (e.g., arrivals vs. departures).

**Pattern:**

- X-axis of glyph → time.
- Y-axis → aggregated metric (or multiple metrics with stacked lines).
- Glyph opacity or border → overall reliability / sample size.

See the "Advanced Glyph-Based Design Patterns" section below for more sophisticated temporal glyphs like Pencil and Helix glyphs.

### 4.3 OD and Flow Maps as Grids

ScreenGrid does not draw network edges itself, but is useful for **gridded OD summaries**:

- Use the grid to aggregate **origins** or **destinations** of flows.
- Per cell, encode:
  - total outgoing volume,
  - total incoming volume,
  - dominant destination region/category,
  - or simple origin/destination balance.

**Design ideas:**

- **Origin-side grid**: each cell shows where flows originating here tend to go (e.g. pie by destination region, or radial bars by direction sector).
- **Destination-side grid**: each cell shows composition of origins feeding into this destination.

**For interaction:**

- Hover a cell → highlight corresponding flows in a separate layer (drawn by MapLibre as lines), using the cell’s `cellData` to drive that other layer.
- Click a cell → switch the grid from origin-based to destination-based view (or vice versa) by re-aggregating.

### 4.4 Network and Flow Data

For network data (edges/nodes):

- Use the grid to summarize **node attributes** or **edge traffic** per area.
- Use ScreenGrid as the **context** for where activity is concentrated, and let another layer draw the detailed network geometries.

**Patterns:**

- Cell glyph: stacked bars for types of flows passing through this area.
- Anchor glyphs on important nodes (using `feature-anchors`) to show multivariate node attributes (degree, betweenness, category, etc.).

### 4.5 Category Mixtures and Profiles

Classic Bertin-style multivariate design:

- Use **pie/donut** glyphs for share-type variables (composition).
- Use **radial bar** glyphs for compact comparison of 3–6 categories.
- For small multiples, consider a **2×2 matrix of mini-glyphs** within each cell to compare different aspects of the data.

The legend module can be wired to show the mapping between colors, categories, and variables.

### 4.6 Uncertainty and Probabilistic Encoding

Incorporate uncertainty into glyphs for datasets with probabilistic or noisy data (e.g., forecasts, sensor errors), per Beecham's work on uncertainty in visualization.

- Use glyph opacity, blur, or error bars to represent confidence levels.
- Map variables to probabilistic shading (extending Bertin's "value" variable).

**Pattern:**

- Variable A → glyph core (e.g., bar height for mean value).
- Uncertainty → glyph envelope (e.g., shaded range for standard deviation).
- Hover → show confidence intervals in tooltips.

This addresses perceptual limits by indicating when glyph density reflects low reliability.

### 4.7 Hexagonal or Non-Rectangular Grids

For improved packing in dense areas, support hexagonal grids (inspired by HexTiles for multivariate geospatial data).

- Toggle between square and hex grids to reduce artifacts.
- Place glyphs in hex cells for better spatial distribution.

**Pattern:**

- Use hex aggregation mode for irregular data distributions.
- Glyphs remain multivariate but benefit from geometric variation.

### 4.8 Radial and Layout-Based Glyphs

Optimize glyph design with radial layouts and multi-criteria placement algorithms.

- Employ radial primitives (dots, lines, circles) for multivariate encoding.
- Use automated placement to avoid overlap (e.g., for 3–6 categories).

**Pattern:**

- Variables → radial positions/angles (e.g., direction sectors in OD flows).
- Implementation: Custom `onDrawCell` with layout algorithms.

### 4.9 Interactive Brushing and Linking Patterns

Enable coordinated views for exploratory analysis, aligning with Andrienko's spatio-temporal frameworks.

- Link glyphs to external plots (e.g., time-series panels).
- Brushing: Select a glyph to filter/highlight related data in other layers.

**Pattern:**

- Hover/click → update linked visualizations (e.g., parallel coordinates).
- Supports task taxonomy: overview, zoom, filter, details-on-demand.

### 4.10 Composite and Hierarchical Glyphs

For high-dimensional data, create nested or hierarchical glyphs.

- Overlay multiple marks (e.g., background + pie + label).
- Use matrices of mini-glyphs for small multiples.

**Pattern:**

- Variables → layered components (e.g., outer ring for categories, inner for sub-categories).
- Extends Chernoff Faces to custom composites.

## 5. Advanced Glyph-Based Design Patterns

For more complex datasets, you can design more expressive glyphs. These often draw inspiration from academic work in geovisualization and information visualization.

### 5.1 Advanced Spatio-Temporal Glyphs

Beyond simple line charts, you can represent time in more sophisticated ways. These are often associated with the "space-time cube" concept in GIS, where time is treated as a third dimension. ScreenGrid can represent these ideas in 2D glyphs.

- **Pencil Glyphs**: Ideal for visualizing linear or event-based temporal data. A pencil glyph is a bar where different segments encode information.
  - **Use Case**: Visualizing the duration and stages of an event (e.g., a power outage).
  - **Implementation**: Draw a vertical bar where the length represents total duration. Use different colors along the bar to show different phases (e.g., initial report, dispatch, resolution). The bar's thickness could represent the number of customers affected.

- **Helix Glyphs**: Perfect for cyclic temporal patterns (e.g., daily, weekly, or seasonal cycles).
  - **Use Case**: Showing hourly traffic patterns for each day of the week in a grid cell.
  - **Implementation**: Draw a spiral where each loop represents a 24-hour cycle. The radius of the spiral at a certain angle (hour) represents the traffic volume. Color could distinguish weekdays from weekends. This allows for quick comparison of cyclic profiles between different cells.

### 5.2 High-Dimensional Glyphs (Custom Composites)

For datasets with many attributes, you can create custom composite glyphs that map data variables to visual properties in non-standard ways.

- **Chernoff Faces**: A classic (if sometimes controversial) example where variables are mapped to facial features.
  - **Use Case**: Representing complex socio-economic or environmental indicators. For example, mapping unemployment rate to mouth curvature, income level to eye size, and air quality to face color. While not always easy to interpret precisely, they can provide a powerful, at-a-glance impression of overall "health" or "distress" of an area.
  - **Implementation**: This requires a fully custom `onDrawCell` function that draws arcs, circles, and shapes based on multiple data attributes from the cell's aggregated data.

### 5.3 Attribute-Rich Network Summaries

Expanding on the OD-flow concept, glyphs can summarize not just the volume of flows but also their network-theoretic properties.

- **Use Case**: Analyzing urban mobility networks or internet traffic.
- **Implementation**:
  - **Node Centrality Glyphs**: In a grid over a city, place glyphs that summarize the network centrality (e.g., betweenness, degree) of the transport hubs within each cell. A star-shaped glyph could have its points sized by the degree of different types of connections (bus, train, ferry).
  - **Flow Composition Glyphs**: For a cell representing an area with network traffic, a glyph could show the mix of traffic types (e.g., local vs. through-traffic, commercial vs. residential) using stacked bars or a donut chart, while the cell background shows total volume.

### 5.4 Uncertainty Glyphs

For probabilistic data, glyphs can encode confidence and error.

- **Error Bar Glyphs**: Bars with whiskers for mean and variance.
  - **Use Case**: Environmental forecasts with uncertainty.
  - **Implementation**: Draw bars with shaded ranges based on data attributes.

### 5.5 Hexagonal Grid Glyphs

Adapt glyphs for hex grids to leverage better tiling.

- **HexTiles Glyphs**: Place multivariate symbols in hexagonal cells.
  - **Use Case**: Dense multivariate geospatial data without overlap.
  - **Implementation**: Modify aggregation to hex mode and adjust glyph positioning.

### 5.6 Radial Layout Glyphs

Use circular arrangements for compact encoding.

- **Radial Bar Glyphs**: Bars radiating from center.
  - **Use Case**: Comparing categories in OD flows.
  - **Implementation**: Draw arcs or lines at angles proportional to variables.

## 6. Workflow: Choosing Where ScreenGrid Fits

When designing a map, ask:

1. **Is my primary question about where things happen, or about polygon-level totals?**
   - If polygon boundaries are semantically central (wards, boroughs), and you need traditional choropleths or hatching, start with MapLibre styles and treat ScreenGrid as a secondary layer for summaries.
   - If the emphasis is on *spatial patterns and profiles* rather than administrative units, ScreenGrid can be the primary visual.

2. **How many variables do I truly need to show simultaneously?**
   - 1 variable → background grid or simple glyph.
   - 2–4 variables → combined color + glyph, or multi-part glyph (e.g., bars, pies).
   - 5+ variables → consider advanced glyphs (Pencils, Helixes), splitting into multiple layers, or designing composite glyphs that emphasize a subset at a time.

3. **Do users need to read exact values, or relative patterns?**
   - Exact values → rely on hover/click callbacks and legends; keep glyphs simple.
   - Patterns and rankings → richer glyphs (time series, radials, composites) are appropriate.

4. **What role do polygons play?**
   - If polygons are just containers for data, consider feature-anchor glyphs.
   - If polygon shapes themselves carry meaning (coastlines, irregular regions), use MapLibre polygon layers for shape and ScreenGrid for symbolic summaries.

## 7. Implementation Hooks

To realise the above patterns in code, you will typically combine:

- **Aggregation and query**:
  - `getCellsInBounds`, `getCellsAboveThreshold` for spatial queries.
  - `getGridStats()` for global ranges used in normalization.
- **Glyphs**:
  - `onDrawCell` or a plugin `glyph` for custom multivariate designs.
  - Built-in glyph utilities for standard patterns (bars, pies, donuts, radial bars, time series).
- **Geometry placement** (if using polygons/lines):
  - `source`, `placement`, `renderMode: 'feature-anchors'`, and `anchorSizePixels`.
- **Interactivity**:
  - `onHover`, `onClick` to connect ScreenGrid cells with other layers (e.g. flow lines, base choropleths).
  - Built-in brushing/linking for coordinated views.

- **Uncertainty and Performance**:
  - Confidence mode for glyphs (opacity/blur for uncertainty).
  - Grid geometry options (square/hex toggles).
  - Level-of-detail (LOD) rendering for large datasets.
  - Statistical hooks for auto-normalization.

- **Export and Accessibility**:
  - Static image export for publications.
  - Accessibility features (alt-text for glyphs).

See:

- `GLYPH_DRAWING_GUIDE.md` for concrete glyph implementations and code.
- `PLUGIN_GLYPH_ECOSYSTEM.md` for plugin-based glyph reuse.
- `SPATIO_TEMPORAL_GUIDE.md` for time-focused designs.
- `GEOMETRY_INPUT_AND_PLACEMENT.md` + `PLACEMENT_CONFIG.md` for anchor-based designs on polygon/line data.

## 8. Summary

In cartographic terms, ScreenGrid is best understood as a **screen-space glyph map engine**:

- It excels at **multivariate**, **spatio-temporal**, **flow-related**, and **uncertainty-aware summaries** in regular grids (square/hex) or at feature anchors.
- It delegates **polygon styling and low-level cartographic textures** (hatching, true dot-density fills) to the base map style engine (MapLibre).
- It is most powerful when combined with MapLibre layers, UI controls, and interactive features to create **coordinated, exploratory views**.
- Its design patterns draw from foundational works like Bertin's visual variables, Andrienko's spatio-temporal analytics, Slingsby's screen-space glyphmaps, and Beecham's uncertainty visualizations, positioning it as a comprehensive tool for diverse GIS analyses.

When in doubt, let polygon and line layers carry the traditional cartography, and let ScreenGrid provide the **small, information-dense symbols** that reveal how multiple dimensions of your data behave across space and time.

## 9. References

- Bertin, J. (1967). *Semiology of Graphics*. University of Wisconsin Press. (Foundational visual variables for multivariate encoding.)
- Andrienko, N., & Andrienko, G. (2013). A Visual Analytics Framework for Spatio-Temporal Analysis and Modelling. *Data Mining and Knowledge Discovery*. (Spatio-temporal exploration patterns.)
- Slingsby, A., Reeve, R., & Harris, C. (2023). Gridded Glyphmaps for Supporting Spatial COVID-19 Modelling. *IEEE Visualization and Applications*. (Screen-space aggregation with glyphs.)
- Beecham, R. (2020). On the Use of 'Glyphmaps' for Analysing the Scale and Temporal Dynamics of Spatial Behaviour. *ISPRS International Journal of Geo-Information*. (Glyphmaps for transport and uncertainty.)
- Additional: HexTiles (McNabb et al., 2019) for hexagonal multivariate encoding; radial glyphs for layout optimization.
