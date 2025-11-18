/**
 * AggregationFunctionRegistry.js
 * Registry for aggregation functions (sum, mean, count, etc.)
 * Allows users to provide custom aggregation functions or use built-in ones
 */

const _registry = new Map();

export const AggregationFunctionRegistry = {
  /**
   * Register an aggregation function
   * @param {string} name - Function name
   * @param {Function} fn - Aggregation function: (cellDataArray) => number | object
   * @param {Object} options - { overwrite: false }
   */
  register(name, fn, { overwrite = false } = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('AggregationFunctionRegistry.register: name must be a non-empty string');
    }
    if (!fn || typeof fn !== 'function') {
      throw new Error('AggregationFunctionRegistry.register: fn must be a function');
    }
    if (_registry.has(name) && !overwrite) {
      throw new Error(`AggregationFunctionRegistry: function "${name}" already exists`);
    }
    _registry.set(name, fn);
  },

  /**
   * Get an aggregation function by name
   * @param {string} name - Function name
   * @returns {Function|null} Aggregation function or null if not found
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

