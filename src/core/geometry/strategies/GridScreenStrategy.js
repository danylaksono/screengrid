/**
 * GridScreenStrategy.js
 * Samples polygon interior at screen-grid centers (pixels)
 */

import { GeometryUtils } from '../GeometryUtils.js';

export class GridScreenStrategy {
  /**
   * Place anchors by selecting screen-grid centers inside polygons
   * @param {Array} features - GeoJSON features
   * @param {Object} config - Placement config
   * @param {Object} map - MapLibre map instance (required for screen-grid)
   * @returns {Array} Array of anchors
   */
  static place(features, config, map = null) {
    const anchors = [];
    const spacing = config.spacing;
    const maxPerFeature = config.maxPerFeature;
    const jitterPixels = config.jitterPixels || 0;
    const partition = config.partition || 'union';

    if (!spacing || !spacing.pixels) {
      throw new Error('GridScreenStrategy: spacing with pixels is required');
    }

    if (!map) {
      throw new Error('GridScreenStrategy: map instance is required for screen-grid strategy');
    }

    const spacingPixels = spacing.pixels;

    // Get viewport bounds
    const bounds = map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    // Get canvas dimensions
    const canvas = map.getCanvas();
    const width = canvas.width;
    const height = canvas.height;

    // Generate screen grid centers
    const gridCenters = [];
    for (let y = spacingPixels / 2; y < height; y += spacingPixels) {
      for (let x = spacingPixels / 2; x < width; x += spacingPixels) {
        // Convert screen coordinates to geographic
        const lngLat = map.unproject([x, y]);
        gridCenters.push({
          screen: [x, y],
          geo: [lngLat.lng, lngLat.lat]
        });
      }
    }

    for (const feature of features) {
      if (!feature || !feature.geometry) {
        console.warn('GridScreenStrategy: skipping feature without geometry', feature);
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
              // Union: process each polygon separately
              polygons = geometry.coordinates;
            }
            break;

          default:
            console.warn(`GridScreenStrategy: unsupported geometry type '${geometry.type}'. Skipping feature id=${featureId}.`);
            continue;
        }

        // Process each polygon
        for (const polygon of polygons) {
          const exteriorRing = polygon[0];
          const holes = polygon.slice(1);

          // Filter grid centers that are inside polygon
          const interiorCenters = gridCenters.filter(gridCenter => {
            const [lng, lat] = gridCenter.geo;
            // Check if point is within viewport bounds (quick check)
            if (lng < sw.lng || lng > ne.lng || lat < sw.lat || lat > ne.lat) {
              return false;
            }
            // Check if inside polygon (and not in holes)
            return GeometryUtils.pointInPolygonWithHoles([lng, lat], exteriorRing, holes);
          });

          // Apply maxPerFeature cap
          let finalCenters = interiorCenters;
          if (maxPerFeature && interiorCenters.length > maxPerFeature) {
            // Uniformly sample
            const step = interiorCenters.length / maxPerFeature;
            finalCenters = [];
            for (let i = 0; i < maxPerFeature; i++) {
              const idx = Math.floor(i * step);
              finalCenters.push(interiorCenters[idx]);
            }
          }

          // Create anchors
          for (const gridCenter of finalCenters) {
            let [lng, lat] = gridCenter.geo;

            // Apply jitter if configured
            if (jitterPixels > 0) {
              const jitterX = (Math.random() - 0.5) * 2 * jitterPixels;
              const jitterY = (Math.random() - 0.5) * 2 * jitterPixels;
              const jitteredScreen = [
                gridCenter.screen[0] + jitterX,
                gridCenter.screen[1] + jitterY
              ];
              const jitteredGeo = map.unproject(jitteredScreen);
              lng = jitteredGeo.lng;
              lat = jitteredGeo.lat;
            }

            anchors.push({
              position: [lng, lat],
              featureId,
              props,
              weight: props.weight || 1
            });
          }
        }
      } catch (error) {
        console.warn(`GridScreenStrategy: error processing feature id=${featureId}, skipping:`, error);
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

