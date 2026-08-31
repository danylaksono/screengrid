import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateSpec } from '../../src/grammar/validateSpec.js';
import { generateAtlasPoints, buildAtlasProfile } from '../../examples/data/atlas.js';
import { buildFailureGallery, STANDING_NOTE } from '../../examples/atlas/failures.js';

console.log('[Test] Validation coverage (every guardrail is demonstrated and repairable)');

// The companion to DesignSpaceCoverage. That test asserts the grammar can
// *express* every design; this one asserts the validator's cartographic rules
// are each demonstrated by a spec that earns the warning and repaired by one
// that does not.
//
// The rule list is read out of validateSpec.js itself rather than duplicated
// here, so adding a `warnings.push` without a demonstration breaks the build.

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, '../../src/grammar/validateSpec.js'), 'utf8');

// --- Extract every warning rule from the validator's source ---------------

/** Turn a source-literal warning into a matcher (template holes become .*). */
function toMatcher(literal) {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // `\$\{...\}` survives escaping as a literal; turn each hole into a wildcard.
  const pattern = escaped.replace(/\\\$\\\{[^}]*\\\}/g, '.*');
  return new RegExp(`^${pattern}$`);
}

const ruleLiterals = [];
const pushRe = /warnings\.push\(\s*(`[^`]*`|'(?:[^'\\]|\\.)*')\s*\)/g;
let match;
while ((match = pushRe.exec(source)) !== null) {
  const raw = match[1];
  ruleLiterals.push(raw.slice(1, -1).replace(/\\'/g, "'"));
}

assert.ok(ruleLiterals.length >= 15, `expected the validator's rule set, found ${ruleLiterals.length}`);

const rules = ruleLiterals.map((literal) => ({ literal, matcher: toMatcher(literal) }));

// The standing note describes the technique, not a mistake in a particular
// design: screen-space cells are viewport dependent by construction, so it is
// emitted for every screen-space spec and there is no spec that repairs it.
// It is excluded by declaration, with that reason.
const UNREPAIRABLE = new Set([STANDING_NOTE]);

// --- Build the gallery -----------------------------------------------------

const profile = buildAtlasProfile(generateAtlasPoints({ count: 2000, seed: 7 }));
const gallery = buildFailureGallery(profile);

assert.ok(gallery.length >= 12, `expected a substantial gallery, got ${gallery.length}`);

// --- 1. Each case must actually break, and its repair must actually work ---

const ids = new Set();
const demonstrated = [];

for (const entry of gallery) {
  assert.ok(entry.id && !ids.has(entry.id), `case ids must be unique (${entry.id})`);
  ids.add(entry.id);
  assert.ok(entry.title, `case "${entry.id}" needs a title`);
  assert.ok(entry.why && entry.why.length > 80, `case "${entry.id}" needs to say why the rule exists`);
  assert.ok(entry.repair && entry.repair.length > 40, `case "${entry.id}" needs to say what the repair is`);

  const brokenReport = validateSpec(entry.broken);
  const repairedReport = validateSpec(entry.repaired);

  assert.ok(brokenReport.valid, `case "${entry.id}": the broken spec must still be valid — this gallery is about warnings, not errors:\n  ${brokenReport.errors.join('\n  ')}`);
  assert.ok(repairedReport.valid, `case "${entry.id}": the repaired spec does not validate:\n  ${repairedReport.errors.join('\n  ')}`);

  const before = new Set(brokenReport.warnings);
  const after = new Set(repairedReport.warnings);
  const fixed = [...before].filter((w) => !after.has(w));

  assert.ok(
    fixed.length > 0,
    `case "${entry.id}" repairs nothing: the broken and repaired specs produce the same warnings`
  );

  // The repair must not trade one warning for another.
  const introduced = [...after].filter((w) => !before.has(w));
  assert.strictEqual(
    introduced.length, 0,
    `case "${entry.id}" introduces new warnings while repairing:\n  ${introduced.join('\n  ')}`
  );

  // The repaired spec should be clean apart from the standing note.
  const remaining = [...after].filter((w) => !UNREPAIRABLE.has(w));
  assert.strictEqual(
    remaining.length, 0,
    `case "${entry.id}": the repaired spec still warns:\n  ${remaining.join('\n  ')}`
  );

  demonstrated.push(...fixed);
}

console.log(`  all ${gallery.length} cases break, repair cleanly, and introduce nothing OK`);

// --- 2. THE COVERAGE ASSERTION --------------------------------------------
// Every cartographic rule in the validator must be demonstrated by some case.

const undemonstrated = [];
let checked = 0;

for (const rule of rules) {
  if (UNREPAIRABLE.has(rule.literal)) continue;
  checked += 1;
  if (!demonstrated.some((w) => rule.matcher.test(w))) undemonstrated.push(rule.literal);
}

if (undemonstrated.length > 0) {
  console.error(`\n  ${undemonstrated.length} validator rule(s) have no worked demonstration:`);
  undemonstrated.forEach((r) => console.error(`    - ${r}`));
  console.error('');
}

assert.strictEqual(
  undemonstrated.length,
  0,
  `${undemonstrated.length} of ${checked} cartographic rules are not demonstrated by examples/atlas/failures.js. `
  + 'Add a case that fires the rule and repairs it, or — if the rule genuinely cannot be repaired by any '
  + 'spec — add it to UNREPAIRABLE with a reason.'
);

console.log(`  all ${checked} repairable cartographic rules demonstrated and repaired OK`);
console.log(`  (${UNREPAIRABLE.size} rule excluded by declaration: it describes the technique, not a mistake)`);

// --- 3. The gallery and the atlas must not disagree ------------------------
// The atlas declines the radial-wedge suggestion with a justification; the
// gallery shows the repair the validator recommends. Both are legitimate, but
// the gallery must actually contain that case, or the atlas's justification is
// arguing against a rule nobody demonstrated.
assert.ok(
  gallery.some((c) => c.limitation),
  'at least one case should record where the rule and the compiler disagree'
);
console.log('  rules with recorded limitations are documented OK');

console.log('Validation coverage tests passed');
