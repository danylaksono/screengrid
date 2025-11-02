/**
 * CanvasManager.js
 * Manages canvas creation, sizing, and cleanup
 */

export class CanvasManager {
  constructor() {
    this.overlayCanvas = null;
    this.ctx = null;
    this.resizeObserver = null;
    this.map = null;
  }

  /**
   * Initialize the canvas overlay
   * @param {Object} map - MapLibre GL map instance
   * @throws {Error} If canvas cannot be initialized
   */
  init(map) {
    this.map = map;

    const canvas = map.getCanvas();
    if (!canvas) {
      throw new Error('Canvas not available from map');
    }

    // Create a 2D canvas overlay for grid rendering
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.pointerEvents = 'none';
    overlayCanvas.style.zIndex = '1'; // Ensure visibility

    // Insert the overlay canvas into the map container
    const container = map.getContainer();
    container.appendChild(overlayCanvas);

    this.overlayCanvas = overlayCanvas;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from overlay canvas');
    }
    this.ctx = ctx;

    console.log('CanvasManager initialized', {
      canvasSize: { width: canvas.width, height: canvas.height },
      devicePixelRatio: window.devicePixelRatio,
    });

    // Initial size and DPI setup
    this.resize();
    this._setupResizeObserver();
  }

  /**
   * Get the 2D rendering context
   * @returns {CanvasRenderingContext2D} 2D context
   */
  getContext() {
    return this.ctx;
  }

  /**
   * Get the overlay canvas element
   * @returns {HTMLCanvasElement} Canvas element
   */
  getCanvas() {
    return this.overlayCanvas;
  }

  /**
   * Resize canvas to match map canvas with DPI scaling
   */
  resize() {
    if (!this.map || !this.overlayCanvas) return;

    const canvas = this.map.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Update overlay canvas size with DPI scaling
    this.overlayCanvas.width = rect.width * dpr;
    this.overlayCanvas.height = rect.height * dpr;
    this.overlayCanvas.style.width = rect.width + 'px';
    this.overlayCanvas.style.height = rect.height + 'px';

    // Set transform for DPI scaling
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    console.log('Canvas resized:', {
      displaySize: { width: rect.width, height: rect.height },
      deviceSize: { width: this.overlayCanvas.width, height: this.overlayCanvas.height },
      dpr,
    });
  }

  /**
   * Clear the canvas
   */
  clear() {
    if (!this.ctx || !this.overlayCanvas) return;

    // Use display size (same as renderer) since transform is already applied
    const { width, height } = this.getDisplaySize();
    this.ctx.clearRect(0, 0, width, height);
  }

  /**
   * Get canvas dimensions in CSS pixels
   * @returns {Object} {width, height}
   */
  getDisplaySize() {
    if (!this.overlayCanvas) return { width: 0, height: 0 };

    return {
      width: this.overlayCanvas.width / (window.devicePixelRatio || 1),
      height: this.overlayCanvas.height / (window.devicePixelRatio || 1),
    };
  }

  /**
   * Setup ResizeObserver to handle window/container resizes
   * @private
   */
  _setupResizeObserver() {
    const resizeObserver = new ResizeObserver(() => {
      this.resize();
    });

    resizeObserver.observe(this.map.getCanvas());
    this.resizeObserver = resizeObserver;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Unbind resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove canvas from DOM
    if (this.overlayCanvas && this.overlayCanvas.parentNode) {
      this.overlayCanvas.parentNode.removeChild(this.overlayCanvas);
    }

    this.overlayCanvas = null;
    this.ctx = null;
    this.map = null;

    console.log('CanvasManager cleaned up');
  }
}
