/**
 * AggregationModeRegistry.js
 * Registry for aggregation mode plugins (similar to GlyphRegistry)
 * Manages different aggregation strategies: screen-grid, screen-hex, map-h3, etc.
 */

const _registry = new Map();

export const AggregationModeRegistry = {
  /**
   * Register an aggregation mode plugin
   * @param {string} name - Unique mode identifier
   * @param {Object} plugin - Mode plugin object
   * @param {Object} options - { overwrite: false }
   */
  register(name, plugin, { overwrite = false } = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('AggregationModeRegistry.register: name must be a non-empty string');
    }
    if (!plugin || typeof plugin.aggregate !== 'function') {
      throw new Error('AggregationModeRegistry.register: plugin must have an aggregate() method');
    }
    if (!plugin || typeof plugin.render !== 'function') {
      throw new Error('AggregationModeRegistry.register: plugin must have a render() method');
    }
    if (_registry.has(name) && !overwrite) {
      throw new Error(`AggregationModeRegistry: mode "${name}" already exists`);
    }

    // Validate plugin structure
    const requiredMethods = ['aggregate', 'render', 'getCellAt'];
    for (const method of requiredMethods) {
      if (typeof plugin[method] !== 'function') {
        throw new Error(`AggregationModeRegistry.register: plugin must have ${method}() method`);
      }
    }

    // Set defaults for optional methods
    plugin.name = name;
    plugin.type = plugin.type || 'screen-space';
    plugin.needsUpdateOnMove = plugin.needsUpdateOnMove ?? true;
    plugin.needsUpdateOnZoom = plugin.needsUpdateOnZoom ?? true;
    plugin.getStats = plugin.getStats || (() => ({}));
    plugin.init = plugin.init || (() => null);

    _registry.set(name, plugin);
  },

  /**
   * Get an aggregation mode plugin by name
   * @param {string} name - Mode identifier
   * @returns {Object|null} Plugin object or null if not found
   */
  get(name) {
    return _registry.get(name) || null;
  },

  /**
   * Check if a mode is registered
   * @param {string} name - Mode identifier
   * @returns {boolean} True if mode exists
   */
  has(name) {
    return _registry.has(name);
  },

  /**
   * List all registered mode names
   * @returns {Array<string>} Array of mode names
   */
  list() {
    return Array.from(_registry.keys());
  },

  /**
   * Unregister a mode
   * @param {string} name - Mode identifier
   * @returns {boolean} True if mode was removed
   */
  unregister(name) {
    return _registry.delete(name);
  },

  /**
   * Clear all registered modes (use with caution)
   */
  clear() {
    _registry.clear();
  },
};

