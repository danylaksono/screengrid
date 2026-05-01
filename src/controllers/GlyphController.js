/**
 * GlyphController.js
 * Manages glyph plugin lifecycle and draw callback resolution.
 */

import { GlyphRegistry } from '../glyphs/GlyphRegistry.js';
import { Logger } from '../utils/Logger.js';

export class GlyphController {
  constructor(layer) {
    this.layer = layer;
    this.instance = null;
  }

  init(config) {
    if (!config?.glyph) return;

    try {
      const plugin = GlyphRegistry.get(config.glyph);
      if (plugin && typeof plugin.init === 'function') {
        this.instance = plugin.init({
          layer: this.layer,
          config: config.glyphConfig || {},
        }) || null;
      }
    } catch (error) {
      Logger.error(`Glyph plugin init failed for "${config.glyph}":`, error);
      this.instance = null;
    }
  }

  destroy(config) {
    if (!config?.glyph) return;

    try {
      const plugin = GlyphRegistry.get(config.glyph);
      if (this.instance && typeof this.instance.destroy === 'function') {
        this.instance.destroy();
      } else if (plugin && typeof plugin.destroy === 'function') {
        plugin.destroy({ layer: this.layer });
      }
    } catch (error) {
      Logger.error(`Glyph plugin destroy failed for "${config.glyph}":`, error);
    } finally {
      this.instance = null;
    }
  }

  getDrawCallback(config) {
    if (config?.onDrawCell) {
      return config.onDrawCell;
    }

    if (!config?.glyph) {
      return null;
    }

    const plugin = GlyphRegistry.get(config.glyph);
    if (!plugin || typeof plugin.draw !== 'function') {
      Logger.warn(`Glyph "${config.glyph}" not found in GlyphRegistry`);
      return null;
    }

    const glyphConfig = config.glyphConfig || {};
    return (ctx, x, y, normalizedValue, cellInfo) => {
      try {
        plugin.draw(ctx, x, y, normalizedValue, cellInfo, glyphConfig);
      } catch (error) {
        Logger.error(`Glyph plugin "${config.glyph}" threw an error:`, error);
      }
    };
  }
}
