# Terminology glossary — Categories (EN / AR)

> One word per concept, used identically in tabs, buttons, toasts, dialogs,
> empty states, badges, and form fields. The categories scope is applied and
> enforced by `src/app/core/i18n/i18n-keys.spec.ts` ("glossary" tests).

## The glossary

| # | Concept | EN | AR | Used in |
|---|---------|----|----|---------|
| 1 | Lifecycle tabs | Active \| Trash | الحالية \| المهملات | `lifecycle-tabs`, tab counts |
| 2 | Status values | Enabled \| Disabled | مفعّل \| معطّل | badges, filters, forms — never the tab words |
| 3a | Action: trash | Move to trash | نقل إلى المهملات | row/bulk/detail buttons, toasts |
| 3b | Action: restore | Restore | استعادة | row/bulk/detail/banner buttons |
| 3c | Action: destroy | Delete permanently | حذف نهائي | confirm dialog, bulk bar |
| 4 | Entity "category" | category | فئة | titles, nav, subtitles, hints, errors, banners |

Notes:
- EN "Trash" is both tab and noun ("Trash is empty", "in Trash") — one word, fine.
- AR tab word is الحالية (not النشطة/نشط) so it can never be confused with status.
- Entity choice: **فئة**. Rationale: nav (`الفئات`), add/edit/delete titles, and the
  detail page already say فئة; only the bulk-added trash strings say تصنيف.

## Inconsistencies found (same concept, different word)

**A. "نشط" currently means three things**
- Tab: `categories.tabActive` / `trash.tabActive` = "نشط" → becomes الحالية
- Status badge: `common.active` via `status-cell` = "نشط" → becomes مفعّل
- Form checkbox: `categories.activeLabel` = "نشطة" → replaced by switch (Phase 2.1)
- Cross-tab hints embed it: `noResultsInActive` ("لا نتائج في نشط"),
  `switchToActive` ("فتح النشط") → reword to الحالية

**B. Trash is "المحذوفات" in some strings, "المهملات" in others**
- `trash.tabTrash` = "المحذوفات", `emptyTrash` = "سلة المحذوفات فارغة",
  `movedToTrash` (toast) = "تم النقل إلى المحذوفات",
  list `moveToTrash`/`bulkMoveToTrash` = "نقل إلى المحذوفات" → all become المهملات-family
- Already المهملات (keep): detail `moveToTrash` = "نقل إلى المهملات",
  `deletedBanner` = "…في المهملات…", `common.deleteFailed` = "…إلى المهملات"
- EN side is consistent ("Trash" everywhere) — no EN change except Active→Enabled.

**C. Entity: فئة vs تصنيف**
- فئة (keep): `add/addTitle/editTitle/deleteTitle`, `name` ("اسم الفئة"),
  nav `categories` ("الفئات"), `emptyActive` ("لا توجد فئات بعد"),
  detail `deleteImpact`/`deletedBanner`/`noProducts`, dashboard `revenueByCategory`
- تصنيف (change → فئة-family): `tabsLabel` ("عرض التصنيفات"),
  `subtitleActive` ("{{count}} تصنيف في متجرك"), `emptyHint`, `emptyTrashHint`,
  `trashBanner`, `restoreConflictBody`, `restoreNotFound`, `restoreForbidden`,
  `loadError`, `emptyActiveHint`, `trash.banner`, `trash.subtitleActive`

**D. Status filter (row 2 applied)**
- Filter options already say `statusEnabled`/`statusDisabled` = "مفعّل | معطّل" —
  correct, keep. Only the trigger fallback (now via `t()`) and badges change.

## Status: applied (final sweep W2, 2026-10-18, incl. user ruling A)

