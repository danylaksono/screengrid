/**
 * LineSampleStrategy.js
 * Samples points along lines at regular intervals
 */

import { GeometryUtils } from '../GeometryUtils.js';

export class LineSampleStrategy {
  /**
   * Place anchors by sampling along lines
   * @param {Array} features - GeoJSON features
   * @param {Object} config - Placement config
   * @param {Object} map - MapLibre map instance (for zoom/lat-dependent spacing)
   * @returns {Array} Array of anchors
   */
  static place(features, config, map = null) {
    const anchors = [];
    const spacing = config.spacing;
    const maxPerFeature = config.maxPerFeature;
    const minLength = config.minLength;
    const zoomAdaptive = config.zoomAdaptive || false;
    const partition = config.partition || 'union';

    if (!spacing) {
      throw new Error('LineSampleStrategy: spacing is required');
    }

    // Determine spacing in meters
    let spacingMeters;
    if (spacing.meters) {
      spacingMeters = spacing.meters;
    } else if (spacing.pixels && map) {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const lat = center.lat;
      
      if (zoomAdaptive) {
        spacingMeters = GeometryUtils.pixelsToMeters(spacing.pixels, zoom, lat);
      } else {
        // Use center latitude for conversion
        spacingMeters = GeometryUtils.pixelsToMeters(spacing.pixels, zoom, lat);
      }
    } else {
      throw new Error('LineSampleStrategy: spacing must have meters or pixels (with map)');
    }

    for (const feature of features) {
      if (!feature || !feature.geometry) {
        console.warn('LineSampleStrategy: skipping feature without geometry', feature);
        continue;
      }

      const geometry = feature.geometry;
      const featureId = feature.id || feature.properties?.id || null;
      const props = feature.properties || {};

      try {
        let lineCoords = [];

        switch (geometry.type) {
          case 'LineString':
            lineCoords = [geometry.coordinates];
            break;

          case 'MultiLineString':
            if (partition === 'per-part') {
              lineCoords = geometry.coordinates;
            } else {
              // Union: combine all lines into one
              lineCoords = [geometry.coordinates.flat()];
            }
            break;

          case 'Point':
            // Single point: place one anchor
            anchors.push({
              position: geometry.coordinates,
              featureId,
              props,
              weight: props.weight || 1
            });
            continue;

          case 'MultiPoint':
            // Multiple points: sample each
            for (const coord of geometry.coordinates) {
              anchors.push({
                position: coord,
                featureId,
                props,
                weight: props.weight || 1
              });
            }
            continue;

          default:
            console.warn(`LineSampleStrategy: unsupported geometry type '${geometry.type}'. Skipping feature id=${featureId}.`);
            continue;
        }

        // Sample each line
        for (const coords of lineCoords) {
          if (coords.length < 2) continue;

          // Calculate total length
          let totalLength = 0;
          const segmentLengths = [];
          for (let i = 0; i < coords.length - 1; i++) {
            const len = GeometryUtils.distanceMeters(coords[i], coords[i + 1]);
            segmentLengths.push(len);
            totalLength += len;
          }

          // Check minLength fallback
          if (minLength && totalLength < minLength) {
            // Fallback to centroid
            const centroid = GeometryUtils.centroidOfLine(coords);
            anchors.push({
              position: centroid,
              featureId,
              props,
              weight: props.weight || 1
            });
            continue;
          }

          // Sample along the line
          const samples = [];
          let distanceAlongLine = 0;
          let segmentIndex = 0;
          let segmentStartDistance = 0;

          // Always include first point
          samples.push(coords[0]);

          while (distanceAlongLine < totalLength) {
            distanceAlongLine += spacingMeters;

            if (distanceAlongLine >= totalLength) {
              // Include last point if we've reached the end
              if (samples.length === 0 || samples[samples.length - 1] !== coords[coords.length - 1]) {
                samples.push(coords[coords.length - 1]);
              }
              break;
            }

            // Find which segment contains this distance
            while (segmentIndex < segmentLengths.length &&
                   segmentStartDistance + segmentLengths[segmentIndex] < distanceAlongLine) {
              segmentStartDistance += segmentLengths[segmentIndex];
              segmentIndex++;
            }

            if (segmentIndex >= segmentLengths.length) break;

            // Interpolate point along segment
            const segmentProgress = (distanceAlongLine - segmentStartDistance) / segmentLengths[segmentIndex];
            const p1 = coords[segmentIndex];
            const p2 = coords[segmentIndex + 1];
            const interpolated = [
              p1[0] + (p2[0] - p1[0]) * segmentProgress,
              p1[1] + (p2[1] - p1[1]) * segmentProgress
            ];
            samples.push(interpolated);
          }

          // Apply maxPerFeature cap
          let finalSamples = samples;
          if (maxPerFeature && samples.length > maxPerFeature) {
            // Uniformly sample from the samples
            const step = samples.length / maxPerFeature;
            finalSamples = [];
            for (let i = 0; i < maxPerFeature; i++) {
              const idx = Math.floor(i * step);
              finalSamples.push(samples[idx]);
            }
          }

          // Create anchors
          for (const position of finalSamples) {
            anchors.push({
              position,
              featureId,
              props,
              weight: props.weight || 1
            });
          }
        }
      } catch (error) {
        console.warn(`LineSampleStrategy: error processing feature id=${featureId}, skipping:`, error);
      }
    }

    return anchors;
  }
}

