import { ScreenGridLayerGL } from '../src/ScreenGridLayerGL.js';
import '../src/glyphs/PublicTransportGlyph.js';
import fs from 'fs';
import { expandPtal } from '../examples/data/ptal-loader.js';

if (typeof global.window === 'undefined') global.window = { devicePixelRatio: 1 };

const { data } = expandPtal(JSON.parse(fs.readFileSync(new URL('../examples/data/ptal-london.json', import.meta.url))));

const layer = new ScreenGridLayerGL({
  id: 'pta-layer',
  data,
  getPosition: (d) => {
    if (!d) return null;
    if (Array.isArray(d.centroid) && d.centroid.length >= 2) return d.centroid;
    if (Array.isArray(d.COORDINATES) && d.COORDINATES.length >= 2) return d.COORDINATES;
    if (d.geometry && d.geometry.type === 'Point' && Array.isArray(d.geometry.coordinates)) return d.geometry.coordinates;
    if (d.geometry && d.geometry.type === 'MultiPoint' && Array.isArray(d.geometry.coordinates) && d.geometry.coordinates[0]) return d.geometry.coordinates[0];
    if (d.properties && typeof d.properties.cent_long === 'number' && typeof d.properties.cent_lat === 'number') return [d.properties.cent_long, d.properties.cent_lat];
    if (typeof d.cent_long === 'number' && typeof d.cent_lat === 'number') return [d.cent_long, d.cent_lat];
    return null;
  },
  getWeight: () => 1,
  cellSizePixels: 60,
  colorScale: (v) => [255 * v, 200 * (1 - v), 50, 200],
  enableGlyphs: true,
  glyph: 'public-transport',
  glyphConfig: { timeIndex: 7, showSparkline: true, debug: true },
  showBackground: true,
});

// Mock canvas manager: Proxy no-ops any 2D context method, accepts any property set
const ctxStub = new Proxy({}, {
  get: (target, prop) => {
    if (!(prop in target)) target[prop] = () => {};
    return target[prop];
  },
  set: () => true,
});
layer.canvasManager = {
  getContext: () => ctxStub,
  getDisplaySize: () => ({ width: 1200, height: 800 }),
  clear: () => {},
};

// Mock aggregation result: call aggregator to build grid
import { Projector } from '../src/core/Projector.js';
import { Aggregator } from '../src/core/Aggregator.js';

// Minimal map stub with project method using EPSG:3857? just use US-UK coordinate mapping: we'll fake projection
const map = {
  project: ([lng, lat]) => ({ x: (lng + 180) * 3.5 % 1200, y: (90 - lat) * 4 % 800 }),
  getCanvas: () => ({ width: 1200, height: 800 }),
  getZoom: () => 11,
};

// Use Projector.projectPoints with map stub
const projected = Projector.projectPoints(data, layer.config.getPosition, layer.config.getWeight, map);
console.log('getPosition(data[0])', layer.config.getPosition(data[0]));
console.log('getWeight(data[0])', layer.config.getWeight(data[0]));
console.log('projected length', projected.length, 'first sample', projected.slice(0,2));
const aggregationResult = Aggregator.aggregate(projected, data, 1200, 800, 60);

layer.gridData = aggregationResult;

console.log('layer.config.glyph', layer.config.glyph);
import { GlyphRegistry } from '../src/glyphs/GlyphRegistry.js';
console.log('GlyphRegistry has public-transport?', GlyphRegistry.has('public-transport'));
const plugin = GlyphRegistry.get('public-transport');
console.log('plugin draw?', plugin && typeof plugin.draw === 'function');

// Mock map to layer (some functions may need it)
layer.map = map;

// Call draw
layer._draw();

console.log('done testLayerDraw');
