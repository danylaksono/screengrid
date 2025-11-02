/**
 * ConfigManager.js
 * Centralized configuration management with defaults
 */

export class ConfigManager {
  static DEFAULT_CONFIG = {
    id: 'screen-grid-layer',
    data: [],
    getPosition: (d) => d.coordinates,
    getWeight: (d) => 1,
    cellSizePixels: 50,
    colorScale: (v) => [255 * v, 100, 200, 200],
    onAggregate: null,
    onHover: null,
    onClick: null,
    onDrawCell: null,
    enableGlyphs: false,
    glyphSize: 0.8,
    adaptiveCellSize: false,
    minCellSize: 20,
    maxCellSize: 100,
    zoomBasedSize: false,
    enabled: true,
    // Aggregation mode configuration
    aggregationMode: 'screen-grid', // 'screen-grid' | 'screen-hex' | 'map-h3' | string (custom)
    aggregationModeConfig: {}, // Mode-specific configuration
    // Freeze mode configuration
    freezeAggregation: false, // If true, aggregation is frozen
    freezeOnMove: false, // Freeze only on pan (but update on zoom)
    freezeOnZoom: false, // Freeze only on zoom (but update on pan)
  };

  /**
   * Create configuration from user options merged with defaults
   * @param {Object} options - User-provided configuration
   * @returns {Object} Merged configuration
   */
  static create(options = {}) {
    return {
      ...ConfigManager.DEFAULT_CONFIG,
      ...options,
    };
  }

  /**
   * Update configuration with partial options
   * @param {Object} config - Current configuration
   * @param {Object} updates - Partial configuration updates
   * @returns {Object} Updated configuration
   */
  static update(config, updates = {}) {
    return {
      ...config,
      ...updates,
    };
  }

  /**
   * Validate configuration structure
   * @param {Object} config - Configuration to validate
   * @returns {boolean} True if valid
   */
  static isValid(config) {
    return (
      config &&
      typeof config === 'object' &&
      Array.isArray(config.data) &&
      typeof config.getPosition === 'function' &&
      typeof config.getWeight === 'function' &&
      typeof config.cellSizePixels === 'number' &&
      config.cellSizePixels > 0
    );
  }
}
