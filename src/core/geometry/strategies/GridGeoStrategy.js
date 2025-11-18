/**
 * GridGeoStrategy.js
 * Samples polygon interior at geodesic spacing (meters)
 */

import { GeometryUtils } from '../GeometryUtils.js';
import { Logger } from '../../../utils/Logger.js';

export class GridGeoStrategy {
  /**
   * Place anchors by sampling polygon interior at geodesic spacing
   * @param {Array} features - GeoJSON features
   * @param {Object} config - Placement config
   * @param {Object} map - MapLibre map instance (optional, for view-dependent operations)
   * @returns {Array} Array of anchors
   */
  static place(features, config, map = null) {
    const anchors = [];
    const spacing = config.spacing;
    const maxPerFeature = config.maxPerFeature;
    const minArea = config.minArea;
    const partition = config.partition || 'union';

    if (!spacing || !spacing.meters) {
      throw new Error('GridGeoStrategy: spacing with meters is required');
    }

    const spacingMeters = spacing.meters;

    for (const feature of features) {
      if (!feature || !feature.geometry) {
        Logger.warn('GridGeoStrategy: skipping feature without geometry', feature);
        continue;
      }

      const geometry = feature.geometry;
      const featureId = feature.id || feature.properties?.id || null;
      const props = feature.properties || {};

      try {
        let polygons = [];

        switch (geometry.type) {
          case 'Polygon':
            polygons = [geometry.coordinates];
            break;

          case 'MultiPolygon':
            if (partition === 'per-part') {
              polygons = geometry.coordinates;
            } else {
              // Union: treat as single polygon (use first, others as holes)
              // For simplicity, process each polygon separately and combine
              polygons = geometry.coordinates;
            }
            break;

            default:
            Logger.warn(`GridGeoStrategy: unsupported geometry type '${geometry.type}'. Skipping feature id=${featureId}.`);
            continue;
        }

        // Process each polygon
        for (const polygon of polygons) {
          const exteriorRing = polygon[0];
          const holes = polygon.slice(1);

          // Check minArea fallback
          if (minArea) {
            const bbox = GeometryUtils.getBoundingBox(exteriorRing);
            const widthMeters = GeometryUtils.distanceMeters(
              [bbox.minLng, bbox.minLat],
              [bbox.maxLng, bbox.minLat]
            );
            const heightMeters = GeometryUtils.distanceMeters(
              [bbox.minLng, bbox.minLat],
              [bbox.minLng, bbox.maxLat]
            );
            const areaMeters2 = widthMeters * heightMeters; // Approximate

            if (areaMeters2 < minArea) {
              // Fallback to centroid
              const centroid = GeometryUtils.centroidOfPolygon(exteriorRing);
              anchors.push({
                position: centroid,
                featureId,
                props,
                weight: props.weight || 1
              });
              continue;
            }
          }

          // Get bounding box
          const bbox = GeometryUtils.getBoundingBox(exteriorRing);
          const centerLat = (bbox.minLat + bbox.maxLat) / 2;

          // Generate grid points
          const gridPoints = GeometryUtils.generateGeodesicGrid(bbox, spacingMeters, centerLat);

          // Filter points that are inside polygon (and not in holes)
          const interiorPoints = gridPoints.filter(point =>
            GeometryUtils.pointInPolygonWithHoles(point, exteriorRing, holes)
          );

          // Apply maxPerFeature cap
          let finalPoints = interiorPoints;
          if (maxPerFeature && interiorPoints.length > maxPerFeature) {
            // Uniformly sample
            const step = interiorPoints.length / maxPerFeature;
            finalPoints = [];
            for (let i = 0; i < maxPerFeature; i++) {
              const idx = Math.floor(i * step);
              finalPoints.push(interiorPoints[idx]);
            }
          }

          // Create anchors
          for (const position of finalPoints) {
            anchors.push({
              position,
              featureId,
              props,
              weight: props.weight || 1
            });
          }
        }
      } catch (error) {
        Logger.warn(`GridGeoStrategy: error processing feature id=${featureId}, skipping:`, error);
        // Fallback to centroid on error
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
}

