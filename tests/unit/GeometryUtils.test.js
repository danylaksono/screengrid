import assert from 'assert';
import { GeometryUtils } from '../../src/core/geometry/GeometryUtils.js';

console.log('[Test] GeometryUtils.centroidOfPoints');

const points1 = [[0, 0], [10, 0], [10, 10], [0, 10]];
const centroid1 = GeometryUtils.centroidOfPoints(points1);
assert.strictEqual(centroid1[0], 5);
assert.strictEqual(centroid1[1], 5);
console.log('centroidOfPoints OK');

// Test with single point
const points2 = [[5, 10]];
const centroid2 = GeometryUtils.centroidOfPoints(points2);
assert.strictEqual(centroid2[0], 5);
assert.strictEqual(centroid2[1], 10);
console.log('centroidOfPoints with single point OK');

// Test error handling
try {
  GeometryUtils.centroidOfPoints([]);
  assert.fail('Should have thrown error');
} catch (e) {
  assert(e.message.includes('empty'));
  console.log('centroidOfPoints error handling OK');
}

console.log('[Test] GeometryUtils.centroidOfLine');

const line1 = [[0, 0], [10, 10]];
const centroid3 = GeometryUtils.centroidOfLine(line1);
assert.strictEqual(centroid3[0], 5);
assert.strictEqual(centroid3[1], 5);
console.log('centroidOfLine OK');

// Test with single point
const line2 = [[5, 10]];
const centroid4 = GeometryUtils.centroidOfLine(line2);
assert.strictEqual(centroid4[0], 5);
assert.strictEqual(centroid4[1], 10);
console.log('centroidOfLine with single point OK');

// Test error handling
try {
  GeometryUtils.centroidOfLine([]);
  assert.fail('Should have thrown error');
} catch (e) {
  assert(e.message.includes('empty'));
  console.log('centroidOfLine error handling OK');
}

console.log('[Test] GeometryUtils.centroidOfPolygon');

const polygon1 = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]; // closed ring
const centroid5 = GeometryUtils.centroidOfPolygon(polygon1);
assert.strictEqual(centroid5[0], 5);
assert.strictEqual(centroid5[1], 5);
console.log('centroidOfPolygon OK');

// Test with open ring
const polygon2 = [[0, 0], [10, 0], [10, 10], [0, 10]];
const centroid6 = GeometryUtils.centroidOfPolygon(polygon2);
assert.strictEqual(centroid6[0], 5);
assert.strictEqual(centroid6[1], 5);
console.log('centroidOfPolygon with open ring OK');

// Test error handling
try {
  GeometryUtils.centroidOfPolygon([[0, 0], [10, 0]]);
  assert.fail('Should have thrown error');
} catch (e) {
  assert(e.message.includes('at least 3'));
  console.log('centroidOfPolygon error handling OK');
}

console.log('[Test] GeometryUtils.distanceMeters');

const point1 = [0, 0];
const point2 = [0, 1]; // 1 degree latitude ≈ 111km
const distance = GeometryUtils.distanceMeters(point1, point2);
assert(distance > 110000 && distance < 112000); // Approximately 111km
console.log('distanceMeters OK');

// Test with same point
assert.strictEqual(GeometryUtils.distanceMeters(point1, point1), 0);
console.log('distanceMeters with same point OK');

console.log('[Test] GeometryUtils.metersPerPixel');

const mpp1 = GeometryUtils.metersPerPixel(10, 0); // Equator, zoom 10
assert(mpp1 > 0);
console.log('metersPerPixel OK');

// Test that higher zoom gives smaller meters per pixel
const mpp2 = GeometryUtils.metersPerPixel(15, 0);
assert(mpp2 < mpp1);
console.log('metersPerPixel zoom scaling OK');

console.log('[Test] GeometryUtils.pixelsToMeters');

const pixels = 100;
const zoom = 10;
const lat = 0;
const meters = GeometryUtils.pixelsToMeters(pixels, zoom, lat);
assert(meters > 0);
assert.strictEqual(meters, pixels * GeometryUtils.metersPerPixel(zoom, lat));
console.log('pixelsToMeters OK');

console.log('[Test] GeometryUtils.metersToPixels');

const meters2 = 1000;
const pixels2 = GeometryUtils.metersToPixels(meters2, zoom, lat);
assert(pixels2 > 0);
assert.strictEqual(pixels2, meters2 / GeometryUtils.metersPerPixel(zoom, lat));
console.log('metersToPixels OK');

console.log('[Test] GeometryUtils.pointInPolygon');

const polygon3 = [[0, 0], [10, 0], [10, 10], [0, 10]];
assert.strictEqual(GeometryUtils.pointInPolygon([5, 5], polygon3), true);
assert.strictEqual(GeometryUtils.pointInPolygon([15, 15], polygon3), false);
assert.strictEqual(GeometryUtils.pointInPolygon([5, -1], polygon3), false);
console.log('pointInPolygon OK');

// Test point on edge
assert.strictEqual(GeometryUtils.pointInPolygon([0, 5], polygon3), true);
console.log('pointInPolygon on edge OK');

console.log('[Test] GeometryUtils.pointInPolygonWithHoles');

const exterior = [[0, 0], [10, 0], [10, 10], [0, 10]];
const hole = [[3, 3], [7, 3], [7, 7], [3, 7]];

assert.strictEqual(GeometryUtils.pointInPolygonWithHoles([5, 5], exterior, [hole]), false);
assert.strictEqual(GeometryUtils.pointInPolygonWithHoles([1, 1], exterior, [hole]), true);
assert.strictEqual(GeometryUtils.pointInPolygonWithHoles([15, 15], exterior, [hole]), false);
console.log('pointInPolygonWithHoles OK');

console.log('[Test] GeometryUtils.getBoundingBox');

const polygon4 = [[-5, -3], [10, -3], [10, 7], [-5, 7]];
const bbox = GeometryUtils.getBoundingBox(polygon4);
assert.strictEqual(bbox.minLng, -5);
assert.strictEqual(bbox.minLat, -3);
assert.strictEqual(bbox.maxLng, 10);
assert.strictEqual(bbox.maxLat, 7);
console.log('getBoundingBox OK');

console.log('[Test] GeometryUtils.generateGeodesicGrid');

const bbox2 = { minLng: 0, minLat: 0, maxLng: 1, maxLat: 1 };
const grid = GeometryUtils.generateGeodesicGrid(bbox2, 100000, 0.5); // 100km spacing
assert(grid.length > 0);
assert(Array.isArray(grid[0]));
assert.strictEqual(grid[0].length, 2);
console.log('generateGeodesicGrid OK');

console.log('GeometryUtils tests passed');

