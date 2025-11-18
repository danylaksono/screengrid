/**
 * DataUtilities.js
 * Minimal utility functions for extracting and processing cellData
 * These are pure functions that help with common patterns mentioned in the design docs
 */

/**
 * Extract and aggregate values by a key from cellData
 * Useful for category breakdowns (pie charts, bar charts)
 * @param {Array} cellData - Array of {data, weight, ...}
 * @param {Function|string} keyExtractor - Function to extract key from data, or property name
 * @param {Function|string} valueExtractor - Function to extract value from data, or property name (default: weight)
 * @param {Function} aggregator - Aggregation function (default: sum)
 * @returns {Map} Map of key -> aggregated value
 */
export function groupBy(cellData, keyExtractor, valueExtractor = null, aggregator = null) {
  if (!cellData || cellData.length === 0) return new Map();

  const getKey = typeof keyExtractor === 'string' 
    ? (item) => item.data[keyExtractor]
    : keyExtractor;

  const getValue = valueExtractor === null
    ? (item) => item.weight || 0
    : typeof valueExtractor === 'string'
    ? (item) => item.data[valueExtractor] || 0
    : valueExtractor;

  const aggFn = aggregator || ((values) => values.reduce((sum, v) => sum + v, 0));

  const groups = new Map();
  
  cellData.forEach(item => {
    const key = getKey(item);
    if (key == null) return;
    
    const value = getValue(item);
    if (value == null || isNaN(value)) return;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(value);
  });

  // Aggregate each group
  const result = new Map();
  groups.forEach((values, key) => {
    result.set(key, aggFn(values));
  });

  return result;
}

/**
 * Extract multiple attributes from cellData
 * Useful for multi-attribute aggregation
 * @param {Array} cellData - Array of {data, weight, ...}
 * @param {Object} extractors - Object mapping attribute names to extractor functions or property names
 * @returns {Object} Object with extracted attributes aggregated (sum by default)
 * 
 * @example
 * extractAttributes(cellData, {
 *   total: (item) => item.weight,
 *   count: () => 1,
 *   avg: (item) => item.data.value,
 *   category: (item) => item.data.category
 * })
 */
export function extractAttributes(cellData, extractors) {
  if (!cellData || cellData.length === 0) return {};

  const result = {};
  const aggregators = {};

  // Initialize result structure
  Object.keys(extractors).forEach(key => {
    const extractor = extractors[key];
    if (typeof extractor === 'function') {
      // For numeric extractors, sum by default
      result[key] = 0;
      aggregators[key] = (values) => values.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    } else {
      // For property names, collect values
      result[key] = [];
      aggregators[key] = (values) => values;
    }
  });

  // Extract values
  cellData.forEach(item => {
    Object.keys(extractors).forEach(key => {
      const extractor = extractors[key];
      let value;

      if (typeof extractor === 'function') {
        value = extractor(item);
      } else if (typeof extractor === 'string') {
        value = item.data[extractor];
      }

      if (value != null) {
        if (typeof result[key] === 'number') {
          // Only add if value is a number
          if (typeof value === 'number' && !isNaN(value)) {
            result[key] += value;
          } else {
            // Convert to array if we encounter a non-numeric value
            // Only include the current numeric value if it's not zero (initial state)
            result[key] = result[key] !== 0 ? [result[key]] : [];
            result[key].push(value);
          }
        } else if (Array.isArray(result[key])) {
          result[key].push(value);
        }
      }
    });
  });

  return result;
}

/**
 * Compute basic statistics from cellData values
 * Useful for uncertainty encoding and statistical glyphs
 * @param {Array} cellData - Array of {data, weight, ...}
 * @param {Function|string} valueExtractor - Function to extract value, or property name (default: weight)
 * @returns {Object} Statistics: {mean, std, min, max, count, sum}
 */
export function computeStats(cellData, valueExtractor = null) {
  if (!cellData || cellData.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, count: 0, sum: 0 };
  }

  const getValue = valueExtractor === null
    ? (item) => item.weight || 0
    : typeof valueExtractor === 'string'
    ? (item) => item.data[valueExtractor] || 0
    : valueExtractor;

  const values = cellData
    .map(getValue)
    .filter(v => v != null && !isNaN(v) && typeof v === 'number');

  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, count: 0, sum: 0 };
  }

  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { mean, std, min, max, count: values.length, sum };
}

/**
 * Group cellData by time periods
 * Useful for temporal glyphs (time series, helix glyphs)
 * @param {Array} cellData - Array of {data, weight, ...}
 * @param {Function|string} timeExtractor - Function to extract time from data, or property name
 * @param {Function|string} valueExtractor - Function to extract value, or property name (default: weight)
 * @param {string} period - Time period: 'year', 'month', 'day', 'hour' (default: 'year')
 * @param {Function} aggregator - Aggregation function per period (default: sum)
 * @returns {Array} Array of {time, value} objects sorted by time
 */
export function groupByTime(cellData, timeExtractor, valueExtractor = null, period = 'year', aggregator = null) {
  if (!cellData || cellData.length === 0) return [];

  const getTime = typeof timeExtractor === 'string'
    ? (item) => item.data[timeExtractor]
    : timeExtractor;

  const getValue = valueExtractor === null
    ? (item) => item.weight || 0
    : typeof valueExtractor === 'string'
    ? (item) => item.data[valueExtractor] || 0
    : valueExtractor;

  const aggFn = aggregator || ((values) => values.reduce((sum, v) => sum + v, 0));

  // Extract time period from date/time value
  const getPeriod = (timeValue) => {
    if (typeof timeValue === 'number') {
      // Assume it's a timestamp or year
      const date = new Date(timeValue);
      if (isNaN(date.getTime())) {
        // Not a valid date, assume it's a year
        return period === 'year' ? timeValue : null;
      }
      
      switch (period) {
        case 'year': return date.getFullYear();
        case 'month': return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        case 'day': return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        case 'hour': return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
        default: return timeValue;
      }
    }
    return timeValue;
  };

  const groups = new Map();

  cellData.forEach(item => {
    const timeValue = getTime(item);
    if (timeValue == null) return;

    const periodKey = getPeriod(timeValue);
    if (periodKey == null) return;

    const value = getValue(item);
    if (value == null || isNaN(value)) return;

    if (!groups.has(periodKey)) {
      groups.set(periodKey, []);
    }
    groups.get(periodKey).push(value);
  });

  // Aggregate and convert to array
  const result = Array.from(groups.entries())
    .map(([time, values]) => ({
      time: time,
      value: aggFn(values)
    }))
    .sort((a, b) => {
      // Sort by time value (handle both numbers and strings)
      if (typeof a.time === 'number' && typeof b.time === 'number') {
        return a.time - b.time;
      }
      return String(a.time).localeCompare(String(b.time));
    });

  return result;
}

