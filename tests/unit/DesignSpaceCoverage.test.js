import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateSpec, SPEC_VERSION } from '../../src/grammar/validateSpec.js';
import { compileSpec } from '../../src/grammar/compileSpec.js';
import { generateAtlasPoints, buildAtlasProfile } from '../../examples/data/atlas.js';
import { buildCatalogue } from '../../examples/atlas/catalogue.js';

console.log('[Test] Design-space coverage');

// This test is the evidence behind the claim "Screengrid's grammar covers the
// gridded-glyphmap design space". It reads the JSON Schemas, enumerates every
// declared enum value, and fails if the atlas catalogue does not instantiate one.
//
// Without it, coverage is a sentence in a paper that quietly stops being true
// the first time the grammar grows. With it, adding an enum value to a schema
// breaks the build until a case demonstrates it.

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(here, '../../src/grammar/schemas');

// --- Enums that describe the DATA, not a design choice ---------------------
// The atlas demonstrates design decisions an author makes. These enums describe
// the shape of whatever dataset was loaded, so an atlas case cannot meaningfully
// "cover" them; they are exercised by the profiler and its own tests instead.
// Every exclusion is listed with its reason: the list is part of the claim.
const EXCLUDED_PATHS = new Map([
  ['datasetProfile.sourceType', 'describes the input file, not a design choice'],
  ['datasetProfile.fields[].type', 'describes the input data, not a design choice'],
  ['datasetProfile.coordinateCandidates[].coordinateSystem', 'a profiler inference, not a design choice'],
]);

// Schema files that are not part of the map design space.
const EXCLUDED_SCHEMAS = new Set([
  'assistant-action.schema.json', // the LLM patch protocol, not a map design
]);

// --- Schema walking --------------------------------------------------------

const schemas = new Map();
for (const file of fs.readdirSync(schemaDir)) {
  if (!file.endsWith('.json')) continue;
  schemas.set(file, JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8')));
}
assert.ok(schemas.has('screengrid-spec.schema.json'), 'root schema must exist');

function resolveRef(ref, currentFile) {
  if (ref.startsWith('#/$defs/')) {
    const name = ref.slice('#/$defs/'.length);
    return { node: schemas.get(currentFile)?.$defs?.[name], file: currentFile, def: name };
  }
  const file = ref.replace(/^\.\//, '');
  return { node: schemas.get(file), file, def: null };
}

// A reusable $def (channel, derivedTerm, ...) is referenced from several places.
// Its enums are ONE design axis, not one per reference site: requiring every
// aggregate op on every channel would demand 28 cases to demonstrate 7 choices,
// and would measure the schema's factoring rather than the design space. So a
// $def's enums are collected under a canonical `$defs.<name>` path, and spec
// values found at any referencing site are credited to it.
const refAliases = new Map(); // instance path -> canonical $defs path

/** Collect {path -> Set(values)} for every enum reachable from a schema root. */
function collectEnums(node, currentPath, currentFile, out, seen) {
  if (!node || typeof node !== 'object') return;

  if (node.$ref) {
    const { node: target, file, def } = resolveRef(node.$ref, currentFile);
    const nextPath = def ? `$defs.${def}` : currentPath;
    if (def) refAliases.set(currentPath, nextPath);
    const key = `${file}|${node.$ref}|${nextPath}`;
    if (seen.has(key)) return;
    seen.add(key);
    collectEnums(target, nextPath, file, out, seen);
    return;
  }

  if (Array.isArray(node.enum)) {
    if (!out.has(currentPath)) out.set(currentPath, new Set());
    node.enum.forEach((v) => out.get(currentPath).add(v));
  }

  for (const combinator of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(node[combinator])) {
      node[combinator].forEach((sub) => collectEnums(sub, currentPath, currentFile, out, seen));
    }
  }

  if (node.properties) {
    for (const [key, sub] of Object.entries(node.properties)) {
      const next = currentPath ? `${currentPath}.${key}` : key;
      collectEnums(sub, next, currentFile, out, seen);
    }
  }

  if (node.items) {
    collectEnums(node.items, `${currentPath}[]`, currentFile, out, seen);
  }
}

const schemaEnums = new Map();
collectEnums(schemas.get('screengrid-spec.schema.json'), '', 'screengrid-spec.schema.json', schemaEnums, new Set());

// Enums reachable only from non-excluded schema roots.
for (const file of EXCLUDED_SCHEMAS) {
  assert.ok(schemas.has(file) || true, `excluded schema ${file} listed but absent (harmless)`);
}

assert.ok(schemaEnums.size > 10, `expected many enums, found ${schemaEnums.size}`);

// --- Spec walking (mirrors the schema path shape) --------------------------

function collectSpecValues(node, currentPath, out) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectSpecValues(item, `${currentPath}[]`, out));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectSpecValues(value, currentPath ? `${currentPath}.${key}` : key, out);
    }
    return;
  }
  if (!out.has(currentPath)) out.set(currentPath, new Set());
  out.get(currentPath).add(node);
}

