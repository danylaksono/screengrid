import GlyphRegistry from './GlyphRegistry.js';
import { Logger } from '../utils/Logger.js';
import { CATEGORIES, COLORS } from './PublicTransportGlyph.js';

// Typographic accessibility glyph -- the same PTAL data as
// PublicTransportGlyph, but the glyph *is* text.
//
// Implements Brath & Banissi's typographic design space ("Using Typography to
// Expand the Design Space of Data Visualization", She Ji 2016; "Typographic
// Sets", SetVR 2016; "Multivariate Label-based Thematic Maps", Int. J.
// Cartography 2017; "Bertin's Forgotten Typographic Variables", CaGIS 2019).
//
// Each cell draws a *set* of words -- one per service category -- in a fixed
// 2x3 arrangement. Every word carries its own category's data in its
// typography, so all six variables are legible at once. This is the text
// analogue of the six bars in PublicTransportGlyph:
//
//   slot position  <- category identity, in the same order as the bar glyph
//   size           <- location quotient (continuous)
//   weight         <- absolute reachable share (3 discriminable steps)
//   slant          <- below London's lower-quartile LSOA for that service
//   colour         <- category hue, shared with PublicTransportGlyph
//   rotation       <- headroom, when `encodeOrientation` is on (see below)
//
// The same glyph serves both render modes. In `screen-grid` it reads the many
// LSOA records aggregated into a cell; in `feature-anchors` the layer hands it
// a single record whose `data` is the feature's own properties. Nothing here
// needs to know which, so long as the properties carry `<category>_pct_<band>`.
//
// == Rotation is opt-in ==
//
// `encodeOrientation` tilts each word by how much more of that service the
// place would reach at the widest travel-time band -- flat means the current
// band already reaches everything it is going to, a steep tilt means a longer
// journey still buys a lot. Slope is the one quantity an angle encodes
// literally, and dragging the time slider flattens the words as accessibility
// saturates.
//
// It is off by default. Rotation costs legibility and, like weight, offers few
// discriminable steps, so it is worth spending only when the glyph is large --
// feature anchors rather than small grid cells.
//
// == Why fixed slots, not flowed text ==
//
// An earlier version sorted the words by value and line-wrapped them. Two
// things broke. Type size and word count compete for the same cell area, so
// the cells with the largest values grew words too wide to pack and silently
// dropped half their categories -- losing data exactly where it mattered
// most. And a category's position then depended on its own value, so the same
// service sat somewhere different in every cell and could not be scanned
// across the grid.
//
// Holding position constant costs the ranking channel and buys cross-cell
// comparability, which is the point of a grid glyphmap. It also makes this
// example a controlled comparison against PublicTransportGlyph: same data,
// same category order, same shared scale -- only the encoding channel changes,
// from bar length to type size.
//
// == Why location quotient, not the raw share ==
//
// Each source value is a share of *all London services of that type*.
// Employment sites are numerous and central, so every LSOA reaches a higher
// share of them (London mean 23.9% at 120 min) than of primary schools
// (13.3%). Ranking categories by raw share therefore returns `employment` in
// 4835 of 4835 LSOAs -- it reports which category has the largest London-wide
// mean, a dataset constant, not a property of place.
//
// Dividing by each category's London mean for the same time band (a location
// quotient) puts the six categories on a comparable footing, and the leading
// word becomes "the service this place is unusually well served by", which
// varies across the city. `normalization: 'raw'` deliberately restores the
// broken behaviour so the failure can be demonstrated side by side; see
// docs/CARTOGRAPHIC_EVALUATION_RUBRIC.md, "Profile comparison".
//
// == Weight has few usable steps ==
//
// Canvas resolves `ctx.font` against the faces actually installed, so a
// continuous 200-800 ramp collapses to whatever the family provides -- for a
// websafe stack, normal and bold only. Weight is therefore quantised to three
// documented steps rather than pretending to be continuous, consistent with
// the discriminability findings in the InfoTypography perception literature.

const MINUTES = [15, 30, 45, 60, 75, 90, 105, 120];

const ABBR = {
  employment: 'EMP',
  supermarket: 'SUP',
  school_primary: 'PRI',
  school_secondary: 'SEC',
  gp: 'GP',
  hospitals: 'HOS',
};

const DEFAULT_VALUE_SCALE = 100;      // values are percentages, 0-100
const DEFAULT_QUOTIENT_RANGE = [0.6, 1.5];
const DEFAULT_SLANT_BELOW = 0.85;

// Only a few weight steps survive font fallback; see header note.
const WEIGHT_STEPS = [300, 400, 700];

const SLOT_COLS = 2;
const SLOT_ROWS = 3;

