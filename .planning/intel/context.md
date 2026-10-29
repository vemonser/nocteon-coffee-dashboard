# Context

## Topic: Project rules and workflow (AGENTS.md)
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/AGENTS.md
- Notes: One branch per task; commit per sub-task "area: <ID> <title>"; run build + lint before each commit. Never mark Done without evidence (viewport screenshot, measured value in results.json, or passing test). Never invent backend endpoints/fields; write missing under "Needs backend" in DECISIONS.md and build safe fallback. Never run seeds/migrations against production. Source of truth for tokens/components: design.md. UI rules: i18n all strings via en+ar; sentence case; dates/numbers/money via shared helpers; logical CSS only; filter row compact height 38px; row actions in kebab; lists fixed 72px row + bulk bar + skeleton/empty/error; dialogs footer order destructive→secondary→primary, primary names action; forms Save disabled until dirty+valid, one Save per page, dirty deep-compare, errors after blur/submit, "Unsaved changes" modal, no alert/confirm/prompt (use ConfirmDialogService); no developer text on screen; permission gate via PermissionService has('x:y')/*appCan, 403 de-dup toast; one shared selector per metric; deterministic seeds; status vocabulary Active/Blocked, Verified/Unverified, Enabled/Disabled, order statuses from shared map, one badge component.

## Topic: API expectations (frontend contract)
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/API_EXPECTATIONS.md
- Notes: Frontend contract expectations vs backend. Notifications: cursor vs page/size mismatch; mark read/unread/read-all POST vs PATCH mismatch; delete exists. Nav counts: backend adds contactUnread not in frontend allow-list. Products list: stock fields missing/alias mismatch (variantsCount vs variantCount). Product option values: usage-count endpoint now implemented; appliesTo exists. Roles/permissions: endpoints exist; frontend uses static ALL_PERMISSIONS. Users summary: byRole ignored. Contact replies: endpoints exist.

## Topic: Architecture
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.planning/codebase/ARCHITECTURE.md
- Notes: Angular 22 SPA, standalone components, signals-first state, lazy routes, feature folders. Core layer (auth, permissions, i18n, theme, crud base, dashboard metrics, settings, nav counts). Feature layer per domain. Shared layer (data-table, dialogs, ui atoms, utils). Spartan Helm primitives via libs/ui. Data flow: route→feature service→HttpClient→auth/language interceptors→backend REST /api/dashboard/*. Auth: JWT in memory + httpOnly refresh cookie, authGuard (ADMIN), permissionGuard. No global store (NgRx); URL query params persist list state. Anti-patterns: ProductService reimplements CRUD independently; mixed component location conventions; direct AuthService permission checks in templates.

## Topic: Concerns
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.planning/codebase/CONCERNS.md
- Notes: Technical debt (inconsistent feature service base class, mixed component locations, incomplete permission rollout, unverified UI flows). Known issues GLOBAL-04/07/08, PRODUCTS-04/06, OPTIONS-04, NOTIF-01, VERIFY-01/02, SEARCH-01. Backend dependencies on contracts. Testing gaps (32 spec files, serial E2E, QA harness gaps, evidence manifest format). Performance (large bundles, evidence artifacts). Security (JWT in memory, refresh cookie, 403 de-dup, Playwright traces gitignored). Fragile areas (BaseListComponent, dirty-tracking, i18n checks, RTL). Operational concerns (large graph files, overlapping workflow systems, GSD not initialized at map time — superseded 2026-10-26, GSD is now initialized; see "Post-ingestion updates" below).

## Topic: Coding conventions
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.planning/codebase/CONVENTIONS.md
- Notes: Prettier printWidth 100, single quotes, 2-space indent. Standalone components only; signals-first; lazy loading; feature folders; base abstractions. Kebab-case files, PascalCase classes. i18n dotted lowercase camelCase keys. Reactive forms, Save disabled until dirty+valid, errors after blur/submit. Dialogs footer destructive→secondary→primary. Lists 72px rows, bulk bar, skeleton/empty/error, filter 38px. Logical CSS only, colors from tokens. Permission gate via PermissionService has()/*appCan. Status vocabulary. HTTP errors via NotifyService.apiError toast.

## Topic: Design system
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/design.md
- Notes: Warm-neutral surfaces, copper-brown primary (#8a4b22), semantic colors never brand. Same variable names as shadcn/spartan. RTL first-class via logical properties. Chart system (coffee-warm ramp, 6 series). Money formatted in one place (formatCurrency via | money pipe). Order number from backend. Counts state what they count. Soft delete and status mapping. Contrast audit WCAG 2.x. Typography, spacing/radius/elevation/motion. Layout rules (max-w-7xl). Page patterns (list/detail/dashboard). Accessibility and states. Order pages: one status system, progress tracker, order list, order detail, status dialog, pinned first column. Command palette (global search). Contact & reviews patterns.

## Topic: External integrations
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.planning/codebase/INTEGRATIONS.md
- Notes: Backend API base http://localhost:8080, REST JSON envelopes ApiResponse/PageResponse. Auth JWT + httpOnly refresh cookie. Endpoints /api/dashboard/*, /api/auth/*, /api/settings. Soft delete support. Internal service layer: HttpClient with functional interceptors; feature services per domain; BaseCrudService/BaseListComponent; singletons (AuthService, PermissionService, ThemeService, LanguageService, StoreSettingsService, NavCountsService, NotifyService, DirtyRegistry). i18n Transloco with en/ar dictionaries. Theming via ThemeService .dark class. External libs: ApexCharts, Quill, Embla Carousel, GSAP, Spartan Helm. Dev/QA: Playwright E2E (workers=1), QA harness, evidence harness; backend on :8080, dev server :4200.

## Topic: Technology stack
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.planning/codebase/STACK.md
- Notes: TypeScript ~6.0.2, Angular ^22.0.0, RxJS ~7.8.0, Tailwind ^4.1.12, Transloco ^8.4.0, ApexCharts, Quill, Embla, GSAP, Spartan Helm. Build: Angular CLI ^22, Vitest, Playwright ^1.64.0, Prettier ^3.8.1. Environment apiUrl localhost:8080. Build budgets initial 500kB warn / 1.6MB error. No separate prod env file.

## Topic: Project structure
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.planning/codebase/STRUCTURE.md
- Notes: Top-level: src/, libs/ui/, e2e/, qa/, scripts/, evidence/, .quality/, docs/, .planning/, public/. Feature folders features/<feature>/{detail,components,models,services,utils,adapters}. Shared components/data-table, ui atoms, utils/locale-format, permission.utils, status-badge. Tests unit src/**/*.spec.ts (32 files), E2E e2e/*.spec.ts, QA qa/*.spec.ts, evidence. 80+ scripts.

## Topic: Testing
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.planning/codebase/TESTING.md
- Notes: Unit tests via Angular builder (Vitest available), 32 spec files covering permissions, i18n, dashboard metrics, orders, reviews, users/roles, shared components/utils. E2E Playwright Chromium 1440×900, workers=1, base URL 4200, auth storageState cached. QA harness qa/playwright.config.ts + qa:static. Evidence harness scripts/evidence.mjs matrix 375/768/1024/1440/1920 × light/dark × en/ar. i18n check scripts/i18n-case-check.mjs. Build verification ng build with budgets.

## Topic: Known issues
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/KNOWN_ISSUES.md
- Notes: Known issues tracker with verification status open/fixed/needs-backend/needs-decision. Covers dates, labels, filter rows, dialogs, placeholders, alerts, sidebar, permissions, products, options, notifications, journal, search, broadcasts, contact messages, reviews, roles, users. Cross-ref docs/rbac-pass2-watermark.md.

## Topic: Implementation tickets
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/TODO.md
- Notes: UI tickets V1–V5: V1 add dialog fixes; V2 lists fixes; V3 category detail fixes; V4 sidebar fixes; V5 screenshots and evidence.

## Topic: Orders contract (spec summary)
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- Notes: Contract for orders pages backend needs: existing endpoints, defects (status transition too loose, seed totals disagree, order numbers collision, phone only on address), proposed endpoints (stats, status change with note/notify/reason, history, notes, shipment, payment details, tags), features that must not be faked (email resend no endpoint, gateway refund built via Paymob, carrier API not real, tax not real, history/notes not real at contract time, variant on order line not real), six decisions needed (shipped→cancelled, backwards, changed_by, partial refund, email, tags). See constraints.md for extracted constraints.

## Post-ingestion updates

- **2026-10-26 — GSD initialization (supersedes the "GSD not initialized" note above).** The GSD scaffold was created on 2026-10-26: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` and `.planning/STATE.md` now exist with `commit_docs: false`. The ingestion-time notes in this file are preserved verbatim as the state observed on 2026-10-26 before initialization. `.planning/codebase/CONCERNS.md` was corrected for this one stale claim; the rest of the codebase map is unchanged.
- **2026-10-26 — Scaffold audit correction.** The scaffold was rewritten against the installed GSD v1.15.0 templates. No product requirements were added: ingestion extracted 0, and the roadmap intentionally defines no phases pending owner confirmation.
