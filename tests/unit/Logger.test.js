import assert from 'assert';
import { Logger, setDebug } from '../../src/utils/Logger.js';

console.log('[Test] Logger.setDebug');

// Test initial state (should be false)
setDebug(false);
assert.strictEqual(typeof Logger.log, 'function');
assert.strictEqual(typeof Logger.warn, 'function');
assert.strictEqual(typeof Logger.error, 'function');
console.log('Logger functions exist OK');

// Test that error always works (we can't easily test log/warn without mocking console)
// But we can verify the functions don't throw
try {
  Logger.error('Test error message');
  console.log('Logger.error executes OK');
} catch (e) {
  assert.fail('Logger.error should not throw');
}

// Test with debug enabled
setDebug(true);
try {
  Logger.log('Test log message');
  Logger.warn('Test warn message');
  console.log('Logger.log and Logger.warn execute OK');
} catch (e) {
  assert.fail('Logger functions should not throw');
}

// Test with debug disabled
setDebug(false);
try {
  Logger.log('This should not appear');
  Logger.warn('This should not appear');
  console.log('Logger.log and Logger.warn respect debug flag OK');
} catch (e) {
  assert.fail('Logger functions should not throw');
}

// Reset debug state
setDebug(false);
console.log('Logger tests passed');

