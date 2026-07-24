// grammar-render-bridge.js — the visual half of the grammar pipeline.
//
// compileSpec() intentionally emits only the *analytical* half of a layer
// (aggregationMode, cellSizePixels, normalizationFunction, aggregationFunction,
// getPosition, getWeight) — the library stays domain- and style-agnostic. The
// *visual* encoding (a colour ramp for the palette, a glyph draw callback for
// the glyph type) lives in the application. This module is that seam, shared by
// the grammar examples so each one stays focused on the spec it demonstrates.

// --- Palettes: ordered colour stops interpolated in RGB. Names match the
//     grammar's PALETTES set (see validateSpec.js). ---------------------------
const RAMPS = {
  ember:   [[26, 12, 8], [120, 30, 10], [220, 80, 20], [255, 170, 40], [255, 232, 150]],
  viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
  ocean:   [[10, 24, 54], [17, 68, 116], [23, 122, 160], [80, 181, 189], [190, 232, 220]],
  slate:   [[24, 26, 30], [58, 64, 74], [110, 120, 132], [166, 176, 188], [226, 231, 238]],
};

// Discrete palette for categorical composition glyphs (colour-blind-aware set).
export const CATEGORICAL_COLORS = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2', '#edc948', '#9c755f',
];

function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Build a colorScale (v in [0,1] => [r,g,b,a], a in 0..255) from a palette name.
 * @param {string} palette - one of the grammar's palette names
 * @param {Object} [opts]
 * @param {number} [opts.opacity=210] - alpha (0..255)
 * @param {number} [opts.floor=0.06] - clamp the low end so near-empty cells stay faint but visible
 */
export function colorScaleFromPalette(palette, { opacity = 210, floor = 0.06 } = {}) {
  const ramp = RAMPS[palette] || RAMPS.ember;
  const last = ramp.length - 1;
  return (v) => {
    const t = Math.max(floor, Math.min(1, Number.isFinite(v) ? v : 0));
    const scaled = t * last;
    const i = Math.min(last - 1, Math.floor(scaled));
    const f = scaled - i;
    const c0 = ramp[i];
    const c1 = ramp[i + 1];
    return [
      Math.round(lerp(c0[0], c1[0], f)),
      Math.round(lerp(c0[1], c1[1], f)),
      Math.round(lerp(c0[2], c1[2], f)),
      opacity,
    ];
  };
}

/**
 * A composition (pie) glyph driven by a categorical field's per-cell
 * distribution. Reads the *semantic cell's* lazy `measures` — the whole point
 * of the semantic-cell model — rather than re-tallying raw records by hand.
 *
 * @param {string} segmentField - categorical field name (e.g. 'land_use')
 * @param {Object} [opts]
 * @param {string[]} [opts.categories] - fixed category order (keeps colours
 *   stable across cells); defaults to whatever the cell contains
 * @returns {Function} onDrawCell(ctx, x, y, normVal, cell)
 */
export function pieGlyphFor(segmentField, { categories = null } = {}) {
  const colorOf = new Map();
  if (categories) categories.forEach((c, i) => colorOf.set(c, CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]));

  return function drawCompositionGlyph(ctx, x, y, normVal, cell) {
    // `cell.measures` is a lazy getter; touching it here (inside the glyph
    // branch) is exactly where the perf design intends the cost to land.
    const field = cell?.measures?.fields?.[segmentField];
    const cats = field?.categories;
    if (!cats || cats.length === 0) return;

    const radius = cell.glyphRadius || (cell.cellSize ? cell.cellSize * 0.4 : 16);
    const total = cats.reduce((s, c) => s + c.count, 0) || 1;

    let start = -Math.PI / 2;
    for (const { value, count } of cats) {
      if (!colorOf.has(value)) colorOf.set(value, CATEGORICAL_COLORS[colorOf.size % CATEGORICAL_COLORS.length]);
      const angle = (count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = colorOf.get(value);
      ctx.globalAlpha = 0.9;
      ctx.fill();
      start += angle;
    }
    ctx.globalAlpha = 1;

    // A sparse-cell cue: outline low-sample cells so readers don't over-read them.
    if (cell.reliability?.warnings?.includes('low-sample-size')) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };
}

/** Resolve the segment field's category order from a profile, for stable colours. */
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
