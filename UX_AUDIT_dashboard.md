# UX_AUDIT_dashboard.md — Dashboard home (area: `dashboard`)

Date: 2026-10-28 · Angular 22.0 (`animate.enter`/`animate.leave` available; `@angular/animations` not used anywhere — nothing to migrate) · Views: en/ar × light/dark, viewport 1440×900.
Method: Playwright (chromium) scripted capture + task walk. Screenshots are viewport captures only.
Evidence: `evidence/ux-audit/dashboard/` (paths below). Report-only — `src/` untouched.

## What already works (do not regress)
- **Command palette (Ctrl+K)**: searches entities (orders verified: type `ORD` → Enter opened `/dashboard/orders/ORD-2026-000002` — **3 keystrokes, 0 clicks**), quick links (Orders, Reviews, Contact messages, Carts), quick actions (Add product, Add category), Esc closes, `Ctrl+Enter` opens in new tab, good empty state ("Check spelling, or try an order number or email."). Evidence: `walk-t1-palette-open.png`, `walk-t1-palette-typed.png`, `walk-t1-after-enter.png`, `walk-t1-palette-empty.png`.
- **Range state in the URL**: switching to "Today" → `/dashboard?days=1`, preserved after reload. Evidence: `walk-t4-range-today.png`.
- **Action-first home**: Needs attention row (open orders / unread messages / reviews awaiting moderation) with counts and chevrons; KPI deltas vs previous period with comparison labels; "Updated just now" + refresh; Export report. Principle 7 largely met.
- **Error states are widget-level** with Retry ("The attention queue could not be loaded." + Retry; explanatory currency fallback banner). Evidence: `home-en-light-error.png`.
- **RTL**: fully mirrored layout, Arabic dates/numbers, `dir=rtl` on `<html>`. Evidence: `home-ar-light.png`, `home-ar-dark.png`.
- **Reduced motion**: with `prefers-reduced-motion: reduce` no animations remain (measured 0). Evidence: `home-en-light-reduced.png`.
- **Focus visibility**: Tab focus shows `outline: auto` (1px). Evidence: `home-en-light-focus.png`.
- Header icon-only buttons (bell, theme, account) all have translated `aria-label`s (verified in source).

## Ranked findings — mark items `[x]` for me to implement

| # | Problem / opportunity | Evidence | Impact | Effort | Proposed change | Needs decision? |
|---|---|---|---|---|---|---|
| 1 | [x] KPI cards render **"No prior data"** and zeros *while loading* — the loading state looks like a real (wrong) answer; then values pop in — **Done** (`70ea184c`) | `home-en-light-loading.png`, `verify-loading-after.png` | H | S | Show the same skeleton used by the attention panel until the overview resolves; never render "No prior data" before first success | no |
| 2 | [x] **"null kg"** on the Coffee sold card when the store-settings call fails — developer text on screen (AGENTS rule 9) — **Done** (`70ea184c`) | `verify-null-before.png`, `verify-null-after.png` | H | S | Guard the value: `null → '—'` (em dash via i18n), keep the kg suffix only for numbers | no |
| 3 | [x] **KPI drill-down loses all filters**: every KPI card links to bare `/dashboard/orders`; "Paid orders 3" opens the *unfiltered* list; selected range (`?days`) is not carried — **Done** for the KPI cards (`9e37e49a`): they now open `paymentStatus=PAID` + the mapped range token. *Correction after reading `core/dashboard/attention.ts`:* the attention tiles (messages/reviews/low-stock/carts) were **already filtered**; only the open-orders row is unfiltered, and that is a documented deliberate choice (no multi-status tab — a single-status link would show fewer rows than the badge). Left as is. | `walk-t2-kpi-drilldown.png`, `verify-drilldown-filtered.png`; `dashboard.component.html` passes `[link]` only, `kpi-card` already supports `[queryParams]` | H | M | Pass `queryParams` (status mapping per card; `days` from the active range) on KPI cards and attention tiles | no |
| 4 | [~] **No motion system** — **foundation Done** (`4231977a`): `src/styles/motion.css` (durations ≤320ms, three easings, only transform/opacity, reduced-motion collapse), dialog enter (fade + scale 0.97) on the shared confirm, and route cross-fade via `withViewTransitions()` with the width/height group animation disabled. **Measured:** dialog 220ms (transform+opacity), overlay 160ms, route 160ms old/new, reduced motion 100ms. Remaining: the per-area rollout (menus/popovers, list-row stagger, tabs indicator, KPI count-up + `appCountUp`/`appStagger`/`appReveal`) via `/ux-motion <area>` | measured + `evidence/ux-audit/motion/dialog.png` | H | M | Run `/ux-motion global` first, then per-area patterns (palette fade+scale 0.97, menu fade+4px, KPI count-up ≤600ms, chart draw-in ≤600ms, route cross-fade 150–200ms) | no |
| 5 | [x] **Cold load shows a blank cream screen** (no shell, no sidebar) while auth resolves on a slow connection — **Done**: branded splash in `index.html` (removed on bootstrap), plus fixed the pre-paint theme key (`theme` → `nocteon-theme`) that caused a light flash for dark users | `home-en-light-loading.png` (first round), `verify-splash-after.png` | M | S | App shell (sidebar + header silhouette) or branded splash until the auth check settles | no |
| 6 | [x] **"Updated Just now"** — capital J mid-sentence — **Done (D1 option A, `b7ca121c`)**: `formatRelativeTime` takes `{ lowercase: true }` for composed labels; the toolbar composes "Updated just now"; standalone uses keep "Just now". Unit tests: `src/app/core/i18n/relative-time.spec.ts` (4/4, new case included) | toolbar `home-en-light.png`; unit run `vitest src/app/core/i18n` 25/25 | M | S | Lowercase only when composed after a label | resolved (D1) |
| 7 | **CLS en/light 0.0346** (target < 0.02; ar ≈ 0.0005). Charts/values arrive late and push layout | measured, 2 runs (0.0346, 0.1821 outlier) | M | M | Reserve chart/card heights (aspect-ratio boxes) so data arrival cannot shift layout | no |
| 8 | **No "?" shortcuts help dialog**; palette footer shows shortcuts only while open | `walk-t1-palette-open.png` | L | S | `?` (and a menu entry) opens a dialog listing global shortcuts — pairs with the motion/palette workstream | no |
| 9 | **Keyboard list navigation (j/k, Enter) and row peek drawer** absent (principle 5) — belongs to the orders/lists areas, noted for their own audits | n/a (out of home scope) | L | M | Schedule under `/ux-audit orders` | no |
| 10 | Color transitions (150ms) on buttons animate `color`/`background-color`, not transform/opacity — our motion rules allow transform/opacity only | measured: `d:150, p:[backgroundColor,color]` on header buttons | L | S | Fold into `/ux-motion global` token cleanup | no |

