/**
 * PointStrategy.js
 * Pass-through strategy for Point/MultiPoint features
 */

export class PointStrategy {
  /**
   * Place anchors using point pass-through strategy
   * @param {Array} features - GeoJSON features
   * @param {Object} config - Placement config (unused for point strategy)
   * @param {Object} map - MapLibre map instance (unused)
   * @returns {Array} Array of anchors
   */
  static place(features, config, map = null) {
    const anchors = [];

    for (const feature of features) {
      if (!feature || !feature.geometry) {
        console.warn('PointStrategy: skipping feature without geometry', feature);
        continue;
      }

      const geometry = feature.geometry;
      const featureId = feature.id || feature.properties?.id || null;
      const props = feature.properties || {};

      try {
        switch (geometry.type) {
          case 'Point':
            anchors.push({
              position: geometry.coordinates,
              featureId,
              props,
              weight: props.weight || 1
            });
            break;

          case 'MultiPoint':
            for (const coord of geometry.coordinates) {
              anchors.push({
                position: coord,
                featureId,
                props,
                weight: props.weight || 1
              });
            }
            break;

          default:
            // For non-point geometries, skip with warning
            console.warn(`PointStrategy: geometry type '${geometry.type}' is not a point. Skipping feature id=${featureId}.`);
            break;
        }
      } catch (error) {
        console.warn(`PointStrategy: error processing feature id=${featureId}, skipping:`, error);
      }
    }

    return anchors;
  }
}

