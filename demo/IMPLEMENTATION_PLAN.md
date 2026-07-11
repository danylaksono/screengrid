# Demo Implementation Plan: Schema-Driven Screengrid Co-Pilot

## Summary

Create a static `demo/` prototype for a generalisable Screengrid design pattern:

```
uploaded point data -> profiling -> grid/cell abstraction -> declarative glyph spec -> visual UI + LLM co-pilot -> validated rendering
```

The prototype should prove that Screengrid can become a reusable design workflow rather than a set of dataset-specific examples. The schema is the product: UI controls, LLM suggestions, validation, rendering, and explanation all work through one shared design spec.

## Research Rationale

- **Munzner nested model**: separate domain goals, data/task abstraction, encoding/interaction, and algorithmic implementation. The app should not let glyph drawing decisions leak into data profiling or provider orchestration.
- **Grammar of Graphics / Vega-Lite**: use a declarative JSON spec that can be saved, diffed, validated, regenerated, and edited by tools.
- **Mackinlay/APT**: validate candidate visual encodings for expressiveness and effectiveness before rendering them.
- **Borgo et al. glyph guidance**: treat glyphs as structured multivariate marks with explicit channels, not arbitrary mini-drawings.

## Architecture

The prototype is static and browser-only:

- `prototype/index.html` provides the app shell.
- `prototype/styles.css` contains the visual system.
- `prototype/js/data.js` parses CSV and GeoJSON.
- `prototype/js/profile.js` infers fields, coordinate candidates, missingness, and summaries.
- `prototype/js/spec.js` creates and patches the shared design spec.
- `prototype/js/validation.js` performs lightweight runtime validation and design-rule checks.
- `prototype/js/rendering.js` adapts the design spec into `ScreenGridLayerGL` options.
- `prototype/js/orchestrator.js` registers pure client tools and records auditable runs.
- `prototype/js/llm.js` calls OpenAI-compatible chat completions from the browser.
- `prototype/js/app.js` wires UI, LLM suggestions, patch review, and map rendering.

## Shared Spec

The UI and assistant both manipulate this shape:

```js
{
  datasetProfile,
  screengrid: {
    coordinateSystem,
    coordinateFields,
    aggregationMode,
    aggregation,
    cellSizePixels,
    filters,
    summaries,
    normalization,
    emptyCellPolicy
  },
  glyph: {
    type,
    channels,
    scales,
    palette,
    legend
  },
  interaction: {
    hover,
    click,
    selection,
    explanation
  }
}
```

Assistant proposals use JSON Patch-style operations:

```js
{
  summary,
  rationale,
  actions: [
    {
      id,
      label,
      confidence,
      patch: [
        { op: "replace", path: "/glyph/type", value: "bar" }
      ]
    }
  ],
  warnings
}
```

## Staged Checklist

1. Add documentation and schemas.
2. Build CSV/GeoJSON parsing and dataset profiling.
3. Build the visual spec editor.
4. Render the spec through `ScreenGridLayerGL`.
5. Add local tool registry and run log.
6. Add OpenAI-compatible provider adapter.
7. Add proposal diff, accept, reject, and validation feedback.
8. Add schema fixtures and browser smoke testing in a later iteration.

## Acceptance Scenarios

- Upload CSV with longitude/latitude columns and render a density grid.
- Upload GeoJSON Point features and render them without server conversion.
- Switch aggregation from count to a numeric field.
- Change glyph type, size field, color field, palette, and normalization from visual controls.
- Ask the co-pilot for a glyph suggestion, inspect the patch, and accept it.
- Reject a suggestion without changing the current spec.
- Attempt an invalid patch and show validation errors instead of applying it.

## Defaults

- Static modules, no React/Vite in v1.
- CSV + GeoJSON upload only.
- Browser-only bring-your-own-key LLM calls.
- OpenAI-compatible provider shape for OpenAI, OpenRouter, or similar APIs.
- API key is held in memory unless the user explicitly enables local persistence.

