/**
 * EventBinder.js
 * Manages event binding and unbinding
 */

export class EventBinder {
  constructor() {
    this.map = null;
    this.handlers = {};
  }

  /**
   * Bind events to the map
   * @param {Object} map - MapLibre map instance
   * @param {Object} eventHandlers - Object with handler methods
   * @param {Function} eventHandlers.handleHover - Hover handler
   * @param {Function} eventHandlers.handleClick - Click handler
   * @param {Function} eventHandlers.handleZoom - Zoom handler
   * @param {Function} eventHandlers.handleMove - Move handler
   */
  bind(map, eventHandlers) {
    this.map = map;

    // Create bound handlers that preserve context
    this.handlers.onMouseMove = (e) => eventHandlers.handleHover(e);
    this.handlers.onClick = (e) => eventHandlers.handleClick(e);
    this.handlers.onZoom = () => eventHandlers.handleZoom();
    this.handlers.onMove = () => eventHandlers.handleMove();

    // Attach to map
    this.map.on('mousemove', this.handlers.onMouseMove);
    this.map.on('click', this.handlers.onClick);
    this.map.on('zoom', this.handlers.onZoom);
    this.map.on('move', this.handlers.onMove);

    // Debug-only message
    // Importing Logger here would create a module-level dependency; prefer silent default.
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const { Logger } = require('../utils/Logger.js');
      if (Logger) Logger.log('Events bound to map');
    } catch (e) {
      // ignore
    }
  }

  /**
   * Unbind events from the map
   */
  unbind() {
    if (!this.map) return;

    this.map.off('mousemove', this.handlers.onMouseMove);
    this.map.off('click', this.handlers.onClick);
    this.map.off('zoom', this.handlers.onZoom);
    this.map.off('move', this.handlers.onMove);

    this.handlers = {};
    this.map = null;

    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const { Logger } = require('../utils/Logger.js');
      if (Logger) Logger.log('Events unbound from map');
    } catch (e) {
      // ignore
    }
  }

  /**
   * Bind a specific event
   * @param {string} eventName - Event name (e.g., 'mousemove', 'click')
   * @param {Function} handler - Handler function
   */
  bindEvent(eventName, handler) {
    if (!this.map) return;

    const boundHandler = (e) => handler(e);
    this.handlers[eventName] = boundHandler;
    this.map.on(eventName, boundHandler);
  }

  /**
   * Unbind a specific event
   * @param {string} eventName - Event name
   */
  unbindEvent(eventName) {
    if (!this.map || !this.handlers[eventName]) return;

    this.map.off(eventName, this.handlers[eventName]);
    delete this.handlers[eventName];
  }
}
