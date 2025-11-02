/**
 * ScreenGrid Library
 * Main entry point
 */

// Main class
export { ScreenGridLayerGL } from './ScreenGridLayerGL.js';

// Core modules
export { Aggregator } from './core/Aggregator.js';
export { Projector } from './core/Projector.js';
export { CellQueryEngine } from './core/CellQueryEngine.js';

// Canvas modules
export { CanvasManager } from './canvas/CanvasManager.js';
export { Renderer } from './canvas/Renderer.js';

// Event modules
export { EventBinder } from './events/EventBinder.js';
export { EventHandlers } from './events/EventHandlers.js';

// Glyph utilities
export { GlyphUtilities } from './glyphs/GlyphUtilities.js';
// Glyph plugin registry
export { GlyphRegistry } from './glyphs/GlyphRegistry.js';

// Configuration
export { ConfigManager } from './config/ConfigManager.js';

// Legend module
export { Legend } from './legend/Legend.js';
export { LegendDataExtractor } from './legend/LegendDataExtractor.js';
export { LegendRenderers } from './legend/LegendRenderers.js';
