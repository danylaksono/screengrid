import assert from 'assert';
import { EventHandlers } from '../../src/events/EventHandlers.js';

console.log('[Test] EventHandlers callbacks');

const event = { point: { x: 12, y: 34 } };
let clickPayload = null;
EventHandlers.handleClick(event, { getCellAt: () => null }, (payload) => {
  clickPayload = payload;
});

assert.ok(clickPayload);
assert.strictEqual(clickPayload.cell, null);
assert.strictEqual(clickPayload.event, event);

let hoverPayload = null;
EventHandlers.handleHover(event, { getCellAt: () => ({ id: 'cell' }) }, (payload) => {
  hoverPayload = payload;
});

assert.deepStrictEqual(hoverPayload.cell, { id: 'cell' });
assert.strictEqual(hoverPayload.event, event);

console.log('EventHandlers callbacks OK');
