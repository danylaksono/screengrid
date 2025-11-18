/**
 * NormalizationFunctionRegistry.js
 * Registry for normalization functions (max-local, max-global, z-score, percentile, etc.)
 * Allows users to provide custom normalization functions or use built-in ones
 */

const _registry = new Map();

export const NormalizationFunctionRegistry = {
  /**
   * Register a normalization function
   * @param {string} name - Function name
   * @param {Function} fn - Normalization function: (grid, cellValue, cellIndex, context) => number
   * @param {Object} options - { overwrite: false }
   */
  register(name, fn, { overwrite = false } = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('NormalizationFunctionRegistry.register: name must be a non-empty string');
    }
    if (!fn || typeof fn !== 'function') {
      throw new Error('NormalizationFunctionRegistry.register: fn must be a function');
    }
    if (_registry.has(name) && !overwrite) {
      throw new Error(`NormalizationFunctionRegistry: function "${name}" already exists`);
    }
    _registry.set(name, fn);
  },

  /**
   * Get a normalization function by name
   * @param {string} name - Function name
   * @returns {Function|null} Normalization function or null if not found
   */
  get(name) {
    if (typeof name === 'function') {
      // Allow direct function passing
      return name;
    }
    return _registry.get(name) || null;
  },

  /**
   * Check if a function exists
   * @param {string} name - Function name
   * @returns {boolean}
   */
  has(name) {
    return _registry.has(name);
  },

  /**
   * List all registered function names
   * @returns {Array<string>}
   */
  list() {
    return Array.from(_registry.keys());
  },

  /**
   * Unregister a function
   * @param {string} name - Function name
   * @returns {boolean} True if removed
   */
  unregister(name) {
    return _registry.delete(name);
  },

  /**
   * Clear all registered functions
   */
  clear() {
    _registry.clear();
  },
};

