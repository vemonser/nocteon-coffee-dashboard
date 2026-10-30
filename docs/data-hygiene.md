# Data hygiene — where the test records come from

Branch: `data-hygiene`

## H1. The pollution

The `Auditcov …` records visible in the dashboard are **not created by this
repository's Playwright/QA specs**. The literal `Auditcov` only exists in the
backend repository's audit integration tests:

`../nocteon-backend/src/test/java/com/nocteon/nocteon_api/audit/`

| Test | Records it creates |
| --- | --- |
| `LookupAuditIntegrationTest` | **origins, farms, roast levels, processing methods, coffee varieties, tasting notes, brewing methods, pairings, categories** — names `Auditcov lookup <label> <suffix>` / `… renamed`, slugs `auditcov-lookup-…`, plus an `auditcov-lookup-admin-…` user. This is the source of the Pairings trash and the tasting note in the Add-product wizard. |
| `JournalAuditIntegrationTest` | journal posts, journal categories, `auditcov-journal-admin-…` user |
| `OrderAuditCoverageIntegrationTest` | orders, an `auditcov-order-…` admin + customer |
| `ProductAuditCoverageIntegrationTest` | products, categories, `auditcov-prod-admin-…` user |
| `ProductTagOptionAuditIntegrationTest` | product tags/options, `auditcov-tagopt-admin-…` user |
| `PromoCodeAuditIntegrationTest` | promo codes (`PROMORB-…`), `auditcov-promo-admin-…` user |
| `ReviewAuditCoverageIntegrationTest` | reviews, products, categories, admin + author users |
| `ShippingZoneAuditIntegrationTest` | shipping zones (`Auditcov shipzone …`), `auditcov-ship-admin-…` user |
| `AuthAuditCoverageIntegrationTest` | users, audit-log rows, `auditcov-auth-…` users |

Those tests do run JDBC cleanup in `@BeforeEach`/`@AfterEach`, but a run that is
interrupted (or a cleanup step that fails after a failed assertion) leaves rows
behind. They also talk to the same local database the dashboard reads.

`grep -rn "Auditcov" qa e2e scripts` returns **0 matches**: the dashboard suite
never used that prefix.

### Dashboard specs/scripts that create data

| File | Entity / operation | Cleanup before this branch |
| --- | --- | --- |
| `e2e/verify-create-ux.spec.ts` | categories (UI create) | trashed only, never permanently deleted |
| `e2e/_shots-create-ux.spec.ts` | categories (16 screenshot states, `happy` creates) | trashed only |
| `e2e/evidence-fe-09-10.spec.ts` | tags (UI create) + assigns it to `brazil-mogiana` | UI deletes the tag only on the happy path; a failure left it linked (409 on trash) |
| `e2e/newsletter-broadcast.spec.ts` | broadcasts (UI create) | UI delete only; a failure left it behind |
| `scripts/evidence-targets.mjs` (`review-dialog` phase) | reviews (`POST /api/products/reviews`) | only when `--cleanup-fixtures` is passed |
| `scripts/rbac-pass2-evidence.mjs` | roles (`ZERO_PERMS_E2E`) | deletes it at the end of the script |
| `e2e/review-dialog.spec.ts` | mutates a seed review approval (PATCH) | restores it |
| `e2e/verify-detail-ux.spec.ts`, `e2e/measurements.spec.ts` | edit `coffee` and revert without saving | no new row |
| `e2e/verify-delete-confirm.spec.ts` | tries to delete the referenced `coffee` category (409) | nothing moves |

`qa/audit.spec.ts` and `qa/scenarios.ts` only read pages and open dialogs; they
do not submit creates.

## H2. Purge script

`scripts/purge-test-data.mjs`

```bash
npm run purge:test-data                  # dry run, table + totals
npm run purge:test-data -- --yes         # trash, then permanently delete
npm run purge:test-data -- --prefix=Auditcov --yes
npm run purge:test-data -- --json        # machine-readable report
```

