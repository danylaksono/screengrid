/**
 * compileGlyph.js
 * Compiles the `glyph` half of a Screengrid spec into executable render options.
 *
 * Until now `compileSpec` emitted only the analytical half of a layer and left the
 * visual half (palette ramp, glyph callback) to application code. That made the
 * glyph grammar *checkable* but not *executable*: `validateSpec` could reject a
 * bad glyph spec, but nothing in the library could draw a good one. This module
 * closes that gap, so a spec is a complete, reproducible description of a map.
 *
 * Performance contract (see AGENTS.md sections 7 and 9). Screen-space maps
 * re-aggregate every pan/zoom frame, so anything read per cell per frame is paid
 * per frame. Therefore:
 *   - Per-cell payloads are computed ONCE per aggregation, in `onAggregate`,
 *     reading raw `cellData` records only. `cell.measures` is never touched on
 *     the render path.
 *   - Shared (cross-cell) domains are computed in that same pass, which is what
 *     makes "one divisor for every cell" honest rather than per-cell rescaling.
 *   - `onDrawCell` indexes into the precomputed payload and draws. It allocates
 *     nothing per glyph.
 */

import { GlyphUtilities } from '../glyphs/GlyphUtilities.js';

// --- Palettes -------------------------------------------------------------
// Ordered RGB stops interpolated in RGB. Names match the grammar's PALETTES set
// (see validateSpec.js). `categorical` is not a ramp; it selects CATEGORICAL_COLORS.
const RAMPS = {
  ember:   [[26, 12, 8], [120, 30, 10], [220, 80, 20], [255, 170, 40], [255, 232, 150]],
  viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
  ocean:   [[10, 24, 54], [17, 68, 116], [23, 122, 160], [80, 181, 189], [190, 232, 220]],
  slate:   [[24, 26, 30], [58, 64, 74], [110, 120, 132], [166, 176, 188], [226, 231, 238]],
};

/** Discrete, colour-blind-aware palette for categorical encodings. */
export const CATEGORICAL_COLORS = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2', '#edc948', '#9c755f',
];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

function rampAt(ramp, v) {
  const last = ramp.length - 1;
  const scaled = clamp01(v) * last;
  const i = Math.min(last - 1, Math.floor(scaled));
  const f = scaled - i;
  const c0 = ramp[i];
  const c1 = ramp[i + 1];
  return [
    Math.round(lerp(c0[0], c1[0], f)),
    Math.round(lerp(c0[1], c1[1], f)),
    Math.round(lerp(c0[2], c1[2], f)),
  ];
}

/**
 * Build a `colorScale` (v in [0,1] => [r,g,b,a], a in 0..255) from a palette name.
 * @param {string} palette - one of the grammar's palette names
 * @param {Object} [opts]
 * @param {number} [opts.opacity=210] - alpha (0..255)
 * @param {number} [opts.floor=0.06] - clamp the low end so near-empty cells stay faint but visible
 * @returns {Function}
 */
export function colorScaleFromPalette(palette, { opacity = 210, floor = 0.06 } = {}) {
  const ramp = RAMPS[palette] || RAMPS.ember;
  return (v) => {
    const [r, g, b] = rampAt(ramp, Math.max(floor, clamp01(v)));
    return [r, g, b, opacity];
  };
}

