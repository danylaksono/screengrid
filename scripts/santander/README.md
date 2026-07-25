# Santander Cycle flow preprocessing

`fetch-santander-flows.mjs` downloads real **London Santander Cycle Hire**
journeys and joins each trip's start/end docking station to its coordinates from
the **TfL BikePoint API**, producing the origin–destination flow file the flow
case studies consume (`examples/case-studies/od-flows.html`,
`inter-cell-flows.html`, `od-bundling.html`).

The examples run on synthetic data by default; once this script has produced
`examples/data/santander-flows.json`, the loader
(`examples/data/flows-loader.js`) picks it up automatically and the pages switch
to real trips.

## Data sources & licence

Both are **TfL Open Data** (openly licensed):

- Journeys: <https://cycling.data.tfl.gov.uk/> (`usage-stats/*.csv`). Note that
  this domain serves a static HTML "bucket browser"; the script lists and fetches
  objects from the underlying S3 REST endpoint
  (`https://s3-eu-west-1.amazonaws.com/cycling.data.tfl.gov.uk/`).
- Stations: <https://api.tfl.gov.uk/BikePoint> (lat/lon per docking station)

> Powered by TfL Open Data. Contains OS data © Crown copyright and database
> rights. Cycle hire data © Transport for London.

This attribution is written into `santander-flows-meta.json` and shown on the
example pages. The downloaded raw CSVs and the preprocessed output are **not
committed** (see `.gitignore`) — regenerate them locally.

## Usage

Requires Node ≥ 18 (global `fetch`, web streams). No dependencies.

```bash
# List available usage files (most recent first)
node scripts/santander/fetch-santander-flows.mjs --list

# Trial the pipeline cheaply: one file, stop after 20k rows
node scripts/santander/fetch-santander-flows.mjs --months=1 --max-rows=20000

# Full run: ~last month, sampled to 60k trips (default output path)
node scripts/santander/fetch-santander-flows.mjs --months=4 --sample=60000
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--months=<n>` | `4` | Most-recent weekly usage files to include (~4–5 ≈ a month) |
| `--sample=<n>` | `60000` | Reservoir-sample to `n` trips (`0` = keep all) |
| `--seed=<n>` | `42` | PRNG seed for the sample (reproducible) |
| `--out=<path>` | `examples/data/santander-flows.json` | Output JSON |
| `--max-rows=<n>` | `0` | Stop after `n` rows per file (quick trials) |
| `--list` | — | List usage files and exit |
| `--debug` | — | Print the raw bucket-listing response head (diagnostics) |

**Heads up:** each usage file is 100+ MB. Parsing streams line by line so memory
stays flat, but a full month is a real download — start with `--max-rows` or
`--months=1`.

## Output schema

A JSON array of trips (same shape as the synthetic generator, so it is drop-in):

```jsonc
{ "olon": -0.1237, "olat": 51.5299,   // origin station
  "dlon": -0.0837, "dlat": 51.5152,   // destination station
  "bearing": 106.4, "dist_km": 5.31,  // precomputed origin→destination
  "period": "am",                      // from start hour: am 07–10, pm 16–19, else offpeak
  "duration_min": 12,
  "oname": "…", "dname": "…" }
```

Trips whose stations can't be matched to coordinates, and same-station round
trips (zero-length), are dropped; the counts are reported in `…-meta.json`.

## How the join works

- **BikePoint** entries have `id` like `BikePoints_14` and a lat/lon. The script
  keys stations by that numeric id (and by `TerminalName` and normalised name as
  fallbacks).
- **Usage** rows carry a start/end station number (and name). The script joins on
  the number first, then the normalised name.
- TfL changed the usage CSV columns around 2023; the header mapping handles both
  the pre-2023 (`StartStation Id`, `Duration` seconds) and 2023+
  (`Start station number`, `Total duration (ms)`) schemas.

## Offline test

`parse-test.mjs` covers the pure parsing/join logic (both CSV schemas,
quoted-comma station names, hour→period, station join) without any network:

```bash
node scripts/santander/parse-test.mjs
```
