import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'public/assets/i18n/en.json');
const ALLOW = new Set([
  'Nocteon Coffee',
  'Nocteon',
]);

function collect(obj, prefix = '') {
  const out = [];
  if (typeof obj === 'string') {
    out.push({ path: prefix, value: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => out.push(...collect(v, `${prefix}[${i}]`)));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      out.push(...collect(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return out;
}

function capitalizedWords(s) {
  // Title Case runs: two or more adjacent capitalized words (e.g. "Coffee Details").
  const runs = s.match(/[A-Z][a-z]+(?:'[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+(?:'[A-Z][a-z]+)?)+/g) || [];
  const words = [];
  for (const r of runs) words.push(...r.split(/\s+/));
  return words;
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const entries = collect(data);
const offenders = [];
for (const e of entries) {
  const words = capitalizedWords(e.value);
  // remove allowlisted phrases
  let text = e.value;
  for (const a of ALLOW) text = text.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  const w = capitalizedWords(text);
  if (w.length >= 2) {
    offenders.push({ path: e.path, value: e.value, words: w });
  }
}

if (offenders.length === 0) {
  console.log('i18n:case-check: no offenders');
  process.exit(0);
}
console.log(`i18n:case-check: ${offenders.length} offender(s):`);
for (const o of offenders) {
  console.log(`  ${o.path}: "${o.value}"  [${o.words.join(', ')}]`);
}
// warning only
process.exit(0);
