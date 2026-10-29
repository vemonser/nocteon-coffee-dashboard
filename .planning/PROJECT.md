# Nocteon Admin Dashboard

## What This Is

Nocteon Admin Dashboard is an Angular 22 single-page application for operating a coffee-commerce business. It provides authenticated, permission-gated administration for the dashboard home, orders, carts, products and their taxonomy (categories, product options, coffee varieties, farms, origins, processing methods, roast levels, brewing methods, tasting notes, pairings), users and roles, reviews, contact messages, promo codes, shipping zones, journal, broadcasts, newsletter, notifications, store settings, the user profile and an unauthorized page. The frontend consumes a separate Spring Boot backend and follows the shared data-table, dialog and status-badge vocabulary established by the Orders pages.

## Core Value

> **Provisional — pending product-owner confirmation.** Inferred from `AGENTS.md` (rules 3 and 11) and `design.md` §2c; it was not stated by the owner during initialization.

Every number, date, status and permission shown in the UI must come from the API or the authenticated session; the browser never invents data, and a value the backend cannot supply is shown honestly as unavailable rather than fabricated.

## Context

- Brownfield Angular 22 application: standalone components, signals-first state, lazy-loaded routes, Tailwind CSS 4 and Spartan Helm primitives.
- The backend is a separate Spring Boot repository. Contract material in this repo is `API_GAPS.md`, `API_EXPECTATIONS.md`, `ORDERS_CONTRACT.md` and `DECISIONS.md`; only `DECISIONS.md` is authoritative ADR input (it is the highest-precedence source in the ingestion set).
- Existing codebase map: `.planning/codebase/` (7 documents). Document-ingestion synthesis: `.planning/intel/` with `.planning/INGEST-CONFLICTS.md`.
- Ingestion found **0 authoritative product requirements** — the source set contained no PRD. Product scope is therefore unconfirmed (see `.planning/REQUIREMENTS.md`).
- UI quality rules live in `AGENTS.md`; design tokens and page patterns live in `design.md`.
- **Known defect:** the `/factory/evidence` gate referenced by `AGENTS.md` is not installed at the path the command expects (`skills/software-factory/bin/evidence-gate` is absent; the installed binary lives under `~/.config/opencode/skills/software-factory/bin/`). Separately, the legacy manifest `.quality/runs/2026-10-21T11-45-00Z/evidence-manifest.json` stores evidence as strings, which the gate rejects as `EVIDENCE_MALFORMED`; the other three manifests use the expected object shape. The capture script `scripts/evidence.mjs` itself is present.
- Test, lint, i18n and build commands have **not** been run as part of initializing this scaffold; nothing in this document claims they pass.

## Requirements

### Validated

"Existing" means the module is present in the codebase and routed; it is not a claim that a test suite passed.

- ✓ Authentication (JWT in memory plus httpOnly refresh cookie) and permission-gated routing — existing (`src/app/core`, `src/app/app.routes.ts`)
- ✓ Dashboard home with metrics and charts — existing (`src/app/features/dashboard`)
- ✓ Orders list and order detail with adapters, status dialogs, progress tracker and activity timeline — existing (`src/app/features/orders`)
- ✓ Products, categories, product options, coffee varieties, farms, origins, processing methods, roast levels, brewing methods, tasting notes, pairings — existing (`src/app/features/*`)
- ✓ Users, roles and permissions management — existing (`src/app/features/users`)
- ✓ Reviews and contact messages consoles — existing (`src/app/features/reviews`, `src/app/features/contact-messages`)
- ✓ Carts, promo codes and shipping zones — existing (`src/app/features/carts`, `promo-codes`, `shipping-zone`)
- ✓ Journal, broadcasts, newsletter, notifications and store settings — existing (`src/app/features/journal`, `broadcasts`, `newsletter`, `notifications-list`, `store-settings`)
- ✓ Profile and unauthorized pages — existing (`src/app/app.routes.ts:525,536`)
- ✓ Shared data table, dialogs, status badge, locale-format helpers and EN/AR i18n — existing (`src/app/shared`, `src/app/core`)
- ✓ Evidence capture script and QA harness configuration — present (`scripts/evidence.mjs`, `qa/playwright.config.ts`); the `/factory/evidence` gate wrapper is **not** present (see Context)

### Active

No confirmed product requirements yet. Nothing is listed here until the owner confirms scope; see `.planning/REQUIREMENTS.md`.

