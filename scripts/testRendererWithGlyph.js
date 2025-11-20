import { Renderer } from '../src/canvas/Renderer.js';

// Provide minimal global.window shim for Node (devicePixelRatio used in renderer)
if (typeof global.window === 'undefined') global.window = { devicePixelRatio: 1 };

// Mock simple canvas context with necessary methods used by Renderer and glyphs
function createMockCtx() {
  const ctx = {
    fillRect: (x, y, w, h) => console.log(`fillRect(${x},${y},${w},${h})`),
    beginPath: () => console.log('beginPath'),
    arc: (x, y, r, s, e) => console.log(`arc(${x},${y},${r})`),
    fill: () => console.log('fill'),
    stroke: () => console.log('stroke'),
    moveTo: (x, y) => console.log(`moveTo(${x},${y})`),
    lineTo: (x, y) => console.log(`lineTo(${x},${y})`),
    clearRect: (x, y, w, h) => console.log(`clearRect(${x},${y},${w},${h})`),
    save: () => console.log('save'),
    restore: () => console.log('restore'),
    set globalAlpha(v) { console.log('globalAlpha set', v); },
    set fillStyle(v) { console.log('fillStyle set', v); },
    set strokeStyle(v) { console.log('strokeStyle set', v); },
    set lineWidth(v) { console.log('lineWidth set', v); },
    set lineCap(v) { console.log('lineCap set', v); },
  };
  return ctx;
}

// Build aggregation result (2x2 grid)
const aggregationResult = {
  cols: 2,
  rows: 2,
  width: 120,
  height: 120,
  cellSizePixels: 60,
  grid: [1, 0, 0, 1],
  cellData: [
    [{ data: { employment_pct_15: 10 }, weight: 1 }],
    [],
    [],
    [{ data: { employment_pct_15: 20 }, weight: 1 }],
  ],
};

const ctx = createMockCtx();

let called = false;

Renderer.render(aggregationResult, ctx, {
  colorScale: (v) => [255 * v, 100, 200, 200],
  enableGlyphs: true,
  onDrawCell: (ctxArg, x, y, normVal, cellInfo) => {
    console.log('onDrawCell called at', x, y, 'normVal', normVal);
    called = true;
  },
  glyphSize: 0.8,
  normalizationFunction: 'max-local',
  normalizationContext: {},
  showBackground: true,
});

console.log('onDrawCell invoked?', called);