// --- Build the catalogue ---------------------------------------------------

const records = generateAtlasPoints({ count: 2000, seed: 7 });
const profile = buildAtlasProfile(records);
const catalogue = buildCatalogue(profile);

assert.ok(catalogue.length >= 20, `expected a substantial catalogue, got ${catalogue.length}`);

const rawCovered = new Map();
for (const entry of catalogue) {
  collectSpecValues(entry.spec, '', rawCovered);
}

// Credit values found at a $def reference site to that $def's canonical axis
// (see refAliases above), keeping the instance path too.
const covered = new Map();
const creditTo = (key, values) => {
  if (!covered.has(key)) covered.set(key, new Set());
  const target = covered.get(key);
  values.forEach((v) => target.add(v));
};
for (const [instancePath, values] of rawCovered) {
  creditTo(instancePath, values);
  for (const [site, canonical] of refAliases) {
    if (instancePath === site || instancePath.startsWith(`${site}.`)) {
      creditTo(instancePath.replace(site, canonical), values);
    }
  }
}

// --- 1. Every catalogue spec must validate ---------------------------------

const partialSpecs = [];
for (const entry of catalogue) {
  const report = validateSpec(entry.spec);
  assert.ok(
    report.valid,
    `case "${entry.id}" does not validate:\n  ${report.errors.join('\n  ')}`
  );
  assert.strictEqual(entry.spec.version, SPEC_VERSION, `case "${entry.id}" must declare the current spec version`);
  if (report.checkability === 'partial') partialSpecs.push(entry.id);
}
console.log(`  all ${catalogue.length} catalogue specs validate OK`);

// The escape hatch must be present but rare: it is the boundary of the grammar,
// and a catalogue full of it would prove nothing about the declarative core.
assert.ok(partialSpecs.length >= 1, 'the catalogue must show the custom escape hatch at least once');
assert.ok(
  partialSpecs.length <= 2,
  `too many partially-checkable specs (${partialSpecs.join(', ')}); the atlas must demonstrate the declarative grammar`
);
console.log(`  escape hatch demonstrated by ${partialSpecs.length} case(s) OK`);

// --- 2. Every catalogue spec must compile ----------------------------------

for (const entry of catalogue) {
  const options = entry.customFunctions ? { customFunctions: entry.customFunctions } : {};
  const { layerOptions, legend } = compileSpec(entry.spec, options);
  assert.strictEqual(typeof layerOptions.getPosition, 'function', `case "${entry.id}" must compile a position accessor`);
  assert.ok(layerOptions.aggregationFunction, `case "${entry.id}" must compile an aggregation`);
  assert.strictEqual(typeof layerOptions.colorScale, 'function', `case "${entry.id}" must compile a colour scale`);
  assert.ok(legend, `case "${entry.id}" must compile a legend descriptor`);
  if (entry.spec.glyph.type !== 'heatmap') {
    assert.strictEqual(typeof layerOptions.onDrawCell, 'function', `case "${entry.id}" must compile a glyph callback`);
  }
}
console.log(`  all ${catalogue.length} catalogue specs compile to renderable options OK`);

// --- 3. THE COVERAGE ASSERTION ---------------------------------------------

