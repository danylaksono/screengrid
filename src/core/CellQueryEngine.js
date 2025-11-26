/**
 * CellQueryEngine.js
 * Query engine for finding and accessing grid cells
 */

export class CellQueryEngine {
  /**
   * Get cell information at a specific point
   * @param {Object} aggregationResult - Result from Aggregator.aggregate()
   * @param {Object} point - {x, y} coordinates
   * @returns {Object|null} Cell info: {col, row, value, cellData, x, y} or null
   */
  static getCellAt(aggregationResult, point) {
    if (!aggregationResult) return null;

    const { grid, cellData, cols, rows, cellSizePixels } = aggregationResult;
    const col = Math.floor(point.x / cellSizePixels);
    const row = Math.floor(point.y / cellSizePixels);

    // Bounds check
    if (col < 0 || col >= cols || row < 0 || row >= rows) {
      return null;
    }

    const idx = row * cols + col;
    return {
      col,
      row,
      value: grid[idx],
      cellData: cellData[idx],
      x: col * cellSizePixels,
      y: row * cellSizePixels,
      cellSize: cellSizePixels,
      index: idx,
    };
  }

  /**
   * Get all cells with data in a rectangular region
   * @param {Object} aggregationResult - Aggregation result
   * @param {Object} bounds - {minX, minY, maxX, maxY}
   * @returns {Array} Array of cell info objects
   */
  static getCellsInBounds(aggregationResult, bounds) {
    if (!aggregationResult) return [];

    const { grid, cellData, cols, rows, cellSizePixels } = aggregationResult;
    const minCol = Math.floor(bounds.minX / cellSizePixels);
    const minRow = Math.floor(bounds.minY / cellSizePixels);
    const maxCol = Math.floor(bounds.maxX / cellSizePixels);
    const maxRow = Math.floor(bounds.maxY / cellSizePixels);

    const cells = [];

    for (let row = Math.max(0, minRow); row <= Math.min(rows - 1, maxRow); row++) {
      for (let col = Math.max(0, minCol); col <= Math.min(cols - 1, maxCol); col++) {
        const idx = row * cols + col;
        if (grid[idx] > 0) {
          cells.push({
            col,
            row,
            value: grid[idx],
            cellData: cellData[idx],
            x: col * cellSizePixels,
            y: row * cellSizePixels,
            cellSize: cellSizePixels,
            index: idx,
          });
        }
      }
    }

    return cells;
  }

