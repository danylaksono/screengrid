/**
 * Placement Strategy Registry
 * Central registry for all placement strategies
 */

import { PointStrategy } from './PointStrategy.js';
import { CentroidStrategy } from './CentroidStrategy.js';
import { LineSampleStrategy } from './LineSampleStrategy.js';
import { GridGeoStrategy } from './GridGeoStrategy.js';
import { GridScreenStrategy } from './GridScreenStrategy.js';
import { PolylabelStrategy } from './PolylabelStrategy.js';

const STRATEGIES = {
  'point': PointStrategy,
  'centroid': CentroidStrategy,
  'line-sample': LineSampleStrategy,
  'grid-geo': GridGeoStrategy,
  'grid-screen': GridScreenStrategy,
  'polylabel': PolylabelStrategy, // Optional: requires 'polylabel' package
};

export class PlacementStrategyRegistry {
  /**
   * Register a placement strategy
   * @param {string} name - Strategy name
   * @param {Object} strategy - Strategy object with `place` method
   */
  static register(name, strategy) {
    if (typeof strategy.place !== 'function') {
      throw new Error(`PlacementStrategyRegistry: strategy '${name}' must have a 'place' method`);
    }
    STRATEGIES[name] = strategy;
  }

  /**
   * Get a placement strategy
   * @param {string} name - Strategy name
   * @returns {Object|null} Strategy object or null if not found
   */
  static get(name) {
    return STRATEGIES[name] || null;
  }

  /**
   * Check if a strategy exists
   * @param {string} name - Strategy name
   * @returns {boolean}
   */
  static has(name) {
    return name in STRATEGIES;
  }

  /**
   * List all registered strategy names
   * @returns {Array<string>}
   */
  static list() {
    return Object.keys(STRATEGIES);
  }
}

// Export individual strategies for direct access
export { PointStrategy } from './PointStrategy.js';
export { CentroidStrategy } from './CentroidStrategy.js';
export { LineSampleStrategy } from './LineSampleStrategy.js';
export { GridGeoStrategy } from './GridGeoStrategy.js';
export { GridScreenStrategy } from './GridScreenStrategy.js';
export { PolylabelStrategy } from './PolylabelStrategy.js';

