import assert from 'assert';
import { CentroidStrategy } from '../../src/core/geometry/strategies/CentroidStrategy.js';

console.log('[Test] CentroidStrategy anchor shape');

// Regression: the centroidOf* helpers already return a single [lng, lat] pair.
// Wrapping them in an extra array made the strategy's destructuring produce
// lng=[lng,lat] / lat=undefined, so every anchor failed the numeric guard and
// was silently dropped. Only Point geometries survived. Guard every type.

const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

const features = [
  { type: 'Feature', properties: { name: 'point' }, geometry: { type: 'Point', coordinates: [1, 2] } },
  { type: 'Feature', properties: { name: 'multipoint' }, geometry: { type: 'MultiPoint', coordinates: [[0, 0], [10, 10]] } },
  { type: 'Feature', properties: { name: 'line' }, geometry: { type: 'LineString', coordinates: [[0, 0], [10, 10]] } },
  { type: 'Feature', properties: { name: 'multiline' }, geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [10, 10]], [[20, 20], [30, 30]]] } },
  { type: 'Feature', properties: { name: 'polygon' }, geometry: { type: 'Polygon', coordinates: [square] } },
  { type: 'Feature', properties: { name: 'multipolygon' }, geometry: { type: 'MultiPolygon', coordinates: [[square]] } },
];

const anchors = CentroidStrategy.place(features, {});
assert.strictEqual(anchors.length, features.length, `expected one anchor per feature, got ${anchors.length}`);

for (const a of anchors) {
  assert.ok(Array.isArray(a.position), `${a.props.name}: position must be an array`);
  assert.strictEqual(a.position.length, 2, `${a.props.name}: position must be [lng, lat]`);
  assert.strictEqual(typeof a.position[0], 'number', `${a.props.name}: lng must be a number, got ${JSON.stringify(a.position[0])}`);
  assert.strictEqual(typeof a.position[1], 'number', `${a.props.name}: lat must be a number, got ${JSON.stringify(a.position[1])}`);
  assert.ok(Number.isFinite(a.position[0]) && Number.isFinite(a.position[1]), `${a.props.name}: coordinates must be finite`);
}
console.log('one valid [lng, lat] anchor per geometry type OK');

// Polygon centroid of the unit square is its middle.
const poly = anchors.find((a) => a.props.name === 'polygon');
assert.strictEqual(poly.position[0], 5);
assert.strictEqual(poly.position[1], 5);
console.log('polygon centroid value OK');

// per-part partitioning yields one anchor per part.
const perPart = CentroidStrategy.place(
  [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [10, 10]], [[20, 20], [30, 30]]] } }],
  { partition: 'per-part' }
);
assert.strictEqual(perPart.length, 2, 'per-part MultiLineString yields 2 anchors');
assert.ok(perPart.every((a) => typeof a.position[0] === 'number'), 'per-part anchors are numeric');
console.log('per-part partitioning OK');

// Features without geometry are skipped, not fatal.
const mixed = CentroidStrategy.place(
  [{ type: 'Feature', properties: {} }, features[4]],
  {}
);
assert.strictEqual(mixed.length, 1, 'features without geometry are skipped');
console.log('missing geometry skipped OK');

console.log('CentroidStrategy tests passed');
