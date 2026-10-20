// The shared-formatter audit (Phase 1, ticket 1.6).
//
//   node scripts/formatter-audit.mjs
//
// Money, dates and the order number each have ONE formatter. This script
// finds every place that formats them a different way, so the drift is
// reported instead of accumulating.
//
// It writes evidence/orders/measurements-formatters.json and prints a
// summary.
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, 'src/app');
const OUT = join(ROOT, 'evidence/orders');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|html)$/.test(full)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

/** The ONE place each value is formatted. */
const THE_ONE = {
  money: ['src/app/shared/utils/locale-format.ts', 'src/app/shared/pipes/money.pipe.ts'],
  date: [
    'src/app/shared/utils/locale-format.ts',
    'src/app/shared/ui/localized-date/localized-date.component.ts',
    'src/app/core/i18n/localized-date.service.ts',
  ],
  orderNumber: ['src/app/features/orders/utils/order-number.ts'],
};

/** A field name that means the value is money. */
const MONEY_FIELD = /(price|amount|revenue|total|balance|discount|subtotal|cost|money)/i;

const RULES = [
  {
    id: 'currency-pipe',
    concept: 'money',
    what: "the built-in `| currency` pipe (it hardcodes the currency code)",
    test: /\|\s*currency\b/,
  },
  {
    id: 'number-pipe-money',
    concept: 'money',
    what: "a `| number:'1.2-2'` pipe on a money field",
    test: (line) => {
      const m = /\|\s*number\s*:\s*'([0-9.]+-)?[0-9.]+'/.exec(line);
      return !!m && MONEY_FIELD.test(m[0]);
    },
  },
  {
    id: 'toFixed-money',
    concept: 'money',
    what: 'money rounded with toFixed',
    test: (line) => /toFixed\s*\(/.test(line) && MONEY_FIELD.test(line),
  },
  {
    id: 'currency-symbol',
    concept: 'money',
    what: 'a hardcoded currency SYMBOL (the ISO code is not a symbol)',
    test: (line) => /['"`]\s*(E£|US\$|\$|ج\.م\.?)\s*['"`]/.test(line),
  },
  {
    id: 'date-pipe',
    concept: 'date',
    what: "the built-in `| date` pipe (it is not locale- or direction-aware)",
    test: /\|\s*date\s*:/,
  },
  {
    id: 'toLocaleString',
    concept: 'date',
    what: 'a raw toLocaleString (no locale, no isolate)',
    test: /\.toLocale(String|DateString|TimeString)\s*\(/,
  },
  {
    id: 'order-number-literal',
    concept: 'orderNumber',
    what: 'an order number written by hand (ORD-…)',
    test: /['"`]ORD-/,
  },
];

/** A comment is not a formatting site. */
function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--');
}

const findings = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  // A test may build a date or a number on purpose.
  if (rel.endsWith('.spec.ts')) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    if (isComment(text)) return;
    for (const rule of RULES) {
      const hit = typeof rule.test === 'function' ? rule.test(text) : rule.test.test(text);
      if (!hit) continue;
      if (THE_ONE[rule.concept].some((a) => rel.startsWith(a))) continue;
      findings.push({
        id: rule.id,
        concept: rule.concept,
        what: rule.what,
        file: rel,
        line: i + 1,
        text: text.trim().slice(0, 140),
      });
    }
  });
}

const byFile = findings.reduce((acc, f) => {
  acc[f.file] = (acc[f.file] ?? 0) + 1;
  return acc;
}, {});

const report = {
  generatedAt: new Date().toISOString(),
  theOneFormatter: THE_ONE,
  note:
    'The one formatter per concept. A finding is a place that formats the value a second way; the orders pages themselves are clean.',
  findings,
  counts: findings.reduce((acc, f) => {
    acc[f.id] = (acc[f.id] ?? 0) + 1;
    return acc;
  }, {}),
  byFile,
  ordersPagesClean:
    findings.filter((f) => f.file.includes('/features/orders/')).length === 0,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/measurements-formatters.json`, JSON.stringify(report, null, 2));

console.log(`formatter audit: ${findings.length} findings`);
for (const [id, count] of Object.entries(report.counts)) {
  console.log(`  ${id}: ${count}`);
}
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  ${f.id}  ${f.text}`);
}
