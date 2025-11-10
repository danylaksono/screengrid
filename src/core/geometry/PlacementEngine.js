/**
 * PlacementEngine.js
 * Main engine that converts GeoJSON source to anchor points using placement strategies
 */

import { PlacementValidator } from './PlacementValidator.js';
import { PlacementStrategyRegistry } from './strategies/index.js';

export class PlacementEngine {
  /**
   * Convert GeoJSON source to anchor points
   * @param {Object} source - GeoJSON FeatureCollection, Feature, or array of Features
   * @param {Object} placementConfig - Placement configuration
   * @param {Object} map - MapLibre map instance (required for view-dependent strategies)
   * @returns {Array} Array of anchors: { position: [lng, lat], featureId, props, weight? }
   */
  static place(source, placementConfig, map = null) {
    // Normalize source to array of features
    const features = PlacementValidator.normalizeSource(source);

    if (features.length === 0) {
      return [];
    }

    // Get strategy
    const strategyName = placementConfig.strategy;
    const strategy = PlacementStrategyRegistry.get(strategyName);

    if (!strategy) {
      throw new Error(`PlacementEngine: strategy '${strategyName}' not found. Available: ${PlacementStrategyRegistry.list().join(', ')}`);
    }

    // Merge with defaults
    const defaults = PlacementValidator.getDefaultPlacementConfig(strategyName);
    const config = {
      ...defaults,
      ...placementConfig
    };

    // Check if strategy needs map (for view-dependent operations)
    const needsMap = strategyName === 'grid-screen' || 
                     (strategyName === 'line-sample' && (config.spacing?.pixels || config.zoomAdaptive));

    if (needsMap && !map) {
      if (strategyName === 'grid-screen') {
        throw new Error('PlacementEngine: strategy \'grid-screen\' requires map instance.');
      }
      console.warn(`PlacementEngine: strategy '${strategyName}' with pixel spacing or zoomAdaptive requires map instance. Some features may be skipped.`);
    }

    // Apply jitter if configured
    const anchors = strategy.place(features, config, map);
    
    if (config.jitterPixels && config.jitterPixels > 0 && map) {
      return PlacementEngine._applyJitter(anchors, config.jitterPixels, map);
    }

    return anchors;
  }

  /**
   * Apply jitter to anchors to avoid exact overlaps
   * @private
   */
  static _applyJitter(anchors, jitterPixels, map) {
    return anchors.map(anchor => {
      const [lng, lat] = anchor.position;
      
      // Project to screen, add jitter, unproject back
      const screenPoint = map.project([lng, lat]);
      const jitterX = (Math.random() - 0.5) * 2 * jitterPixels;
      const jitterY = (Math.random() - 0.5) * 2 * jitterPixels;
      
      const jitteredScreen = [screenPoint.x + jitterX, screenPoint.y + jitterY];
      const jitteredGeo = map.unproject(jitteredScreen);

      return {
        ...anchor,
        position: [jitteredGeo.lng, jitteredGeo.lat]
      };
    });
  }

  /**
   * Check if placement needs recomputation on view change
   * @param {Object} placementConfig - Placement configuration
   * @returns {boolean}
   */
  static needsViewUpdate(placementConfig) {
    if (!placementConfig) return false;

    const strategy = placementConfig.strategy;
    const hasPixelSpacing = placementConfig.spacing?.pixels;
    const zoomAdaptive = placementConfig.zoomAdaptive;

    // grid-screen is always view-dependent
    if (strategy === 'grid-screen') {
      return true;
    }

    // Other strategies are view-dependent if using pixel spacing or zoomAdaptive
    return hasPixelSpacing || zoomAdaptive;
  }
}

