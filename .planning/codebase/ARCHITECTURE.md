---
last_mapped_commit: 2c5b82b097aec293aee8a62c7d6ea81070ac203e
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# Architecture

**Analysis Date:** 2026-10-26

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Browser (SPA)                          │
│  bootstrapApplication(App, appConfig)  src/main.ts          │
├──────────────────┬──────────────────┬───────────────────────┤
│   Router         │   Layout shell   │    Standalone comps    │
│  app.routes.ts   │  features/layout │    features/*          │
│  (lazy load)     │  layout.component│                        │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core services layer                      │
│  src/app/core  (auth, permissions, i18n, theme, notify,     │
│   crud base, dashboard metrics, settings, nav counts)        │
└────────────────────────┬────────────────────────────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│  HttpClient + interceptors (auth, language)                  │
│  src/app/core/interceptors, src/app/core/providers           │
└────────────────────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend REST API  (environment.apiUrl = http://localhost:8080) │
│  /api/dashboard/*, /api/auth/*, /api/settings, ...          │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App (root) | Hosts router outlet + global dialogs; beforeunload dirty guard | `src/app/app.ts` |
| appConfig | Wires providers (router, http, transloco, initializers, icons, quill) | `src/app/app.config.ts` |
| routes | Central route table; lazy `loadComponent`; guards per route | `src/app/app.routes.ts` |
| LayoutComponent | Dashboard shell (sidebar + nav bar + toaster); focus management on nav | `src/app/features/layout/layout.component.ts` |
| AppSidebarComponent | Permission-filtered nav sections, badge counts, expand/collapse | `src/app/features/layout/sidebar/app-sidebar.component.ts` |
| AuthService | Session (signals), login/refresh/logout, JWT refresh timer, permission check | `src/app/core/auth/auth.service.ts` |
| PermissionService | `has(slug)` over current user permissions (ADMIN bypass) | `src/app/core/auth/permission.service.ts` |
| BaseCrudService | Abstract HTTP CRUD + soft-delete endpoints (getDeleted/restore/deletePermanently) | `src/app/core/crud/base-crud.service.ts` |
| BaseListComponent | Reusable list directive: paging, sort, search, dialog CRUD, soft-delete tabs, bulk ops, URL state | `src/app/core/crud/base-list.component.ts` |
| StoreSettingsService | Loads store currency (GET /api/settings); single source for currency | `src/app/core/settings/store-settings.service.ts` |
| NavCountsService | Polls /api/dashboard/nav-counts for sidebar badges | `src/app/core/nav/nav-counts.service.ts` |
| LanguageService | Dictionary load + active lang + document dir (RTL/LTR) | `src/app/core/i18n/language.service.ts` |
| ThemeService | light/dark signal + localStorage + html class | `src/app/core/theme/theme.service.ts` |

## Pattern Overview

**Overall:** Standalone-component Angular SPA with feature-based folders, signal-based state, and lazy-loaded routes. UI built on Spartan Helm components (`libs/ui/*`) + Tailwind CSS; i18n via Transloco.

**Key Characteristics:**
- Standalone components (no NgModules); each component declares its own `imports`.
- Signals (`signal`, `computed`, `effect`) for reactive state; RxJS only for HTTP streams.
- Feature folders own models/services/components; core holds cross-cutting services.
- Lazy loading via `loadComponent` in `app.routes.ts`; route guards for auth/permission/unsaved changes.
- Shared base abstractions (`BaseCrudService`, `BaseListComponent`) for CRUD list pages.
- Permission-based UI gating (`PermissionService`, `appCan`/`hasPermission` directives) with server as source of truth.

## Layers

**App shell / bootstrap:**
- Purpose: Bootstrap application, global providers, root component.
- Location: `src/main.ts`, `src/app/app.ts`, `src/app/app.config.ts`, `src/app/app.routes.ts`
- Contains: bootstrap, providers, route table
- Depends on: core providers
- Used by: browser entry

**Core layer:**
- Purpose: Cross-cutting infrastructure — auth, permissions, i18n, theme, notifications, CRUD base, dashboard metrics, settings, nav counts, guards, interceptors, models.
- Location: `src/app/core/`
- Contains: services, guards, interceptors, models, providers, animations, design baselines
- Depends on: `environment`, HttpClient
- Used by: features and shared

**Feature layer:**
- Purpose: Domain features (products, orders, users, ...). Each owns components, models, services.
- Location: `src/app/features/<feature>/`
- Contains: list/detail/wizard components, feature services, DTOs
- Depends on: core, shared
- Used by: routes (lazy)

**Shared layer:**
- Purpose: Reusable UI components, directives, pipes, utils, data (nav items).
- Location: `src/app/shared/`
- Contains: data-table, dialogs, UI atoms, pipes, utils, directives
- Depends on: core (some), Spartan libs
- Used by: features

**UI primitives (Spartan):**
- Purpose: Headless UI component library (shadcn-style) mapped via tsconfig paths.
- Location: `libs/ui/*`
- Contains: component implementations
- Used by: shared and features via `@spartan-ng/helm/*`

## Data Flow

### Primary Request Path (list page)

1. Route activates lazy component (`app.routes.ts` `loadComponent`).
2. Component injects feature service (e.g. `ProductService` in `src/app/features/products/services/product.service.ts`).
3. Service calls `HttpClient` against `${environment.apiUrl}/api/dashboard/...` with HttpParams.
4. `authInterceptor` attaches bearer token; `languageInterceptor` adds language header.
5. Response `ApiResponse<T>` unwrapped; signals updated; template renders.

### Auth / session flow

1. `app-initializers.provider.ts` calls `AuthService.initializeSession()` (refresh via httpOnly cookie).
2. `authGuard` checks `isLoggedIn()` + ADMIN role before entering `/dashboard`.
3. `permissionGuard(permission)` checks `AuthService.hasPermission()` for route.
4. JWT refresh timer re-refreshes ~30s before expiry (`startRefreshTimer`).

### State Management

- Component-local state via Angular signals (`signal`, `computed`).
- Shared singleton services (`providedIn: 'root'`) hold global state (auth, theme, language, settings, nav counts).
- No global store (NgRx); `DirtyRegistry` tracks unsaved forms for unsaved-changes guard.
- URL query params persist list view/search/page/size/status (`BaseListComponent`).

## Key Abstractions

**BaseCrudService<TResponse, TRequest, TId>:**
- Purpose: Standardized HTTP CRUD + soft-delete endpoints for entities.
- Examples: `src/app/core/crud/base-crud.service.ts`; feature services that extend or mirror it (e.g. `src/app/features/products/services/product.service.ts` — independent implementation).
- Pattern: abstract `basePath`; `buildBaseParams`, `buildRequestBody` (auto multipart/json).

**BaseListComponent<TResponse, TRequest, TId>:**
- Purpose: Reusable list page controller (paging, sort, search, dialog create/edit, delete, soft-delete tabs, bulk ops, undo toast, URL state).
- Examples: `src/app/core/crud/base-list.component.ts`; consumed by feature list components.
- Pattern: abstract methods `getId`, `loadPage`, `buildForm`, `toRequest`, `callCreate`, `callUpdate`, `callDelete`, `onEditOpen`.

**ApiResponse<T> / PageResponse<T>:**
- Purpose: Backend envelope and paging shape.
- Examples: `src/app/core/models/api-response.model.ts`.

**Permission gating:**
- Purpose: Route + template level authorization.
- Examples: `src/app/core/auth/permission.guard.ts`, `src/app/core/auth/permission.directive.ts`, `src/app/shared/directives/can.directive.ts`, `src/app/shared/directives/can-disable.directive.ts`.

**Locale formatting:**
- Purpose: Single source for dates/numbers/money in both languages.
- Examples: `src/app/shared/utils/locale-format.ts` (`formatDate`, `formatCurrency`, `formatCompactCurrency`, ...).

## Entry Points

**Browser entry:**
- Location: `src/main.ts`
- Triggers: page load
- Responsibilities: bootstrap `App` with `appConfig`

**Root component:**
- Location: `src/app/app.ts`
- Triggers: bootstrap
- Responsibilities: router outlet + global dialogs + beforeunload dirty guard

**Route table:**
- Location: `src/app/app.routes.ts`
- Triggers: navigation
- Responsibilities: lazy load feature components, apply guards

**App initializers:**
- Location: `src/app/core/i18n/app-initializers.provider.ts`
- Triggers: bootstrap (before render)
- Responsibilities: load language dictionary, apply theme, initialize session

## Architectural Constraints

- **Threading:** Single-threaded browser event loop; RxJS for async HTTP. No workers.
- **Global state:** Module-level singletons via `providedIn: 'root'` (AuthService, ThemeService, LanguageService, StoreSettingsService, NavCountsService, PermissionService, NotifyService, DirtyRegistry). No central store.
- **Circular imports:** None observed at top level; features import core/shared only. Shared utils import core i18n types.
- **Standalone components:** All components standalone; no NgModule. `libs/ui` components registered via tsconfig paths.
- **Path aliases:** `@spartan-ng/helm/*` and `@nocteon/status-badge` resolve to `libs/ui/*` and `src/app/shared/ui/status-badge` (see `tsconfig.json`).
- **Environment:** Single environment file `src/environments/environment.ts` (apiUrl localhost:8080); no prod env file; production build uses file replacement only for notification mock.

## Anti-Patterns

### Inconsistent feature service base class

**What happens:** Most entities use `BaseCrudService`; `ProductService` (`src/app/features/products/services/product.service.ts`) re-implements CRUD independently with its own `MAX_PAGE_SIZE` cap and manual HttpParams.
**Why it's wrong:** Duplicated pagination cap and request building; drift risk (e.g. soft-delete endpoints reimplemented by hand).
**Do this instead:** Extend `BaseCrudService` and override only entity-specific params, matching `src/app/core/crud/base-crud.service.ts`.

### Mixed component location conventions

**What happens:** Some lists live at `features/<x>/components/<x>-list.component.ts` (categories, users), others at `features/<x>/components/<x>-list/<x>-list.component.ts` (products, orders), and detail pages vary (`category-detail/components/...` vs `orders/order-detail/...`).
**Why it's wrong:** Inconsistent import paths and discovery.
**Do this instead:** Follow the dominant `features/<feature>/<feature>-detail/components/...` and `features/<feature>/components/<name>.component.ts` pattern; document deviations in `STRUCTURE.md`.

### Direct AuthService permission checks in templates

**What happens:** Some components call `auth.hasPermission(...)` directly instead of `PermissionService.has(...)` or `appCan` directive.
**Why it's wrong:** Bypasses the single permission source and signal reactivity consistency.
**Do this instead:** Use `PermissionService` (`src/app/core/auth/permission.service.ts`) and `appCan`/`appCanDisable` directives.

## Error Handling

**Strategy:** HTTP errors surface via `NotifyService.apiError` (toast) and inline dialog errors; list loading sets `loadError` signal with retry. 403 handled with de-duplicated toast. Form validation errors shown after blur/submit.

**Patterns:**
- `BaseListComponent.load()` sets `loadError` on failure; templates show error state with retry.
- Submit errors set `dialogError` signal above submit button + toast.
- Soft-delete restore failures classified via `classifyRestoreError` (404/409/401/403).
- `authInterceptor` handles 401 (refresh/clear session).

## Cross-Cutting Concerns

**Logging:** Console in dev; no centralized logger. Transloco `missingHandler.logMissingKey` in dev.
**Validation:** Reactive forms with validators; `form.invalid` blocks submit; errors after blur/submit.
**Authentication:** JWT access token in memory (signal); refresh token httpOnly cookie; `authInterceptor` + `languageInterceptor`.
**i18n:** Transloco with `public/assets/i18n/{en,ar}.json`; `LanguageService` loads dictionary before render; RTL via document dir.
**Theming:** `ThemeService` toggles `dark` class on `<html>`; Tailwind dark mode.

---

*Architecture analysis: 2026-10-26*
