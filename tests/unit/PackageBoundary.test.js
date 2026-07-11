import assert from 'assert';
import { createRequire } from 'module';
import packageJson from '../../package.json' with { type: 'json' };

console.log('[Test] Package boundary');

const require = createRequire(import.meta.url);
const esm = await import('../../dist/screengrid.mjs');
const cjs = require('../../dist/screengrid.cjs');
const selfReference = await import('screengrid');
const packageMain = require('../..');

for (const moduleShape of [esm, cjs, selfReference, packageMain]) {
  assert.strictEqual(typeof moduleShape.ScreenGridLayerGL, 'function');
  assert.strictEqual(typeof moduleShape.Aggregator, 'function');
  assert.strictEqual(typeof moduleShape.GlyphRegistry.register, 'function');
}

assert.strictEqual(packageJson.exports['.'].types, './index.d.ts');
assert.ok(packageJson.files.includes('index.d.ts'));
assert.ok(packageJson.files.includes('LICENSE'));

console.log('Package boundary OK');
