import GlyphRegistry from './GlyphRegistry.js';
import { Logger } from '../utils/Logger.js';

// Public transport accessibility glyph plugin
// Draws a 6-petal glyph (one petal per category) where petal length encodes
// accessibility percentage at the selected time bin.

const CATEGORIES = ['employment', 'supermarket', 'school_primary', 'school_secondary', 'gp', 'hospitals'];
const MINUTES = [15, 30, 45, 60, 75, 90, 105, 120];

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

function _computeAvgForCell(cellData, timeIndex) {
  const minute = MINUTES[Math.max(0, Math.min(timeIndex, MINUTES.length - 1))];
  const out = {};
  for (const cat of CATEGORIES) out[cat] = 0;
  let count = 0;
  for (const d of cellData || []) {
    const props = (d && d.data && d.data.properties) || d.data || d.properties || d.props || {};
    let foundAny = false;
    for (const cat of CATEGORIES) {
      const val = _extractPct(props, cat, minute);
      if (val != null) {
        // assume percentage-like values (0-100). Keep raw for now.
        out[cat] += Number(val);
        foundAny = true;
      }
    }
    if (foundAny) count += 1;
  }
  if (count === 0) return null;
  for (const cat of CATEGORIES) out[cat] = out[cat] / count; // average
  return out;
}

function _computeForCell(cellData, timeIndex, cumulative = false) {
  const minute = MINUTES[Math.max(0, Math.min(timeIndex, MINUTES.length - 1))];
  const out = {};
  for (const cat of CATEGORIES) out[cat] = 0;
  let count = 0;

  for (const d of cellData || []) {
    const props = (d && d.data && d.data.properties) || d.data || d.properties || d.props || {};
    let foundAny = false;
    for (const cat of CATEGORIES) {
      let val = null;
      if (!cumulative) {
        val = _extractPct(props, cat, minute);
      } else {
        // sum across time bins up to minute
        let s = 0;
        let any = false;
        for (let ti = 0; ti <= Math.max(0, Math.min(timeIndex, MINUTES.length - 1)); ti++) {
          const v = _extractPct(props, cat, MINUTES[ti]);
          if (v != null) { s += Number(v); any = true; }
        }
        if (any) val = s;
      }

      if (val != null) {
        out[cat] += Number(val);
        foundAny = true;
      }
    }
    if (foundAny) count += 1;
  }

  if (count === 0) return null;
  for (const cat of CATEGORIES) out[cat] = out[cat] / count; // average
  return out;
}

const COLORS = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02'];

const PublicTransportGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
    try {
      // Debug: Nothing logged here by default
      const timeIndex = config.timeIndex != null ? config.timeIndex : (config.minute ? MINUTES.indexOf(config.minute) : MINUTES.length - 1);
      const glyphRadius = cellInfo.glyphRadius || Math.max(8, (cellInfo.cellSize || 20) * 0.45);

      const cumulative = config && config.cumulative;
      const avg = _computeForCell(cellInfo.cellData || [], timeIndex, cumulative);
      if (!avg) return; // nothing to draw

      // Normalize averages: if values > 1 assume 0-100 percentages
      const maxVal = Math.max(...Object.values(avg));
      const normalizeFactor = maxVal > 1 ? 100 : 1;

      // Draw a 2x3 grid of squares whose sizes encode each category value
      ctx.save();

      const padding = 2;
      // Prefer glyphRadius provided by renderer so glyphSize slider affects rendering
      const cellSize = (cellInfo && cellInfo.glyphRadius) ? (cellInfo.glyphRadius * 2) : (cellInfo.cellSize || (glyphRadius * 2));

      // subtle background
      ctx.fillStyle = 'rgba(204,204,204,0.2)';
      ctx.beginPath();
      ctx.rect(x - cellSize / 2, y - cellSize / 2, cellSize, cellSize);
      ctx.fill();

      const cellWidth = (cellSize - 2 * padding) / 3;
      const cellHeight = (cellSize - 2 * padding) / 2;

      const getKeys = CATEGORIES;
      const colours = COLORS;

      const sizes = [];
      for (const key of getKeys) {
        const v = (avg && avg[key]) ? avg[key] : 0;
        sizes.push(v);
      }

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const index = row * 3 + col;
          const rawSize = sizes[index] || 0;
          const size = (rawSize / 100) * Math.min(cellWidth, cellHeight);

          const centerX = col * cellWidth + cellWidth / 2 - size / 2;
          const centerY = row * cellHeight + cellHeight / 2 - size / 2;

          const drawX = centerX + x - cellSize / 2 + padding;
          const drawY = centerY + y - cellSize / 2 + padding;

          ctx.beginPath();
          ctx.fillStyle = colours[index % colours.length] || 'rgba(0,0,0,0.6)';
          ctx.fillRect(drawX, drawY, size, size);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.strokeRect(drawX, drawY, size, size);
        }
      }

      // Optionally draw sparkline (uses averaged timeseries across categories)
      if (config && config.showSparkline) {
        try {
          const series = CATEGORIES.map((cat) => {
            const arr = [];
            for (let ti = 0; ti < MINUTES.length; ti++) {
              let s = 0;
              let c = 0;
              for (const d of cellInfo.cellData || []) {
                const props = (d && d.data && d.data.properties) || d.data || d.properties || d.props || {};
                const val = _extractPct(props, cat, MINUTES[ti]);
                if (val != null) { s += Number(val); c += 1; }
              }
              arr.push(c === 0 ? 0 : s / c);
            }
            return arr;
          });

          const combined = [];
          for (let ti = 0; ti < MINUTES.length; ti++) {
            let s = 0;
            for (let k = 0; k < series.length; k++) s += series[k][ti] || 0;
            combined.push(s / series.length);
          }

          const w = cellSize * 0.9;
          const h = cellSize * 0.28;
          const left = x - w / 2;
          const top = y + cellSize / 2 - h - padding;
          const maxSeries = Math.max(...combined, 1);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1.5;
          for (let ti = 0; ti < combined.length; ti++) {
            const vx = left + (ti / (combined.length - 1)) * w;
            const vy = top + (1 - (combined[ti] / maxSeries)) * h;
            if (ti === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
          }
          ctx.stroke();
        } catch (e) {
          // swallow sparkline errors
        }
      }

      ctx.restore();
    } catch (e) {
      Logger.error('PublicTransportGlyph.draw error:', e);
    }
  }
};

// Register plugin
try {
  GlyphRegistry.register('public-transport', PublicTransportGlyph, { overwrite: true });
} catch (e) {
  // ignore registration errors on hot reload
}

export default PublicTransportGlyph;
