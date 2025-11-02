/**
 * GlyphRegistry.js
 * Simple registry for glyph plugins.
 * Plugins are plain JS objects with a `draw(ctx, x, y, normalizedValue, cellInfo, config)` method.
 */

import { GlyphUtilities } from './GlyphUtilities.js';

const _registry = new Map();

export const GlyphRegistry = {
  register(name, plugin, { overwrite = false } = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('GlyphRegistry.register: name must be a non-empty string');
    }
    if (!plugin || typeof plugin.draw !== 'function') {
      throw new Error('GlyphRegistry.register: plugin must have a draw(ctx, x, y, normalizedValue, cellInfo, config) method');
    }
    if (_registry.has(name) && !overwrite) {
      throw new Error(`GlyphRegistry: plugin with name "${name}" already exists`);
    }
    _registry.set(name, plugin);
  },

  get(name) {
    return _registry.get(name);
  },

  has(name) {
    return _registry.has(name);
  },

  list() {
    return Array.from(_registry.keys());
  },

  unregister(name) {
    return _registry.delete(name);
  },

  clear() {
    _registry.clear();
  },
};

// Register a few built-in wrappers for convenience. These are thin adapters
// around the existing GlyphUtilities methods so they can be referenced by name.
function _registerBuiltins() {
  try {
    GlyphRegistry.register('circle', {
      draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
        const radius = config.radius || cellInfo.glyphRadius || (cellInfo.cellSize || 10) * 0.4;
        const color = config.color || (config.colorScale ? config.colorScale(normalizedValue) : '#ff6b6b');
        const alpha = config.alpha != null ? config.alpha : 0.8;
        GlyphUtilities.drawCircleGlyph(ctx, x, y, radius, color, alpha);
      },
    });

    GlyphRegistry.register('bar', {
      draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
        const values = config.values || (cellInfo.cellData || []).map((d) => (d.weight || 1));
        const maxValue = config.maxValue || Math.max(...values, 1);
        const cellSize = cellInfo.cellSize || 20;
        GlyphUtilities.drawBarGlyph(ctx, x, y, values, maxValue, cellSize, config.colors);
      },
    });

    GlyphRegistry.register('pie', {
      draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
        const values = config.values || (cellInfo.cellData || []).map((d) => (d.weight || 1));
        const radius = config.radius || (cellInfo.glyphRadius || (cellInfo.cellSize || 20) * 0.4);
        GlyphUtilities.drawPieGlyph(ctx, x, y, values, radius, config.colors);
      },
    });

    GlyphRegistry.register('heatmap', {
      draw(ctx, x, y, normalizedValue, cellInfo, config = {}) {
        const radius = config.radius || (cellInfo.glyphRadius || (cellInfo.cellSize || 20) * 0.4);
        const colorScale = config.colorScale || ((v) => `rgba(255,0,0,${Math.min(0.9, v)})`);
        GlyphUtilities.drawHeatmapGlyph(ctx, x, y, radius, normalizedValue, colorScale);
      },
    });
  } catch (e) {
    // Defensive: registry may already contain these during hot reloads
    // eslint-disable-next-line no-console
    console.warn('GlyphRegistry: error registering built-ins', e);
  }
}

_registerBuiltins();

export default GlyphRegistry;
