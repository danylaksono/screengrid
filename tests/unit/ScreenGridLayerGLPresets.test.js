import assert from 'assert';
import { ScreenGridLayerGL } from '../../src/ScreenGridLayerGL.js';

console.log('[Test] ScreenGridLayerGL preset factories');

const density = ScreenGridLayerGL.density({
  data: [],
  cellSizePixels: 72,
});
assert(density instanceof ScreenGridLayerGL);
assert.strictEqual(density.config.aggregationMode, 'screen-grid');
assert.strictEqual(density.config.renderMode, 'screen-grid');
assert.strictEqual(density.config.cellSizePixels, 72);
console.log('density preset OK');

const hexDensity = ScreenGridLayerGL.hexDensity({
  data: [],
  aggregationModeConfig: { hexSize: 44 },
});
assert(hexDensity instanceof ScreenGridLayerGL);
assert.strictEqual(hexDensity.config.aggregationMode, 'screen-hex');
assert.strictEqual(hexDensity.config.renderMode, 'screen-grid');
assert.strictEqual(hexDensity.config.aggregationModeConfig.hexSize, 44);
console.log('hexDensity preset OK');

const glyphMap = ScreenGridLayerGL.glyphMap({
  data: [],
  glyph: 'circle',
  glyphSize: 0.6,
});
assert(glyphMap instanceof ScreenGridLayerGL);
assert.strictEqual(glyphMap.config.aggregationMode, 'screen-grid');
assert.strictEqual(glyphMap.config.renderMode, 'screen-grid');
assert.strictEqual(glyphMap.config.enableGlyphs, true);
assert.strictEqual(glyphMap.config.glyph, 'circle');
assert.strictEqual(glyphMap.config.glyphSize, 0.6);
console.log('glyphMap preset OK');

const featureGlyphs = ScreenGridLayerGL.featureGlyphs({
  source: {
    type: 'FeatureCollection',
    features: [],
  },
  placement: { strategy: 'centroid' },
  glyph: 'pie',
});
assert(featureGlyphs instanceof ScreenGridLayerGL);
assert.strictEqual(featureGlyphs.config.renderMode, 'feature-anchors');
assert.strictEqual(featureGlyphs.config.enableGlyphs, true);
assert.strictEqual(featureGlyphs.config.glyph, 'pie');
console.log('featureGlyphs preset OK');

const override = ScreenGridLayerGL.glyphMap({
  data: [],
  aggregationMode: 'screen-hex',
  enableGlyphs: false,
});
assert.strictEqual(override.config.aggregationMode, 'screen-hex');
assert.strictEqual(override.config.enableGlyphs, false);
console.log('preset overrides OK');

console.log('ScreenGridLayerGL preset tests passed');