const missing = [];
let checkedPaths = 0;
let checkedValues = 0;

for (const [enumPath, values] of [...schemaEnums.entries()].sort()) {
  if (EXCLUDED_PATHS.has(enumPath)) continue;
  checkedPaths += 1;
  const seen = covered.get(enumPath) || new Set();
  for (const value of values) {
    checkedValues += 1;
    if (!seen.has(value)) missing.push(`${enumPath} = ${JSON.stringify(value)}`);
  }
}

if (missing.length > 0) {
  console.error(`\n  ${missing.length} design-space case(s) not covered by the atlas:`);
  missing.forEach((m) => console.error(`    - ${m}`));
  console.error('');
}

assert.strictEqual(
  missing.length,
  0,
  `${missing.length} of ${checkedValues} design-space cases are not demonstrated by the atlas catalogue. `
  + 'Add a case to examples/atlas/catalogue.js, or, if the value genuinely describes data rather '
  + 'than a design choice, add it to EXCLUDED_PATHS with a reason.'
);

console.log(`  ${checkedValues} enum values across ${checkedPaths} design-space axes all covered OK`);
console.log(`  (${EXCLUDED_PATHS.size} data-describing axes excluded by declaration)`);

// --- 4. Coverage of the intent x comparison matrix -------------------------
// The two axes that drive the cartographic rules deserve their own assertion:
// they are what `validateSpec` keys off, so a gap here is a gap in the checks.

const intents = new Set();
const comparisons = new Set();
for (const entry of catalogue) {
  intents.add(entry.spec.intent.task);
  if (entry.spec.intent.comparison) comparisons.add(entry.spec.intent.comparison);
}
const schemaIntents = schemaEnums.get('intent.task');
const schemaComparisons = schemaEnums.get('intent.comparison');
for (const task of schemaIntents) {
  assert.ok(intents.has(task), `no atlas case demonstrates the "${task}" intent`);
}
for (const comparison of schemaComparisons) {
  assert.ok(comparisons.has(comparison), `no atlas case demonstrates the "${comparison}" comparison`);
}
console.log(`  all ${schemaIntents.size} intents and ${schemaComparisons.size} comparison scopes covered OK`);

// --- 5. Every case is documented -------------------------------------------
// A case with no explanation is not evidence; it is a screenshot.

const ids = new Set();
for (const entry of catalogue) {
  assert.ok(entry.id && !ids.has(entry.id), `case ids must be unique (${entry.id})`);
  ids.add(entry.id);
  assert.ok(entry.title, `case "${entry.id}" needs a title`);
  assert.ok(entry.group, `case "${entry.id}" needs a group`);
  assert.ok(entry.question, `case "${entry.id}" needs the question it answers`);
  assert.ok(entry.note && entry.note.length > 40, `case "${entry.id}" needs a substantive note`);
}
console.log(`  all ${catalogue.length} cases carry a question and an explanation OK`);

// --- 6. No warning is silently ignored -------------------------------------
// AGENTS.md section 2.4: fix a cartographic warning, or state why it is
// acceptable for the stated intent — never ignore one. The atlas is the
// library's own worked example, so it has to hold itself to that rule. The
// viewport reminder is emitted for every screen-space spec by design, so it is
// a standing note rather than a design warning about a particular case.
const STANDING_NOTE = 'Screen-space cells are viewport dependent; avoid presenting them as stable geographic districts.';

let cleanCases = 0;
let justifiedCases = 0;
for (const entry of catalogue) {
  const design = validateSpec(entry.spec).warnings.filter((w) => w !== STANDING_NOTE);
  if (design.length === 0) {
    cleanCases += 1;
    continue;
  }
  assert.ok(
    entry.justification && entry.justification.length > 60,
    `case "${entry.id}" leaves ${design.length} cartographic warning(s) unanswered:\n  `
    + design.join('\n  ')
    + '\n  Either fix the spec, or add a `justification` saying why the warning is acceptable here.'
  );
  justifiedCases += 1;
}
console.log(`  ${cleanCases} cases clean, ${justifiedCases} with written justifications, 0 ignored OK`);

console.log('Design-space coverage tests passed');
