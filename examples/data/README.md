# Example datasets

All data in this folder is **synthetic** — generated purely to demonstrate the
ScreenGrid library. It does not represent real people, places, buildings, or
measurements, and it is not derived from any proprietary or third-party source.
Coordinates use real geography only so the examples render over a familiar map.

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

## `public_transport_accessibility.json`

A synthetic accessibility dataset: a GeoJSON `Feature` array spread across Great
Britain. Used by `examples/domain/public-transport-accessibility.html` with the
built-in `public-transport` glyph.

Each feature's `properties` contains centroid coordinates and cumulative
accessibility values for six categories × eight travel-time cuts:

- categories: `employment`, `supermarket`, `school_primary`, `school_secondary`, `gp`, `hospitals`
- minutes: `15, 30, 45, 60, 75, 90, 105, 120`
- fields: `${category}_${minutes}` (synthetic count) and `${category}_pct_${minutes}` (0–1, cumulative/monotonic) — the glyph reads the `_pct_` fields
- positioning: `properties.cent_long`, `properties.cent_lat`

## Regenerating

These files are produced by a small deterministic generator (seeded PRNG). If
you need different sizes or distributions, regenerate them rather than editing by
hand so the schema stays consistent with what the examples expect.
