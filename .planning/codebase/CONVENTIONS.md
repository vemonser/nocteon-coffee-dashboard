---
last_mapped_commit: 2c5b82b097aec293aee8a62c7d6ea81070ac203e
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# Coding Conventions

**Analysis Date:** 2026-10-26

## Formatting

- **Prettier:** `printWidth: 100`, single quotes, Angular HTML parser for `*.html` (`.prettierrc`).
- **EditorConfig:** 2-space indentation, UTF-8, final newline, trim trailing whitespace (`.editorconfig`).
- **TypeScript quotes:** single quotes (`ij_typescript_use_double_quotes = false`).

## Angular Patterns

- **Standalone components only.** No NgModules; each component declares its own `imports`.
- **Signals-first state.** Use `signal`, `computed`, `effect`; RxJS only for HTTP streams.
- **Lazy loading.** Routes use `loadComponent` in `src/app/app.routes.ts`.
- **Feature folders.** Each domain owns components/models/services/utils; core holds cross-cutting services.
- **Base abstractions.** `BaseCrudService` and `BaseListComponent` standardize CRUD pages; prefer extending them.

## Naming

- **Files:** kebab-case (`product-list.component.ts`, `order.service.ts`).
- **Classes:** PascalCase with suffix (`ProductListComponent`, `OrderService`).
- **Signals:** camelCase; computed names describe derived state.
- **i18n keys:** dotted, lowercase camelCase (`orders.detail.collectedAt`).
- **CSS classes:** Tailwind utilities; design tokens from `src/styles`.

## Forms

- Reactive forms with validators.
- Save disabled until form is dirty and valid.
- Errors appear after blur or submit attempt.
- One Save per page, typically sticky footer.
- Dirty tracking via deep-compare of normalized snapshot.

## Dialogs

- Footer order: destructive → secondary → primary.
- Primary button names the action ("Add option", not generic "Save").
- Esc closes; focus trapped and returns to trigger.

## Lists

- Fixed row height (~72px).
- Bulk action bar when rows selected.
- Loading skeleton, empty state, error state with retry.
- Filter row: search + selects share 38px height.
- Row actions in kebab menu; no always-visible red trash.

## Internationalization

- Every visible string goes through Transloco (`en` + `ar`).
- No raw keys or hardcoded text on screen.
- Dates, numbers, money use shared helpers only (`formatDate`, `formatDateTime`, `formatRelative`, currency formatter `EGP 650.00`).
- Sentence case for titles/labels/buttons/nav/table headers (proper nouns excepted).

## Layout & Styling

- Logical CSS only (`ms/me/ps/pe/text-start/text-end`).
- Colors from tokens; check light, dark, and RTL.
- Filter controls share 38px height.

## Permissions

- Gate UI with `PermissionService` (`has('x:y')`, `*appCan`).
- Server remains source of truth; 403 handled with one de-duplicated toast.

## Status Vocabulary

- Active / Blocked; Verified / Unverified; Enabled / Disabled (products).
- Order statuses from shared map; one badge component (`@nocteon/status-badge`).

## Error Handling

- HTTP errors surface via `NotifyService.apiError` toast + inline dialog errors.
- List loading sets `loadError` signal with retry.
- 403 de-duplicated toast; 401 refresh/clear session in `authInterceptor`.

---

*Conventions analysis: 2026-10-26*