It scans the active **and trash** views of: origins, farms, roast levels,
processing methods, coffee varieties, tasting notes, brewing methods, pairings,
tags, categories, shipping zones, promo codes, products, journal posts,
broadcasts. A record matches only when its English/Arabic name, slug or code
**starts with** a prefix in `qa/test-prefixes.json` (`Auditcov`, `QA `, `e2e-`);
`includes` is never used.

Safety:

- refuses an API base whose hostname is not `localhost` / `127.0.0.1` / `::1`;
- refuses when `NODE_ENV` / `SPRING_PROFILES_ACTIVE` / `APP_ENV` / `PROFILE`
  looks like production;
- paces requests below the backend's 200/minute general limiter and retries a
  `429` with backoff;
- `--yes` always trashes first, then calls `/{id}/permanent` (broadcasts are
  already hard-deleted by their only DELETE endpoint);
- the final scan must be 0, otherwise the script exits with code 1.

### Before / after on the dev database (prefix `Auditcov`)

| Entity | Before (active + trash) | After |
| --- | ---: | ---: |
| Origins | 14 + 14 = 28 | 0 |
| Farms | 0 + 14 = 14 | 0 |
| Roast levels | 1 + 15 = 16 | 0 |
| Processing methods | 1 + 15 = 16 | 0 |
| Coffee varieties | 1 + 15 = 16 | 0 |
| Tasting notes | 1 + 15 = 16 | 0 |
| Brewing methods | 1 + 15 = 16 | 0 |
| Pairings | 1 + 15 = 16 | 0 |
| Tags | 0 | 0 |
| Categories | 1 + 15 = 16 | 0 |
| Shipping zones | 0 | 0 |
| Promo codes | 0 | 0 |
| Products | 0 | 0 |
| Journal posts | 0 | 0 |
| Broadcasts | 0 | 0 |
| **Total** | **21 + 133 = 154** | **0** |

The first `--yes` attempt hit the API's 200-request/minute limiter halfway; the
script now retries 429s, and the final run deleted the remaining 60 and ended at
0.

## H3. Tests clean up after themselves

- `qa/test-prefixes.json` — the one list of legal test prefixes.
- `qa/test-data-entities.json` — the one list of list endpoints, trash endpoints
  and delete style, shared by the purge script and the Playwright helper.
- `e2e/helpers/test-data.ts` — `testName()` builds every created name as
  `e2e-<run-id>-<label>`; `recordResponse()` stores the returned id + slug in
  `qa/.run/<run-id>.json`; `cleanupCreated()` trashes and permanently deletes
  those ids in `afterAll`, even when the test failed.
- `e2e/global-teardown.ts` — after the whole run, runs the purge with the run's
  exact prefix and fails the run if anything is left.
- `playwright.config.ts` — creates the run id/prefix and registers the global
  teardown.
- `qa/no-test-data.spec.ts` — the QA check: after a full QA run, the dry-run
  scan must report `Totals: 0`. `npm run qa:no-test-data` runs it alone.
- `package.json` — `purge:test-data` and `qa:no-test-data`.

The data-creating specs now use `testName(...)` and record ids:

- `e2e/verify-create-ux.spec.ts` → category, afterAll permanent delete.
- `e2e/_shots-create-ux.spec.ts` → category, afterAll permanent delete.
- `e2e/evidence-fe-09-10.spec.ts` → tag, tries to detach it in `finally` (a
  linked tag cannot be trashed), then afterAll deletes it.
- `e2e/newsletter-broadcast.spec.ts` → broadcast, records the id, forgets it
  after the UI delete, afterAll is the safety net.

## Verification

```text
npm run qa                 → 2 passed (5.2m)
npm run purge:test-data    → Totals: 0 (0 active, 0 in trash)
```

The `qa/no-test-data.spec.ts` check is part of `npm run qa`, so every future QA
run fails if a test prefix is visible again.
