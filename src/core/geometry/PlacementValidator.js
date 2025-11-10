/**
 * PlacementValidator.js
 * Validates placement configuration according to PLACEMENT_CONFIG.md rules
 */

export class PlacementValidator {
  /**
   * Validate placement configuration
   * @param {Object} config - Full layer config
   * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
   */
  static validate(config) {
    const errors = [];
    const warnings = [];

    // Check mutual exclusivity: data+getPosition vs source+placement
    const hasDataPath = config.data && Array.isArray(config.data) && config.data.length > 0 && typeof config.getPosition === 'function';
    const hasSourcePath = config.source && config.placement;

    if (hasDataPath && hasSourcePath) {
      errors.push('Invalid config: Provide either `data`/`getPosition` or `source`/`placement`, not both.');
      return { valid: false, errors, warnings };
    }

    // If source is provided, validate placement config
    if (config.source) {
      if (!config.placement || !config.placement.strategy) {
        errors.push('Invalid placement: `placement.strategy` is required when `source` is provided.');
        return { valid: false, errors, warnings };
      }

      const placement = config.placement;
      const strategy = placement.strategy;

      // Validate strategy-specific requirements
      const strategyErrors = PlacementValidator._validateStrategy(strategy, placement);
      errors.push(...strategyErrors);

      // Validate spacing if present
      if (placement.spacing) {
        const spacingErrors = PlacementValidator._validateSpacing(placement.spacing);
        errors.push(...spacingErrors);
      }

      // Validate numeric bounds
      if (placement.maxPerFeature !== undefined) {
        if (!Number.isInteger(placement.maxPerFeature) || placement.maxPerFeature < 1) {
          errors.push(`Invalid value: \`maxPerFeature\` must be an integer >= 1.`);
        } else if (placement.maxPerFeature > 10000) {
          warnings.push(`Performance warning: \`maxPerFeature\` is very high (${placement.maxPerFeature}). Consider reducing for better performance.`);
        }
      }

      if (placement.minArea !== undefined && (placement.minArea < 0 || !isFinite(placement.minArea))) {
        errors.push(`Invalid value: \`minArea\` must be >= 0 (units: m²).`);
      }

      if (placement.minLength !== undefined && (placement.minLength < 0 || !isFinite(placement.minLength))) {
        errors.push(`Invalid value: \`minLength\` must be >= 0 (units: meters).`);
      }

      if (placement.jitterPixels !== undefined && (placement.jitterPixels < 0 || !isFinite(placement.jitterPixels))) {
        errors.push(`Invalid value: \`jitterPixels\` must be >= 0.`);
      }

      if (config.anchorSizePixels != null) {
        if (typeof config.anchorSizePixels !== 'number' || !isFinite(config.anchorSizePixels) || config.anchorSizePixels <= 0) {
          errors.push(`Invalid value: \`anchorSizePixels\` must be a finite number > 0.`);
        }
      }

      // Validate partition
      if (placement.partition && !['union', 'per-part'].includes(placement.partition)) {
        errors.push(`Invalid partition: must be 'union' or 'per-part'.`);
      }

      // Double aggregation safeguard
      if (strategy === 'grid-screen' && config.renderMode === 'screen-grid') {
        warnings.push('Placement \'grid-screen\' with renderMode \'screen-grid\' may double-aggregate. Consider using renderMode \'feature-anchors\' instead.');
      }

      // Validate renderMode
      if (config.renderMode && !['screen-grid', 'feature-anchors'].includes(config.renderMode)) {
        errors.push(`Invalid renderMode: must be 'screen-grid' or 'feature-anchors'.`);
      }
    }

    // Validate source structure if provided
    if (config.source) {
      const sourceErrors = PlacementValidator._validateSource(config.source);
      errors.push(...sourceErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate strategy-specific requirements
   * @private
   */
  static _validateStrategy(strategy, placement) {
    const errors = [];
    const validStrategies = ['point', 'centroid', 'polylabel', 'line-sample', 'grid-geo', 'grid-screen'];

    if (!validStrategies.includes(strategy)) {
      errors.push(`Invalid strategy: '${strategy}'. Must be one of: ${validStrategies.join(', ')}.`);
      return errors;
    }

    // Strategy-specific validation
    switch (strategy) {
      case 'line-sample':
      case 'grid-geo':
      case 'grid-screen':
        if (!placement.spacing) {
          errors.push(`Invalid placement: \`spacing\` is required for strategy '${strategy}'.`);
        }
        break;
      case 'grid-geo':
        if (placement.spacing && !placement.spacing.meters) {
          errors.push(`Invalid placement: strategy 'grid-geo' requires \`spacing: { meters: number }\`.`);
        }
        break;
      case 'grid-screen':
        if (placement.spacing && !placement.spacing.pixels) {
          errors.push(`Invalid placement: strategy 'grid-screen' requires \`spacing: { pixels: number }\`.`);
        }
        break;
    }

    return errors;
  }

  /**
   * Validate spacing configuration
   * @private
   */
  static _validateSpacing(spacing) {
    const errors = [];

    if (typeof spacing !== 'object' || spacing === null) {
      errors.push('Invalid spacing: must be an object with `{ meters: number }` or `{ pixels: number }`.');
      return errors;
    }

    const hasMeters = 'meters' in spacing;
    const hasPixels = 'pixels' in spacing;

    if (!hasMeters && !hasPixels) {
      errors.push('Invalid spacing: Specify exactly one of `{ meters }` or `{ pixels }`.');
      return errors;
    }

    if (hasMeters && hasPixels) {
      errors.push('Invalid spacing: Specify exactly one of `{ meters }` or `{ pixels }`, not both.');
      return errors;
    }

    const value = hasMeters ? spacing.meters : spacing.pixels;
    if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
      errors.push(`Invalid spacing: value must be a finite positive number.`);
    }

    return errors;
  }

  /**
   * Validate source GeoJSON structure
   * @private
   */
  static _validateSource(source) {
    const errors = [];

    // Check if it's FeatureCollection or array of Features
    if (source.type === 'FeatureCollection') {
      if (!Array.isArray(source.features)) {
        errors.push('Invalid source: FeatureCollection must have a `features` array.');
        return errors;
      }
    } else if (Array.isArray(source)) {
      // Array of features - validate each
      source.forEach((feature, i) => {
        if (!feature || feature.type !== 'Feature') {
          errors.push(`Invalid source: item at index ${i} is not a GeoJSON Feature.`);
        }
      });
    } else if (source.type === 'Feature') {
      // Single feature - wrap it later
    } else {
      errors.push('Invalid source: must be a GeoJSON FeatureCollection, Feature, or array of Features.');
    }

    return errors;
  }

  /**
   * Normalize source to array of features
   * @param {Object} source - GeoJSON source
   * @returns {Array} Array of features
   */
  static normalizeSource(source) {
    if (source.type === 'FeatureCollection') {
      return source.features || [];
    } else if (Array.isArray(source)) {
      return source;
    } else if (source.type === 'Feature') {
      return [source];
    } else {
      return [];
    }
  }

  /**
   * Get default placement config for a strategy
   * @param {string} strategy - Placement strategy
   * @returns {Object} Default config
   */
  static getDefaultPlacementConfig(strategy) {
    const defaults = {
      strategy,
      partition: 'union',
      maxPerFeature: undefined,
      minArea: undefined,
      minLength: undefined,
      jitterPixels: undefined,
      zoomAdaptive: false,
    };

    // Strategy-specific defaults
    switch (strategy) {
      case 'line-sample':
        defaults.spacing = { meters: 200 };
        defaults.zoomAdaptive = true;
        break;
      case 'grid-geo':
        defaults.spacing = { meters: 500 };
        defaults.maxPerFeature = 1000;
        break;
      case 'grid-screen':
        defaults.spacing = { pixels: 50 };
        defaults.maxPerFeature = 500;
        break;
    }

    return defaults;
  }
}