## Quick wins (small effort, high impact)
- #2 "null kg" guard.
- #1 KPI loading skeleton.
- #5 app shell on cold load.
- #8 "?" shortcuts dialog (tiny, palette exists).
- #3 is the biggest UX gap but is M effort — do it right after the quick wins.

## Needs decision (from UX_DECISIONS.md)
- **D1 — Relative-time casing**: (a) compose lowercase "just now" when embedded after a label ("Updated just now"), keep "Just now" standalone — recommended; (b) keep "Just now" everywhere (status quo). Waiting for your mark.

## Measured values (script, chromium 1440×900)
| Scenario | CLS | Animations found |
|---|---|---|
| en/light initial load | 0.0346 (earlier run: 0.1821) | 0 |
| en/dark initial load | 0.0005 | 0 |
| ar/light initial load | 0.0005 | 0 |
| ar/dark initial load | 0.0005–0.0262 (two runs) | 0 |
| en/light after reload (replay check) | — | 0 (nothing replays — nothing animates) |
| en/light `prefers-reduced-motion: reduce` | — | 0 (compliant) |
| Palette open (sampled at 60/180ms) | — | 0 (instant appearance) |
| Header button hover | — | 150ms `cubic-bezier(0.4,0,0.2,1)` on `color`/`background-color` |

Task walk (clicks/keystrokes): open specific order = Ctrl+K + "ORD" + Enter (3 keys, 0 clicks) ✅; drill into "Paid orders" = 1 click but lands unfiltered ❌ (#3); act on "Open orders" attention tile = 1 click, unfiltered ❌ (#3); switch range = 1 click, URL persisted ✅.

## Screenshot index
`evidence/ux-audit/dashboard/`: `home-{en,ar}-{light,dark}.png`, `home-en-light-{loading,loading-3s,error,reload,reduced,focus}.png`, `walk-t1-palette-{open,typed,empty}.png`, `walk-t1-after-enter.png`, `walk-t2-kpi-drilldown.png`, `walk-t3-needs-attention.png`, `walk-t4-range-today.png`, `walk-t6-header-menu.png`, `walk-t7-ar.png`.

Next areas for `/ux-audit all`: orders → products/catalog → reviews → contact-messages (resume via `UX_AUDIT_STATE.md`).

## Implementation log (2026-10-28)
| Item | Commit(s) | After-evidence |
|---|---|---|
| #2 "null kg" guard | `70ea184c` | `verify-null-before.png` → `verify-null-after.png` (coffee card shows "—", `hasNullKg: false`) |
| #1 KPI first-load skeletons | `70ea184c` | `verify-loading-after.png` (`primarySkeleton: true`, `secondarySkeleton: true`, no "No prior data"; real row returns after load) |
| #3 pre-filtered KPI drill-down | `9e37e49a` | `verify-drilldown-filtered.png` (`paymentStatus=PAID&range=30d` in the URL) |
| #5 cold-load splash + pre-paint theme key | (this run) | `verify-splash-after.png` |

Verification: `npm run build` clean, `npm run i18n:check` clean. Remaining H item: #4 motion foundation → run `/ux-motion global`. #6 waits on decision D1.

## Test triage (2026-10-28)
- `dashboard-round2 "the KPI cards share one padding and one baseline"` → **passes** with the changes (2.9s).
- `dashboard-states "1 — every dashboard endpoint fails…"` and `"3 — the range lives in the URL…"` → **fail identically at the pre-change commit** (`8819bded`, verified in a throwaway worktree) — pre-existing, not a regression of this program.
- New finding from that triage: with `?days=90` on reload the URL keeps the range but the toolbar radio falls back to "Last 30 days" (test asserts `/90/`, reads `"Last 30 days"`). Pre-existing toolbar-restore bug, M/S, owner: dashboard-toolbar — scheduled for the next implement run.
