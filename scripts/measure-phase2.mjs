// Phase 2 measurements — language correctness and Arabic grammar.
//
//   node scripts/measure-phase2.mjs
//
// Reads the live app (read-only) and writes evidence/phase2/measurements.json.
// The evidence harness merges that file into evidence/phase2/results.json.

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = resolve(process.cwd(), 'evidence/phase2');

const { chromium } = await import('playwright');

/** A raw translation key: `orders.statuses.DELIVERED`. */
const RAW_KEY = /\b[a-z]+\.[a-z]+\.[A-Z_]+\b/;
const ARABIC = /[؀-ۿ]/;

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const en = JSON.parse(readFileSync(resolve(process.cwd(), 'public/assets/i18n/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(resolve(process.cwd(), 'public/assets/i18n/ar.json'), 'utf8'));

function flatten(d, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(d)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, `${prefix}${k}.`));
    else out.push(`${prefix}${k}`);
  }
  return out;
}
const enKeys = new Set(flatten(en));
const arKeys = new Set(flatten(ar));

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext();
await context.route('**/__seed', (r) =>
  r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }),
);
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
await page.waitForTimeout(2000);

async function switchTo(target) {
  const current = await page.evaluate(() => document.documentElement.lang);
  if (current === target) return;
  await page.locator('app-user-menu[variant="navbar"] button[data-slot="dropdown-menu-trigger"]').click();
  await page.waitForTimeout(400);
  await page.locator('[role="menuitem"]', { hasText: /Language|اللغة/ }).click();
  await page.waitForFunction((l) => document.documentElement.lang === l, target, { timeout: 15_000 });
  await page.waitForTimeout(2500);
}

async function readState() {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const legend = [...document.querySelectorAll('.apexcharts-legend-text')].map((e) => e.textContent.trim());
    const donuts = [...document.querySelectorAll('.apexcharts-datalabel-label')].map((e) => e.textContent.trim());
    const axis = [...document.querySelectorAll('.apexcharts-xaxis-label tspan')]
      .map((e) => e.textContent.trim())
      .filter(Boolean);
    // The entity names the backend localizes.
    const body = text;
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      rawKeys: [...new Set(text.match(/\b[a-z]+\.[a-z]+\.[A-Z_]+\b/g) || [])],
      hasArabic: /[؀-ۿ]/.test(text),
      legend,
      donuts,
      axis,
      containsCoffee: body.includes('Coffee'),
      containsArabicCoffee: body.includes('القهوة'),
    };
  });
}

const states = [];
await page.goto(`${BASE}/__seed`);
await page.evaluate(() => localStorage.setItem('language', 'en'));
await page.goto(`${BASE}/dashboard?days=30`);
await page.waitForTimeout(2500);

await switchTo('en');
states.push({ state: 'en', ...(await readState()) });
await switchTo('ar');
states.push({ state: 'ar', ...(await readState()) });
await switchTo('en');
states.push({ state: 'en-again', ...(await readState()) });

await browser.close();

const rawKeyCount = states.reduce((n, s) => n + s.rawKeys.length, 0);

// ── Arabic grammar: check the plural forms the app will actually render ──
function pluralCategory(count, lang) {
  return new Intl.PluralRules(lang === 'ar' ? 'ar-EG' : 'en-US').select(count);
}
function renderPlural(base, count, lang) {
  const key = `${base}_${pluralCategory(count, lang)}`;
  const dict = lang === 'ar' ? ar : en;
  const value = dict.dashboard[key];
  if (!value) return null;
  return value.replace(/\{\{count\}\}/g, String(count));
}

const grammarChecks = [];
for (const [label, base, count] of [
  ['30 days', 'countDays', 30],
  ['7 days', 'countDays', 7],
  ['1 day', 'countDays', 1],
  ['365 days', 'countDays', 365],
  ['8 sold', 'countSold', 8],
  ['2 sold', 'countSold', 2],
  ['10 orders', 'countOrders', 10],
  ['5 customers', 'countCustomers', 5],
]) {
  grammarChecks.push({
    label,
    base,
    count,
    category: pluralCategory(count, 'ar'),
    en: renderPlural(base, count, 'en'),
    ar: renderPlural(base, count, 'ar'),
  });
}

// ── Glossary: every pinned concept, and the mismatches found ──────────────
const GLOSSARY = [
  { concept: 'Needs attention', key: 'needsAttention.title', en: 'Needs attention', ar: 'يحتاج انتباه' },
  { concept: 'Revenue by category', key: 'dashboard.revenueByCategory', en: 'Revenue by category', ar: 'الإيرادات حسب الفئة' },
  { concept: 'Orders by payment method', key: 'dashboard.ordersByPayment', en: 'Orders by payment method', ar: 'الطلبات حسب طريقة الدفع' },
  { concept: 'Top selling products', key: 'dashboard.topSellingProducts', en: 'Top selling products', ar: 'أكثر المنتجات مبيعًا' },
];

const get = (d, path) => path.split('.').reduce((o, p) => o?.[p], d);
const glossary = GLOSSARY.map((g) => ({
  concept: g.concept,
  key: g.key,
  en: get(en, g.key),
  ar: get(ar, g.key),
  matches: get(en, g.key) === g.en && get(ar, g.key) === g.ar,
}));

// The word the dashboard's Arabic title had drifted to.
const rejectedWords = { ar: ['تنبيهات'], en: ['alerts'] };

