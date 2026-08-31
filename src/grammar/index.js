/**
 * Screengrid Grammar
 * Declarative specification, validation, and compilation for screen-space gridded
 * glyphmaps. JSON Schema contracts live in ./schemas/; validateSpec adds the
 * cross-field and cartographic rules JSON Schema cannot express; compileSpec turns
 * a spec into executable ScreenGridLayerGL options via the library's generic hooks.
 */

export { validateSpec, validateAssistantProposal, SPEC_VERSION } from './validateSpec.js';
export { compileSpec, compileDerivedMeasure, resolveParameters } from './compileSpec.js';
export { compileGlyph, colorScaleFromPalette, CATEGORICAL_COLORS } from './compileGlyph.js';
