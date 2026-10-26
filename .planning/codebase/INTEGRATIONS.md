---
last_mapped_commit: 2c5b82b097aec293aee8a62c7d6ea81070ac203e
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# External Integrations

**Analysis Date:** 2026-10-26

## Backend API

- **Base URL:** `http://localhost:8080` (`src/environments/environment.ts`).
- **API style:** REST over HTTP; JSON envelopes `ApiResponse<T>` / `PageResponse<T>` (`src/app/core/models/api-response.model.ts`).
- **Auth:** JWT access token in memory (signal) + httpOnly refresh cookie; `authInterceptor` attaches bearer token and handles 401 refresh/clear session.
- **Language:** `languageInterceptor` adds language header to requests.
- **Primary endpoints (dashboard):** `/api/dashboard/*` (orders, products, users, roles, reviews, contact messages, broadcasts, carts, categories, farms, origins, processing/roast/brewing/tasting-note/product-options, shipping zones, promo codes, store settings, dashboard stats, nav counts), plus `/api/auth/*` and `/api/settings`.
- **Soft delete:** many entities support `getDeleted` / `restore` / `deletePermanently` (see `BaseCrudService`).

## Internal Service Layer

- **HTTP client:** Angular `HttpClient` with functional interceptors.
- **Feature services:** one per domain under `src/app/features/<feature>/...` (e.g. `src/app/features/products/services/product.service.ts`, `src/app/features/orders/services/order.service.ts`).
- **Shared base:** `BaseCrudService` and `BaseListComponent` (`src/app/core/crud/*`) standardize CRUD list pages; some services (e.g. `ProductService`) implement CRUD independently.
- **Singleton global services:** `AuthService`, `PermissionService`, `ThemeService`, `LanguageService`, `StoreSettingsService`, `NavCountsService`, `NotifyService`, `DirtyRegistry`.

## Authentication & Authorization

- **Login flow:** `AuthService` (`src/app/core/auth/auth.service.ts`) handles login/refresh/logout and refresh timer.
- **Route guards:** `authGuard` (login + ADMIN role) and `permissionGuard(permission)` (`src/app/core/auth/permission.guard.ts`).
- **Template gating:** `PermissionService.has(slug)` plus `appCan` / `appCanDisable` directives (`src/app/core/auth/permission.directive.ts`, `src/app/shared/directives/can*.directive.ts`).
- **Unsaved changes:** `unsavedChangesGuard` (`src/app/core/guards/unsaved-changes.guard.ts`) plus global `DirtyRegistry`.

## Internationalization

- **Library:** Transloco.
- **Dictionaries:** `public/assets/i18n/en.json`, `ar.json` (loaded before render by `LanguageService` / app initializers).
- **RTL/LTR:** `LanguageService` sets document `dir` and active language.

## Theming

- **ThemeService** toggles `.dark` class on `<html>` and persists to localStorage.

## External Libraries / Assets

- **ApexCharts** bundle injected via `angular.json` scripts.
- **Quill** rich text editor for journal/broadcast content.
- **Embla Carousel** for media galleries.
- **GSAP** for animations.
- **Spartan Helm** UI primitives (`libs/ui/*`).

## Dev / QA Integrations

- **Playwright** E2E (`e2e/`, `playwright.config.ts`), workers=1, chromium.
- **QA harness** (`qa/playwright.config.ts`, `scripts/qa-static.mjs`) for route-based UI audit.
- **Evidence harness** (`scripts/evidence.mjs`, `scripts/evidence-targets.mjs`) for viewport matrix captures and `results.json`.
- **Backend dependency:** E2E assumes backend running on `:8080`; dev server on `:4200` is managed by Playwright.

---

*Integrations analysis: 2026-10-26*
