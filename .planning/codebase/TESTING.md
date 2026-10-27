---
last_mapped_commit: 2c5b82b097aec293aee8a62c7d6ea81070ac203e
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# Testing

**Analysis Date:** 2026-10-26

## Unit Tests

- **Runner:** Angular unit-test builder (Vitest available; `npm run test:unit` → `ng test`).
- **Location:** `src/**/*.spec.ts` (32 files).
- **Coverage areas:**
  - Permissions (`permission-service.spec.ts`)
  - i18n keys and relative time (`i18n-keys.spec.ts`, `relative-time.spec.ts`)
  - Dashboard metrics (`delta.spec.ts`, `order-scope.spec.ts`, `period.spec.ts`, `period-fetch.spec.ts`, `sparkline.spec.ts`, `attention.spec.ts`)
  - Design/raw control scan (`raw-controls.spec.ts`)
  - Orders utilities and adapters (`order-*.spec.ts`, `customer-summary.spec.ts`, `order-totals.spec.ts`, `order-items.adapter.spec.ts`, `order-activity.adapter.spec.ts`)
  - Reviews (`review.service.spec.ts`, `review-list.component.spec.ts`)
  - Users/roles (`role-chips.spec.ts`, `role-diff.spec.ts`)
  - Shared components (`data-table.component.spec.ts`, `status-badge.component.spec.ts`, `user-avatar.component.spec.ts`, `rating-stars.component.spec.ts`)
  - Shared utils (`locale-format.spec.ts`, `permission.utils.spec.ts`, `surface-guard.spec.ts`, `chart-rules.spec.ts`)
- **Command:** `npm run test:unit`.

## E2E Tests (Playwright)

- **Config:** `playwright.config.ts`.
- **Test dir:** `./e2e`.
- **Browser:** Chromium, viewport 1440×900.
- **Workers:** 1 (serial; login rate-limit friendly).
- **Base URL:** `http://localhost:4200` (or `E2E_BASE_URL`).
- **Dev server:** auto-started by Playwright (`npm start`) unless `E2E_NO_WEBSERVER`.
- **Auth:** storageState cached at `e2e/.auth/dashboard-admin.json`.
- **Suites:** auth, orders, reviews, contact-messages, dashboard states, order detail, review dialog, and many `verify-*` / `evidence-*` specs.
- **Commands:** `npm test`, `npm run test:e2e`, `npm run test:e2e:headed`, `npm run test:ui`, `npm run test:report`.

## QA Harness

- **Config:** `qa/playwright.config.ts` (testDir `.`, testMatch `**/*.spec.ts`).
- **Static audit:** `npm run qa:static` (`scripts/qa-static.mjs`).
- **Dynamic route audit:** `npm run qa` (Playwright with QA config).
- **Purpose:** route-based UI checks (i18n keys, dialog names, h1 vs nav labels, dirty tracking, etc.).

## Evidence Harness

- **Script:** `scripts/evidence.mjs` (npm run evidence).
- **Matrix:** widths 375/768/1024/1440/1920 × light/dark × en/ar.
- **Output:** `evidence/<phase>/results.json` plus screenshots.
- **Measurements:** merged from `evidence/<phase>/measurements.json`.
- **Auth:** one cached login via storageState; language switched at runtime.

## i18n Checks

- **Command:** `npm run i18n:check` (`scripts/i18n-case-check.mjs`).
- Validates sentence case and i18n key usage.

## Build Verification

- **Command:** `npm run build` (`ng build`).
- Production budgets enforced (initial 500kB warn / 1.6MB error).

## QA / Evidence Scripts

- `scripts/` contains 80+ scripts for measurement, capture, audit, verification, and migration (`measure-*.mjs`, `capture-*.mjs`, `verify-*.mjs`, `debug-*.mjs`).
- `evidence-targets.mjs` defines phase target sets.
- `assert-order-evidence.mjs` provides phase-specific assertions.

---

*Testing analysis: 2026-10-26*
