/**
 * The grammar validator is now part of the library (single source of truth).
 * This module re-exports it so the prototype and the React app keep working
 * unchanged. See src/grammar/ for the schemas, validator, and spec compiler.
 */
export { validateSpec, validateAssistantProposal, SPEC_VERSION } from '../../../src/grammar/validateSpec.js';
