# ScreenGrid Documentation

This folder contains the in-depth documentation for the ScreenGrid library. For a high-level overview and installation instructions, see the repository root `README.md`.

## Structure

- `QUICK_REFERENCE.md` – One-page cheat sheet and module overview
- `API_REFERENCE.md` – Complete, up-to-date public API reference
- `ARCHITECTURE.md` – Architecture and module-level design
- `USAGE.md` – Running examples, local dev, troubleshooting
- `GEOMETRY_INPUT_AND_PLACEMENT.md` – Geometry input, placement strategies, render modes
- `PLACEMENT_CONFIG.md` – Formal placement config shape and validation rules
- `GLYPH_DRAWING_GUIDE.md` – Glyphs with `onDrawCell`, multivariate and temporal patterns
- `PLUGIN_GLYPH_ECOSYSTEM.md` – Plugin glyph registry, built‑ins, custom plugins
- `PLUGIN_GLYPHS.md` – Design note for the plugin system (kept for background context)
- `SPATIO_TEMPORAL_GUIDE.md` – Focused guide for spatio‑temporal/time‑series use cases
 - `CARTOGRAPHY_AND_MULTIVARIATE_DESIGN.md` – Design philosophy and cartographic patterns

## How to Navigate

- Start with `QUICK_REFERENCE.md` if you already know ScreenGrid and just need reminders.
- Read `API_REFERENCE.md` when you need exact option names, defaults, and method signatures.
- Use `ARCHITECTURE.md` if you are extending the library or reading the source.
- Use `GLYPH_DRAWING_GUIDE.md` and `PLUGIN_GLYPH_ECOSYSTEM.md` when designing glyph‑based visualizations.
- Use `GEOMETRY_INPUT_AND_PLACEMENT.md` + `PLACEMENT_CONFIG.md` for non‑point geometry workflows (polygons/lines and feature‑anchor mode).

## Version Notes

The documents in this folder describe the refactored, modular `v2.x` codebase:

- Module layout and exports match `src/` and the root `README.md`.
- Geometry placement (`source`, `placement`, `renderMode`, `anchorSizePixels`) is documented in `GEOMETRY_INPUT_AND_PLACEMENT.md` and `PLACEMENT_CONFIG.md`.
- Glyph plugins (`glyph`, `glyphConfig`, `GlyphRegistry`) and legend integration are documented in `GLYPH_DRAWING_GUIDE.md` and `PLUGIN_GLYPH_ECOSYSTEM.md`.

If you find any mismatch between the docs and the runtime API, treat `API_REFERENCE.md` and the root `README.md` as the source of truth.
