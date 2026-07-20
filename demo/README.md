# Screengrid Co-Pilot Demo

This folder contains the static reference prototype for Screengrid as a schema-driven multivariate cartographic grammar. The revised demo pattern is:

```text
uploaded point data -> dataset profile -> analytical intent -> spatial aggregation contract -> semantic cell model -> glyph grammar -> cartographic validation -> rendering + explanation
```

The important idea is that the visual UI and the LLM co-pilot manipulate the same declarative design spec. The LLM never injects arbitrary rendering code in v1. It proposes structured edits, the app validates them, and the user accepts or rejects the patch.

## Contents

- `schema/` - moved: the JSON Schema contracts now live in the library at [`src/grammar/schemas/`](../src/grammar/schemas/), alongside the validator (`validateSpec`) and spec compiler (`compileSpec`) exported from the package root.
- `prototype/` - the original static browser app using plain HTML, CSS, and ES modules.

The Vite/React "publication demo" app (`app/`) and its fixtures now live in the dedicated [screengrid-demo](https://github.com/danylaksono/screengrid-demo) repo.

## Running The Prototype

From the repository root:

```bash
npm run dev
```

Then open:

```text
http://localhost:8000/demo/prototype/
```

The prototype imports Screengrid directly from `src/index.js`, matching the existing examples.

## Current Prototype Scope

- CSV and GeoJSON point upload.
- Automatic dataset profiling and coordinate inference.
- Visual controls for coordinates, aggregation, normalization, grid size, glyph type, visual channels, palette, and cartographic evaluation.
- MapLibre rendering through `ScreenGridLayerGL`.
- Client-side co-pilot panel with an OpenAI-compatible provider adapter.
- Local fallback suggestions when no API key is supplied.
- Inspectable patch proposals with accept/reject controls.

## Design Pattern

The generalisable abstraction is a semantic cell model:

```js
{
  id,
  spatial: { type, bounds, centroid, zoom, cellSizePixels, aggregationMode },
  records: { count, denominator, rawRefs },
  measures: { count, fields },
  reliability: { sampleSizeClass, warnings },
  comparability: { normalization, viewportDependent, validAcrossZoom },
  custom
}
```

Once arbitrary point data is transformed into semantic cells, glyph rendering no longer depends directly on the source dataset. This lets the same interaction model support public transport accessibility, energy data, urban services, events, sensors, or any other point dataset while exposing reliability and comparability limits.

## Literature Grounding

- Munzner's nested model separates domain problem, data/task abstraction, visual encoding, and algorithm. The demo mirrors this by separating profiling, spec design, glyph mapping, and rendering.
- Vega/Vega-Lite show why declarative visualization grammars are useful for reproducibility, validation, and tool-generated edits.
- Mackinlay/APT motivates expressiveness and effectiveness checks before a visual encoding is accepted.
- Borgo et al.'s glyph survey frames glyphs as structured multivariate signs, which supports a constrained glyph grammar instead of arbitrary generated drawing code.
- Literature on gridded glyphmaps, binned aggregation, and multivariate maps motivates explicit checks for scale dependence, category overload, low sample size, uncertainty, and normalisation claims.
