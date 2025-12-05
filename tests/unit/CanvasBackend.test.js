import assert from 'assert';
import { CanvasBackend } from '../../src/canvas/CanvasBackend.js';

console.log('[Test] CanvasBackend basic checks');
const cb = new CanvasBackend();
assert.strictEqual(cb.getName(), 'canvas');
console.log('CanvasBackend.getName OK');
console.log('CanvasBackend tests passed');
