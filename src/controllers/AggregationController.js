/**
 * AggregationController.js
 * Coordinates aggregation mode lifecycle, aggregation, rendering, and stats.
 */

import { AggregationModeRegistry } from '../aggregation/AggregationModeRegistry.js';
import '../aggregation/modes/index.js';
import { Logger } from '../utils/Logger.js';

export class AggregationController {
  constructor() {
    this.modePlugin = null;
    this.modeInstance = null;
  }

  init(config, map) {
    const modeName = config.aggregationMode || 'screen-grid';
    const modePlugin = AggregationModeRegistry.get(modeName);

    if (!modePlugin) {
      const error = `AggregationModeRegistry: mode "${modeName}" not found. Available modes: ${AggregationModeRegistry.list().join(', ')}`;
      Logger.error('[AggregationController]', error);
      throw new Error(error);
    }

    this.modePlugin = modePlugin;

    if (typeof modePlugin.init === 'function') {
      try {
        this.modeInstance = modePlugin.init(
          config.aggregationModeConfig || {},
          map
        );
      } catch (error) {
        Logger.error(`[AggregationController] AggregationMode "${modeName}" init failed:`, error);
        this.modeInstance = null;
      }
    }
  }

  destroy() {
    if (this.modeInstance && typeof this.modeInstance.destroy === 'function') {
      try {
        this.modeInstance.destroy();
      } catch (error) {
        Logger.error('Error destroying aggregation mode instance:', error);
      }
    }

    this.modeInstance = null;
    this.modePlugin = null;
  }

  ensureMode(config, map) {
    if (!this.modePlugin) {
      this.init(config, map);
    }

    return this.modePlugin;
  }

  aggregate(data, getPosition, getWeight, map, config, displaySize) {
    const modePlugin = this.ensureMode(config, map);
    const modeConfig = {
      ...config.aggregationModeConfig,
      cellSizePixels: config.cellSizePixels,
      displaySize,
      aggregationFunction: config.aggregationFunction,
      onAfterAggregate: config.onAfterAggregate,
    };

    const gridData = modePlugin.aggregate(
      data,
      getPosition,
      getWeight,
      map,
      modeConfig
    );

    if (gridData && config.aggregationModeConfig) {
      gridData.aggregationModeConfig = config.aggregationModeConfig;
    }

    return gridData;
  }

  render(gridData, ctx, config, map) {
    const modePlugin = this.ensureMode(config, map);
    modePlugin.render(gridData, ctx, config, map);
  }

  getCellAt(point, gridData, map) {
    if (!gridData || !this.modePlugin) {
      return null;
    }

    return this.modePlugin.getCellAt(point, gridData, map);
  }

  getStats(gridData, fallbackAggregator) {
    if (!gridData) return null;

    if (this.modePlugin && typeof this.modePlugin.getStats === 'function') {
      return this.modePlugin.getStats(gridData);
    }

    return fallbackAggregator.getStats(gridData);
  }

  needsUpdateOnMove() {
    return this.modePlugin?.needsUpdateOnMove?.() ?? true;
  }

  needsUpdateOnZoom() {
    return this.modePlugin?.needsUpdateOnZoom?.() ?? true;
  }

  isScreenSpace() {
    return this.modePlugin?.type === 'screen-space';
  }
}
