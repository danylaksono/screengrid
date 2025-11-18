/**
 * Legend.js
 * Main Legend class for rendering data-driven legends
 */

import { LegendDataExtractor } from './LegendDataExtractor.js';
import { LegendRenderers } from './LegendRenderers.js';
import { GlyphRegistry } from '../glyphs/GlyphRegistry.js';
import { Logger } from '../utils/Logger.js';

export class Legend {
  /**
   * Create a new Legend instance
   * @param {Object} options - Configuration options
   * @param {ScreenGridLayerGL} options.layer - ScreenGridLayerGL instance to connect to
   * @param {string} options.type - Legend type: 'color-scale', 'categorical', 'temporal', 'size-scale', 'auto', 'multi'
   * @param {string} options.position - Position: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
   * @param {string} options.title - Legend title
   * @param {HTMLElement} options.container - Custom container element (optional)
   * @param {Object} options.renderOptions - Options passed to renderers
   * @param {Function} options.categoryExtractor - Function to extract category from data (for categorical)
   * @param {Function} options.valueExtractor - Function to extract value from data
   * @param {Function} options.timeExtractor - Function to extract time/year from data (for temporal)
   * @param {Function} options.sizeExtractor - Function to extract size from data (for size-scale)
   */
  constructor(options = {}) {
    this.layer = options.layer;
    this.type = options.type || 'auto';
    this.position = options.position || 'bottom-right';
    this.title = options.title || 'Legend';
    this.container = options.container || null;
    this.renderOptions = options.renderOptions || {};
    this.categoryExtractor = options.categoryExtractor;
    this.valueExtractor = options.valueExtractor;
    this.timeExtractor = options.timeExtractor;
    this.sizeExtractor = options.sizeExtractor;

    // Internal state
    this.element = null;
    this.gridData = null;
    this.config = null;

    // Bind to layer's onAggregate callback
    if (this.layer) {
      this._attachToLayer();
    }

    // Create DOM element
    this._createElement();
  }

  /**
   * Attach to layer's aggregation callback
   * @private
   */
  _attachToLayer() {
    if (!this.layer) return;

    const originalOnAggregate = this.layer.config?.onAggregate;

    // Wrap the onAggregate callback
    const wrappedCallback = (gridData) => {
      // Call original callback if it exists
      if (originalOnAggregate) {
        originalOnAggregate(gridData);
      }

      // Update legend with current config
      if (this.layer && this.layer.config) {
        this.update(gridData, this.layer.config);
      }
    };

    // Update the layer's config
    if (this.layer.config) {
      this.layer.config.onAggregate = wrappedCallback;
    } else {
      // If config not ready, wait for it
      setTimeout(() => {
        if (this.layer && this.layer.config) {
          this.layer.config.onAggregate = wrappedCallback;
        }
      }, 100);
    }

    // Also try to get initial data if available
    if (this.layer.gridData && this.layer.config) {
      this.update(this.layer.gridData, this.layer.config);
    }
  }

  /**
   * Create the legend DOM element
   * @private
   */
  _createElement() {
    if (this.container) {
      // Use provided container
      this.element = this.container;
    } else {
      // Create new element
      this.element = document.createElement('div');
      this.element.className = 'glyph-legend';
      this.element.style.cssText = `
        position: absolute;
        background: white;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        padding: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        z-index: 1000;
        max-width: 250px;
        pointer-events: none;
      `;

      // Position the element
      this._applyPosition();

      // Add to map container or body
      if (this.layer && this.layer.map) {
        this.layer.map.getContainer().appendChild(this.element);
      } else {
        document.body.appendChild(this.element);
      }
    }

    // Add title styling
    const style = document.createElement('style');
    style.textContent = `
      .glyph-legend-title {
        font-weight: 600;
        font-size: 13px;
        color: #333;
        margin-bottom: 8px;
      }
      .glyph-legend-scale {
        border-radius: 2px;
        overflow: hidden;
      }
      .glyph-legend-stop {
        cursor: help;
      }
      .glyph-legend-item {
        cursor: default;
      }
    `;
    if (!document.getElementById('glyph-legend-styles')) {
      style.id = 'glyph-legend-styles';
      document.head.appendChild(style);
    }
  }

  /**
   * Apply positioning to legend element
   * @private
   */
  _applyPosition() {
    if (!this.element || this.container) return;

    const positions = {
      'top-left': { top: '10px', left: '10px', bottom: 'auto', right: 'auto' },
      'top-right': { top: '10px', right: '10px', bottom: 'auto', left: 'auto' },
      'bottom-left': { bottom: '10px', left: '10px', top: 'auto', right: 'auto' },
      'bottom-right': { bottom: '10px', right: '10px', top: 'auto', left: 'auto' }
    };

    const pos = positions[this.position] || positions['bottom-right'];
    Object.assign(this.element.style, pos);
  }

