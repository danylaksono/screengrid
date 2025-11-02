# Plugin Glyphs — Design & API

This document describes the design, API, and usage for the ScreenGrid glyph plugin system.

📖 **📚 For comprehensive documentation**: See [PLUGIN_GLYPH_ECOSYSTEM.md](./PLUGIN_GLYPH_ECOSYSTEM.md) for detailed evaluation, all available plugins, usage patterns, and complete API reference.

Status: ✅ **Fully implemented and production-ready**. Complete implementation in `src/glyphs/GlyphRegistry.js` with full integration into `ScreenGridLayerGL.js`. Four built-in plugins available, lifecycle hooks implemented, and legend support functional.

## Goals

- Provide a lightweight, JS-first plugin registry so users and third-party packages can register reusable glyphs by name.
- Keep the existing `onDrawCell` callback fully supported and highest precedence for backward compatibility.
- Offer built-in glyphs registered under friendly names (e.g. `circle`, `bar`, `pie`, `heatmap`).
- Keep the runtime path fast and safe: plugins run synchronously on the main thread and must be reasonably fast.

## High-level contract

- Registration: `GlyphRegistry.register(name, plugin, { overwrite=false })`
- Plugin shape (required/optional fields):
  - `draw(ctx, x, y, normalizedValue, cellInfo, config)` — required. Draw into the provided Canvas 2D context.
  - `init?(opts)` — optional. Called by a layer if the layer wants to invoke initialization. (Not used in MVP.)
  - `destroy?()` — optional. Called on layer removal if used.
  - `getLegend?(cellInfo)` — optional. Return legend entries for the cell.

## Layer integration

New/updated `ScreenGridLayerGL` options (MVP):

- `glyph` (string | null): Registered glyph name to use. If provided and a plugin exists with that name, the plugin's `draw` will be invoked for each cell.
- `glyphConfig` (object): Arbitrary object passed as the last argument to `plugin.draw` and available for built-in wrappers.
- Precedence order when rendering glyphs (highest -> lowest):
  1. `onDrawCell` callback from the layer's config (unchanged behavior)
  2. `glyph` name resolved from `GlyphRegistry`
  3. Color-mode rendering (no glyphs)

Implementation detail: the layer constructs a wrapper `onDrawCell` function from the plugin and passes that to the existing `Renderer` pipeline. No changes to `Renderer` were required.

## Example usage

Register a glyph in your app startup code:

```javascript
import { GlyphRegistry } from 'screengrid/src/glyphs/GlyphRegistry.js';

GlyphRegistry.register('myGauge', {
  draw(ctx, x, y, normalizedValue, cellInfo, config) {
    const radius = config && config.radius ? config.radius : cellInfo.glyphRadius;
    // Draw a simple gauge using canvas
    ctx.fillStyle = config.color || 'steelblue';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    // Add more drawing based on normalizedValue or cellInfo
  }
});

// Then create a layer using the registered glyph
const layer = new ScreenGridLayerGL({
  data,
  glyph: 'myGauge',
  glyphConfig: { radius: 8, color: '#ff6600' },
  enableGlyphs: true,
});
```

Notes:

- You can still provide `onDrawCell` directly (anonymous function or closure); it takes precedence over `glyph`.
- Built-in glyphs are available by default: `circle`, `bar`, `pie`, `heatmap`.

## Error handling and performance guidance

- The layer wraps plugin execution in a try/catch and logs errors. A faulty plugin will not break the whole render loop.
- Plugins run synchronously during render. For heavy computations, precompute during aggregation (`onAggregate`) and store summarised data on `cellInfo` so `draw` remains fast.
- Avoid network fetches or long-running sync work inside `draw`.

## Backwards compatibility & migration

- No change required for existing users using `onDrawCell`.
- To use a registered glyph instead of a callback, set `glyph: '<name>'` and optionally `glyphConfig` on the layer.

## Future improvements (post-MVP)

- ✅ **Implemented**: Per-layer plugin lifecycle hooks (`plugin.init(layer, config)` and `plugin.destroy()`)
- ✅ **Implemented**: Legend integration (Legend module calls `plugin.getLegend()` when available)
- ⏳ **Planned**: Optional sandboxing: consider WebWorker or sandboxed if third-party plugins run untrusted code.
- ⏳ **Planned**: Dynamic loading: allow registering plugins from URLs (with security considerations).

## Files changed in this PR

- `src/glyphs/GlyphRegistry.js` — new registry and built-in adapters
- `src/ScreenGridLayerGL.js` — wired the registry into the draw pipeline (wraps plugin.draw into onDrawCell)
- `docs/PLUGIN_GLYPHS.md` — this design doc

## Minimal testing checklist

1. Register a simple plugin and confirm it's called when `glyph` is set.
2. Confirm `onDrawCell` still takes precedence.
3. Confirm built-in names ('circle', 'bar', 'pie', 'heatmap') draw something.
4. Confirm errors thrown in plugin.draw are logged and do not halt rendering.