  /**
   * Get all cells with data values above a threshold
   * @param {Object} aggregationResult - Aggregation result
   * @param {number} threshold - Minimum value
   * @returns {Array} Array of cell info objects
   */
  static getCellsAboveThreshold(aggregationResult, threshold) {
    if (!aggregationResult) return [];

    const { grid, cellData, cols, rows, cellSizePixels } = aggregationResult;
    const cells = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (grid[idx] >= threshold) {
          cells.push({
            col,
            row,
            value: grid[idx],
            cellData: cellData[idx],
            x: col * cellSizePixels,
            y: row * cellSizePixels,
            cellSize: cellSizePixels,
            index: idx,
          });
        }
      }
    }

    return cells;
  }

  /**
   * Get all cells that contain data points matching an attribute filter
   * @param {Object} aggregationResult - Aggregation result
   * @param {Function} filterFn - Filter function: (dataPoint) => boolean
   *   Receives the original data point object from cellData[].data
   * @returns {Array} Array of cell info objects
   * 
   * @example
   * // Filter cells containing restaurants with rating > 4
   * const cells = CellQueryEngine.getCellsByAttribute(
   *   aggregationResult,
   *   (data) => data.rating > 4
   * );
   * 
   * @example
   * // Filter cells containing points in a specific category
   * const cells = CellQueryEngine.getCellsByAttribute(
   *   aggregationResult,
   *   (data) => data.category === 'restaurant'
   * );
   */
  static getCellsByAttribute(aggregationResult, filterFn) {
    if (!aggregationResult) return [];
    if (typeof filterFn !== 'function') {
      throw new Error('CellQueryEngine.getCellsByAttribute: filterFn must be a function');
    }

    const { grid, cellData, cols, rows, cellSizePixels } = aggregationResult;
    const cells = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const cellDataArray = cellData[idx];
        
        // Skip empty cells
        if (!cellDataArray || cellDataArray.length === 0) continue;
        
        // Check if any data point in the cell matches the filter
        const hasMatch = cellDataArray.some(item => {
          try {
            return filterFn(item.data);
          } catch (e) {
            // If filter function throws, skip this item
            return false;
          }
        });

        if (hasMatch) {
          cells.push({
            col,
            row,
            value: grid[idx],
            cellData: cellDataArray,
            x: col * cellSizePixels,
            y: row * cellSizePixels,
            cellSize: cellSizePixels,
            index: idx,
          });
        }
      }
    }

    return cells;
  }

  /**
   * Get all cells that contain data points within a time range
   * @param {Object} aggregationResult - Aggregation result
   * @param {Function|string} timeExtractor - Function to extract time from data point, or property name
   *   If function: (dataPoint) => number|Date
   *   If string: property name to access (e.g., 'year', 'timestamp')
   * @param {number|Date} minTime - Minimum time (inclusive)
   * @param {number|Date} maxTime - Maximum time (inclusive)
   * @returns {Array} Array of cell info objects
   * 
   * @example
   * // Filter cells with data from 2020-2022
   * const cells = CellQueryEngine.getCellsByTimeRange(
   *   aggregationResult,
   *   (data) => data.year,
   *   2020,
   *   2022
   * );
   * 
   * @example
   * // Using property name
   * const cells = CellQueryEngine.getCellsByTimeRange(
   *   aggregationResult,
   *   'timestamp',
   *   new Date('2020-01-01'),
   *   new Date('2022-12-31')
   * );
   */
  static getCellsByTimeRange(aggregationResult, timeExtractor, minTime, maxTime) {
    if (!aggregationResult) return [];
    if (minTime == null || maxTime == null) {
      throw new Error('CellQueryEngine.getCellsByTimeRange: minTime and maxTime are required');
    }

    // Normalize time extractor
    const getTime = typeof timeExtractor === 'string'
      ? (item) => item.data[timeExtractor]
      : timeExtractor;

    if (typeof getTime !== 'function') {
      throw new Error('CellQueryEngine.getCellsByTimeRange: timeExtractor must be a function or string');
    }

    // Normalize times to numbers for comparison
    const minTimeNum = minTime instanceof Date ? minTime.getTime() : Number(minTime);
    const maxTimeNum = maxTime instanceof Date ? maxTime.getTime() : Number(maxTime);

    if (isNaN(minTimeNum) || isNaN(maxTimeNum)) {
      throw new Error('CellQueryEngine.getCellsByTimeRange: minTime and maxTime must be valid numbers or Dates');
    }

    const { grid, cellData, cols, rows, cellSizePixels } = aggregationResult;
    const cells = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const cellDataArray = cellData[idx];
        
        // Skip empty cells
        if (!cellDataArray || cellDataArray.length === 0) continue;
        
        // Check if any data point in the cell falls within the time range
        const hasMatch = cellDataArray.some(item => {
          try {
            const timeValue = getTime(item);
            if (timeValue == null) return false;
            
            // Normalize extracted time to number
            const timeNum = timeValue instanceof Date 
              ? timeValue.getTime() 
              : Number(timeValue);
            
            if (isNaN(timeNum)) return false;
            
            return timeNum >= minTimeNum && timeNum <= maxTimeNum;
          } catch (e) {
            // If extraction throws, skip this item
            return false;
          }
        });

        if (hasMatch) {
          cells.push({
            col,
            row,
            value: grid[idx],
            cellData: cellDataArray,
            x: col * cellSizePixels,
            y: row * cellSizePixels,
            cellSize: cellSizePixels,
            index: idx,
          });
        }
      }
    }

    return cells;
  }

  /**
   * Get all cells that match multiple filter criteria
   * Combines multiple filter types (attribute, time, spatial, value threshold)
   * @param {Object} aggregationResult - Aggregation result
   * @param {Object} filters - Filter configuration object
   * @param {Function} filters.attribute - Attribute filter function: (dataPoint) => boolean
   * @param {Object} filters.time - Time range filter: {extractor: Function|string, min: number|Date, max: number|Date}
   * @param {Object} filters.bounds - Spatial bounds filter: {minX, minY, maxX, maxY}
   * @param {number} filters.threshold - Value threshold filter (minimum aggregated value)
   * @param {string} filters.matchMode - How to combine filters: 'all' (AND) or 'any' (OR), default: 'all'
   * @returns {Array} Array of cell info objects
   * 
   * @example
   * // Filter cells matching ALL criteria: high value, in bounds, from 2020-2022
   * const cells = CellQueryEngine.getCellsByMultipleFilters(aggregationResult, {
   *   threshold: 50,
   *   bounds: { minX: 0, minY: 0, maxX: 400, maxY: 300 },
   *   time: {
   *     extractor: (data) => data.year,
   *     min: 2020,
   *     max: 2022
   *   },
   *   matchMode: 'all'
   * });
   * 
   * @example
   * // Filter cells matching ANY criteria: high value OR in specific category
   * const cells = CellQueryEngine.getCellsByMultipleFilters(aggregationResult, {
   *   threshold: 100,
   *   attribute: (data) => data.category === 'restaurant',
   *   matchMode: 'any'
   * });
   */
  static getCellsByMultipleFilters(aggregationResult, filters) {
    if (!aggregationResult) return [];
    if (!filters || typeof filters !== 'object') {
      throw new Error('CellQueryEngine.getCellsByMultipleFilters: filters must be an object');
    }

    const matchMode = filters.matchMode || 'all';
    if (matchMode !== 'all' && matchMode !== 'any') {
      throw new Error('CellQueryEngine.getCellsByMultipleFilters: matchMode must be "all" or "any"');
    }

    const { grid, cellData, cols, rows, cellSizePixels } = aggregationResult;
    const cells = [];

    // Pre-compute spatial bounds if provided
    let spatialBounds = null;
    if (filters.bounds) {
      const { minX, minY, maxX, maxY } = filters.bounds;
      spatialBounds = {
        minCol: Math.floor(minX / cellSizePixels),
        minRow: Math.floor(minY / cellSizePixels),
        maxCol: Math.floor(maxX / cellSizePixels),
        maxRow: Math.floor(maxY / cellSizePixels),
      };
    }

    // Pre-compute time range if provided
    let timeFilter = null;
    if (filters.time) {
      const { extractor, min, max } = filters.time;
      const getTime = typeof extractor === 'string'
        ? (item) => item.data[extractor]
        : extractor;
      
      const minTimeNum = min instanceof Date ? min.getTime() : Number(min);
      const maxTimeNum = max instanceof Date ? max.getTime() : Number(max);
      
      timeFilter = { getTime, minTimeNum, maxTimeNum };
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const cellDataArray = cellData[idx];
        
        // Skip empty cells
        if (!cellDataArray || cellDataArray.length === 0) continue;

        const matchResults = [];

        // Check spatial bounds filter
        if (spatialBounds) {
          const inBounds = col >= spatialBounds.minCol && 
                          col <= spatialBounds.maxCol &&
                          row >= spatialBounds.minRow && 
                          row <= spatialBounds.maxRow;
          matchResults.push(inBounds);
        }

        // Check value threshold filter
        if (filters.threshold != null) {
          matchResults.push(grid[idx] >= filters.threshold);
        }

        // Check attribute filter
        if (filters.attribute) {
          const hasAttributeMatch = cellDataArray.some(item => {
            try {
              return filters.attribute(item.data);
            } catch (e) {
              return false;
            }
          });
          matchResults.push(hasAttributeMatch);
        }

        // Check time range filter
        if (timeFilter) {
          const hasTimeMatch = cellDataArray.some(item => {
            try {
              const timeValue = timeFilter.getTime(item);
              if (timeValue == null) return false;
              const timeNum = timeValue instanceof Date 
                ? timeValue.getTime() 
                : Number(timeValue);
              if (isNaN(timeNum)) return false;
              return timeNum >= timeFilter.minTimeNum && timeNum <= timeFilter.maxTimeNum;
            } catch (e) {
              return false;
            }
          });
          matchResults.push(hasTimeMatch);
        }

        // If no filters were applied, skip
        if (matchResults.length === 0) continue;

        // Determine if cell matches based on matchMode
        const matches = matchMode === 'all'
          ? matchResults.every(result => result === true)
          : matchResults.some(result => result === true);

        if (matches) {
          cells.push({
            col,
            row,
            value: grid[idx],
            cellData: cellDataArray,
            x: col * cellSizePixels,
            y: row * cellSizePixels,
            cellSize: cellSizePixels,
            index: idx,
          });
        }
      }
    }

    return cells;
  }

  /**
   * Instance method for convenience
   */
  constructor(aggregationResult = null) {
    this.aggregationResult = aggregationResult;
  }

  /**
   * Set the aggregation result
   * @param {Object} aggregationResult - Result from aggregation
   */
  setAggregationResult(aggregationResult) {
    this.aggregationResult = aggregationResult;
  }

  /**
   * Query cell at point using stored result
   * @param {Object} point - {x, y}
   * @returns {Object|null} Cell info
   */
  getCellAt(point) {
    return CellQueryEngine.getCellAt(this.aggregationResult, point);
  }

  /**
   * Query cells in bounds
   * @param {Object} bounds - Bounding rectangle
   * @returns {Array} Cells in bounds
   */
  getCellsInBounds(bounds) {
    return CellQueryEngine.getCellsInBounds(this.aggregationResult, bounds);
  }

  /**
   * Query cells above threshold
   * @param {number} threshold - Threshold value
   * @returns {Array} Cells above threshold
   */
  getCellsAboveThreshold(threshold) {
    return CellQueryEngine.getCellsAboveThreshold(this.aggregationResult, threshold);
  }

  /**
   * Query cells by attribute filter using stored result
   * @param {Function} filterFn - Filter function: (dataPoint) => boolean
   * @returns {Array} Cells matching attribute filter
   */
  getCellsByAttribute(filterFn) {
    return CellQueryEngine.getCellsByAttribute(this.aggregationResult, filterFn);
  }

  /**
   * Query cells by time range using stored result
   * @param {Function|string} timeExtractor - Time extractor function or property name
   * @param {number|Date} minTime - Minimum time (inclusive)
   * @param {number|Date} maxTime - Maximum time (inclusive)
   * @returns {Array} Cells within time range
   */
  getCellsByTimeRange(timeExtractor, minTime, maxTime) {
    return CellQueryEngine.getCellsByTimeRange(this.aggregationResult, timeExtractor, minTime, maxTime);
  }

  /**
   * Query cells by multiple filters using stored result
   * @param {Object} filters - Filter configuration object
   * @returns {Array} Cells matching filters
   */
  getCellsByMultipleFilters(filters) {
    return CellQueryEngine.getCellsByMultipleFilters(this.aggregationResult, filters);
  }
}
