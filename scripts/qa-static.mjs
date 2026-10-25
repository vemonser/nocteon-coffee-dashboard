import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const enPath = path.join(root, 'public/assets/i18n/en.json');
const arPath = path.join(root, 'public/assets/i18n/ar.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out) && Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}
// fix flatten
function flat(obj, prefix = '', acc = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, acc);
    else acc[key] = v;
  }
  return acc;
}
const fen = flat(en);
const far = flat(ar);

let issues = [];
// Check 3: i18n parity
for (const key of Object.keys(fen)) {
  if (!(key in far)) issues.push({ check: 'i18n-parity', severity: 'P0', msg: `missing in ar: ${key}` });
}
for (const key of Object.keys(far)) {
  if (!(key in fen)) issues.push({ check: 'i18n-parity', severity: 'P0', msg: `missing in en: ${key}` });
}
for (const key of Object.keys(fen)) {
  if (key in far) {
    const a = fen[key], b = far[key];
    if (typeof a === 'string' && typeof b === 'string') {
      if (a.trim() === b.trim() && !/^(nocteon|egp|egypt)$/i.test(a.trim())) {
        // allowlist brand names: skip if value equals a known brand token
        if (!/nocteon/i.test(a)) issues.push({ check: 'i18n-parity', severity: 'P2', msg: `ar identical to en: ${key}` });
      }
      // variable mismatch
      const va = [...a.matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g)].map(m=>m[1]).sort();
      const vb = [...b.matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g)].map(m=>m[1]).sort();
      if (va.join(',') !== vb.join(',')) issues.push({ check: 'i18n-parity', severity: 'P0', msg: `var mismatch ${key}: en=${va} ar=${vb}` });
    }
  }
}
// plural forms: keys ending in _one/_other etc. check families
const pluralFamilies = new Map();
for (const key of Object.keys(fen)) {
  const m = key.match(/^(.*)_(one|other|few|many|two|zero)$/);
  if (m) {
    if (!pluralFamilies.has(m[1])) pluralFamilies.set(m[1], new Set());
    pluralFamilies.get(m[1]).add(m[2]);
  }
}
for (const [base, forms] of pluralFamilies) {
  if (!forms.has('one') || !forms.has('other')) issues.push({ check: 'i18n-parity', severity: 'P1', msg: `incomplete plural family: ${base} (${[...forms]})` });
}

// Check 4: Title Case
const properNouns = new Set(['Nocteon','EGP','SKU','API','URL','ID','PDF','CSV']);
for (const [key, val] of Object.entries(fen)) {
  if (typeof val !== 'string') continue;
  const words = val.trim().split(/\s+/);
  const caps = words.filter(w => /^[A-Z][a-z]/.test(w));
  if (caps.length >= 2) {
    // allow if all caps words are proper nouns
    const suspicious = caps.filter(w => !properNouns.has(w.replace(/[^A-Za-z]/g,'')));
    if (suspicious.length >= 2) issues.push({ check: 'title-case', severity: 'P2', msg: `${key}: "${val}"` });
  }
}

// Check 11: static grep for alert/confirm/prompt
const srcFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'node_modules' && f !== 'dist') walk(p); }
    else if (/\.(ts|html)$/.test(f)) srcFiles.push(p);
  }
}
walk(path.join(root, 'src'));
for (const f of srcFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/\b(alert|confirm|prompt)\s*\(/.test(line) && !line.includes('//')) {
      issues.push({ check: 'native-dialog', severity: 'P0', msg: `${path.relative(root, f)}:${i+1}: ${line.trim().slice(0,120)}` });
    }
  });
}

// Check 15: RTL physical classes
const allow = /allow-rtl-physical/;
const physRe = /\b(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|float-left|float-right)\w*/;
for (const f of srcFiles) {
  if (!f.endsWith('.html') && !f.endsWith('.css') && !f.endsWith('.scss')) continue;
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (allow.test(line)) return;
    const m = line.match(physRe);
    if (m) issues.push({ check: 'rtl-lint', severity: 'P2', msg: `${path.relative(root, f)}:${i+1}: ${m[0]}` });
  });
}

// Write report
const outDir = path.join(root, 'qa', 'static-report');
fs.mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(outDir, `static-${ts}.json`), JSON.stringify(issues, null, 2));
console.log(`qa:static: ${issues.length} issues`);
const byCheck = {};
for (const it of issues) byCheck[it.check] = (byCheck[it.check]||0)+1;
console.log(JSON.stringify(byCheck, null, 2));
// exit 0 (warning only)
process.exit(0);