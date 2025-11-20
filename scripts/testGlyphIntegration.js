import { Renderer } from '../src/canvas/Renderer.js';
import { GlyphRegistry } from '../src/glyphs/GlyphRegistry.js';
import '../src/glyphs/PublicTransportGlyph.js';
import fs from 'fs';

if (typeof global.window === 'undefined') global.window = { devicePixelRatio: 1 };

const data = JSON.parse(fs.readFileSync(new URL('../examples/data/public_transport_accessibility.json', import.meta.url)));
console.log('Loaded data length', data.length);

// Build simple 4x4 grid, 2x2 cells for simplicity
const cols = 2; const rows = 2; const cellSizePixels = 60; const width = cols * cellSizePixels; const height = rows * cellSizePixels;
const grid = [0,0,0,0];
const cellData = [[],[],[],[]];

// Place some sample features into cell 0 and 3
for (let i=0;i<10;i++) {
  const item = data[i % data.length];
  cellData[0].push({ data: item, weight: 1 });
  grid[0] += 1;
}
for (let i=10;i<20;i++) {
  const item = data[i % data.length];
  cellData[3].push({ data: item, weight: 1 });
  grid[3] += 1;
}

const aggregationResult = { cols, rows, width, height, cellSizePixels, grid, cellData };

const ctx = {
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  moveTo: () => {},
  lineTo: () => {},
  save: () => {},
  restore: () => {},
  set fillStyle(v){},
  set strokeStyle(v){},
  set lineWidth(v){},
  set lineCap(v){},
  set globalAlpha(v){}
};

const plugin = GlyphRegistry.get('public-transport');
if (!plugin) {
  console.error('public-transport plugin not found');
  process.exit(1);
}

const glyphCfg = { timeIndex: 7, showSparkline: true, debug: true };

let invoked = false;

const onDrawCell = (ctxArg, x, y, normVal, info) => {
  try {
    plugin.draw(ctxArg, x, y, normVal, info, glyphCfg);
    invoked = true;
  } catch (e) {
    console.error('draw threw', e);
  }
};

Renderer.render(aggregationResult, ctx, { colorScale: (v) => [255 * v, 100, 200, 200], enableGlyphs: true, onDrawCell, glyphSize: 0.8, normalizationFunction: 'max-local', showBackground: true });

console.log('invoked?', invoked);