/** CSS colour string from a palette ramp at t in [0,1] (used for glyph fills). */
function rampCss(palette, t, alpha = 1) {
  const ramp = RAMPS[palette] || RAMPS.ember;
  const [r, g, b] = rampAt(ramp, t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- Channel accessors ----------------------------------------------------
// A channel is {field, aggregate, fallback}. Compiled once into a function over
// the cell's raw records ({data, weight, projectedX, projectedY}).

/**
 * Compile one channel into (records) => number|string|null.
 * @param {Object|null} channel
 * @returns {Function|null} null when the channel is absent
 */
function compileAccessor(channel) {
  if (!channel) return null;
  const field = channel.field ?? null;
  const fallback = channel.fallback ?? null;
  // Default op: a channel with no field can only be a count; otherwise mean.
  const op = channel.aggregate || (field === null ? 'count' : 'mean');

  if (op === 'count' || field === null) {
    return (records) => records.length;
  }

  if (op === 'mode') {
    return (records) => {
      const counts = new Map();
      let best = fallback;
      let bestN = 0;
      for (const r of records) {
        const v = r?.data?.[field];
        if (v === null || v === undefined || v === '') continue;
        const n = (counts.get(v) || 0) + 1;
        counts.set(v, n);
        if (n > bestN) { bestN = n; best = v; }
      }
      return best;
    };
  }

  if (op === 'distinct') {
    return (records) => {
      const seen = new Set();
      for (const r of records) {
        const v = r?.data?.[field];
        if (v === null || v === undefined || v === '') continue;
        seen.add(v);
      }
      return seen.size;
    };
  }

  // Numeric reducers. Loop rather than spread (AGENTS.md section 9: no
  // Math.max(...arr) on unbounded arrays).
  return (records) => {
    let total = 0;
    let n = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const r of records) {
      const v = Number(r?.data?.[field]);
      if (!Number.isFinite(v)) continue;
      total += v;
      n += 1;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (n === 0) return Number.isFinite(fallback) ? fallback : null;
    if (op === 'sum') return total;
    if (op === 'min') return min;
    if (op === 'max') return max;
    return total / n; // mean
  };
}

/** Reduce records to one number by a mark's `data.aggregate` op. */
function reduceBy(op, records, field) {
  let total = 0;
  let n = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const r of records) {
    const v = Number(r?.data?.[field]);
    if (!Number.isFinite(v)) continue;
    total += v;
    n += 1;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (n === 0) return null;
  if (op === 'sum') return total;
  if (op === 'min') return min;
  if (op === 'max') return max;
  return total / n;
}

// --- Field-list resolution (for series and radial profiles) ---------------

function orderFields(names, order) {
  const list = names.slice();
  if (order === 'lexical') return list.sort((a, b) => String(a).localeCompare(String(b)));
  if (order === 'temporal') {
    // Natural ordering: compare embedded integers when present (hour_1 < hour_10),
    // falling back to lexical. ISO-like names sort correctly either way.
    const key = (s) => {
      const m = String(s).match(/(\d+)/);
      return m ? Number(m[1]) : Number.NaN;
    };
    return list.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb) return ka - kb;
      return String(a).localeCompare(String(b));
    });
  }
  return list; // 'given' (default): author-declared order is meaningful
}

/** Resolve a mark's ordered field list from `fields` or `fieldPattern`. */
function resolveFields(spec, data) {
  if (!data) return [];
  if (Array.isArray(data.fields) && data.fields.length > 0) {
    return orderFields(data.fields, data.order);
  }
  if (data.fieldPattern) {
    let re;
    try {
      re = new RegExp(data.fieldPattern);
    } catch {
      return [];
    }
    const names = (spec.datasetProfile?.fields || [])
      .filter((f) => re.test(f.name))
      .map((f) => f.name);
    return orderFields(names, data.order);
  }
  return [];
}

// --- Domain helpers -------------------------------------------------------

const newDomain = () => ({ min: Infinity, max: -Infinity });

function extend(domain, v) {
  if (!Number.isFinite(v)) return;
  if (v < domain.min) domain.min = v;
  if (v > domain.max) domain.max = v;
}

/** Normalize v into [0,1] against a domain; degenerate domains map to 0.5. */
function normIn(domain, v) {
  if (!domain || !Number.isFinite(v)) return 0;
  const { min, max } = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max === min) return 0.5;
  return clamp01((v - min) / (max - min));
}

// --- Category resolution --------------------------------------------------

/**
 * Fixed category order for a segment field, taken from the dataset profile so
 * colours stay stable across cells, frames and viewports. Returns null if the
 * profile carries no categories (colours then fall back to first-seen order).
 */
function categoriesFor(spec, fieldName, limit) {
  const profile = (spec.datasetProfile?.fields || []).find((f) => f.name === fieldName);
  const cats = profile?.categories;
  if (!Array.isArray(cats) || cats.length === 0) return null;
  return cats
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((c) => c.value);
}

// --- The compiler ---------------------------------------------------------

