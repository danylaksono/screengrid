// grammar-render-bridge.js — a thin compatibility shim.
//
// This module used to be the "visual half" of the grammar pipeline: compileSpec
// emitted only aggregation options, and each example hand-wrote its own palette
// ramp and glyph callback. That has moved into the library. `compileSpec` now
// compiles the glyph block too (see src/grammar/compileGlyph.js), so a validated
// spec renders on its own and the seam this file used to fill is gone.
//
// What remains here is one genuine data helper — `categoriesFromRecords` — which
// belongs to example data preparation rather than to the grammar, plus
// re-exports so older example code keeps working.

export { colorScaleFromPalette, CATEGORICAL_COLORS } from '../../src/index.js';

/**
 * Resolve a categorical field's category order directly from records.
 *
 * Prefer the dataset profile's `categories` when you have one — the glyph
 * compiler reads it, which is what keeps a category's colour stable across
 * cells, frames and viewports. This helper is for the case where you are
 * building a profile in the first place, or inspecting raw data.
 *
 * @param {Array<Object>} records - plain data records (not cell records)
 * @param {string} field - categorical field name
 * @param {number} [limit=8] - keep only the most frequent N
 * @returns {Array<string>} category values, most frequent first
 */
export function categoriesFromRecords(records, field, limit = 8) {
  const counts = new Map();
  for (const r of records) {
    const v = r[field];
    if (v == null) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([v]) => v);
}
