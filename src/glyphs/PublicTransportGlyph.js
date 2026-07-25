import GlyphRegistry from './GlyphRegistry.js';
import { Logger } from '../utils/Logger.js';

// Public transport accessibility glyph plugin.
//
// Draws six bars on a shared baseline -- one per service category -- where bar
// height encodes the percentage of that service reachable within the selected
// travel-time band. Behind each bar sits a faint envelope showing the value at
// the widest time band, so moving the time slider fills bars inside a fixed
// outline instead of rescaling the whole glyph.
//
// Design notes (see docs/CARTOGRAPHIC_EVALUATION_RUBRIC.md, "Profile
// comparison"): the rubric requires a *shared scale* and names "local scaling
// hides differences" as the common failure. Values are therefore divided by a
// fixed `valueScale` (default 100, i.e. percent) rather than by a per-cell
// maximum -- an earlier version inferred the divisor from each cell's own
// values, which meant two cells in the same frame could use different encodings
// and a cell could change encoding between adjacent slider steps.
//
// Length on a common baseline is also a more accurate magnitude encoding than
// the area of squares this glyph previously drew.

const CATEGORIES = ['employment', 'supermarket', 'school_primary', 'school_secondary', 'gp', 'hospitals'];
const MINUTES = [15, 30, 45, 60, 75, 90, 105, 120];

// Colour-blind-safe qualitative palette (Okabe-Ito), one hue per category.
const COLORS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00'];

const DEFAULT_VALUE_SCALE = 100; // values are percentages, 0-100

function _extractPct(props, category, minute) {
  if (!props || typeof props !== 'object') return null;
  const candidates = [];
  const m = String(minute);
  // common patterns: `${cat}_pct_${m}`, `${cat}_pct${m}`, `${cat}_${m}_pct`, `${cat}_pct` (aggregate)
  candidates.push(`${category}_pct_${m}`);
  candidates.push(`${category}_pct${m}`);
  candidates.push(`${category}_${m}_pct`);
  candidates.push(`${category}_pct`);
  candidates.push(`${category}_${m}`);
  candidates.push(category);

  for (const key of candidates) {
    if (key in props) {
      const v = props[key];
      if (v == null) return null;
      const num = Number(v);
      if (!Number.isNaN(num)) return num;
    }
  }

  // fallback: try to find any property that contains category and minute
  for (const k of Object.keys(props)) {
    if (k.toLowerCase().includes(category) && k.includes(m)) {
      const num = Number(props[k]);
      if (!Number.isNaN(num)) return num;
    }
  }

  return null;
}

function _propsOf(d) {
  return (d && d.data && d.data.properties) || (d && d.data) || (d && d.properties) || (d && d.props) || {};
}

/**
 * Mean value per category across the records in a cell, at one time band.
 *
 * `cumulative` averages across every band up to `timeIndex` instead of reading
 * a single band. The source values are already cumulative (share reachable
 * *within* N minutes), so summing bands would double-count and leave the 0-100
 * range; a mean keeps the result on the same scale as the single-band view.
 */
function _computeForCell(cellData, timeIndex, cumulative = false) {
  const maxIndex = Math.max(0, Math.min(timeIndex, MINUTES.length - 1));
  const out = {};
  for (const cat of CATEGORIES) out[cat] = 0;
  let count = 0;

  for (const d of cellData || []) {
    const props = _propsOf(d);
    let foundAny = false;

    for (const cat of CATEGORIES) {
      let val = null;
      if (!cumulative) {
        val = _extractPct(props, cat, MINUTES[maxIndex]);
      } else {
        let sum = 0;
        let seen = 0;
        for (let ti = 0; ti <= maxIndex; ti++) {
          const v = _extractPct(props, cat, MINUTES[ti]);
          if (v != null) { sum += Number(v); seen += 1; }
        }
        if (seen > 0) val = sum / seen;
      }

      if (val != null) {
        out[cat] += Number(val);
        foundAny = true;
      }
    }
    if (foundAny) count += 1;
  }

  if (count === 0) return null;
  for (const cat of CATEGORIES) out[cat] = out[cat] / count;
  return out;
}

/** Per-category mean at the widest time band — the stable envelope. */
function _computeEnvelope(cellData) {
  return _computeForCell(cellData, MINUTES.length - 1, false);
}

/** Mean across all records for every band, per category — used by the sparkline. */
function _computeSeries(cellData) {
  const series = {};
  for (const cat of CATEGORIES) {
    const arr = [];
    for (let ti = 0; ti < MINUTES.length; ti++) {
      let sum = 0;
      let seen = 0;
      for (const d of cellData || []) {
        const v = _extractPct(_propsOf(d), cat, MINUTES[ti]);
        if (v != null) { sum += Number(v); seen += 1; }
      }
      arr.push(seen === 0 ? 0 : sum / seen);
    }
    series[cat] = arr;
  }
  return series;
}

const PublicTransportGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
    try {
      const timeIndex = config.timeIndex != null
        ? config.timeIndex
        : (config.minute ? MINUTES.indexOf(config.minute) : MINUTES.length - 1);

      const cumulative = !!(config && config.cumulative);
      const showSparkline = !!(config && config.showSparkline);
      const showEnvelope = config.showEnvelope !== false;

      // Fixed, dataset-level scale. Never inferred from the cell's own values:
      // that made the encoding vary between cells and between slider steps.
      const valueScale = Number(config.valueScale) > 0 ? Number(config.valueScale) : DEFAULT_VALUE_SCALE;

      const cellData = cellInfo.cellData || [];
      const values = _computeForCell(cellData, timeIndex, cumulative);
      if (!values) return; // nothing in this cell

      const glyphRadius = cellInfo.glyphRadius || Math.max(8, (cellInfo.cellSize || 20) * 0.45);
      const size = glyphRadius * 2;

      ctx.save();

      const pad = Math.max(2, size * 0.06);
      const left = x - size / 2 + pad;
      const top = y - size / 2 + pad;
      const innerW = size - 2 * pad;
      const innerH = size - 2 * pad;

      // Reserve the lower strip for the sparkline when it is switched on.
      const sparkH = showSparkline ? innerH * 0.3 : 0;
      const barsH = innerH - sparkH - (showSparkline ? pad : 0);
      const baseline = top + barsH;

      // Panel backdrop keeps the glyph legible over any basemap.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x - size / 2, y - size / 2, size, size);

      const gap = innerW * 0.04;
      const barW = (innerW - gap * (CATEGORIES.length - 1)) / CATEGORIES.length;

      const envelope = showEnvelope && !cumulative ? _computeEnvelope(cellData) : null;

      for (let i = 0; i < CATEGORIES.length; i++) {
        const cat = CATEGORIES[i];
        const bx = left + i * (barW + gap);

        // Stable outline at the widest time band, so the slider fills a fixed
        // frame rather than resizing the glyph.
        if (envelope) {
          const envH = Math.max(0, Math.min(1, envelope[cat] / valueScale)) * barsH;
          if (envH > 0.5) {
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(bx, baseline - envH, barW, envH);
          }
        }

        const frac = Math.max(0, Math.min(1, (values[cat] || 0) / valueScale));
        const h = frac * barsH;
        if (h > 0.4) {
          ctx.fillStyle = COLORS[i % COLORS.length];
          ctx.fillRect(bx, baseline - h, barW, h);
        }
      }

      // Shared baseline: the reference that makes bar lengths comparable.
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, baseline + 0.5);
      ctx.lineTo(left + innerW, baseline + 0.5);
      ctx.stroke();

      if (showSparkline) {
        const series = _computeSeries(cellData);
        const sTop = baseline + pad;
        // Mean across categories, on the same fixed scale as the bars.
        const combined = MINUTES.map((_, ti) => {
          let s = 0;
          for (const cat of CATEGORIES) s += series[cat][ti] || 0;
          return s / CATEGORIES.length;
        });

        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        for (let ti = 0; ti < combined.length; ti++) {
          const vx = left + (ti / (combined.length - 1)) * innerW;
          const frac = Math.max(0, Math.min(1, combined[ti] / valueScale));
          const vy = sTop + (1 - frac) * sparkH;
          if (ti === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        }
        ctx.stroke();

        // Mark where the slider currently sits along that trajectory.
        const ti = Math.max(0, Math.min(timeIndex, MINUTES.length - 1));
        const mx = left + (ti / (MINUTES.length - 1)) * innerW;
        const mFrac = Math.max(0, Math.min(1, combined[ti] / valueScale));
        const my = sTop + (1 - mFrac) * sparkH;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.arc(mx, my, 1.75, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.restore();
    } catch (e) {
      Logger.error('PublicTransportGlyph.draw error:', e);
    }
  },

  /** Category order and colours, so pages can build a matching legend. */
  legend() {
    return CATEGORIES.map((name, i) => ({ name, color: COLORS[i % COLORS.length] }));
  }
};

// Register plugin
try {
  GlyphRegistry.register('public-transport', PublicTransportGlyph, { overwrite: true });
} catch (e) {
  // ignore registration errors on hot reload
}

export default PublicTransportGlyph;
export { CATEGORIES, MINUTES, COLORS };