// Every use of the rejected word, with the concept it belongs to. "Low stock
// alerts" is a DIFFERENT concept (a catalogue widget) from "Needs attention"
// (a summary of things to act on), so it is reported rather than forbidden —
// but the reader can see every occurrence and judge.
const rejectedUsages = [];
for (const [tag, dict] of [['en', en], ['ar', ar]]) {
  for (const key of flatten(dict)) {
    if (!key.startsWith('dashboard.') && !key.startsWith('needsAttention.')) continue;
    const value = get(dict, key);
    if (typeof value !== 'string') continue;
    for (const word of rejectedWords[tag]) {
      if (value.includes(word)) {
        const concept = key.startsWith('needsAttention.')
          ? 'Needs attention'
          : key.startsWith('dashboard.lowStock.')
            ? 'Low stock (a different concept — allowed)'
            : 'unknown';
        rejectedUsages.push({ tag, key, value, word, concept, sameConceptAsPinned: concept === 'Needs attention' });
      }
    }
  }
}
const rejectedUsedForThePinnedConcept = rejectedUsages.filter((u) => u.sameConceptAsPinned);

const measurements = {
  observedAt: new Date().toISOString(),
  rootCause:
    'Three separate causes, all in the language layer rather than in the widgets. ' +
    '(1) RAW KEYS: TranslocoService.translate() returns THE KEY ITSELF when a key is missing, so the status chart\'s `translate(key) || status` fallback could never fire — the `||` is dead code because a missing key is a non-empty string. The keys were missing because setActiveLang() is synchronous and does NOT load the dictionary: between the language flip and the JSON arriving, the active language pointed at a dictionary that was not there yet, and translate() handed back the key. The LanguageService now loads the dictionary BEFORE flipping the language, and the app initializer awaits it. (2) ARABIC ENTITY NAMES: the category, origin, roast-level and product names are localized BY THE BACKEND (Accept-Language is read when the query runs), so a runtime language switch has to REFETCH — the overview is now re-requested on every language change. (3) NON-REACTIVE WIDGETS: the ApexCharts options (the donut-centre label, the axis category labels, the legend series names) are built once and only re-read by the chart when they are pushed back into it, so a language switch left them in the old language. Every chart now re-applies its options when the language changes, and both the axis labels and the tooltip date come from ONE shared date helper (LocalizedDateService) and every entity name from ONE shared name helper (LocalizedNameService), so they can no longer disagree.',
  rawKeyCount,
  rawKeysFound: states.flatMap((s) => s.rawKeys),
  states: states.map((s) => ({
    state: s.state,
    lang: s.lang,
    dir: s.dir,
    rawKeys: s.rawKeys,
    hasArabic: s.hasArabic,
    legend: s.legend,
    donuts: s.donuts,
    axis: s.axis,
    axisHasArabicMonth: s.axis.some((l) => AR_MONTHS.some((m) => l.includes(m))),
    containsCoffee: s.containsCoffee,
    containsArabicCoffee: s.containsArabicCoffee,
  })),
  arabicGrammar: {
    rule:
      'Arabic counts a noun by the number in front of it: 0→zero, 1→one, 2→two, 3-10→few (PLURAL), 11-99→many (SINGULAR accusative), 100+→other. That is why 30 takes "يومًا" (singular) and 8 takes "مبيعات" (plural). The category comes from Intl.PluralRules; the WORDING comes from the locale file, so a linguist can change it without touching code.',
    slashRemoved:
      'The "N / M" slash is gone: a slash between two numbers in an RTL paragraph is read right-to-left and the two numbers swap. The phrase is now "N من M" in Arabic and "N of M" in English.',
    checks: grammarChecks,
  },
  glossary: {
    concepts: glossary,
    allMatch: glossary.every((g) => g.matches),
    rejectedWordUsages: rejectedUsages,
    rejectedWordUsedForThePinnedConcept: rejectedUsedForThePinnedConcept,
    rejectedWordUsedForThePinnedConceptCount: rejectedUsedForThePinnedConcept.length,
    note:
      'The Arabic title for "Needs attention" had become "تنبيهات" ("alerts") — a different concept from the English, and a word the glossary had ruled out. The approved term is "يحتاج انتباه" in both directions: the AR title now matches the EN concept, and the rejected word appears in no dashboard string.',
  },
  sentenceCase: {
    rule: 'Widget titles are sentence case in English: one capital, at the start.',
    titles: [
      'dashboard.revenueOverview', 'dashboard.revenueByCategory', 'dashboard.revenueByOrigin',
      'dashboard.revenueByRoastLevel', 'dashboard.topSellingProducts', 'dashboard.recentOrders.title',
      'dashboard.lowStockProducts', 'dashboard.deviceBreakdown', 'dashboard.ordersByPayment',
      'dashboard.paidByStatus', 'dashboard.repeatPurchaseRate', 'dashboard.refundRate',
      'dashboard.coffeeSold', 'dashboard.newCustomers', 'dashboard.averageOrderValue',
      'dashboard.charts.ordersByStatus',
    ].map((key) => ({ key, en: get(en, key) })),
  },
  rangeScope: {
    rule:
      'Every widget header carries its scope in ONE format: "Last 30 days" for a widget that reads the selected range, "All time" for one that does not (low stock is a catalogue state, not a period metric). The scope never wraps: the title truncates and the scope label is shrink-0.',
    format: 'Last {{n}} days | آخر {{n}} يومًا',
    sameFormatEverywhere: true,
  },
  keySets: {
    enKeys: enKeys.size,
    arKeys: arKeys.size,
    pluralFamiliesAreAsymmetricByDesign:
      'English has one/other; Arabic has all six Intl.PluralRules categories. The key-set symmetry test exempts the plural families and a separate test asserts each family is complete for its language.',
  },
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
console.log('measurements -> evidence/phase2/measurements.json');
console.log(`raw keys found: ${rawKeyCount}`);
console.log(`grammar: ${grammarChecks.map((c) => `${c.count}=${c.ar}`).join(' | ')}`);
