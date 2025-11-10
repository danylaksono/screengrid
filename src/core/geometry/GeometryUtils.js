/**
 * GeometryUtils.js
 * Pure geometry utility functions for computing centroids, distances, etc.
 */

export class GeometryUtils {
  /**
   * Compute centroid of a point array
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @returns {Array} [lng, lat] centroid
   */
  static centroidOfPoints(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      throw new Error('centroidOfPoints: coordinates array is empty');
    }

    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of coordinates) {
      sumLng += lng;
      sumLat += lat;
    }

    return [sumLng / coordinates.length, sumLat / coordinates.length];
  }

  /**
   * Compute centroid of a line (midpoint of total length)
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @returns {Array} [lng, lat] centroid
   */
  static centroidOfLine(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      throw new Error('centroidOfLine: coordinates array is empty');
    }

    if (coordinates.length === 1) {
      return coordinates[0];
    }

    // For simplicity, use midpoint of first and last point
    // A more accurate approach would compute weighted midpoint by segment lengths
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    return [
      (first[0] + last[0]) / 2,
      (first[1] + last[1]) / 2
    ];
  }

  /**
   * Compute centroid of a polygon (using exterior ring only)
   * @param {Array} coordinates - Exterior ring coordinates [[lng, lat], ...]
   * @returns {Array} [lng, lat] centroid
   */
  static centroidOfPolygon(coordinates) {
    if (!coordinates || coordinates.length < 3) {
      throw new Error('centroidOfPolygon: polygon must have at least 3 vertices');
    }

    // Simple centroid: average of all vertices
    // Note: This is not the true geometric centroid (area-weighted),
    // but it's fast and sufficient for many use cases
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;

    // Exclude last point if it's duplicate of first (closed ring)
    const coords = coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
                    coordinates[0][1] === coordinates[coordinates.length - 1][1]
      ? coordinates.slice(0, -1)
      : coordinates;

    for (const [lng, lat] of coords) {
      sumLng += lng;
      sumLat += lat;
      count++;
    }

    if (count === 0) {
      throw new Error('centroidOfPolygon: no valid coordinates');
    }

    return [sumLng / count, sumLat / count];
  }

  /**
   * Calculate distance between two points in meters (Haversine formula)
   * @param {Array} point1 - [lng, lat]
   * @param {Array} point2 - [lng, lat]
   * @returns {number} Distance in meters
   */
  static distanceMeters(point1, point2) {
    const [lng1, lat1] = point1;
    const [lng2, lat2] = point2;

    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate approximate meters per pixel at a given zoom and latitude
   * @param {number} zoom - Map zoom level
   * @param {number} lat - Latitude in degrees
   * @returns {number} Meters per pixel
   */
  static metersPerPixel(zoom, lat) {
    const earthCircumference = 40075017; // meters
    const latRad = lat * Math.PI / 180;
    const metersPerPixelAtEquator = earthCircumference / (256 * Math.pow(2, zoom));
    return metersPerPixelAtEquator / Math.cos(latRad);
  }

  /**
   * Convert pixels to meters at a given zoom and latitude
   * @param {number} pixels - Pixel distance
   * @param {number} zoom - Map zoom level
   * @param {number} lat - Latitude in degrees
   * @returns {number} Meters
   */
  static pixelsToMeters(pixels, zoom, lat) {
    return pixels * GeometryUtils.metersPerPixel(zoom, lat);
  }

  /**
   * Convert meters to pixels at a given zoom and latitude
   * @param {number} meters - Meter distance
   * @param {number} zoom - Map zoom level
   * @param {number} lat - Latitude in degrees
   * @returns {number} Pixels
   */
  static metersToPixels(meters, zoom, lat) {
    return meters / GeometryUtils.metersPerPixel(zoom, lat);
  }

  /**
   * Check if a point is inside a polygon using ray-casting algorithm
   * @param {Array} point - [lng, lat]
   * @param {Array} polygon - Array of [lng, lat] coordinates (exterior ring)
   * @returns {boolean} True if point is inside polygon
   */
  static pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      const intersect = ((yi > y) !== (yj > y)) &&
                        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Check if a point is inside a polygon with holes
   * @param {Array} point - [lng, lat]
   * @param {Array} exteriorRing - Exterior ring coordinates
   * @param {Array} holes - Array of hole rings (optional)
   * @returns {boolean} True if point is inside exterior and not in any hole
   */
  static pointInPolygonWithHoles(point, exteriorRing, holes = []) {
    // Must be inside exterior ring
    if (!GeometryUtils.pointInPolygon(point, exteriorRing)) {
      return false;
    }

    // Must not be inside any hole
    for (const hole of holes) {
      if (GeometryUtils.pointInPolygon(point, hole)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get bounding box of a polygon
   * @param {Array} polygon - Array of [lng, lat] coordinates
   * @returns {Object} {minLng, minLat, maxLng, maxLat}
   */
  static getBoundingBox(polygon) {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    for (const [lng, lat] of polygon) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }

    return { minLng, minLat, maxLng, maxLat };
  }

  /**
   * Generate a grid of points within a bounding box at geodesic spacing
   * @param {Object} bbox - {minLng, minLat, maxLng, maxLat}
   * @param {number} spacingMeters - Spacing in meters
   * @param {number} centerLat - Latitude for spacing calculation (use center of bbox)
   * @returns {Array} Array of [lng, lat] grid points
   */
  static generateGeodesicGrid(bbox, spacingMeters, centerLat) {
    const { minLng, minLat, maxLng, maxLat } = bbox;

    // Calculate spacing in degrees (approximate)
    const metersPerDegreeLat = 111320; // meters per degree latitude (constant)
    const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

    const spacingLat = spacingMeters / metersPerDegreeLat;
    const spacingLng = spacingMeters / metersPerDegreeLng;

    const points = [];
    let lat = minLat;
    while (lat <= maxLat) {
      let lng = minLng;
      while (lng <= maxLng) {
        points.push([lng, lat]);
        lng += spacingLng;
      }
      lat += spacingLat;
    }

    return points;
  }
}