### Out of Scope

| Exclusion | Reason |
|-----------|--------|
| Rebuilding delivered order-details v3/v4/v5 work as new roadmap phases | Delivered and in use; the Superpowers specs and plans under `docs/superpowers/` and the v4 trackers are history, not scope |
| Inventing backend endpoints or fields | `AGENTS.md` workflow rule; missing capability is recorded under "Needs backend" in `DECISIONS.md` with a safe fallback |
| Running seeds or migrations against production data | `AGENTS.md` workflow rule |
| Treating historical proposals as current requirements | `ORDERS_CONTRACT.md` and `ORDERS_SEED_PROPOSAL.md` predate implementation; `.planning/INGEST-CONFLICTS.md` records ADR-over-SPEC resolution |

## Constraints

- **Tech stack**: Angular 22 SPA, separate Spring Boot backend at `http://localhost:8080` — verified in `package.json` and `src/environments/*.ts`.
- **API pagination**: dashboard list services clamp page size to `MAX_PAGE_SIZE = 100` — verified in `src/app/core/crud/base-crud.service.ts:31`, `features/orders/services/order.service.ts:35`, `features/products/services/product.service.ts:30`, `features/newsletter/services/newsletter.service.ts:29`. The companion claim that larger requests return HTTP 400 comes from the historical `ORDERS_CONTRACT.md` and is **not verified** from this repository.
- **i18n**: every visible string goes through en and ar; `npm run i18n:check` must pass — `AGENTS.md` rule 1.
- **Dialogs and forms**: `window.alert`, `window.confirm` and `window.prompt` are forbidden (lint error); use `ConfirmDialogService` — `AGENTS.md` rule 8.
- **Layout**: logical CSS only; verify light, dark and RTL — `AGENTS.md` rule 4.
- **Evidence**: the factory evidence gate must exit 0 when used — `AGENTS.md` software-factory layer. The gate is currently not installed in this repo; do not claim an evidence run that did not happen.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GSD v1.15.0 as the planning and orchestration layer | Resumable state plus gated plan/execute/verify workflows | — Pending |
| Keep documentation commits off (`commit_docs: false`) | Manual control over what enters history while adopting GSD | ✓ Good (applied in `.planning/config.json`) |
| Treat historical specs and v4 trackers as reference only | Avoid re-planning delivered work as new phases | ✓ Good (applied; recorded in ROADMAP.md) |
| One order status model, but status and payment status stay separate | Two vocabularies produced two Arabic words for one status, and "refunded" is a payment state, not a fulfilment state | ✓ Good (`features/orders/models/order-status.model.ts`, `ORDERS_GLOSSARY` in `core/i18n/i18n-keys.spec.ts`) |
| A shipped order cannot be cancelled | Once a parcel is in transit, cancelling is a return, not a status change; the API refuses it with 409 | ✓ Good (implemented per `DECISIONS.md`) |
| Seed totals are repaired, real orders are not rewritten | The seed disagreed with its own items; the fix is a seed fix, not a rule for the store's books | ✓ Good (migration `V111__repair_seeded_order_totals.sql`, backend repo) |
| Refunds go through Paymob and are recorded only after gateway acceptance | A refund row must mean the money moved; a refusal must leave the order untouched | ✓ Good (implemented, backend repo) |
| One formatter per concept — money, dates, order number | The built-in date pipe rendered locale-order dates; money had two shapes | ✓ Good (`shared/utils/locale-format.ts`, `scripts/formatter-audit.mjs` reports 0 findings per `DECISIONS.md`) |
| The status-change e-mail is enqueued after the transaction commits | Never notify a customer about a change that was rolled back | ✓ Good (implemented, backend repo) |

### Unresolved

- **Next milestone scope** — no confirmed product requirements; ingestion extracted 0 (`.planning/intel/SYNTHESIS.md`).
- **Core Value** — provisional, pending owner confirmation.
- **Product option value usage endpoint** — `API_EXPECTATIONS.md` lists `GET .../values/{id}/usage` as missing while `DECISIONS.md` records a 404 in the current backend; unresolved, treated as unverified (`.planning/INGEST-CONFLICTS.md`, INFO 3).
- **Six contract questions in `ORDERS_CONTRACT.md`** — only `SHIPPED → CANCELLED` was closed (decision above); the remaining ones stay open as written in the contract.

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-10-26 after scaffold audit correction*