/**
 * Compile a spec's `glyph` block into executable render options.
 *
 * @param {Object} spec - a Screengrid spec (validate it first)
 * @param {Object} [options]
 * @param {number} [options.glyphSize=0.9] - mark size as a fraction of the cell
 *   (AGENTS.md section 5: expose cellSizePixels, keep glyphSize near 0.9)
 * @param {Function} [options.onAggregate] - the application's own aggregation
 *   callback; composed with the compiler's domain pass rather than replaced
 * @returns {Object} {enableGlyphs, showBackground, glyphSize, colorScale,
 *   onAggregate, onDrawCell, legend}
 */
export function compileGlyph(spec, { glyphSize = 0.9, onAggregate: appOnAggregate = null } = {}) {
  const glyph = spec.glyph || {};
  const type = glyph.type || 'heatmap';
  const channels = glyph.channels || {};
  const scales = glyph.scales || {};
  const palette = glyph.palette || 'ember';
  const maxCategories = glyph.limits?.maxCategories ?? spec.validation?.maxCategories ?? 6;

  const colorScale = colorScaleFromPalette(palette);

  // A heatmap is the cell fill itself: no glyph pass at all. This is the one
  // glyph type fully expressed by the colour ramp.
  if (type === 'heatmap') {
    return {
      enableGlyphs: false,
      showBackground: true,
      glyphSize,
      colorScale,
      onAggregate: appOnAggregate || undefined,
      onDrawCell: undefined,
      legend: legendDescriptor(spec, { kind: 'sequential', palette }),
      _domains: null,
    };
  }

  // --- Compile the per-cell accessors this glyph type needs ---------------
  const sizeAcc = compileAccessor(channels.size);
  const colorAcc = compileAccessor(channels.color);
  const opacityAcc = compileAccessor(channels.opacity);
  const segmentField = channels.segments?.field || null;
  const measures = Array.isArray(channels.measures) ? channels.measures : [];
  const measureAccs = measures.map((m) => compileAccessor({ field: m.field, aggregate: m.aggregate || 'mean' }));

  const categorical = scales.color === 'categorical';
  const sizeScale = scales.size === 'sqrt' ? 'sqrt' : 'linear';
  const opacityScale = scales.opacity === 'inverse' ? 'inverse' : 'linear';

  const custom = glyph.custom || null;
  const layout = custom?.layout || 'cartesian-mini';
  const customDomain = custom?.domain || 'global';
  const marks = Array.isArray(custom?.marks) ? custom.marks : [];
  // Resolve each mark's field list / uncertainty triple once, at compile time.
  const markPlans = marks.map((mark) => ({
    mark: mark.mark,
    fields: resolveFields(spec, mark.data),
    field: mark.data?.field || null,
    lower: mark.data?.lower || null,
    upper: mark.data?.upper || null,
    aggregate: mark.data?.aggregate || 'mean',
    stroke: mark.stroke || null,
    fill: mark.fill || null,
    lineWidth: Number.isFinite(mark.lineWidth) ? mark.lineWidth : 1.5,
    opacity: Number.isFinite(mark.opacity) ? mark.opacity : 1,
  }));

  // A sparse-cell cue is drawn only when the spec asked for a reliability
  // threshold, so specs that did not declare one pay nothing for it.
  const reliabilityCue = (spec.screengrid?.summaries || []).some(
    (s) => Number.isFinite(s?.reliability?.warnBelowCount)
  ) || Number.isFinite(spec.screengrid?.semanticModel?.reliability?.lowCountThreshold);

  // Stable category order and colours for segment-based glyphs.
  const fixedCategories = segmentField ? categoriesFor(spec, segmentField, maxCategories) : null;
  const categoryColor = new Map();
  if (fixedCategories) {
    fixedCategories.forEach((c, i) => categoryColor.set(c, CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]));
  }
  const colorForCategory = (value) => {
    if (!categoryColor.has(value)) {
      categoryColor.set(value, CATEGORICAL_COLORS[categoryColor.size % CATEGORICAL_COLORS.length]);
    }
    return categoryColor.get(value);
  };

  // --- Per-aggregation state (one pass's payloads + shared domains) -------
  let payloads = [];
  let domains = freshDomains(measures.length);

  function freshDomains(measureCount) {
    const d = {
      size: newDomain(),
      color: newDomain(),
      opacity: newDomain(),
      measures: new Array(measureCount),
      series: newDomain(),
    };
    for (let i = 0; i < measureCount; i++) d.measures[i] = newDomain();
    return d;
  }

  /**
   * One pass over every populated cell: build its payload and extend the shared
   * domains. Runs once per aggregation (per pan/zoom), never per cell per frame.
   */
  function buildPayloads(result) {
    const cellData = result?.cellData || [];
    payloads = new Array(cellData.length).fill(null);
    domains = freshDomains(measures.length);

    for (let idx = 0; idx < cellData.length; idx++) {
      const records = cellData[idx];
      if (!records || records.length === 0) continue;

      const payload = { count: records.length };

      if (sizeAcc) {
        payload.size = sizeAcc(records);
        extend(domains.size, payload.size);
      }
      if (colorAcc) {
        payload.color = colorAcc(records);
        if (!categorical) extend(domains.color, payload.color);
      }
      if (opacityAcc) {
        payload.opacity = opacityAcc(records);
        extend(domains.opacity, payload.opacity);
      }

      if (measureAccs.length > 0) {
        const values = new Array(measureAccs.length);
        for (let m = 0; m < measureAccs.length; m++) {
          values[m] = measureAccs[m](records);
          // One domain PER MEASURE, shared across all cells: guarantees
          // cross-cell comparability without falsely equating different units.
          extend(domains.measures[m], values[m]);
        }
        payload.measures = values;
      }

      if (segmentField) {
        buildSegments(payload, records);
      }

      if (markPlans.length > 0) {
        payload.marks = new Array(markPlans.length);
        for (let m = 0; m < markPlans.length; m++) {
          const plan = markPlans[m];
          const entry = {};
          if (plan.fields.length > 0) {
            const series = new Array(plan.fields.length);
            for (let f = 0; f < plan.fields.length; f++) {
              series[f] = reduceBy(plan.aggregate, records, plan.fields[f]);
              extend(domains.series, series[f]);
            }
            entry.series = series;
          }
          if (plan.field) {
            entry.value = reduceBy(plan.aggregate, records, plan.field);
            extend(domains.series, entry.value);
          }
          if (plan.lower) {
            entry.lower = reduceBy(plan.aggregate, records, plan.lower);
            extend(domains.series, entry.lower);
          }
          if (plan.upper) {
            entry.upper = reduceBy(plan.aggregate, records, plan.upper);
            extend(domains.series, entry.upper);
          }
          payload.marks[m] = entry;
        }
      }

      payloads[idx] = payload;
    }
  }

  /** Tally the segment field, honouring the category cap by folding the tail. */
  function buildSegments(payload, records) {
    const counts = new Map();
    for (const r of records) {
      const v = r?.data?.[segmentField];
      if (v === null || v === undefined || v === '') continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    payload.segKeys = [];
    payload.segValues = [];
    payload.segColors = [];

    const order = fixedCategories
      || Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    let shown = 0;
    let other = 0;
    for (const key of order) {
      const n = counts.get(key) || 0;
      counts.delete(key);
      if (n === 0) continue;
      if (shown < maxCategories) {
        payload.segKeys.push(key);
        payload.segValues.push(n);
        payload.segColors.push(colorForCategory(key));
        shown += 1;
      } else {
        other += n;
      }
    }
    // Long tail (categories absent from the declared order) folded into "other",
    // so the category-count guardrail is honoured rather than silently exceeded.
    for (const n of counts.values()) other += n;
    if (other > 0) {
      payload.segKeys.push('other');
      payload.segValues.push(other);
      payload.segColors.push('#9aa3ad');
    }
  }

  const onAggregateCompiled = (result) => {
    buildPayloads(result);
    if (appOnAggregate) appOnAggregate(result);
  };

  // --- Draw ---------------------------------------------------------------
  // Reads only the precomputed payload and the shared domains. No allocation.

  function fillFor(payload, normVal) {
    if (categorical && colorAcc) return colorForCategory(payload.color);
    if (colorAcc) return rampCss(palette, normIn(domains.color, payload.color), 0.92);
    return rampCss(palette, clamp01(normVal), 0.92);
  }

  function alphaFor(payload) {
    if (!opacityAcc) return 1;
    const t = normIn(domains.opacity, payload.opacity);
    return 0.15 + 0.85 * (opacityScale === 'inverse' ? 1 - t : t);
  }

  function drawBars(ctx, x, y, radius, payload) {
    const values = payload.measures;
    if (!values || values.length === 0) return;
    const span = radius * 2;
    const barWidth = span / values.length;
    const baseY = y + radius;
    for (let i = 0; i < values.length; i++) {
      const h = span * normIn(domains.measures[i], values[i]);
      ctx.fillStyle = CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
      ctx.fillRect(x - radius + i * barWidth + barWidth * 0.1, baseY - h, barWidth * 0.8, h);
    }
  }

  /** Normalize a value for a custom mark, honouring custom.domain (local|global). */
  function markNorm(v, localDomain) {
    return customDomain === 'local' ? normIn(localDomain, v) : normIn(domains.series, v);
  }

  /** Per-cell domain for `custom.domain: "local"`. */
  function localDomainFor(entry) {
    const d = newDomain();
    if (entry.series) for (const v of entry.series) extend(d, v);
    extend(d, entry.value);
    extend(d, entry.lower);
    extend(d, entry.upper);
    return d;
  }

  function drawCartesianMarks(ctx, x, y, radius, payload, normVal) {
    if (!payload.marks) return;
    const left = x - radius;
    const span = radius * 2;
    const bottom = y + radius;
    const baseAlpha = alphaFor(payload);

    for (let m = 0; m < markPlans.length; m++) {
      const plan = markPlans[m];
      const entry = payload.marks[m];
      if (!entry) continue;
      const local = customDomain === 'local' ? localDomainFor(entry) : null;
      const yFor = (v) => bottom - span * markNorm(v, local);
      ctx.globalAlpha = plan.opacity * baseAlpha;

      if (plan.mark === 'line' && entry.series) {
        const step = entry.series.length > 1 ? span / (entry.series.length - 1) : 0;
        ctx.strokeStyle = plan.stroke || rampCss(palette, 0.75);
        ctx.lineWidth = plan.lineWidth;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < entry.series.length; i++) {
          const v = entry.series[i];
          if (!Number.isFinite(v)) continue;
          const px = left + i * step;
          const py = yFor(v);
          if (started) ctx.lineTo(px, py);
          else { ctx.moveTo(px, py); started = true; }
        }
        if (started) ctx.stroke();
      } else if (plan.mark === 'point' && entry.series) {
        const step = entry.series.length > 1 ? span / (entry.series.length - 1) : 0;
        ctx.fillStyle = plan.fill || plan.stroke || rampCss(palette, 0.85);
        for (let i = 0; i < entry.series.length; i++) {
          const v = entry.series[i];
          if (!Number.isFinite(v)) continue;
          ctx.beginPath();
          ctx.arc(left + i * step, yFor(v), Math.max(1, plan.lineWidth), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (plan.mark === 'band') {
        // Filled extent across the cell between lower and upper.
        if (!Number.isFinite(entry.lower) || !Number.isFinite(entry.upper)) continue;
        const yUpper = yFor(entry.upper);
        const yLower = yFor(entry.lower);
        ctx.fillStyle = plan.fill || rampCss(palette, 0.6, 0.35);
        ctx.fillRect(left, yUpper, span, Math.max(1, yLower - yUpper));
        if (Number.isFinite(entry.value)) {
          const yValue = yFor(entry.value);
          ctx.strokeStyle = plan.stroke || rampCss(palette, 0.95);
          ctx.lineWidth = plan.lineWidth;
          ctx.beginPath();
          ctx.moveTo(left, yValue);
          ctx.lineTo(left + span, yValue);
          ctx.stroke();
        }
      } else if (plan.mark === 'interval' || plan.mark === 'whisker') {
        if (!Number.isFinite(entry.lower) || !Number.isFinite(entry.upper)) continue;
        const yUpper = yFor(entry.upper);
        const yLower = yFor(entry.lower);
        ctx.strokeStyle = plan.stroke || rampCss(palette, 0.9);
        ctx.lineWidth = plan.lineWidth;
        ctx.beginPath();
        ctx.moveTo(x, yUpper);
        ctx.lineTo(x, yLower);
        ctx.stroke();
        if (plan.mark === 'whisker') {
          const cap = radius * 0.35;
          ctx.beginPath();
          ctx.moveTo(x - cap, yUpper);
          ctx.lineTo(x + cap, yUpper);
          ctx.moveTo(x - cap, yLower);
          ctx.lineTo(x + cap, yLower);
          ctx.stroke();
        }
        if (Number.isFinite(entry.value)) {
          ctx.fillStyle = plan.fill || rampCss(palette, 0.95);
          ctx.beginPath();
          ctx.arc(x, yFor(entry.value), Math.max(1.5, plan.lineWidth * 1.2), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (plan.mark === 'wedge' || plan.mark === 'ring') {
        // Radial marks declared under a cartesian layout still render, centred.
        drawRadialMark(ctx, x, y, radius, plan, entry, payload, local);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRadialMarks(ctx, x, y, radius, payload) {
    if (!payload.marks) return;
    const baseAlpha = alphaFor(payload);
    for (let m = 0; m < markPlans.length; m++) {
      const plan = markPlans[m];
      const entry = payload.marks[m];
      if (!entry) continue;
      const local = customDomain === 'local' ? localDomainFor(entry) : null;
      ctx.globalAlpha = plan.opacity * baseAlpha;
      drawRadialMark(ctx, x, y, radius, plan, entry, payload, local);
    }
    ctx.globalAlpha = 1;
  }

  function drawRadialMark(ctx, x, y, radius, plan, entry, payload, local) {
    const rFor = (v) => Math.max(1, radius * markNorm(v, local));

    if (plan.mark === 'wedge') {
      // Composition wedges: the segment distribution when present, else the
      // mark's own field series as equal-angle sectors sized by value.
      if (payload.segValues && payload.segValues.length > 0) {
        GlyphUtilities.drawPieGlyph(ctx, x, y, payload.segValues, radius, payload.segColors);
        return;
      }
      if (!entry.series) return;
      const step = (Math.PI * 2) / entry.series.length;
      for (let i = 0; i < entry.series.length; i++) {
        const v = entry.series[i];
        if (!Number.isFinite(v)) continue;
        const start = -Math.PI / 2 + i * step;
        ctx.fillStyle = plan.fill || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, rFor(v), start, start + step * 0.92);
        ctx.closePath();
        ctx.fill();
      }
    } else if (plan.mark === 'ring') {
      const v = Number.isFinite(entry.value)
        ? entry.value
        : (entry.series ? entry.series[entry.series.length - 1] : null);
      if (!Number.isFinite(v)) return;
      ctx.strokeStyle = plan.stroke || rampCss(palette, 0.9);
      ctx.lineWidth = plan.lineWidth;
      ctx.beginPath();
      ctx.arc(x, y, rFor(v), 0, Math.PI * 2);
      ctx.stroke();
    } else if (plan.mark === 'line' || plan.mark === 'point') {
      // Star / radial profile over the field list.
      if (!entry.series || entry.series.length === 0) return;
      const step = (Math.PI * 2) / entry.series.length;
      if (plan.mark === 'line') {
        ctx.strokeStyle = plan.stroke || rampCss(palette, 0.8);
        ctx.lineWidth = plan.lineWidth;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < entry.series.length; i++) {
          const v = entry.series[i];
          if (!Number.isFinite(v)) continue;
          const a = -Math.PI / 2 + i * step;
          const r = rFor(v);
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (started) ctx.lineTo(px, py);
          else { ctx.moveTo(px, py); started = true; }
        }
        if (started) { ctx.closePath(); ctx.stroke(); }
      } else {
        ctx.fillStyle = plan.fill || plan.stroke || rampCss(palette, 0.85);
        for (let i = 0; i < entry.series.length; i++) {
          const v = entry.series[i];
          if (!Number.isFinite(v)) continue;
          const a = -Math.PI / 2 + i * step;
          const r = rFor(v);
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(1, plan.lineWidth), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (plan.mark === 'band' || plan.mark === 'interval' || plan.mark === 'whisker') {
      // Uncertainty as a radial extent: an annulus between lower and upper radii,
      // with the central value drawn as a solid disc.
      if (!Number.isFinite(entry.lower) || !Number.isFinite(entry.upper)) return;
      const rLower = rFor(entry.lower);
      const rUpper = rFor(entry.upper);
      if (plan.mark === 'band') {
        ctx.fillStyle = plan.fill || rampCss(palette, 0.6, 0.3);
        ctx.beginPath();
        ctx.arc(x, y, rUpper, 0, Math.PI * 2);
        ctx.arc(x, y, rLower, Math.PI * 2, 0, true);
        ctx.fill('evenodd');
      } else {
        ctx.strokeStyle = plan.stroke || rampCss(palette, 0.9);
        ctx.lineWidth = plan.lineWidth;
        ctx.beginPath();
        ctx.arc(x, y, rUpper, 0, Math.PI * 2);
        ctx.stroke();
        if (plan.mark === 'whisker') {
          ctx.beginPath();
          ctx.arc(x, y, rLower, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      if (Number.isFinite(entry.value)) {
        ctx.fillStyle = plan.fill || rampCss(palette, 0.95);
        ctx.beginPath();
        ctx.arc(x, y, rFor(entry.value), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function onDrawCell(ctx, x, y, normVal, cell) {
    const payload = payloads[cell.index];
    if (!payload) return;
    const radius = cell.glyphRadius || (cell.cellSize ? (cell.cellSize * glyphSize) / 2 : 16);
    if (radius <= 0) return;

    ctx.globalAlpha = alphaFor(payload);

    if (type === 'circle') {
      const t = sizeAcc ? normIn(domains.size, payload.size) : clamp01(normVal);
      const scaled = sizeScale === 'sqrt' ? Math.sqrt(t) : t;
      ctx.fillStyle = fillFor(payload, normVal);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, radius * scaled), 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'bar') {
      drawBars(ctx, x, y, radius, payload);
    } else if (type === 'pie') {
      if (payload.segValues && payload.segValues.length > 0) {
        GlyphUtilities.drawPieGlyph(ctx, x, y, payload.segValues, radius, payload.segColors);
      }
    } else if (type === 'ring') {
      if (payload.segValues && payload.segValues.length > 0) {
        GlyphUtilities.drawDonutGlyph(ctx, x, y, payload.segValues, radius, radius * 0.55, payload.segColors);
      }
    } else if (type === 'custom') {
      if (layout === 'radial') drawRadialMarks(ctx, x, y, radius, payload);
      else drawCartesianMarks(ctx, x, y, radius, payload, normVal);
    }

    ctx.globalAlpha = 1;

    // Sparse-cell cue: outline low-sample cells so readers do not over-read them.
    if (reliabilityCue && cell.reliability?.warnings?.includes('low-sample-size')) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  return {
    enableGlyphs: true,
    showBackground: true,
    glyphSize,
    colorScale,
    onAggregate: onAggregateCompiled,
    onDrawCell,
    legend: legendDescriptor(spec, {
      kind: measures.length > 0 ? 'measures' : (segmentField ? 'categorical' : 'sequential'),
      palette,
      categories: fixedCategories,
      measures: measures.map((m) => m.label || m.field),
    }),
    // Exposed for tests and legend rendering: the shared domains actually in use.
    // Reading them is how a caller labels "scaled to ..." honestly.
    get _domains() { return domains; },
    get _payloads() { return payloads; },
  };
}

/**
 * A DOM-free legend description derived from the spec. The library stays free of
 * rendering assumptions; applications (or the Legend module) turn this into markup.
 */
function legendDescriptor(spec, { kind, palette, categories = null, measures = null }) {
  const normalization = spec.screengrid?.normalization || 'max-local';
  return {
    enabled: spec.glyph?.legend?.enabled !== false,
    title: spec.glyph?.legend?.title || null,
    kind,
    palette,
    categories,
    measures,
    normalization,
    // The honesty line: what the scaling actually means, in words, for a caption.
    normalizationNote: normalization === 'max-local'
      ? 'Scaled to the maximum in the current view; values are not comparable across views.'
      : normalization === 'max-global'
        ? 'Scaled to the dataset maximum; values are comparable across views.'
        : `Normalization: ${normalization}.`,
    viewportNote: 'Screen cells at the current view, not fixed geographic districts.',
  };
}
