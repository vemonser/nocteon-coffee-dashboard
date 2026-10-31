# MISSES.md — the finder's ratchet

Every issue a human or an outside review finds becomes a **detector or an oracle with a
test** before it is closed. This file records the misses so the finder gets stronger
instead of being replaced by another review.

## Template

```md
### M<n> — <one-line description>
- **Page / state:** <route>, <state path>
- **Noticed by:** <human / outside review / recall run>
- **Why the finder missed it:** <the rule that did not exist, or the wrong threshold>
- **Detector or oracle added:** <file + rule id / oracle name>
- **Test:** <fixture test or oracle assertion>
- **Status:** open / fixed
```

## Log

### M1 — A raw translation key was used as an aria-label
- **Page / state:** Orders, status tabs
- **Noticed by:** the finder itself (F8 run, `i18n.raw-key-attr`), confirmed by reading the DOM
- **Why the finder missed it:** *it did not miss it* — this entry records a confirmed defect so the rule has a regression test. The attribute scan is the rule that found it; before it existed, only visible text was checked.
- **Detector or oracle added:** `qa/finder/detectors/i18n.ts` → `i18n.raw-key-attr`
- **Test:** `qa/finder/test/detectors.spec.ts` → "reports a raw key, an unresolved placeholder and a missing value"
- **Status:** open (the app defect is reported in FINDINGS.md; the rule is covered)

### M2 — The carts "All" chip shows 0 while Active shows 10
- **Page / state:** Carts, default and every tab state
- **Noticed by:** the finder (`counts.chip-sum`), verified in the browser
- **Why the finder missed it:** not a miss — recorded so the chip-sum rule stays pinned. The rule was added in this pass; before it, counts were never cross-checked.
- **Detector or oracle added:** `qa/finder/detectors/counts.ts` → `counts.chip-sum`
- **Test:** `qa/finder/test/detectors.spec.ts` → "reports chips that do not add up to All and a wrong cap"
- **Status:** open (the app defect is in FINDINGS.md)

### M3 — The dashboard's "Open orders" attention count disagrees with the sidebar badge
- **Page / state:** Dashboard, default
- **Noticed by:** the finder oracle `dashboard-open-orders-attention`
- **Why the finder missed it:** not a miss — the oracle is new. Before F4 there was no UI-vs-API comparison.
- **Detector or oracle added:** `qa/finder/invariants.ts` → `dashboard-open-orders-attention`
- **Test:** the oracle list itself (declarative; every entry is a test on each run)
- **Status:** open (needs a product decision: same metric or two named metrics)
