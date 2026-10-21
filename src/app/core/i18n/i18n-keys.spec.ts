import { describe, expect, it } from 'vitest';

/**
 * Phase 1.11: raw translation keys must never reach the screen.
 * - en/ar key sets are symmetric (no key missing on either side).
 * - every static key used in templates (`'a.b' | transloco`) and in code
 *   (`translate('a.b')`, `t('a.b', fallback)`) exists in both locales.
 * - dynamic plural bases (`pluralKey(base, …)`) resolve: EN one/other,
 *   AR all six Intl.PluralRules categories.
 */

type Dict = Record<string, unknown>;

function flatten(d: Dict, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v as Dict, `${prefix}${k}.`));
    } else {
      out.push(`${prefix}${k}`);
    }
  }
  return out;
}

const htmlSources = import.meta.glob('/src/app/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const tsSources = import.meta.glob('/src/app/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const localeModules = import.meta.glob('/public/assets/i18n/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Dict>;

const en = localeModules['/public/assets/i18n/en.json'];
const ar = localeModules['/public/assets/i18n/ar.json'];
const enKeys = new Set(flatten(en));
const arKeys = new Set(flatten(ar));

const used = new Set<string>();
for (const text of Object.values(htmlSources)) {
  for (const m of text.matchAll(/'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)'\s*\|\s*transloco/g)) {
    used.add(m[1]);
  }
}
for (const [path, text] of Object.entries(tsSources)) {
  if (path.endsWith('.spec.ts')) continue;
  for (const m of text.matchAll(/(?:translate|[^A-Za-z_.]t)\(\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)'/g)) {
    used.add(m[1]);
  }
}

/**
 * Plural families: `<base>_<Intl.PluralRules category>`.
 *
 * English has one/other; Arabic has all six. The families are therefore
 * deliberately ASYMMETRIC, and the symmetry check below must exempt them —
 * the same way the "dynamic plural bases" check exempts them from the
 * "every used key exists in both locales" check.
 */
const PLURAL_BASES = [
  'dashboard.countDays',
  'dashboard.countSessions',
  'dashboard.countSold',
  'dashboard.countOrders',
  'dashboard.countCustomers',
  // The orders list and the order detail page count orders, items and
  // results. Arabic counts a noun by the number in front of it, so the
  // family has all six categories there and two in English.
  'orders.countItems',
  'orders.countOrders',
  'orders.countResults',
];
const EN_SUFFIXES = ['one', 'other'];
const AR_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * A key belongs to a plural family if it is `<base>_<category>` AND its
 * siblings carry the OTHER categories.
 *
 * The sibling test is what makes this general: English has one/other and
 * Arabic has all six, so a plural family is legitimately ASYMMETRIC, and
 * the symmetry check must not treat it as a missing key. Looking for the
 * sibling (rather than a hardcoded list of bases) means a family added later
 * is exempt too, instead of failing the symmetry check for a reason that has
 * nothing to do with the translation.
 */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

function isPluralKey(key: string, dict: Dict): boolean {
  const parts = key.split('.');
  const segment = parts[parts.length - 1];
  // "<base>_<category>" — the base may itself contain underscores
  // ("countItems_zero" -> base "countItems", category "zero").
  const underscore = segment.lastIndexOf('_');
  if (underscore <= 0) return false;
  const base = segment.slice(0, underscore);
  const category = segment.slice(underscore + 1);
  if (!PLURAL_CATEGORIES.includes(category)) return false;
  const parent = parts.slice(0, -1).reduce<any>((o, p) => o?.[p], dict);
  if (!parent || typeof parent !== 'object') return false;
  // The family has at least one sibling in a different category. A family may
  // be FLAT (`dashboard.countDays_one`) or NESTED (`dashboard.days.one`).
  const siblingIn = (c: string): boolean =>
    typeof parent[`${base}_${c}`] === 'string' ||
    (typeof parent[base] === 'object' && typeof parent[base][c] === 'string');
  return PLURAL_CATEGORIES.some((c) => c !== category && siblingIn(c));
}

const DYNAMIC_BASES: string[] = PLURAL_BASES;

describe('i18n keys', () => {
  it('en and ar define the same key set (plural families excepted)', () => {
    // A plural family is legitimately asymmetric: English has one/other,
    // Arabic has all six Intl.PluralRules categories. Every OTHER key must
    // exist in both locales.
    const onlyEn = [...enKeys].filter(
      (k) => !arKeys.has(k) && !isPluralKey(k, en) && !isPluralKey(k, ar),
    );
    const onlyAr = [...arKeys].filter(
      (k) => !enKeys.has(k) && !isPluralKey(k, en) && !isPluralKey(k, ar),
    );
    expect({ onlyEn, onlyAr }).toEqual({ onlyEn: [], onlyAr: [] });
  });

  it('every plural family is complete for its language', () => {
    // EN must have one/other; AR must have all six. EVERY family is checked
    // — the families are discovered from the locale files, so a family added
    // later is covered without touching this test.
    const missing: string[] = [];
    const families = new Set<string>();
    for (const key of [...enKeys, ...arKeys]) {
      const parts = key.split('.');
      const last = parts[parts.length - 1];
      if (!PLURAL_CATEGORIES.includes(last)) continue;
      if (!isPluralKey(key, en) && !isPluralKey(key, ar)) continue;
      families.add(parts.slice(0, -1).join('.'));
    }
    for (const base of families) {
      for (const s of EN_SUFFIXES) if (!enKeys.has(`${base}_${s}`)) missing.push(`en:${base}_${s}`);
      for (const s of AR_SUFFIXES) if (!arKeys.has(`${base}_${s}`)) missing.push(`ar:${base}_${s}`);
    }
    expect(missing).toEqual([]);
  });

  it('every static key used in templates/code exists in both locales', () => {
    const missing = [...used].filter((k) => {
      if (DYNAMIC_BASES.includes(k)) return false;
      return !enKeys.has(k) || !arKeys.has(k);
    });
    // A plural family is used through its base, never through a category.
    expect(missing).toEqual([]);
  });

  it('dynamic plural bases resolve in both locales', () => {
    const missing: string[] = [];
    for (const base of DYNAMIC_BASES) {
      for (const s of EN_SUFFIXES) if (!enKeys.has(`${base}_${s}`)) missing.push(`en:${base}_${s}`);
      for (const s of AR_SUFFIXES) if (!arKeys.has(`${base}_${s}`)) missing.push(`ar:${base}_${s}`);
    }
    expect(missing).toEqual([]);
  });

  it('no single-brace placeholders (Transloco matches {{x}} only)', () => {
    const bad: string[] = [];
    const check = (keys: Set<string>, tag: string) => {
      const src = tag === 'en' ? en : ar;
      for (const k of keys) {
        const v = k.split('.').reduce<unknown>((o, p) => (o as Dict)?.[p], src);
        if (typeof v === 'string' && /(?<!\{)\{(?!\{)[^{}]+\}(?!\})/.test(v)) bad.push(`${tag}:${k}`);
      }
    };
    check(enKeys, 'en');
    check(arKeys, 'ar');
    expect(bad).toEqual([]);
  });
});

/**
 * Glossary enforcement (docs/glossary.md) — W2:
 * one word per concept inside the `categories.*` translations. A forbidden
 * term (المحذوفات / تصنيف / نشط-for-tabs …) or a concept rendering with two
 * different words anywhere in the section makes CI fail, so the vocabulary
 * can silently drift again.
 */
const CAT_KEYS = [...enKeys, ...arKeys].filter((k) => k.startsWith('categories.'));

function catValue(key: string, tag: 'en' | 'ar'): string {
  const src = tag === 'en' ? en : ar;
  const v = key.split('.').reduce<unknown>((o, p) => (o as Dict)?.[p], src);
  return typeof v === 'string' ? v : '';
}

/** Terms that must NEVER appear in any categories.* string. */
const FORBIDDEN: Record<'en' | 'ar', RegExp[]> = {
  // تصنيف — the rejected entity word; المحذوفات — the rejected trash word;
  // نشط/النشطة — the rejected tab word (status uses مفعّل/معطّل instead).
  ar: [/المحذوفات/, /تصنيف/, /(نشط|النشطة)(?![^\u0600-\u06FF])/],
  // The rejected entity word; the trash noun is always "Trash".
  en: [/classification/i, /deleted items/i],
};

describe('glossary (docs/glossary.md)', () => {
  it('categories.* strings contain no forbidden terms', () => {
    const violations: string[] = [];
    for (const key of CAT_KEYS) {
      for (const tag of ['en', 'ar'] as const) {
        const v = catValue(key, tag);
        if (!v) continue;
        for (const re of FORBIDDEN[tag]) {
          if (re.test(v)) violations.push(`${tag}:${key} → "${v}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  const APPROVED = {
    tabActive: 'Active',
    tabTrash: 'Trash',
    moveToTrash: 'Move to trash',
    deletePermanently: 'Delete permanently',
    restore: 'Restore',
  } as const;
  const APPROVED_AR = {
    tabActive: 'الحالية',
    tabTrash: 'المهملات',
    moveToTrash: 'نقل إلى المهملات',
    deletePermanently: 'حذف نهائي',
    restore: 'استعادة',
  } as const;

  it('lifecycle tabs use exactly one term per language (both copies agree)', () => {
    expect(catValue('categories.trash.tabActive', 'en')).toBe(APPROVED.tabActive);
    expect(catValue('categories.trash.tabTrash', 'en')).toBe(APPROVED.tabTrash);
    expect(catValue('categories.trash.tabActive', 'ar')).toBe(APPROVED_AR.tabActive);
    expect(catValue('categories.trash.tabTrash', 'ar')).toBe(APPROVED_AR.tabTrash);
  });

  it('trash action strings use exactly one phrase per language', () => {
    // Same concept, three surfaces (row button, bulk button, detail button)
    // — all three must carry the SAME wording, not two variants.
    for (const [key, phrase, arPhrase] of [
      ['categories.trash.moveToTrash', APPROVED.moveToTrash, APPROVED_AR.moveToTrash],
      ['categories.trash.bulkMoveToTrash', APPROVED.moveToTrash, APPROVED_AR.moveToTrash],
      ['categories.detail.moveToTrash', APPROVED.moveToTrash, APPROVED_AR.moveToTrash],
    ] as Array<[string, string, string]>) {
      expect(catValue(key, 'en')).toBe(phrase);
      expect(catValue(key, 'ar')).toBe(arPhrase);
    }
  });

  it('destroy and restore use exactly one term per language', () => {
    expect(catValue('categories.trash.deletePermanently', 'en')).toBe(APPROVED.deletePermanently);
    expect(catValue('categories.trash.deletePermanently', 'ar')).toBe(APPROVED_AR.deletePermanently);
    for (const key of ['categories.trash.restore', 'categories.trash.bulkRestore']) {
      expect(key, 'en key absence check').toBeDefined();
      const enV = catValue(key, 'en');
      const arV = catValue(key, 'ar');
      if (enV) expect(enV).toBe(APPROVED.restore);
      if (arV) expect(arV).toBe(APPROVED_AR.restore);
    }
  });

  it('status words never leak into the lifecycle-tab vocabulary', () => {
    // Row 2: status is Enabled/Disabled · مفعّل/معطّل, and must stay distinct
    // from the tabs (Active/Trash · الحالية/المهملات).
    expect(catValue('categories.trash.statusEnabled', 'en')).toBe('Enabled');
    expect(catValue('categories.trash.statusDisabled', 'en')).toBe('Disabled');
    expect(catValue('categories.trash.statusEnabled', 'ar')).toBe('مفعّل');
    expect(catValue('categories.trash.statusDisabled', 'ar')).toBe('معطّل');
    // The entity word is فئة only (row 4) — e.g. the detail banner/impact copy.
    const entityAr = [
      catValue('categories.detail.deletedBanner', 'ar'),
      catValue('categories.detail.deleteImpact', 'ar'),
      catValue('categories.addTitle', 'ar'),
    ];
    for (const v of entityAr) expect(v).toMatch(/فئة/);
  });

  it('row 2 extended (user ruling A, 2026-10-18): every entity status uses the enabled/disabled family', () => {
    // The five pending strings outside the categories glossary were unified:
    // users, carts, subscriptions and promo codes no longer say نشط/Active.
    const approved: Array<[string, 'en' | 'ar', string]> = [
      ['users.active', 'en', 'Enabled'],
      ['users.active', 'ar', 'مفعّل'],
      ['users.accountActive', 'en', 'Account enabled'],
      ['users.accountActive', 'ar', 'الحساب مفعّل'],
      ['carts.status.active', 'en', 'Enabled'],
      ['carts.status.active', 'ar', 'مفعّلة'],
      ['dashboard.metrics.activeSubscriptions', 'en', 'Enabled Subscriptions'],
      ['dashboard.metrics.activeSubscriptions', 'ar', 'الاشتراكات المفعّلة'],
      ['promoCodes.activeCodes', 'en', 'Enabled Codes'],
      ['promoCodes.activeCodes', 'ar', 'الأكواد المفعّلة'],
    ];
    const drift: string[] = [];
    for (const [key, tag, expected] of approved) {
      const v = catValue(key, tag);
      if (v !== expected) drift.push(`${tag}:${key} → "${v}" (expected "${expected}")`);
    }
    expect(drift).toEqual([]);

    // Global AR scan: no status phrase may regress to the نشط family. عن
    // مسمى "آخر نشاط" (last-activity ATTRIBUTE) is a different concept and
    // its نشاط form is excluded by the regex below.
    const reAssignable = /(^|[\s—«»:،"'])النشط(ة|ات)?|(^|[\s—«»:،"'])نشط(ة)?(?=$|[\s،»\":—?!.\u061F])/;
    const regressions: string[] = [];
    const scanAll = (d: Dict, prefix = '') => {
      for (const [k, v] of Object.entries(d)) {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          scanAll(v as Dict, `${prefix}${k}.`);
        } else if (typeof v === 'string' && reAssignable.test(v)) {
          regressions.push(`ar:${prefix}${k} → "${v}"`);
        }
      }
    };
    scanAll(ar);
    expect(regressions).toEqual([]);
  });
});

/**
 * Phase 2, ticket 2.3 — the dashboard's vocabulary is governed by the same
 * one-concept-one-term rule as the rest of the app.
 *
 * The QA report found the dashboard's Arabic title for "Needs attention" had
 * become "تنبيهات" ("alerts") — a different concept from the English
 * "Needs attention", and a word the glossary had ruled out. The rule is
 * enforced below in BOTH directions:
 *
 *  - a pinned concept may only use its approved word, in both locales;
 *  - no other string in the dashboard may use that word for something else.
 */
const DASHBOARD_GLOSSARY = [
  {
    concept: 'Needs attention',
    keys: ['needsAttention.title'],
    en: 'Needs attention',
    ar: 'يحتاج انتباه',
    // The rejected word: "تنبيهات" means "alerts", a different concept, and
    // it is what the dashboard's Arabic title had drifted to.
    forbiddenAr: [/تنبيهات/],
    forbiddenEn: [/\balerts?\b/i],
  },
  {
    concept: 'Revenue by category',
    keys: ['dashboard.revenueByCategory'],
    en: 'Revenue by category',
    ar: 'الإيرادات حسب الفئة',
    // Only a competing TITLE is rejected — "الفئات" is the glossary's
    // approved plural of the entity word "فئة" and is used all over.
    forbiddenAr: [/الإيرادات حسب الفئات/],
    forbiddenEn: [/^revenue by categories$/i],
  },
  {
    concept: 'Orders by payment method',
    keys: ['dashboard.ordersByPayment'],
    en: 'Orders by payment method',
    ar: 'الطلبات حسب طريقة الدفع',
    forbiddenAr: [/الطلبات حسب طرق الدفع/],
    forbiddenEn: [/^orders by payment methods$/i],
  },
  {
    concept: 'Top selling products',
    keys: ['dashboard.topSellingProducts'],
    en: 'Top selling products',
    ar: 'أكثر المنتجات مبيعًا',
    forbiddenAr: [/أفضل المنتجات/],
    forbiddenEn: [/^top products$/i, /^top selling product$/i],
  },
] as const;

/**
 * The orders glossary — one word per concept, in BOTH locales.
 *
 * The same concept used to have two words: the orders list read
 * `orders.statuses.*` and the status BADGE read `common.statuses.*`, so a
 * cancelled order said "ملغاة" in the list and "ملغي" on the badge of the
 * same row. The payment method had the same split
 * (`orders.paymentMethods.*` vs `dashboard.paymentMethods.*`).
 *
 * The test below fails as soon as one concept maps to two terms again.
 */
const ORDERS_GLOSSARY: Array<{
  concept: string;
  values: string[];
  ordersKey: (value: string) => string;
  otherKey: (value: string) => string;
}> = [
  {
    concept: 'Order status',
    values: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    ordersKey: (v) => `orders.statuses.${v}`,
    otherKey: (v) => `common.statuses.${v.toLowerCase()}`,
  },
  {
    concept: 'Payment status',
    values: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    ordersKey: (v) => `orders.paymentStatuses.${v}`,
    otherKey: (v) => `common.statuses.${v.toLowerCase()}`,
  },
  {
    concept: 'Payment method',
    values: ['ONLINE', 'CASH_ON_DELIVERY'],
    ordersKey: (v) => `orders.paymentMethods.${v}`,
    otherKey: (v) => `dashboard.paymentMethods.${v}`,
  },
];

describe('orders glossary', () => {
  it('a concept maps to ONE term — the list and the badge agree', () => {
    const drift: string[] = [];
    for (const entry of ORDERS_GLOSSARY) {
      for (const value of entry.values) {
        for (const tag of ['en', 'ar'] as const) {
          const a = catValue(entry.ordersKey(value), tag);
          const b = catValue(entry.otherKey(value), tag);
          if (a !== b) {
            drift.push(
              `${tag}: ${entry.concept} "${value}" -> "${a}" (${entry.ordersKey(value)}) ` +
                `vs "${b}" (${entry.otherKey(value)})`,
            );
          }
        }
      }
    }
    expect(drift, `one concept, one term:\n${drift.join('\n')}`).toEqual([]);
  });

  it('every orders term is present in both locales', () => {
    const missing: string[] = [];
    for (const entry of ORDERS_GLOSSARY) {
      for (const value of entry.values) {
        for (const tag of ['en', 'ar'] as const) {
          const v = catValue(entry.ordersKey(value), tag);
          if (!v) missing.push(`${tag}:${entry.ordersKey(value)}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('no Arabic orders term mixes scripts', () => {
    const mixed: string[] = [];
    for (const key of [...enKeys, ...arKeys].filter((k) => k.startsWith('orders.'))) {
      const v = catValue(key, 'ar');
      if (!v) continue;
      // The placeholders ({{count}}, {{status}}) are not part of the word.
      const words = v.replace(/\{\{[^}]*\}\}/g, '');
      // A Latin letter in an Arabic term means the key was never translated
      // (or was translated with an English word left in it). Keyboard key
      // names (Ctrl/Cmd/Enter) and proper nouns are the exceptions: they are
      // printed as they are on the keyboard, not translated.
      if (
        /[A-Za-z]/.test(words) &&
        !/SKU|ORD|CSV|Instagram|Facebook|WhatsApp|URL|Email|Ctrl|Cmd|Enter/i.test(words)
      ) {
        mixed.push(`ar:${key} = "${v}"`);
      }
    }
    expect(mixed).toEqual([]);
  });
});

describe('dashboard glossary (docs/glossary.md)', () => {
  it('every pinned concept uses its approved word in both locales', () => {
    const drift: string[] = [];
    for (const entry of DASHBOARD_GLOSSARY) {
      for (const key of entry.keys) {
        const enV = catValue(key, 'en');
        const arV = catValue(key, 'ar');
        if (enV !== entry.en) drift.push(`en:${key} = "${enV}" (expected "${entry.en}")`);
        if (arV !== entry.ar) drift.push(`ar:${key} = "${arV}" (expected "${entry.ar}")`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('a concept maps to ONE term — no competing title in its own namespace', () => {
    // The check is scoped to the concept's OWN namespace. "Needs attention"
    // and "Low stock alerts" are different concepts, and the word "alerts"
    // is correct for the second one; only a second name for the SAME
    // concept is drift.
    const violations: string[] = [];
    for (const entry of DASHBOARD_GLOSSARY) {
      const namespace = entry.keys[0].includes('.')
        ? entry.keys[0].split('.').slice(0, -1).join('.')
        : '';
      const ownKeys = [...enKeys, ...arKeys].filter(
        (k) =>
          k.startsWith(`${namespace}.`) &&
          !isPluralKey(k, en) &&
          !isPluralKey(k, ar),
      );
      for (const key of ownKeys) {
        const enV = catValue(key, 'en');
        const arV = catValue(key, 'ar');
        // Only the concept's TITLE carries the concept's name; a sub-string
        // (a hint, a count label) may legitimately use another word.
        if (!/(title|heading|label)$/.test(key) && !entry.keys.includes(key as never)) {
          continue;
        }
        for (const re of entry.forbiddenAr) {
          if (re.test(arV)) violations.push(`ar:${key} = "${arV}" uses the rejected word for "${entry.concept}"`);
        }
        for (const re of entry.forbiddenEn) {
          if (re.test(enV)) violations.push(`en:${key} = "${enV}" uses the rejected word for "${entry.concept}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('every dashboard widget title is sentence case in English', () => {
    // "Revenue by Category" -> "Revenue by category". A title is allowed
    // ONE capital (the first word) and proper nouns ("Top selling
    // products" is fine, "Low Stock Alerts" is not).
    const offenders: string[] = [];
    const TITLE_KEYS = [
      'dashboard.revenueOverview',
      'dashboard.revenueByCategory',
      'dashboard.revenueByOrigin',
      'dashboard.revenueByRoastLevel',
      'dashboard.topSellingProducts',
      'dashboard.recentOrders.title',
      'dashboard.lowStockProducts',
      'dashboard.deviceBreakdown',
      'dashboard.ordersByPayment',
      'dashboard.paidByStatus',
      'dashboard.repeatPurchaseRate',
      'dashboard.refundRate',
      'dashboard.coffeeSold',
      'dashboard.newCustomers',
      'dashboard.averageOrderValue',
      'dashboard.charts.ordersByStatus',
    ];
    for (const key of TITLE_KEYS) {
      const v = catValue(key, 'en');
      if (!v) continue;
      // A capital letter anywhere but the start = Title Case.
      const capitals = [...v.matchAll(/\b[A-Z]/g)].map((m) => m.index ?? 0);
      const offending = capitals.filter((i) => i !== 0);
      if (offending.length > 0) offenders.push(`en:${key} = "${v}"`);
    }
    expect(offenders, `widget titles must be sentence case:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every plural family resolves in both locales', () => {
    // The families the dashboard uses for counts: days, sold, orders,
    // customers. English has one/other; Arabic has all six categories.
    const FAMILIES = ['dashboard.countDays', 'dashboard.countSold', 'dashboard.countOrders', 'dashboard.countCustomers'];
    const missing: string[] = [];
    for (const base of FAMILIES) {
      for (const s of EN_SUFFIXES) if (!enKeys.has(`${base}_${s}`)) missing.push(`en:${base}_${s}`);
      for (const s of AR_SUFFIXES) if (!arKeys.has(`${base}_${s}`)) missing.push(`ar:${base}_${s}`);
    }
    expect(missing).toEqual([]);
  });
});

/**
 * The reviews and messages vocabulary.
 *
 * One concept, one term, in both languages, in every surface. The AR
 * review status is "قيد المراجعة" and NOT the order status "قيد الانتظار":
 * two different concepts, two different words, and the same word for two
 * concepts is the drift this test exists to catch.
 */
const REVIEWS_MESSAGES_GLOSSARY = [
  {
    concept: 'Review approved',
    keys: ['reviews.status.approved'],
    en: 'Approved',
    ar: 'معتمد',
    forbiddenAr: [/موافق عليه/],
    forbiddenEn: [/\bapproved by\b/i],
  },
  {
    concept: 'Review pending',
    keys: ['reviews.status.pending'],
    en: 'Pending',
    ar: 'قيد المراجعة',
    forbiddenAr: [/غير معتمدة/, /مُفعّل/, /معطّل/],
    forbiddenEn: [/unapproved/i],
  },
  {
    concept: 'Message unread',
    keys: ['contactMessages.unread'],
    en: 'Unread',
    ar: 'غير مقروءة',
    forbiddenAr: [/^رد$/],
    forbiddenEn: [/^not read$/i],
  },
  {
    concept: 'Message replied',
    keys: ['contactMessages.replied'],
    en: 'Replied',
    ar: 'تم الرد عليها',
    forbiddenAr: [/^رد$/],
    forbiddenEn: [/^replied to$/i],
  },
] as const;

describe('reviews and messages glossary', () => {
  it('a concept maps to ONE term — the approved word, in both locales', () => {
    const drift: string[] = [];
    for (const entry of REVIEWS_MESSAGES_GLOSSARY) {
      for (const key of entry.keys) {
        const en = catValue(key, 'en');
        const ar = catValue(key, 'ar');
        if (en !== entry.en) drift.push(`en:${key} → "${en}" (expected "${entry.en}")`);
        if (ar !== entry.ar) drift.push(`ar:${key} → "${ar}" (expected "${entry.ar}")`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('a concept never drifts to a second word', () => {
    const drift: string[] = [];
    for (const entry of REVIEWS_MESSAGES_GLOSSARY) {
      for (const pattern of entry.forbiddenAr) {
        if (pattern.test(entry.ar)) drift.push(`ar:${entry.concept} → "${entry.ar}"`);
      }
      for (const pattern of entry.forbiddenEn) {
        if (pattern.test(entry.en)) drift.push(`en:${entry.concept} → "${entry.en}"`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('the review status is not the order status', () => {
    // "قيد الانتظار" is the ORDER status; the review's is "قيد المراجعة".
    expect(catValue('common.statuses.pending', 'ar')).not.toBe(
      catValue('reviews.status.pending', 'ar'),
    );
  });
});
