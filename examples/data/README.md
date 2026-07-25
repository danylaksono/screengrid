# Example datasets

Most data in this folder is **synthetic** — generated purely to demonstrate the
ScreenGrid library. It does not represent real people, places, buildings, or
measurements, and it is not derived from any proprietary or third-party source.
Coordinates use real geography only so the examples render over a familiar map.

Two datasets are **real open data** and are labelled as such below:
`ptal-london.json` (committed) and `santander-flows.json` (fetched locally).
The London borough boundaries used by the geometry example are fetched live and
never committed.

## `cambridge.json`

A synthetic domestic-retrofit dataset (heat pumps, EV chargers, solar PV) for
points scattered around the Cambridge, UK area. Used by the temporal examples
(`examples/temporal/time-series.html`, `multivariate-time-series.html`) to draw
per-cell time-series glyphs.

Each record:

| field | type | notes |
|---|---|---|
| `lsoa` | string | area code (arbitrary, real-format) |
| `postcode` | string | arbitrary |
| `lat`, `lon` | number | point location |
| `budget` | string | `capped5000k` \| `capped15000k` \| `uncapped` |
| `year` | number | 2020–2024 |
| `technology` | string | `heat pumps` \| `ev chargers` \| `solar pv` |
| `labour_cost`, `material_cost`, `total_cost` | number | GBP |
| `ashp_carbonsaved`, `ev_carbonsaved`, `pv_carbonsaved` | number \| null | kgCO₂; only the field matching `technology` is set |

## Real data — `ptal-london.json` (committed, 1.1 MB)

**Real** public transport accessibility for **4,835 Greater London LSOAs**, from
Verduzco Torres & McArthur (2024). Used by
`examples/domain/public-transport-accessibility.html` with the built-in
`public-transport` glyph. Loaded through `ptal-loader.js` — do not `fetch` it
directly, the on-disk layout is columnar.

Cumulative accessibility for six categories × eight travel-time cuts:

- categories: `employment`, `supermarket`, `school_primary`, `school_secondary`, `gp`, `hospitals`
- minutes: `15, 30, 45, 60, 75, 90, 105, 120`
- values: `${category}_pct_${minutes}` on a **0–100** scale, cumulative and monotonic across time cuts
- positioning: `properties.cent_long`, `properties.cent_lat`

The loader expands the columnar file into GeoJSON `Feature`s carrying exactly
those `_pct_` field names, so the glyph sees the same shape it always has.

### Why columnar, and how to regenerate

The source extract is 19.1 MB. A `Feature`-per-record layout spends more bytes
repeating key names like `"school_secondary_pct_105"` (6.6 MB across 4,835
records) than on the values themselves, so the committed file stores columns and
`ptal-loader.js` rebuilds the records. Combined with dropping unused MultiPolygon
geometry (33% of the source), dropping the raw count columns the original
metadata says were meant to be excluded, and rounding percentages to 1 dp, the
file is **1.1 MB — 94% smaller** with no loss the glyph can express.

The full source is preserved in git history. To regenerate:

```bash
git show d78801d:examples/data/public_transport_accessibility.json > ptal-full.json
node scripts/ptal/slim-ptal.mjs ptal-full.json examples/data/ptal-london.json
```

The script re-checks that every category × time-cut series survives and stays
monotonic, and fails rather than writing a broken file. See
`public_transport_accessibility_metadata.md` for the original column
descriptions.

> Public transport accessibility indicators: Verduzco Torres, J.G. &
> McArthur, D.P. (2024). Contains National Statistics and OS data © Crown
> copyright and database right.

## `london.js` (generated at runtime, not committed as JSON)

A dependency-free ES module that generates synthetic multivariate **Greater
London** points on demand, used by the grammar examples (`examples/grammar/`) and
the stress test (`examples/stress-test/`). Nothing is committed as data — the
pages call `generateLondonPoints({ count, seed })` in the browser, so the same
`(count, seed)` always yields the same points and the stress test can scale to
500k without a large file in the repo.

Only public geography drives it: a Greater London bounding box and approximate
town-centre coordinates seed the clustering; every attribute is invented.

- `generateLondonPoints({ count, seed, scatter })` → records with `lon`, `lat`,
  `borough`, `land_use` (`residential`/`retail`/`office`/`greenspace`/`industrial`),
  `price`, `access`, `rent`, `pm25`, `year`.
- `buildLondonProfile(records)` → the `datasetProfile` the grammar validates and
  compiles against, with real numeric `min`/`max` (global term normalization
  needs them) and categorical `distinctCount`s (the category guardrail uses them).
- `generateLondonFlows({ count, seed })` → synthetic origin–destination trips for
  the flow-glyph case study (`examples/case-studies/od-flows.html`): each trip has
  an origin/destination, precomputed `bearing` and `dist_km`, a `period`
  (`am`/`pm`/`offpeak`) and a `purpose`. Commutes flow residential → employment in
  the AM peak and reverse in the PM peak. Aggregate by the origin (`[olon, olat]`).

## Real data — London borough boundaries (fetched live, not committed)

`examples/geometry/feature-anchors-london-boroughs.html` loads the 33 London
boroughs straight from the ONS Open Geography Portal at runtime — no committed
copy, because the service sends `Access-Control-Allow-Origin: *`:

```text
Local_Authority_Districts_December_2023_Boundaries_UK_BSC/FeatureServer/0/query
  ?where=LAD23CD LIKE 'E09%'&outFields=LAD23CD,LAD23NM,Shape__Area&outSR=4326&f=geojson
```

Real polygons and a real measured attribute (`Shape__Area`, square metres —
divide by 1e6 for km²), so the glyph encodes something verifiable rather than an
invented value. If the portal is unreachable the page reports the failure in its
readout instead of silently rendering nothing.

> Boundaries: Office for National Statistics licensed under the Open Government
> Licence v3.0. Contains OS data © Crown copyright and database right 2024.

## Real data — `santander-flows.json` (optional, not committed)

The flow case studies load real **Santander Cycle Hire** journeys when this file
is present, and fall back to `generateLondonFlows` otherwise (via
`flows-loader.js`). It is produced by
[`scripts/santander/fetch-santander-flows.mjs`](../../scripts/santander/), which
downloads TfL Open Data journeys and joins them to BikePoint station
coordinates. The file (and its `-meta.json`) are git-ignored — regenerate
locally:

```bash
node scripts/santander/fetch-santander-flows.mjs --months=1 --max-rows=20000  # quick trial
```

> Powered by TfL Open Data. Cycle hire data © Transport for London.

## Regenerating

These files are produced by a small deterministic generator (seeded PRNG). If
you need different sizes or distributions, regenerate them rather than editing by
hand so the schema stays consistent with what the examples expect.
