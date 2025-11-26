/**
 * EventHandlers.js
 * Event handler implementations
 */

import { Logger } from '../utils/Logger.js';

export class EventHandlers {
  /**
   * Handle hover events
   * @param {Object} event - MapLibre mouse event
   * @param {Object} queryTarget - CellQueryEngine instance or ScreenGridLayerGL layer
   * @param {Function} onHover - Hover callback from config
   */
  static handleHover(event, queryTarget, onHover) {
    if (!onHover || !queryTarget) return;

    // Support both CellQueryEngine and ScreenGridLayerGL layer
    // Both have getCellAt method, so call it directly
    const cell = queryTarget.getCellAt({ x: event.point.x, y: event.point.y });
    if (cell) {
      onHover({ cell, event });
    }
  }

  /**
   * Handle click events
   * @param {Object} event - MapLibre click event
   * @param {Object} queryTarget - CellQueryEngine instance or ScreenGridLayerGL layer
   * @param {Function} onClick - Click callback from config
   */
  static handleClick(event, queryTarget, onClick) {
    if (!onClick || !queryTarget) return;

    // Support both CellQueryEngine and ScreenGridLayerGL layer
    // Both have getCellAt method, so call it directly
    const cell = queryTarget.getCellAt({ x: event.point.x, y: event.point.y });
    if (cell) {
      onClick({ cell, event });
    }
  }

  /**
   * Handle zoom events
   * @param {Object} map - MapLibre map instance
   * @param {Object} config - Layer configuration
   * @param {Function} onZoom - Callback after zoom handling
   * @param {Object} previousState - Previous map state: { zoom, center, bounds }
   */
  static handleZoom(map, config, onZoom, previousState = null) {
    if (config.zoomBasedSize) {
      EventHandlers._updateCellSizeBasedOnZoom(map, config);
    }
    
    if (onZoom) {
      // Get current map state
      const zoom = map.getZoom();
      const center = map.getCenter();
      const bounds = map.getBounds();
      
      // Prepare callback data
      const callbackData = {
        zoom,
        center: { lng: center.lng, lat: center.lat },
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        }
      };
      
      // Add previous state if available (for enhanced callback)
      if (previousState) {
        callbackData.previousZoom = previousState.zoom;
        callbackData.previousCenter = previousState.center;
        callbackData.previousBounds = previousState.bounds;
      }
      
      // Call callback with enhanced data (backward compatible - old callbacks ignore params)
      onZoom(callbackData);
    }
  }

  /**
   * Handle move events
   * @param {Object} map - MapLibre map instance
   * @param {Function} onMove - Callback when map moves
   * @param {Object} previousState - Previous map state: { center, bounds }
   */
  static handleMove(map, onMove, previousState = null) {
    if (onMove) {
      // Get current map state
      const center = map.getCenter();
      const bounds = map.getBounds();
      
      // Prepare callback data
      const callbackData = {
        center: { lng: center.lng, lat: center.lat },
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        }
      };
      
      // Add previous state if available (for enhanced callback)
      if (previousState) {
        callbackData.previousCenter = previousState.center;
        callbackData.previousBounds = previousState.bounds;
      }
      
      // Call callback with enhanced data (backward compatible - old callbacks ignore params)
      onMove(callbackData);
    }
  }

  /**
   * Handle brush selection events
   * @param {Object} queryTarget - CellQueryEngine instance or ScreenGridLayerGL layer
   * @param {Object} bounds - Selection bounds: {minX, minY, maxX, maxY}
   * @param {Function} onBrush - Brush callback from config
   * @param {Object} event - Optional MapLibre event
   */
  static handleBrush(queryTarget, bounds, onBrush, event = null) {
    if (!onBrush || !queryTarget) return;
    
    // Get cells in bounds using existing method
    // Support both CellQueryEngine and ScreenGridLayerGL layer
    let cells = [];
    
    if (queryTarget.getCellsInBounds && typeof queryTarget.getCellsInBounds === 'function') {
      // Direct method call (works for both ScreenGridLayerGL and CellQueryEngine)
      cells = queryTarget.getCellsInBounds(bounds);
    }
    
    // Call callback with selected cells
    onBrush({ cells, bounds, event });
  }

  /**
   * Update cell size based on zoom level
   * @private
   */
  static _updateCellSizeBasedOnZoom(map, config) {
    if (!map) return;

    const zoom = map.getZoom();
    const baseZoom = 11;
    const zoomFactor = Math.pow(2, zoom - baseZoom);
    const newCellSize = Math.max(
      config.minCellSize,
      Math.min(config.maxCellSize, config.cellSizePixels / zoomFactor)
    );

    if (Math.abs(newCellSize - config.cellSizePixels) > 1) {
      config.cellSizePixels = newCellSize;
      Logger.log('Cell size updated based on zoom:', {
        zoom,
        zoomFactor,
        newCellSize,
      });
    }
  }

  /**
   * Instance methods for convenience
   */
  handleHover(event, cellQueryEngine, onHover) {
    EventHandlers.handleHover(event, cellQueryEngine, onHover);
  }

  handleClick(event, cellQueryEngine, onClick) {
    EventHandlers.handleClick(event, cellQueryEngine, onClick);
  }

  handleZoom(map, config, onZoom, previousState) {
    EventHandlers.handleZoom(map, config, onZoom, previousState);
  }

  handleMove(map, onMove, previousState) {
    EventHandlers.handleMove(map, onMove, previousState);
  }

  handleBrush(queryTarget, bounds, onBrush, event) {
    EventHandlers.handleBrush(queryTarget, bounds, onBrush, event);
  }
}
