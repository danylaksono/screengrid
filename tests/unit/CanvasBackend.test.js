import assert from 'assert';
import { CanvasManager } from '../../src/canvas/CanvasManager.js';

console.log('[Test] CanvasManager basic checks');

// Test that CanvasManager can be instantiated
const cm = new CanvasManager();
assert(cm !== null);
assert(cm !== undefined);
assert.strictEqual(typeof cm.init, 'function');
assert.strictEqual(typeof cm.getContext, 'function');
assert.strictEqual(typeof cm.getCanvas, 'function');
assert.strictEqual(typeof cm.resize, 'function');
assert.strictEqual(typeof cm.clear, 'function');
assert.strictEqual(typeof cm.cleanup, 'function');
console.log('CanvasManager instantiation OK');

// Test initial state
assert.strictEqual(cm.overlayCanvas, null);
assert.strictEqual(cm.ctx, null);
assert.strictEqual(cm.map, null);
console.log('CanvasManager initial state OK');

// Test getDisplaySize with no canvas
const size = cm.getDisplaySize();
assert.strictEqual(size.width, 0);
assert.strictEqual(size.height, 0);
console.log('CanvasManager.getDisplaySize with no canvas OK');

console.log('CanvasManager tests passed');
