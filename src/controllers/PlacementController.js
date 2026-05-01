/**
 * PlacementController.js
 * Owns geometry placement cache, anchor normalization, and anchor hit testing.
 */

import { PlacementEngine } from '../core/geometry/PlacementEngine.js';
import { Logger } from '../utils/Logger.js';

export class PlacementController {
  constructor() {
    this.anchors = [];
    this.cacheKey = null;
    this.lastViewState = null;
    this.maxWeight = 1;
  }

  reset() {
    this.anchors = [];
    this.cacheKey = null;
    this.lastViewState = null;
    this.maxWeight = 1;
  }

  clearCache() {
    this.cacheKey = null;
  }

  hasPlacement(config) {
    return Boolean(config?.source && config?.placement);
  }

  needsViewUpdate(config) {
    return PlacementEngine.needsViewUpdate(config?.placement);
  }

  update(config, map, canvasManager) {
    if (!this.hasPlacement(config)) {
      this.anchors = [];
      return this.anchors;
    }

    const needsViewUpdate = this.needsViewUpdate(config);
    const viewState = this._getViewState(map, canvasManager);
    const cacheKey = this._getCacheKey(config.placement, needsViewUpdate, viewState);

    if (this._canUseCache(cacheKey, needsViewUpdate, viewState, map)) {
      return this.anchors;
    }

    try {
      this.anchors = PlacementEngine.place(config.source, config.placement, map);
      this.cacheKey = cacheKey;
      this.lastViewState = viewState;
      this.maxWeight = this.anchors.length > 0
        ? Math.max(...this.anchors.map((anchor) => anchor.weight || 1), 1)
        : 1;

      Logger.log(`[PlacementController] Placement computed: ${this.anchors.length} anchors`);
    } catch (error) {
      Logger.error('[PlacementController] Placement error:', error);
      this.reset();
    }

    return this.anchors;
  }

  getAnchorAt(point, config, map) {
    if (!map || this.anchors.length === 0) {
      return null;
    }

    const { x, y } = point;
    const anchorSize = config.anchorSizePixels ||
      Math.round(config.cellSizePixels * config.glyphSize * 0.9);
    const hitRadius = anchorSize / 2 + 5;

    let nearestAnchor = null;
    let minDistance = Infinity;

    for (const anchor of this.anchors) {
      try {
        const screenPoint = map.project(anchor.position);
        const distance = Math.sqrt(
          Math.pow(x - screenPoint.x, 2) + Math.pow(y - screenPoint.y, 2)
        );

        if (distance < hitRadius && distance < minDistance) {
          minDistance = distance;
          nearestAnchor = anchor;
        }
      } catch (error) {
        // Skip invalid anchors.
      }
    }

    if (!nearestAnchor) {
      return null;
    }

    const weight = nearestAnchor.weight || 1;
    const normalizedValue = weight / this.maxWeight;
    const screenPoint = map.project(nearestAnchor.position);

    return {
      mode: 'feature-anchors',
      anchor: nearestAnchor,
      featureId: nearestAnchor.featureId,
      props: nearestAnchor.props,
      weight,
      normalizedValue,
      cellData: [{ data: nearestAnchor.props, weight }],
      x: screenPoint.x,
      y: screenPoint.y,
    };
  }

  _getViewState(map, canvasManager) {
    if (!map) return null;

    const displaySize = canvasManager.getDisplaySize();
    return {
      zoom: Math.floor(map.getZoom() * 10) / 10,
      center: map.getCenter(),
      width: displaySize.width,
      height: displaySize.height,
    };
  }

  _getCacheKey(placement, needsViewUpdate, viewState) {
    const baseKey = `${placement.strategy}-${JSON.stringify(placement)}`;
    return needsViewUpdate && viewState
      ? `${baseKey}-${JSON.stringify(viewState)}`
      : baseKey;
  }

  _canUseCache(cacheKey, needsViewUpdate, viewState, map) {
    if (this.cacheKey !== cacheKey || this.anchors.length === 0) {
      return false;
    }

    if (!needsViewUpdate || !viewState || !this.lastViewState) {
      return true;
    }

    const zoomDelta = Math.abs(viewState.zoom - this.lastViewState.zoom);
    const panDeltaX = Math.abs(viewState.center.lng - this.lastViewState.center.lng);
    const panDeltaY = Math.abs(viewState.center.lat - this.lastViewState.center.lat);
    const bounds = map.getBounds();
    const viewportWidthDegrees = bounds.getEast() - bounds.getWest();
    const viewportHeightDegrees = bounds.getNorth() - bounds.getSouth();
    const panThresholdFraction = 0.25;

    return zoomDelta <= 0.5 &&
      panDeltaX <= viewportWidthDegrees * panThresholdFraction &&
      panDeltaY <= viewportHeightDegrees * panThresholdFraction;
  }
}
