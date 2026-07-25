// Offline test for the Santander preprocessing helpers — no network. Imports
// the real pure functions from fetch-santander-flows.mjs and checks both TfL
// CSV schemas (pre-2023 and 2023+), quoted-comma station names, hour→period,
// and the station join. Run: node scripts/santander/parse-test.mjs
import assert from 'node:assert';
import { parseCsvLine, mapColumns, readRow, toTrip, periodFromHour, normName, bearingAndDistance } from './fetch-santander-flows.mjs';

// --- CSV splitter handles quoted fields with embedded commas + "" escapes ---
assert.deepStrictEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
assert.deepStrictEqual(parseCsvLine('1,"Wormwood St, Liverpool Street",3'), ['1', 'Wormwood St, Liverpool Street', '3']);
assert.deepStrictEqual(parseCsvLine('"a ""quoted"" name",x'), ['a "quoted" name', 'x']);

// --- Old schema (pre-2023) --------------------------------------------------
const oldHeader = parseCsvLine('"Rental Id","Duration","Bike Id","End Date","EndStation Id","EndStation Name","Start Date","StartStation Id","StartStation Name"');
const oldCols = mapColumns(oldHeader);
const oldRow = readRow(
  parseCsvLine('100,720,15000,"05/08/2023 08:15",300,"Wormwood St, Liverpool Street","05/08/2023 08:03",14,"Belgrove Street , Kings Cross"'),
  oldCols
);
assert.strictEqual(oldRow.startId, '14', 'old: start station id');
assert.strictEqual(oldRow.endId, '300', 'old: end station id');
assert.strictEqual(oldRow.hour, 8, 'old: hour from dd/MM/yyyy HH:mm');
assert.strictEqual(oldRow.durationMin, 12, 'old: duration seconds → minutes');

// --- New schema (2023+) -----------------------------------------------------
const newHeader = parseCsvLine('"Number","Start date","Start station number","Start station","End date","End station number","End station","Bike number","Bike model","Total duration","Total duration (ms)"');
const newCols = mapColumns(newHeader);
const newRow = readRow(
  parseCsvLine('1,"2023-08-05 17:03",14,"Belgrove Street, Kings Cross","2023-08-05 17:15",300,"Wormwood St, Liverpool Street",15000,"CLASSIC","12m 0s",720000'),
  newCols
);
assert.strictEqual(newRow.startId, '14', 'new: start station number');
assert.strictEqual(newRow.endId, '300', 'new: end station number');
assert.strictEqual(newRow.hour, 17, 'new: hour from yyyy-MM-dd HH:mm');
assert.strictEqual(newRow.durationMin, 12, 'new: duration (ms) → minutes');

// --- period mapping ---------------------------------------------------------
assert.strictEqual(periodFromHour(8), 'am');
assert.strictEqual(periodFromHour(17), 'pm');
assert.strictEqual(periodFromHour(13), 'offpeak');
assert.strictEqual(periodFromHour(null), 'offpeak');

// --- station join + trip synthesis (id match, name fallback, self-loop) -----
const stations = {
  byId: new Map([
    ['14', { lat: 51.5299, lon: -0.1237, name: 'Belgrove Street, Kings Cross' }],
    ['300', { lat: 51.5152, lon: -0.0837, name: 'Wormwood St, Liverpool Street' }],
  ]),
  byName: new Map([[normName('Belgrove Street, Kings Cross'), { lat: 51.5299, lon: -0.1237, name: 'Belgrove Street, Kings Cross' }]]),
};

const trip = toTrip(newRow, stations);
assert.notStrictEqual(trip, 'unmatched');
assert.notStrictEqual(trip, 'selfloop');
assert.ok(trip.olon === -0.1237 && trip.dlon === -0.0837, 'coords joined from stations');
assert.strictEqual(trip.period, 'pm');
assert.ok(trip.bearing >= 0 && trip.bearing <= 360, 'bearing computed');
assert.ok(trip.dist_km > 2 && trip.dist_km < 5, `plausible intra-city distance, got ${trip.dist_km}`);

// name fallback when id is missing
const nameOnly = toTrip({ startId: '', endId: '', startName: 'Belgrove Street, Kings Cross', endName: 'Belgrove Street, Kings Cross', hour: 9 }, stations);
assert.strictEqual(nameOnly, 'selfloop', 'same station via name fallback → self-loop dropped');

// unmatched station
assert.strictEqual(toTrip({ startId: '999', endId: '888', startName: '', endName: '', hour: 9 }, stations), 'unmatched');

// bearing sanity: due east ≈ 90°, due north ≈ 0°
assert.ok(Math.abs(bearingAndDistance(0, 51.5, 0.01, 51.5).bearing - 90) < 1, 'east ≈ 90°');
assert.ok(bearingAndDistance(0, 51.5, 0, 51.6).bearing < 1, 'north ≈ 0°');

console.log('All Santander preprocessing parse tests passed.');