// Size ramp, as a fraction of the largest type that fits a slot. The floor is
// well above zero: a word scaled to nothing reads as missing data rather than
// as a low value, and every category is present in every cell here.
const SIZE_RATIO = [0.5, 1.0];

// Below this, six words cannot be set legibly and the glyph shows the leading
// service alone. One readable word beats six unreadable ones.
const MIN_SET_FONT_PX = 6.5;
const MAX_FONT_PX = 22;

// Widest label, used to size type to the slot without measuring every cell.
const MAX_LABEL_CHARS = 3;

// Steepest tilt for the orientation channel. Past roughly this angle short
// uppercase labels start to cost real reading effort.
const MAX_TILT_DEG = 28;

/**
 * Can six words be set legibly at this glyph size? Checks the *smallest* type
 * the ramp can produce, not the largest -- the low-quotient words are the ones
 * that fall below the legibility floor first.
 *
 * Exported so a page can tell the reader why the glyph collapsed to one word
 * instead of leaving them to guess.
 */
export function fitsSet(glyphPx) {
  const pad = Math.max(1.5, glyphPx * 0.05);
  const inner = glyphPx - 2 * pad;
  return _fitFontSize(inner / SLOT_COLS, inner / SLOT_ROWS) * SIZE_RATIO[0] >= MIN_SET_FONT_PX;
}

function _propsOf(d) {
  return (d && d.data && d.data.properties) || (d && d.data) || (d && d.properties) || {};
}

/** Mean value per category across the records in a cell, at one time band. */
function _computeForCell(cellData, minute) {
  const out = {};
  for (const cat of CATEGORIES) out[cat] = 0;
  let count = 0;

  for (const d of cellData || []) {
    const props = _propsOf(d);
    let any = false;
    for (const cat of CATEGORIES) {
      const v = props[`${cat}_pct_${minute}`];
      if (v != null) {
        out[cat] += Number(v);
        any = true;
      }
    }
    if (any) count += 1;
  }

  if (count === 0) return null;
  for (const cat of CATEGORIES) out[cat] /= count;
  return out;
}

function _fontString(weight, sizePx, italic) {
  return `${italic ? 'italic ' : ''}${weight} ${sizePx.toFixed(1)}px "Helvetica Neue", Arial, sans-serif`;
}

/**
 * Largest type size that still fits a slot, so the widest label at full size
 * never overflows into its neighbour. Derived from the slot box rather than
 * measured per cell -- the answer depends only on cell geometry, and measuring
 * every word in every cell to discover it would cost a lot for one number.
 */
function _fitFontSize(slotW, slotH) {
  const byWidth = slotW / (MAX_LABEL_CHARS * 0.62);
  const byHeight = slotH * 0.86;
  return Math.min(byWidth, byHeight, MAX_FONT_PX);
}

