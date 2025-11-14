/**
 * PolylabelStrategy.js
 * Better polygon label placement using pole of inaccessibility
 * Falls back to centroid if polylabel library is not available
 */

import { GeometryUtils } from '../GeometryUtils.js';

// Try to load polylabel library (optional dependency)
let polylabel = null;
try {
  // Try to import polylabel if available
  // Note: User needs to install 'polylabel' package separately
  // eslint-disable-next-line no-undef
  if (typeof require !== 'undefined') {
    try {
      polylabel = require('polylabel');
    } catch (e) {
      // polylabel not available
    }
  }
} catch (e) {
  // polylabel not available
}

export class PolylabelStrategy {
  /**
   * Place anchors using polylabel (pole of inaccessibility) for better label placement
   * Falls back to centroid if polylabel is not available
   * @param {Array} features - GeoJSON features
   * @param {Object} config - Placement config
   * @param {Object} map - MapLibre map instance (optional)
   * @returns {Array} Array of anchors
   */
  static place(features, config, map = null) {
    const anchors = [];
    const partition = config.partition || 'union';
    const precision = config.precision || 1.0; // Precision in meters for polylabel
    const timeout = config.timeout || 1000; // Timeout in ms

    // Check if polylabel is available
    const usePolylabel = polylabel !== null;

    if (!usePolylabel) {
      console.warn('PolylabelStrategy: polylabel library not available. Install with: npm install polylabel. Falling back to centroid.');
    }

    for (const feature of features) {
      if (!feature || !feature.geometry) {
        console.warn('PolylabelStrategy: skipping feature without geometry', feature);
        continue;
      }

      const geometry = feature.geometry;
      const featureId = feature.id || feature.properties?.id || null;
      const props = feature.properties || {};

      try {
        let positions = [];

        switch (geometry.type) {
          case 'Polygon':
            positions = [this._getPolylabelOrCentroid(geometry.coordinates, precision, timeout, usePolylabel, featureId)];
            break;

          case 'MultiPolygon':
            if (partition === 'per-part') {
              positions = geometry.coordinates.map(polygon =>
                this._getPolylabelOrCentroid(polygon, precision, timeout, usePolylabel, featureId)
              );
            } else {
              // Union: use polylabel of first polygon (or centroid)
              positions = [this._getPolylabelOrCentroid(geometry.coordinates[0], precision, timeout, usePolylabel, featureId)];
            }
            break;

          case 'LineString':
          case 'MultiLineString':
          case 'Point':
          case 'MultiPoint':
            // For non-polygon geometries, fallback to centroid
            if (geometry.type === 'LineString') {
              positions = [[GeometryUtils.centroidOfLine(geometry.coordinates)]];
            } else if (geometry.type === 'MultiLineString') {
              if (partition === 'per-part') {
                positions = geometry.coordinates.map(coords => [GeometryUtils.centroidOfLine(coords)]);
              } else {
                const allCoords = geometry.coordinates.flat();
                positions = [[GeometryUtils.centroidOfLine(allCoords)]];
              }
            } else if (geometry.type === 'Point') {
              positions = [geometry.coordinates];
            } else if (geometry.type === 'MultiPoint') {
              if (partition === 'per-part') {
                positions = geometry.coordinates.map(coord => coord);
              } else {
                positions = [[GeometryUtils.centroidOfPoints(geometry.coordinates)]];
              }
            }
            break;

          default:
            console.warn(`PolylabelStrategy: unsupported geometry type '${geometry.type}'. Skipping feature id=${featureId}.`);
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
        console.warn(`PolylabelStrategy: error processing feature id=${featureId}, falling back to centroid:`, error);
        // Fallback to centroid
        try {
          if (geometry.type === 'Polygon') {
            const centroid = GeometryUtils.centroidOfPolygon(geometry.coordinates[0]);
            anchors.push({
              position: centroid,
              featureId,
              props,
              weight: props.weight || 1
            });
          }
        } catch (fallbackError) {
          // Ignore fallback errors
        }
      }
    }

    return anchors;
  }

  /**
   * Get polylabel or fallback to centroid
   * @private
   */
  static _getPolylabelOrCentroid(polygon, precision, timeout, usePolylabel, featureId) {
    if (!usePolylabel || !polylabel) {
      // Fallback to centroid
      return GeometryUtils.centroidOfPolygon(polygon[0]);
    }

    try {
      // Convert GeoJSON polygon format to polylabel format
      // polylabel expects: [[[lng, lat], ...], ...] where first ring is exterior, rest are holes
      const polygonFormat = polygon.map(ring => ring.map(coord => [coord[0], coord[1]]));

      // Run polylabel with timeout protection
      const startTime = Date.now();
      const result = polylabel(polygonFormat, precision);

      // Check timeout
      if (Date.now() - startTime > timeout) {
        console.warn(`PolylabelStrategy: timeout for feature id=${featureId}, falling back to centroid`);
        return GeometryUtils.centroidOfPolygon(polygon[0]);
      }

      // polylabel returns {x: lng, y: lat}
      return [result.x, result.y];
    } catch (error) {
      console.warn(`PolylabelStrategy: error computing polylabel for feature id=${featureId}, falling back to centroid:`, error);
      return GeometryUtils.centroidOfPolygon(polygon[0]);
    }
  }
}

