/**
 * CentroidStrategy.js
 * Places one anchor per feature at its centroid
 */

import { GeometryUtils } from '../GeometryUtils.js';
import { Logger } from '../../../utils/Logger.js';

export class CentroidStrategy {
  /**
   * Place anchors using centroid strategy
   * @param {Array} features - GeoJSON features
   * @param {Object} config - Placement config
   * @param {Object} map - MapLibre map instance (optional, for view-dependent operations)
   * @returns {Array} Array of anchors: { position: [lng, lat], featureId, props, weight? }
   */
  static place(features, config, map = null) {
    const anchors = [];
    const partition = config.partition || 'union';

    for (const feature of features) {
      if (!feature || !feature.geometry) {
        Logger.warn('CentroidStrategy: skipping feature without geometry', feature);
        continue;
      }

      const geometry = feature.geometry;
      const featureId = feature.id || feature.properties?.id || null;
      const props = feature.properties || {};

      try {
        // `positions` is a flat list of [lng, lat] pairs. The centroidOf*
        // helpers already return a single pair, so they must not be wrapped in
        // an extra array -- doing so made the destructuring below yield
        // lng=[lng,lat], lat=undefined, silently dropping every anchor for all
        // geometry types except Point.
        let positions = [];

        switch (geometry.type) {
          case 'Point':
            positions = [geometry.coordinates];
            break;

          case 'MultiPoint':
            if (partition === 'per-part') {
              positions = geometry.coordinates.map(coord => coord);
            } else {
              // Union: use centroid of all points
              positions = [GeometryUtils.centroidOfPoints(geometry.coordinates)];
            }
            break;

          case 'LineString':
            positions = [GeometryUtils.centroidOfLine(geometry.coordinates)];
            break;

          case 'MultiLineString':
            if (partition === 'per-part') {
              positions = geometry.coordinates.map(coords => GeometryUtils.centroidOfLine(coords));
            } else {
              // Union: combine all lines and compute centroid
              const allCoords = geometry.coordinates.flat();
              positions = [GeometryUtils.centroidOfLine(allCoords)];
            }
            break;

          case 'Polygon':
            positions = [GeometryUtils.centroidOfPolygon(geometry.coordinates[0])];
            break;

          case 'MultiPolygon':
            if (partition === 'per-part') {
              positions = geometry.coordinates.map(polygon =>
                GeometryUtils.centroidOfPolygon(polygon[0])
              );
            } else {
              // Union: compute centroid of all polygons combined
              // For simplicity, use centroid of first polygon's exterior ring
              // A more accurate approach would compute weighted centroid by area
              positions = [GeometryUtils.centroidOfPolygon(geometry.coordinates[0][0])];
            }
            break;

          default:
            Logger.warn(`CentroidStrategy: unsupported geometry type '${geometry.type}'. Skipping feature id=${featureId}.`);
            continue;
        }

        // Create anchors from positions
        for (const [lng, lat] of positions) {
          if (typeof lng === 'number' && typeof lat === 'number' && isFinite(lng) && isFinite(lat)) {
            anchors.push({
              position: [lng, lat],
              featureId,
              props,
              weight: props.weight || 1
            });
          }
        }
      } catch (error) {
        Logger.warn(`CentroidStrategy: error processing feature id=${featureId}, skipping:`, error);
      }
    }

    return anchors;
  }
}

