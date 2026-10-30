#!/usr/bin/env node
/**
 * Breadcrumb label check (W1).
 *
 * A crumb must ALWAYS be a translated label. The bug this pins: a route
 * declared `data: { breadcrumb: 'newProduct' }` and the key was missing from
 * `navI18n`, so the trail printed the camelCase key itself ("newProduct").
 *
 * The check reads the real sources, so a route added later is covered without
 * touching this file:
 *   1. every `data: { breadcrumb: '...' }` key in app.routes.ts
 *   2. every key declared in the NavKey union
 *   3. the en + ar maps in nav-i18n.ts
 *
 * It fails when a key has no label in en or ar, when a label equals its key,
 * when a label is itself camelCase (the exact thing that reached the screen),
 * when a label looks like an unresolved route param (`:slug`) or placeholder
 * (`{{n}}`), or when a route path's own parameter is used as the crumb key.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routesPath = path.join(root, 'src/app/app.routes.ts');
const navPath = path.join(root, 'src/app/shared/i18n/nav-i18n.ts');

const routesSource = fs.readFileSync(routesPath, 'utf8');
const navSource = fs.readFileSync(navPath, 'utf8');

/** `data: { breadcrumb: 'key' }` -> key */
const routeKeys = new Set();
for (const m of routesSource.matchAll(/breadcrumb:\s*'([^']+)'/g)) {
  routeKeys.add(m[1]);
}

/** The NavKey + BreadcrumbKey unions, e.g. `| 'orders'`. */
function unionKeysOf(name) {
  const start = navSource.indexOf(`export type ${name}`);
  if (start === -1) return [];
  const end = navSource.indexOf(';', start);
  return [...navSource.slice(start, end).matchAll(/\|\s*'([^']+)'/g)].map((m) => m[1]);
}

const unionKeys = new Set([...unionKeysOf('NavKey'), ...unionKeysOf('BreadcrumbKey')]);

/** Both language maps: `en: { ... }` and `ar: { ... }`. */
function mapBlock(lang) {
  const start = navSource.indexOf(`  ${lang}: {`);
  if (start === -1) return '';
  const end = navSource.indexOf('\n  },', start);
  return navSource.slice(start, end === -1 ? undefined : end);
}

function labelsOf(block) {
  const out = new Map();
  for (const m of block.matchAll(/^\s{4}(\w+):\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) {
    out.set(m[1], m[2]);
  }
  return out;
}

const en = labelsOf(mapBlock('en'));
const ar = labelsOf(mapBlock('ar'));

/**
 * The rendered-text failures. These are not about the translation file being
 * syntactically valid — they are the shapes that mean "the key leaked":
 *  - the label IS the key
 *  - the label is a camelCase identifier (no spaces, an inner capital)
 *  - the label is a route param or an unresolved placeholder
 */
function labelProblem(key, label) {
  if (!label || !label.trim()) return 'empty label';
  if (label === key) return 'label equals the raw key';
  if (/^[a-z][A-Za-z0-9]*$/.test(label) && /[A-Z]/.test(label)) return 'label is camelCase';
  if (/^[:]/.test(label)) return 'label is a route param';
  if (/\{\{[^}]*\}\}/.test(label)) return 'label has an unresolved placeholder';
  return null;
}

const problems = [];

// 1. Every breadcrumb key used by a route must be declared and translated.
for (const key of routeKeys) {
  if (!unionKeys.has(key)) problems.push(`app.routes.ts: breadcrumb '${key}' is not in the NavKey union`);
  for (const [lang, map] of [
    ['en', en],
    ['ar', ar],
  ]) {
    const label = map.get(key);
    if (label === undefined) {
      problems.push(`${lang}: missing label for route breadcrumb '${key}'`);
      continue;
    }
    const problem = labelProblem(key, label);
    if (problem) problems.push(`${lang}: '${key}' -> "${label}" (${problem})`);
  }
}

// 2. The reverse: an unused key is fine, but a translated key must be valid.
for (const [lang, map] of [
  ['en', en],
  ['ar', ar],
]) {
  for (const [key, label] of map) {
    const problem = labelProblem(key, label);
    if (problem) problems.push(`${lang}: '${key}' -> "${label}" (${problem})`);
  }
}

// 3. A route that carries a parameter must not use that parameter as its
//    crumb: `path: 'orders/:id', data: { breadcrumb: 'id' }` would print "id".
const routeBlocks = routesSource.split(/\n\s*\{\s*\n/);
for (const block of routeBlocks) {
  const breadcrumb = block.match(/breadcrumb:\s*'([^']+)'/);
  if (!breadcrumb) continue;
  const params = [...block.matchAll(/path:\s*'([^']*)'/g)].flatMap((m) =>
    [...m[1].matchAll(/:([A-Za-z0-9_]+)/g)].map((p) => p[1]),
  );
  if (params.includes(breadcrumb[1])) {
    problems.push(`app.routes.ts: breadcrumb '${breadcrumb[1]}' is a route param (${params.join(', ')})`);
  }
}

if (problems.length === 0) {
  console.log(`breadcrumb:check: ${routeKeys.size} route breadcrumbs, ${en.size} en / ${ar.size} ar labels — no offenders`);
  process.exit(0);
}

console.log(`breadcrumb:check: ${problems.length} offender(s):`);
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
