#!/usr/bin/env node
/**
 * fetch-santander-flows.mjs
 * ---------------------------------------------------------------------------
 * Download and preprocess real London Santander Cycle Hire journeys into the
 * origin–destination flow shape the flow case studies consume, joining each
 * trip's start/end docking station to its coordinates from the TfL BikePoint
 * API. The output drops straight into `examples/case-studies/*` via the flows
 * loader (examples/data/flows-loader.js).
 *
 * Data sources (both TfL Open Data, openly licensed):
 *   - Journeys:  https://cycling.data.tfl.gov.uk/  (usage-stats/*.csv)
 *   - Stations:  https://api.tfl.gov.uk/BikePoint  (lat/lon per docking station)
 *
 * ATTRIBUTION (required by the licence, carried into the output meta):
 *   Powered by TfL Open Data. Contains OS data © Crown copyright and database
 *   rights. Cycle hire data © Transport for London.
 *
 * Requirements: Node >= 18 (global fetch, web streams). No dependencies.
 *
 * Usage:
 *   node scripts/santander/fetch-santander-flows.mjs [options]
 *
 * Options:
 *   --months=<n>     Number of most recent weekly usage files to include (~4-5
 *                    ≈ a month).                                    [default 4]
 *   --sample=<n>     Reservoir-sample down to n trips (0 = keep all). [default 60000]
 *   --seed=<n>       PRNG seed for the sample (reproducible).         [default 42]
 *   --out=<path>     Output JSON.        [default examples/data/santander-flows.json]
 *   --max-rows=<n>   Stop after n data rows per file (quick trials).  [default 0 = all]
 *   --list           List available usage files (most recent first) and exit.
 *   --debug          Print the raw bucket-listing response head (diagnostics).
 *   --help
 *
 * NOTE: usage files are large (100+ MB each). Parsing streams line by line so
 * memory stays flat, but a full month is a real download — use --max-rows to
 * trial the pipeline first, or --months=1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BIKEPOINT_URL = 'https://api.tfl.gov.uk/BikePoint';
// cycling.data.tfl.gov.uk serves a static HTML "bucket browser" SPA, not the S3
// REST API — so list and fetch objects from the S3 endpoint directly (the SPA's
// own JS points at this region/host). Keys and object URLs both hang off this.
const USAGE_BUCKET = 'https://s3-eu-west-1.amazonaws.com/cycling.data.tfl.gov.uk/';
const USAGE_PREFIX = 'usage-stats/';
const ATTRIBUTION = 'Powered by TfL Open Data. Contains OS data © Crown copyright and database rights. Cycle hire data © Transport for London.';

const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

// Run only when invoked directly (so tests can import the pure helpers below
// without triggering any network calls).
if (isMainModule()) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }
  const opts = {
    months: Number(args.months ?? 4),
    sample: Number(args.sample ?? 60000),
    seed: Number(args.seed ?? 42),
    maxRows: Number(args['max-rows'] ?? 0),
    list: Boolean(args.list),
    debug: Boolean(args.debug),
    out: path.resolve(repoRoot, args.out ?? 'examples/data/santander-flows.json'),
  };
  main(opts).catch((err) => { console.error('\n✗ Failed:', err.message); process.exit(1); });
}

async function main(opts) {
  const { months: MONTHS, sample: SAMPLE, seed: SEED, maxRows: MAX_ROWS, out: OUT } = opts;
  const usageFiles = await listUsageFiles({ debug: opts.debug });
  if (opts.list) {
    console.log(`\n${usageFiles.length} usage file(s), most recent first:\n`);
    usageFiles.slice(0, 30).forEach((f) => console.log(`  ${f.lastModified || '(no date)'}  ${f.size ? (f.size / 1e6).toFixed(0) + ' MB' : '?'}  ${f.key}`));
    return;
  }

  if (usageFiles.length === 0) {
    console.error('\n✗ No usage files found in the listing. Re-run with --list --debug to see the raw');
    console.error(`  response from ${USAGE_BUCKET}?prefix=${USAGE_PREFIX} and share it so the parser can be fixed.`);
    return;
  }

  const chosen = usageFiles.slice(0, Math.max(1, MONTHS));
  console.log(`\nSelected ${chosen.length} most-recent usage file(s):`);
  chosen.forEach((f) => console.log(`  ${f.lastModified}  ${f.key}`));

  console.log('\nFetching BikePoint station coordinates …');
  const stations = await fetchStations();
  console.log(`  ${stations.byId.size} stations by id, ${stations.byName.size} by name.`);

  const rng = mulberry32(SEED);
  const reservoir = [];
  let seen = 0, kept = 0, unmatched = 0, selfLoops = 0, rows = 0;

  for (const f of chosen) {
    console.log(`\nStreaming ${f.key} …`);
    const before = rows;
    await streamCsv(USAGE_BUCKET + f.key, (record) => {
      rows += 1;
      const trip = toTrip(record, stations);
      if (trip === 'unmatched') { unmatched += 1; return; }
      if (trip === 'selfloop') { selfLoops += 1; return; }
      if (!trip) return;
      seen += 1;
      // Reservoir sample (uniform over the stream) unless SAMPLE == 0.
      if (SAMPLE <= 0 || reservoir.length < SAMPLE) {
        reservoir.push(trip); kept += 1;
      } else {
        const j = Math.floor(rng() * seen);
        if (j < SAMPLE) reservoir[j] = trip;
      }
      if (MAX_ROWS && rows - before >= MAX_ROWS) throw new StopStream();
    }).catch((e) => { if (!(e instanceof StopStream)) throw e; });
    console.log(`  rows so far: ${rows.toLocaleString()}, valid trips: ${seen.toLocaleString()}`);
  }

  const out = SAMPLE > 0 ? reservoir : reservoir;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const meta = {
    source: 'TfL Santander Cycle Hire',
    attribution: ATTRIBUTION,
    generatedAt: new Date().toISOString(),
    usageFiles: chosen.map((f) => f.key),
    stationSource: BIKEPOINT_URL,
    counts: { rowsParsed: rows, validTrips: seen, output: out.length, unmatchedStation: unmatched, selfLoops },
    schema: '{ olon, olat, dlon, dlat, bearing, dist_km, period, duration_min, oname, dname }',
  };
  fs.writeFileSync(OUT.replace(/\.json$/, '-meta.json'), JSON.stringify(meta, null, 2));

  console.log(`\n✓ Wrote ${out.length.toLocaleString()} trips → ${path.relative(repoRoot, OUT)}`);
  console.log(`  parsed ${rows.toLocaleString()} rows · ${unmatched.toLocaleString()} unmatched stations · ${selfLoops.toLocaleString()} same-station trips dropped`);
  console.log(`  ${ATTRIBUTION}`);
}

// --- Journey row -> flow trip ----------------------------------------------
export function toTrip(rec, stations) {
  const o = stations.byId.get(rec.startId) || stations.byName.get(normName(rec.startName));
  const d = stations.byId.get(rec.endId) || stations.byName.get(normName(rec.endName));
  if (!o || !d) return 'unmatched';
  if (o === d || (o.lon === d.lon && o.lat === d.lat)) return 'selfloop';
  const { bearing, distance } = bearingAndDistance(o.lon, o.lat, d.lon, d.lat);
  return {
    olon: round(o.lon, 6), olat: round(o.lat, 6),
    dlon: round(d.lon, 6), dlat: round(d.lat, 6),
    bearing: round(bearing, 1),
    dist_km: round(distance, 2),
    period: periodFromHour(rec.hour),
    duration_min: rec.durationMin,
    oname: o.name, dname: d.name,
  };
}

export function periodFromHour(h) {
  if (h == null) return 'offpeak';
  if (h >= 7 && h < 10) return 'am';
  if (h >= 16 && h < 19) return 'pm';
  return 'offpeak';
}

// --- BikePoint API ----------------------------------------------------------
async function fetchStations() {
  const res = await fetch(BIKEPOINT_URL);
  if (!res.ok) throw new Error(`BikePoint API ${res.status}`);
  const points = await res.json();
  const byId = new Map();   // numeric station id (string) -> {lat, lon, name}
  const byName = new Map(); // normalised commonName -> {lat, lon, name}
  for (const p of points) {
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const station = { lat: p.lat, lon: p.lon, name: p.commonName };
    const idMatch = /BikePoints_(\d+)/.exec(p.id || '');
    if (idMatch) byId.set(idMatch[1], station);
    // Some datasets key on the terminal name instead of the numeric id.
    const terminal = (p.additionalProperties || []).find((a) => a.key === 'TerminalName');
    if (terminal && terminal.value) byId.set(String(Number(terminal.value)), station);
    if (p.commonName) byName.set(normName(p.commonName), station);
  }
  return { byId, byName };
}

// --- Usage bucket listing ---------------------------------------------------
// Robust to how the endpoint answers: parse S3 XML <Contents> when present, and
// fall back to scanning the raw body for `usage-stats/*.csv` keys (works if the
// root serves an HTML index instead of XML). Sorting prefers <LastModified>, and
// otherwise the end-date embedded in the JourneyDataExtract filename.
async function listUsageFiles({ debug = false } = {}) {
  const seen = new Map(); // key -> { key, lastModified, size }
  let marker = '';
  for (let page = 0; page < 40; page++) {
    // Keep the slash in the prefix literal — some S3 endpoints don't decode %2F.
    const enc = (s) => encodeURIComponent(s).replace(/%2F/gi, '/');
    const url = `${USAGE_BUCKET}?prefix=${enc(USAGE_PREFIX)}${marker ? `&marker=${enc(marker)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bucket listing ${res.status} for ${url}`);
    const body = await res.text();
    if (debug && page === 0) {
      console.log(`\n[debug] GET ${url}\n[debug] status ${res.status}, ${body.length} bytes; head:\n${body.slice(0, 900)}\n[debug] ---`);
    }

    const contents = body.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
    let added = 0;
    for (const c of contents) {
      const key = tag(c, 'Key');
      if (!key || !/\.csv$/i.test(key)) continue;
      if (!seen.has(key)) { seen.set(key, { key, lastModified: tag(c, 'LastModified') || '', size: Number(tag(c, 'Size') || 0) }); added += 1; }
    }
    // Format-agnostic fallback if the XML shape wasn't found.
    if (contents.length === 0) {
      for (const key of body.match(/usage-stats\/[^\s"'<>\\)]+?\.csv/gi) || []) {
        if (!seen.has(key)) { seen.set(key, { key, lastModified: '', size: 0 }); added += 1; }
      }
    }

    const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(body);
    const lastKey = contents.length ? tag(contents[contents.length - 1], 'Key') : '';
    if (!truncated || !lastKey || added === 0) break;
    marker = lastKey;
  }

  const files = [...seen.values()];
  files.sort((a, b) => {
    if (a.lastModified && b.lastModified) return a.lastModified < b.lastModified ? 1 : -1;
    return endDateFromName(b.key) - endDateFromName(a.key);
  });
  return files;
}

const MONTHS_ABBR = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// The last DDMonYYYY in a JourneyDataExtract filename is the extract's end date.
function endDateFromName(key) {
  const all = [...key.matchAll(/(\d{2})([A-Za-z]{3})(\d{4})/g)];
  if (!all.length) return 0;
  const [, dd, mon, yyyy] = all[all.length - 1];
  const mo = MONTHS_ABBR[mon.toLowerCase()];
  return mo == null ? 0 : new Date(Number(yyyy), mo, Number(dd)).getTime();
}

// --- Streaming CSV ----------------------------------------------------------
class StopStream extends Error {}

async function streamCsv(url, onRecord) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const rl = readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
  let cols = null;
  try {
    for await (const line of rl) {
      if (!line) continue;
      const fields = parseCsvLine(line);
      if (!cols) { cols = mapColumns(fields); continue; }
      const rec = readRow(fields, cols);
      if (rec) onRecord(rec);
    }
  } finally {
    rl.close();
  }
}

// Map a header row to the column indices we need, tolerating TfL's schema
// changes over the years (pre-2023 vs 2023+ column names).
export function mapColumns(header) {
  const idx = {};
  header.forEach((h, i) => { idx[h.trim().toLowerCase()] = i; });
  const pick = (...names) => { for (const n of names) if (n in idx) return idx[n]; return -1; };
  return {
    startId: pick('startstation id', 'start station number', 'startstation number'),
    startName: pick('startstation name', 'start station'),
    endId: pick('endstation id', 'end station number', 'endstation number'),
    endName: pick('endstation name', 'end station'),
    startDate: pick('start date', 'start date ', 'startdate'),
    duration: pick('duration', 'total duration', 'total duration (s)'),
    durationMs: pick('total duration (ms)'),
  };
}

export function readRow(f, c) {
  const startId = c.startId >= 0 ? String(f[c.startId] ?? '').trim() : '';
  const endId = c.endId >= 0 ? String(f[c.endId] ?? '').trim() : '';
  const startName = c.startName >= 0 ? f[c.startName] : '';
  const endName = c.endName >= 0 ? f[c.endName] : '';
  if (!startId && !startName) return null;
  const dateStr = c.startDate >= 0 ? String(f[c.startDate] ?? '') : '';
  const hourMatch = /\b(\d{1,2}):(\d{2})\b/.exec(dateStr);
  const hour = hourMatch ? Number(hourMatch[1]) : null;
  // "Duration" (old) is seconds; "Total duration" (new) is text like "12m 0s"
  // so it is ignored in favour of the numeric "(ms)" column.
  let durationMin = null;
  const durSecs = c.duration >= 0 ? Number(f[c.duration]) : NaN;
  if (Number.isFinite(durSecs)) durationMin = round(durSecs / 60, 1);
  else if (c.durationMs >= 0 && Number.isFinite(Number(f[c.durationMs]))) durationMin = round(Number(f[c.durationMs]) / 60000, 1);
  return { startId, endId, startName, endName, hour, durationMin };
}

// CSV line splitter: handles quoted fields containing commas and "" escapes.
export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// --- Geo + utils ------------------------------------------------------------
export function bearingAndDistance(olon, olat, dlon, dlat) {
  const midLat = ((olat + dlat) / 2) * Math.PI / 180;
  const dx = (dlon - olon) * Math.cos(midLat) * 111.32;
  const dy = (dlat - olat) * 110.57;
  let bearing = Math.atan2(dx, dy) * 180 / Math.PI;
  if (bearing < 0) bearing += 360;
  return { bearing, distance: Math.hypot(dx, dy) };
}
export function normName(s) {
  return String(s || '').toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();
}
const round = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : x);
function tag(xml, name) {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1] : null;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}
function parseArgs(argv) {
  const o = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
  }
  return o;
}
function printHelp() {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(2, 46).join('\n').replace(/^ \* ?/gm, ''));
}
