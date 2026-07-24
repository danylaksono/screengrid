# ScreenGrid Examples

The examples are organised by what they teach:

- `grammar/` - The declarative grammar end to end (`validateSpec` / `compileSpec`): density, MCDA suitability, and composition on synthetic London data. Start here for the spec-driven workflow.
- `stress-test/` - Performance harness: synthetic London points up to 500k, square/hex tessellation, and a live FPS meter for the lazy semantic-cell cost.
- `getting-started/` - Small introductory examples and the fuller interactive control demo.
- `aggregation/` - Rectangular and hexagonal screen-space aggregation patterns.
- `glyphs/` - Built-in glyphs, custom glyph callbacks, plugin glyphs, and legends.
- `temporal/` - Time-series and multivariate temporal glyph maps.
- `geometry/` - GeoJSON feature placement and feature-anchor rendering.
- `domain/` - Domain-specific visual analytics demos.
- `utilities/` - Data preparation helpers and utility functions.
- `showcases/` - More expressive or experimental demos.
- `internal/` - Smoke tests and legacy scratch examples that are not part of the public tour.

Open `examples/index.html` from a local HTTP server to browse the curated demo gallery.

```bash
npm start
# then open http://localhost:8000/examples/
```
