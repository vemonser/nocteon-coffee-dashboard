---
last_mapped_commit: 2c5b82b097aec293aee8a62c7d6ea81070ac203e
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# Project Structure

**Analysis Date:** 2026-10-26

## Top-Level Layout

```text
nocteon-dashboard/
├── src/                  # Application source
├── libs/ui/              # Vendored Spartan Helm UI primitives
├── e2e/                  # Playwright E2E tests
├── qa/                   # QA harness config + specs
├── scripts/              # Evidence, QA, measurement, utility scripts
├── evidence/             # Captured browser evidence (results.json per phase)
├── .quality/             # Evidence manifests and QA run artifacts
├── docs/                 # Specs, plans, contracts
├── .planning/            # GSD planning + codebase map
├── public/               # Static assets (i18n dictionaries, images)
├── angular.json          # Angular workspace config
├── package.json          # Scripts and dependencies
└── tsconfig*.json        # TypeScript configuration
```

## Application Source (`src/app`)

```text
src/app/
├── app.ts                 # Root component (router outlet + global dialogs)
├── app.config.ts          # Providers
├── app.routes.ts          # Central route table (lazy loadComponent)
├── core/                  # Cross-cutting infrastructure
│   ├── animations/
│   ├── auth/              # AuthService, PermissionService, guards, directives
│   ├── crud/              # BaseCrudService, BaseListComponent
│   ├── dashboard/         # Dashboard metrics, KPI, attention items
│   ├── design/            # Design baselines / raw-control scan
│   ├── guards/            # unsaved-changes guard
│   ├── i18n/              # LanguageService, relative-time, i18n keys
│   ├── interceptors/      # auth, language
│   ├── models/            # ApiResponse, PageResponse, shared models
│   ├── nav/               # NavCountsService
│   ├── notify/            # NotifyService (toasts)
│   ├── providers/         # app initializers
│   ├── services/          # shared services
│   ├── settings/          # StoreSettingsService (currency)
│   └── theme/             # ThemeService
├── features/              # Domain features
│   ├── auth/
│   ├── brewing-method/
│   ├── broadcasts/
│   ├── carts/
│   ├── categories/
│   ├── coffee-variety/
│   ├── contact-messages/
│   ├── dashboard/
│   ├── farms/
│   ├── journal/
│   ├── layout/
│   ├── newsletter/
│   ├── notification/
│   ├── notifications-list/
│   ├── orders/
│   ├── origins/
│   ├── pairing/
│   ├── processing-method/
│   ├── product-options/
│   ├── products/
│   ├── profile/
│   ├── promo-codes/
│   ├── reviews/
│   ├── roast-level/
│   ├── shipping-zone/
│   ├── store-settings/
│   ├── tasting-note/
│   ├── unauthorized/
│   └── users/
├── shared/
│   ├── components/        # data-table, dialogs, charts
│   ├── data/              # nav items
│   ├── directives/        # can, appCanDisable
│   ├── i18n/
│   ├── pipes/
│   ├── services/
│   ├── ui/                # status-badge, user-avatar, rating-stars
│   └── utils/             # locale-format, permission.utils, surface-guard
└── environments/
```

## Feature Folder Convention

Most features follow:

```text
features/<feature>/
├── <feature>-detail/      # detail page + subcomponents
├── components/            # list/form/dialog components
├── models/                # DTOs and view models
├── services/              # feature services
├── utils/                 # feature helpers
└── adapters/              # data adapters (orders)
```

Variations exist (e.g. `categories/components/category-list.component.ts` vs nested `products/components/product-list/`), documented as a concern.

## Shared & Core Locations

- **Reusable table:** `src/app/shared/components/data-table/data-table.component.ts`.
- **UI atoms:** `src/app/shared/ui/*`.
- **Locale formatting:** `src/app/shared/utils/locale-format.ts`.
- **Permission utilities:** `src/app/shared/utils/permission.utils.ts`.
- **Status badge:** `src/app/shared/ui/status-badge` (also `@nocteon/status-badge`).

## UI Primitives

- `libs/ui/*` (Spartan Helm components) consumed via `@spartan-ng/helm/*`.

## Tests

- Unit specs: `src/**/*.spec.ts` (32 files).
- E2E: `e2e/*.spec.ts` (Playwright).
- QA: `qa/*.spec.ts` (route-based audit).
- Evidence: `e2e/evidence-*.spec.ts` plus `scripts/evidence*.mjs`.

## Configuration & Scripts

- `scripts/` contains 80+ measurement, capture, audit, and verification scripts.
- `evidence/` and `.quality/` hold run artifacts and manifests.
- `docs/` holds specs, plans, contracts, and reports.

---

*Structure analysis: 2026-10-26*
