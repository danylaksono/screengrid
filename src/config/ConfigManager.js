/**
 * ConfigManager.js
 * Centralized configuration management with defaults
 */

import { PlacementValidator } from '../core/geometry/PlacementValidator.js';

export class ConfigManager {
  // Keep track of emitted warnings to avoid noisy repeated logs
  static _emittedWarnings = new Set();

  static _warnOnce(message) {
    if (!ConfigManager._emittedWarnings.has(message)) {
      console.warn(`ConfigManager: ${message}`);
      ConfigManager._emittedWarnings.add(message);
    }
  }

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
    // Geometry placement configuration (Option B)
    source: null, // GeoJSON FeatureCollection, Feature, or array of Features
    placement: null, // Placement configuration object
    renderMode: 'screen-grid', // 'screen-grid' | 'feature-anchors'
    anchorSizePixels: null, // Auto-calculated if null, based on cellSizePixels * glyphSize
    // When true, emit verbose internal debug logs (disabled by default)
    debugLogs: false,
  };

  /**
   * Create configuration from user options merged with defaults
   * @param {Object} options - User-provided configuration
   * @returns {Object} Merged configuration
   */
  static create(options = {}) {
    const config = {
      ...ConfigManager.DEFAULT_CONFIG,
      ...options,
    };

    // Validate placement configuration
    const validation = PlacementValidator.validate(config);
    if (!validation.valid) {
      const errorMsg = `ConfigManager: Invalid configuration:\n${validation.errors.join('\n')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Emit warnings once per session to avoid noisy repeated logs
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        ConfigManager._warnOnce(warning);
      });
    }

    // Auto-switch renderMode for grid-screen strategy to avoid double aggregation
    if (config.placement?.strategy === 'grid-screen' && config.renderMode === 'screen-grid') {
      ConfigManager._warnOnce("Auto-switching renderMode to 'feature-anchors' for grid-screen strategy to avoid double aggregation.");
      config.renderMode = 'feature-anchors';
    }

    // Auto-calculate anchorSizePixels if not provided and in feature-anchors mode
    if (config.renderMode === 'feature-anchors' && config.anchorSizePixels === null) {
      config.anchorSizePixels = Math.round(config.cellSizePixels * config.glyphSize * 0.9);
    }

    return config;
  }

  /**
   * Update configuration with partial options
   * @param {Object} config - Current configuration
   * @param {Object} updates - Partial configuration updates
   * @returns {Object} Updated configuration
   */
  static update(config, updates = {}) {
    const updated = {
      ...config,
      ...updates,
    };

    // Validate updated configuration
    const validation = PlacementValidator.validate(updated);
    if (!validation.valid) {
      const errorMsg = `ConfigManager: Invalid configuration update:\n${validation.errors.join('\n')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Emit warnings once per session
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        ConfigManager._warnOnce(warning);
      });
    }

    // Auto-switch renderMode for grid-screen strategy (deduped warning)
    if (updated.placement?.strategy === 'grid-screen' && updated.renderMode === 'screen-grid') {
      ConfigManager._warnOnce("Auto-switching renderMode to 'feature-anchors' for grid-screen strategy.");
      updated.renderMode = 'feature-anchors';
    }

    // Auto-calculate anchorSizePixels if needed
    if (updated.renderMode === 'feature-anchors' && updated.anchorSizePixels === null) {
      updated.anchorSizePixels = Math.round(updated.cellSizePixels * updated.glyphSize * 0.9);
    }

    return updated;
  }

  /**
   * Validate configuration structure
   * @param {Object} config - Configuration to validate
   * @returns {boolean} True if valid
   */
  static isValid(config) {
    if (!config || typeof config !== 'object') {
      return false;
    }

    // Check cellSizePixels
    if (typeof config.cellSizePixels !== 'number' || config.cellSizePixels <= 0) {
      return false;
    }

    // Check if using data path (legacy)
    const hasDataPath = config.data && Array.isArray(config.data) && 
                       typeof config.getPosition === 'function' &&
                       typeof config.getWeight === 'function';

    // Check if using source path (new)
    const hasSourcePath = config.source && config.placement;

    // Must have one or the other (mutual exclusivity checked by PlacementValidator)
    if (!hasDataPath && !hasSourcePath) {
      // Allow empty data array for initialization
      if (Array.isArray(config.data) && (!config.source || !config.placement)) {
        return true; // Valid empty state
      }
      return false;
    }

    // Use PlacementValidator for full validation
    const validation = PlacementValidator.validate(config);
    return validation.valid;
  }
}