- `common.active`/`inactive` → Enabled/Disabled · مفعّل/معطّل (all entities' badges)
- Tabs → Active/Trash · الحالية/المهملات; trash place → المهملات; entity → فئة
- W2 sweep: every remaining المحذوفات/تصنيف/نشط-tab string in `categories.*`
  (en + ar) replaced; dead duplicates removed from both locales:
  `categories.{tabActive, tabTrash, tabsLabel, emptyTrashHint, restore,
  subtitleActive, subtitleTrash, emptyHint, trashBanner, empty, deleteTitle}`
  and `categories.trash.{subtitleActive, subtitleTrash}` (unreferenced).
- Enforcement: the "glossary" tests in `src/app/core/i18n/i18n-keys.spec.ts`
  fail CI when a forbidden term appears in `categories.*` or a concept renders
  with two different words (tabs / trash+bulk+detail action phrases /
  destroy / restore / status filters / entity word).
- The "breadcrumb label is set at page load" leftover was fixed by W1
  (`verify-language-sync.spec.ts`): the entity name now survives a mid-page
  language switch.

## Ruling A (user, 2026-10-18) — row 2 extended to ALL entities

The former out-of-scope "Active/نشط" states were unified onto the
مفعّل‑family (EN: Enabled; the root word may inflect by Arabic agreement —
مفعّلة/المفعّلة — unity is at word-root level):

| # | Concept | EN | AR |
|---|---------|----|----|
| 5a | User account status | Enabled | مفعّل (`الحساب مفعّل` for the account phrase) |
| 5b | Cart status | Enabled | مفعّلة (agrees with السلة) |
| 5c | Subscriptions metric | Enabled Subscriptions | الاشتراكات المفعّلة |
| 5d | Promo codes status | Enabled Codes | الأكواد المفعّلة |

`common.lastActive` ("آخر نشاط" last-LOGIN attribute) is intentionally NOT a
status and keeps its wording. The i18n lint now scans ALL AR strings for a
نشط‑family regression and pins the five keys' EN values.


---

## Dashboard section (Phase 2, 2026-10-20)

The dashboard's vocabulary follows the same one-concept-one-term rule. These
are enforced by the "dashboard glossary" tests in
`src/app/core/i18n/i18n-keys.spec.ts`.

| # | Concept | EN | AR | Used in |
|---|---------|----|----|---------|
| 6 | Dashboard: things to act on | Needs attention | يحتاج انتباه | the attention strip title, its AR title |
| 7 | Dashboard: revenue split | Revenue by category | الإيرادات حسب الفئة | the category breakdown card |
| 8 | Dashboard: order split | Orders by payment method | الطلبات حسب طريقة الدفع | the payment-method card |
| 9 | Dashboard: best sellers | Top selling products | أكثر المنتجات مبيعًا | the top-products card |

### Notes on row 6

The Arabic title for "Needs attention" had drifted to **تنبيهات** ("alerts"),
which is a different concept from the English — and the dashboard ALSO has a
"Low stock alerts" widget, so the two collided. The approved term is
**يحتاج انتباه**, which keeps the EN/AR concepts aligned (both are a
predicate, "needs attention").

**"alerts" / "تنبيهات" is still correct for the low-stock widget** — that is
a different concept (a catalogue list) and the glossary allows it. Every
occurrence is listed in `evidence/phase2/measurements.json`
(`glossary.rejectedWordUsages`) so a future change can see them.

The previous duplicate names `charts.topProducts` ("Top products") and
`charts.categoryPerformance` were unreferenced and named the same concepts as
rows 7 and 9, so they were removed rather than left to drift.

### Widget titles are sentence case

Every dashboard widget title is sentence case in English: **one** capital, at
the start. "Revenue by category", not "Revenue by Category". Enforced by the
"every dashboard widget title is sentence case in English" test.

One exception, deliberately: `dashboard.metrics.activeSubscriptions` stays
"Enabled Subscriptions" — it is pinned by the earlier user ruling A (row 2
extended) and is a subscriptions metric, not a dashboard widget title.

### Counts are rendered by plural category, not by a fixed word

Arabic counts a noun by the number in front of it:

| Number | Category | Example (days) | Example (sold) |
|--------|----------|----------------|----------------|
| 0 | zero | 0 يوم | لم يُبع |
| 1 | one | 1 يوم | مبيعة واحدة |
| 2 | two | 2 يومان | مبيعتان |
| 3–10 | few (PLURAL) | 7 أيام | 8 مبيعات |
| 11–99 | many (SINGULAR) | 30 يومًا | 30 مبيعة |
| 100+ | other | 100 يوم | 100 مبيعة |

The category comes from `Intl.PluralRules`; the WORDING lives in the locale
file (`dashboard.countDays_few` and so on), so a linguist can change it
without touching code. English has `one`/`other` only; Arabic has all six —
so the plural families are deliberately asymmetric, and the key-set symmetry
test exempts exactly those families.

**The slash is gone.** "4 / 5 customers" became "4 of 5 customers" / "4 من 5
عملاء": a slash between two numbers in an RTL paragraph is read right-to-left
and the two numbers swap, so the separator is a word.