  /**
   * Update legend with new data
   * @param {Object} gridData - Aggregation result from ScreenGridLayerGL
   * @param {Object} config - ScreenGridLayerGL config
   */
  update(gridData, config) {
    if (!gridData || !this.element) return;

    this.gridData = gridData;
    this.config = config;

    // If a glyph plugin is registered and exposes a legend, prefer it.
    if (this.layer && this.layer.config && this.layer.config.glyph) {
      try {
        const plugin = GlyphRegistry.get(this.layer.config.glyph);
        if (plugin && typeof plugin.getLegend === 'function') {
          const pluginLegend = plugin.getLegend(gridData, this.layer.config, { layer: this.layer });
          if (pluginLegend) {
            // pluginLegend may be an array of legend sections or a single legend object
            if (Array.isArray(pluginLegend)) {
              LegendRenderers.renderMultiDimensional(this.element, pluginLegend, { title: this.title, ...this.renderOptions });
            } else if (pluginLegend.type) {
              // dispatch by type
              switch (pluginLegend.type) {
                case 'color-scale':
                  LegendRenderers.renderColorScale(this.element, pluginLegend, { title: this.title, ...this.renderOptions });
                  break;
                case 'categorical':
                  LegendRenderers.renderCategorical(this.element, pluginLegend, { title: this.title, ...this.renderOptions });
                  break;
                case 'temporal':
                  LegendRenderers.renderTemporal(this.element, pluginLegend, { title: this.title, ...this.renderOptions });
                  break;
                case 'size-scale':
                  LegendRenderers.renderSizeScale(this.element, pluginLegend, { title: this.title, ...this.renderOptions });
                  break;
                default:
                  // If unknown, try multi renderer with single section
                  LegendRenderers.renderMultiDimensional(this.element, [pluginLegend], { title: this.title, ...this.renderOptions });
              }
            } else if (typeof pluginLegend === 'string') {
              // Allow plugin to return HTML snippet
              this.element.innerHTML = pluginLegend;
            } else {
              // Fallback: try to stringify
              this.element.innerHTML = `<div class="glyph-legend-title">${this.title}</div><pre>${JSON.stringify(pluginLegend, null, 2)}</pre>`;
            }

            return; // plugin provided legend rendered — exit
          }
        }
      } catch (e) {
        Logger.error('Legend: plugin.getLegend threw an error:', e);
      }
    }

    // Determine legend type
    let legendType = this.type;
    if (legendType === 'auto') {
      legendType = LegendDataExtractor.detectLegendType(config, gridData);
    }

    // Extract legend data
    let legendData = null;

    switch (legendType) {
      case 'color-scale':
        legendData = LegendDataExtractor.extractColorScale(config, gridData);
        if (legendData) {
          LegendRenderers.renderColorScale(this.element, legendData, {
            title: this.title,
            ...this.renderOptions
          });
        }
        break;

      case 'categorical':
        if (!this.categoryExtractor) {
          Logger.warn('Legend: categoryExtractor required for categorical legend');
          return;
        }
        legendData = LegendDataExtractor.extractCategorical(
          gridData,
          this.categoryExtractor,
          this.valueExtractor
        );
        if (legendData) {
          LegendRenderers.renderCategorical(this.element, legendData, {
            title: this.title,
            ...this.renderOptions
          });
        }
        break;

      case 'temporal':
        if (!this.timeExtractor) {
          Logger.warn('Legend: timeExtractor required for temporal legend');
          return;
        }
        legendData = LegendDataExtractor.extractTemporal(
          gridData,
          this.timeExtractor,
          this.valueExtractor
        );
        if (legendData) {
          LegendRenderers.renderTemporal(this.element, legendData, {
            title: this.title,
            ...this.renderOptions
          });
        }
        break;

      case 'size-scale':
        if (!this.sizeExtractor) {
          Logger.warn('Legend: sizeExtractor required for size-scale legend');
          return;
        }
        legendData = LegendDataExtractor.extractSizeScale(gridData, this.sizeExtractor);
        if (legendData) {
          LegendRenderers.renderSizeScale(this.element, legendData, {
            title: this.title,
            ...this.renderOptions
          });
        }
        break;

      case 'multi':
        // Multi-dimensional legend - extract multiple types
        const legendDataArray = [];
        
        // Always include color scale if available
        const colorData = LegendDataExtractor.extractColorScale(config, gridData);
        if (colorData) legendDataArray.push(colorData);

        // Add other types if extractors provided
        if (this.categoryExtractor) {
          const catData = LegendDataExtractor.extractCategorical(
            gridData,
            this.categoryExtractor,
            this.valueExtractor
          );
          if (catData) legendDataArray.push(catData);
        }

        if (this.timeExtractor) {
          const tempData = LegendDataExtractor.extractTemporal(
            gridData,
            this.timeExtractor,
            this.valueExtractor
          );
          if (tempData) legendDataArray.push(tempData);
        }

        if (legendDataArray.length > 0) {
          LegendRenderers.renderMultiDimensional(this.element, legendDataArray, {
            title: this.title,
            ...this.renderOptions
          });
        }
        break;

      default:
        Logger.warn(`Legend: Unknown legend type: ${legendType}`);
    }
  }

  /**
   * Show the legend
   */
  show() {
    if (this.element) {
      this.element.style.display = 'block';
    }
  }

  /**
   * Hide the legend
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Remove the legend from DOM
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  /**
   * Update legend position
   * @param {string} position - New position
   */
  setPosition(position) {
    this.position = position;
    this._applyPosition();
  }

  /**
   * Update legend title
   * @param {string} title - New title
   */
  setTitle(title) {
    this.title = title;
    if (this.gridData && this.config) {
      this.update(this.gridData, this.config);
    }
  }
}

