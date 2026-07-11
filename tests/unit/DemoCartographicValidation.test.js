import assert from 'assert';
import { createDefaultSpec } from '../../demo/prototype/js/spec.js';
import { validateSpec } from '../../demo/prototype/js/validation.js';

console.log('[Test] Demo cartographic validation');

const profile = {
  sourceName: 'validation fixture',
  sourceType: 'csv',
  rowCount: 20,
  coordinateCandidates: [{ x: 'lon', y: 'lat', coordinateSystem: 'lonlat', confidence: 1 }],
  fields: [
    { name: 'lon', type: 'number', missingCount: 0, distinctCount: 20, min: -1, max: 1, mean: 0 },
    { name: 'lat', type: 'number', missingCount: 0, distinctCount: 20, min: 50, max: 51, mean: 50.5 },
    { name: 'value', type: 'number', missingCount: 0, distinctCount: 20, min: 0, max: 100, mean: 50 },
    {
      name: 'category',
      type: 'string',
      missingCount: 0,
      distinctCount: 9,
      min: null,
      max: null,
      mean: null,
      categories: []
    }
  ]
};

const spec = createDefaultSpec(profile);
spec.intent = { task: 'composition', audience: 'cartography researchers', comparison: 'across-cells' };
spec.glyph.type = 'pie';
spec.glyph.channels.segments.field = 'category';
spec.screengrid.normalization = 'max-local';
spec.screengrid.cellSizePixels = 18;

const validation = validateSpec(spec);
assert.strictEqual(validation.valid, true);
assert.ok(validation.warnings.some((warning) => warning.includes('Local normalization')));
assert.ok(validation.warnings.some((warning) => warning.includes('categories')));
assert.ok(validation.warnings.some((warning) => warning.includes('too small')));
assert.ok(validation.warnings.some((warning) => warning.includes('viewport dependent')));
assert.ok(validation.warnings.some((warning) => warning.includes('Mean summaries')));

const invalid = createDefaultSpec(profile);
invalid.intent.task = 'not-a-task';
assert.strictEqual(validateSpec(invalid).valid, false);

console.log('Demo cartographic validation OK');