const TypographicAccessibilityGlyph = {
  draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
    try {
      const timeIndex = config.timeIndex != null ? config.timeIndex : MINUTES.length - 1;
      const minute = MINUTES[Math.max(0, Math.min(timeIndex, MINUTES.length - 1))];

      const cellData = cellInfo.cellData || [];
      const values = _computeForCell(cellData, minute);
      if (!values) return; // nothing in this cell

      // Headroom needs the widest band as a reference. At the widest band
      // there is nothing left to gain, so skip the second pass entirely.
      const widest = MINUTES[MINUTES.length - 1];
      const encodeOrientation = !!config.encodeOrientation;
      const ultimate = encodeOrientation && minute !== widest
        ? _computeForCell(cellData, widest)
        : null;

      // Dataset-level divisors, supplied by the page and shared by every cell.
      // Never inferred from this cell's own values -- that is the "local
      // scaling hides differences" failure in the cartographic rubric.
      const valueScale = Number(config.valueScale) > 0 ? Number(config.valueScale) : DEFAULT_VALUE_SCALE;
      const categoryMeans = config.categoryMeans || null;
      const useQuotient = config.normalization !== 'raw' && categoryMeans;
      const [qLo, qHi] = config.quotientRange || DEFAULT_QUOTIENT_RANGE;
      const slantBelow = Number.isFinite(config.slantBelow) ? config.slantBelow : DEFAULT_SLANT_BELOW;
      const mode = config.mode === 'dominant' ? 'dominant' : 'set';

      // Kept in canonical category order -- slot position encodes identity.
      // `rank` is only consulted to pick the leading service for the
      // single-label fallback.
      const series = CATEGORIES.map((cat, i) => {
        const value = values[cat] || 0;
        const mean = categoryMeans ? Number(categoryMeans[cat]) : 0;
        const quotient = useQuotient && mean > 0 ? value / mean : null;

        // Size: location quotient against a fixed range, or -- in raw mode --
        // the share itself, which is what makes every cell rank the same way.
        const t = useQuotient
          ? (qHi > qLo ? (quotient - qLo) / (qHi - qLo) : 0.5)
          : value / valueScale;

        return {
          cat,
          value,
          quotient,
          rank: useQuotient ? quotient : value,
          t: Math.max(0, Math.min(1, t)),
          color: COLORS[i % COLORS.length],
          text: ABBR[cat] || cat.slice(0, 3).toUpperCase(),
        };
      });

      const glyphRadius = cellInfo.glyphRadius || Math.max(8, (cellInfo.cellSize || 20) * 0.45);
      const size = glyphRadius * 2;
      const pad = Math.max(1.5, size * 0.05);
      const innerW = size - 2 * pad;
      const innerH = size - 2 * pad;

      const [rLo, rHi] = SIZE_RATIO;

      const slotW = innerW / SLOT_COLS;
      const slotH = innerH / SLOT_ROWS;
      const setFont = _fitFontSize(slotW, slotH);

      // Below the legibility floor, six words cannot be set at all. Falling
      // back to the leading service keeps the cell honest rather than filling
      // it with type too small to read. The floor applies to the smallest type
      // the ramp produces, not the largest.
      const asSet = mode !== 'dominant' && setFont * rLo >= MIN_SET_FONT_PX;

      const styled = series.map((w, i) => {
        // Weight: absolute reachable share, quantised to the steps that
        // actually render. Independent of size, which carries the quotient.
        const wi = Math.min(
          WEIGHT_STEPS.length - 1,
          Math.floor(Math.max(0, Math.min(1, w.value / valueScale)) * WEIGHT_STEPS.length),
        );
        // Slant flags the poorly served tail. The threshold is the quotient
        // distribution's lower quartile, supplied by the page, not the mean:
        // the distribution is right-skewed, so a mean-based cut italicises
        // roughly seven words in ten and stops reading as an exception.
        const italic = w.quotient != null && w.quotient < slantBelow;

        // Rotation: share of this service's ultimate reach still unclaimed at
        // the current band. Zero when the band already reaches everything.
        let tilt = 0;
        if (ultimate) {
          const cap = ultimate[w.cat] || 0;
          if (cap > 0) {
            tilt = Math.max(0, Math.min(1, 1 - w.value / cap)) * MAX_TILT_DEG;
          }
        }

        return { ...w, weight: WEIGHT_STEPS[wi], italic, tilt, slot: i };
      });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';

      const paint = (w, cx, cy, fontSize) => {
        const tilted = w.tilt > 0.01;
        if (tilted) {
          // Rotate about the word's own centre so it stays inside its slot.
          // Negative because canvas y grows downward and the tilt reads as
          // "rising".
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((-w.tilt * Math.PI) / 180);
        }
        const ox = tilted ? 0 : cx;
        const oy = tilted ? 0 : cy;

        ctx.font = _fontString(w.weight, fontSize, w.italic);
        // Halo first, so neighbouring words never erode each other's fill.
        ctx.lineWidth = Math.max(1.6, fontSize * 0.24);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeText(w.text, ox, oy);
        ctx.fillStyle = w.color;
        ctx.fillText(w.text, ox, oy);

        if (tilted) ctx.restore();
      };

      if (asSet) {
        // Fixed slots in the canonical category order, so the same service sits
        // in the same place in every cell and can be scanned across the grid.
        const left = x - innerW / 2;
        const top = y - innerH / 2;
        for (const w of styled) {
          const col = w.slot % SLOT_COLS;
          const row = Math.floor(w.slot / SLOT_COLS);
          paint(
            w,
            left + (col + 0.5) * slotW,
            top + (row + 0.5) * slotH,
            setFont * (rLo + (rHi - rLo) * w.t),
          );
        }
      } else {
        const lead = styled.reduce((a, b) => (b.rank > a.rank ? b : a), styled[0]);
        const one = Math.min(_fitFontSize(innerW, innerH), MAX_FONT_PX);
        paint(lead, x, y, one * (rLo + (rHi - rLo) * lead.t));
      }

      ctx.restore();
    } catch (e) {
      Logger.error('TypographicAccessibilityGlyph.draw error:', e);
    }
  },

  /** Category order, colours, and abbreviations, so pages can build a matching legend. */
  legend() {
    return CATEGORIES.map((name, i) => ({ name, color: COLORS[i % COLORS.length], abbr: ABBR[name] }));
  },
};

// Register plugin
try {
  GlyphRegistry.register('typographic-accessibility', TypographicAccessibilityGlyph, { overwrite: true });
} catch (e) {
  // ignore registration errors on hot reload
}

export default TypographicAccessibilityGlyph;
export { ABBR, MINUTES, WEIGHT_STEPS };
