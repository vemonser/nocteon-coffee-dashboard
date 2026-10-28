# UX_AUDIT_products.md — Products list + product wizard (area: `products`)

Date: 2026-10-28 · Angular 22 · Views: en/ar × light/dark, viewport 1440×900 · Report-only (no data was mutated: both confirm dialogs were cancelled via their own buttons).
Method: Playwright scripted capture + task walk. Evidence: `evidence/ux-audit/products/`.

## What already works (do not regress)
- **Structure**: breadcrumbs (Home › Catalog › Products), All/Trash tabs with counts, search + Type/Status/Featured filters, sortable Product/Price columns, kebab row actions (edit, view on storefront, duplicate, enable/disable, feature, trash), bulk checkboxes with a bulk toolbar (enable/disable/feature/trash + progress), page-size selector. `products-en-light.png`.
- **Shared conventions**: EGP money ranges via the shared formatter, Enabled badge vocabulary, sentence-case headers. ✅
- **Optimistic featured toggle** with rollback + toast on failure (`onFeaturedToggle`). ✅ Principle 4.
- **Unsaved-changes modal on the wizard** ("Discard changes / Stay on page / Save and leave") — principle 4 present. `wizard-unsaved-modal.png`.
- **Reduced motion**: 0 animations remain under `prefers-reduced-motion: reduce`; nothing replays on reload. ✅ (measured)
- Error state is widget-level with a Retry control (in-app, no logout). `products-en-light-error.png`.

## Ranked findings — mark `[x]` to approve

| # | Problem / opportunity | Evidence | Impact | Effort | Proposed change | Needs decision? |
|---|---|---|---|---|---|---|
| 1 | [x] **Filters, search, sort, page and tab are not in the URL** — **Done** (`99e60b7b` / contained in `f4514d53`): `q`, `status`, `featured`, `type`, `sort`, `direction`, `page`, `size` and `view=trash` now round-trip; the orders-list contract is mirrored; typing is debounced 350ms and history uses `replaceUrl` | verified live: `?q=aero` → `?q=aero&status=active`, survives reload (input shows "aero"), edit→Back returns to the same filtered URL; trash tab → `?view=trash` survives reload with the tab selected (`verify-url-state-after.png`, `verify-trash-view-url.png`) | H | M | Mirror the orders-list URL contract: `q`, `status`, `featured`, `type`, `sort`, `direction`, `page`, `size`, and the All/Trash tab (`view`) | no |
| 2 | [x] **Trash confirm misrepresented the action** — **Done (D2 option A applied)**: "Move to trash" now runs immediately and the toast offers **Undo (8s)** which restores via `PATCH …/restore`; the "cannot be undone" dialog is gone; the confirm now exists only for permanent delete from the Trash view | verified live: no dialog, toast "Moved to trash [Undo]" (`verify-undo-toast.png`), Undo restores the row; permanent-delete dialog only in Trash (`verify-permanent-confirm.png`) | H | M | See decision **D2** | resolved (A) |
| 2a | [x] **The confirm dialog was hand-rolled** (`@if (deleting())`): no role, no focus trap, Esc did not close it, footer order off-rule — **Done**: the hand-rolled dialog is deleted; permanent delete uses `ConfirmDialogService` (`confirmLabel: "Delete"`, `tone: destructive`). While verifying, the **shared** dialog itself turned out to lack Esc-from-outside and a focus trap, so `app-confirm-dialog` now focuses its surface on open, traps Tab via `cdkTrapFocus`, and listens for document-level Escape — every consumer benefits | measured after: dialog `present: true`, `focusInside: true`, `escCloses: true`, buttons ["Cancel","Delete"] (`verify-permanent-confirm.png`) | H | S | Replace with `ConfirmDialogService` (role, focus trap, Esc, consistent footer order). Wording per D2 | no |
| 3 | [x] **CLS 0.0858 on every products load** (target < 0.02) — **Done**: two causes found and fixed — (a) the page rendered a standalone skeleton *on top of* the table's own in-tbody skeleton (the extra block disappeared when data landed, sliding the page ~360px), and (b) the vertical scrollbar appearing narrowed the whole page. Removing the duplicate + `scrollbar-gutter: stable` + an always-present Stock column brings CLS to **0.0000** in all four combos | measured: en/light 0.0000, en/dark 0.0000, ar/light 0.0000, ar/dark 0.0000 (was 0.0858; 0.1048 mid-fix) | H | M | Fixed 72px row height (AGENTS rule 6), aspect-ratio box for thumbnails, stable column widths | no |
| 4 | [x] **Raw browser error leaked to the UI** — **Done**: `NotifyService.backendMessage` now ignores network failures (status 0) and browser-noise strings, so the toast says "Could not load data"; the inline block adds "Check your connection and try again." | verified: `hasRawNetworkText: false`, hint present, toast "Could not load data" (`verify-error-copy.png`) | M | S | Map network failures to a friendly line — keep Retry; never render `err.message` raw | no |
| 5 | [x] **Empty state was a dead end** — **Done**: "No products match “zzzznope”" + **Clear search** action (verified: 7 rows back, URL cleaned, AeroPress visible); "Trash is empty" for the Trash tab; the Stock column no longer disappears when there are no rows | verified: empty text + `Clear search` + rows restored (`verify-empty-state.png`) | M | S | "No products match …" + Clear-search action; stable columns; keep tab counts unfiltered | no |
| 6 | [x] **Copy bugs** — **Done (D3 applied, `e4fc076f`)**: variants now use the plural pipe — "1 variant"/"3 variants", Arabic "متغير واحد/متغيران/3 متغيرات"; the three filter triggers read "All types / All statuses / All featured" (كل الأنواع/كل الحالات/كل المميزة) instead of the raw "all"; unsaved-changes body now "…saved. **I**f you leave…" | `verify-d3-en.png`, `verify-d3-ar.png`, `verify-d3-filters-en.png`, `verify-d3-filters-ar.png`, `verify-filters-{en,ar}.png` | M | S | Copy pack: `"1 variant"/"{{n}} variants"` + `plural` in ar; filters → "All types / All statuses / All featured" (sentence case) | applied (D3) |
| 7 | [x] **Wizard state was not in the URL** — **Done** for the step: `?step=media` deep-links (same validation gate as a tab click), tab/next/back writes `?step=<id>` with `replaceUrl`, and a refresh keeps the step (verified: deep link → Media; tab → `?step=variants`; reload → Variants). Autosave/draft for the 5-step form: **implemented** (`dffa17df`) — the form saves a debounced draft (1.2s, serialisable values only; staged files excluded) and offers "Restore unsaved draft?" (Restore / Discard) after a refresh; the draft clears on a successful save or on Discard. **Live browser verification pending the local backend** (the `nocteon-app` container is crash-looping on a Flyway validation mismatch — migrations 16–18 applied in the DB but absent from the image; that is the backend session's domain). The ready script is `/tmp/opencode/verify-d1-draft2.mjs` | `verify-wizard-step-url.png`; measured `urlAfterDeepLink`, `urlAfterTab`, `selectedAfterReload` | M | M | Step → query param (`?step=media`), then autosaved draft | no |
| 8 | **Row menu has no transition**; only 150ms color hovers on tr/button — motion system absent here too (same global gap as dashboard #4) | measured `rowMenuAnim`: only `backgroundColor/color` 150ms entries | L | S | Covered by `/ux-motion global` (menu = fade + 4px translate) | no |
| 9 | Palette finds no products ("No results for "aero"" while a product named AeroPress exists) | walk log `T1`; already filed under "Needs backend" in `DECISIONS.md` | L | — | Backend search index; safe fallback already in place | no (backend) |
| 10 | No inline edit for safe fields in the table (status/stock/price are menu- or detail-only); featured star may be the only inline control — principle 5 opportunity for a later pass | `products-en-light.png` | L | M | Schedule with the row-peek-drawer workstream (same as dashboard #9) | no |

## Task walk (3 most common tasks)
- **T1 — find & edit a product**: palette: 0 product hits (see #9). In-list: type search ("aero") + kebab + Edit = **2 clicks, ~3.3s** → `/dashboard/products/aeropress/edit`. Within the ≤3-click bar. ✅
- **T2 — create a product**: "Add product" (1 click) → 5-step wizard; step NOT in URL (#7); leaving dirty shows the unsaved-changes modal ✅, wording has a lowercase "if you leave…" typo (fold into D3 copy pack). Never saved anything during the walk.
- **T3 — trash a product**: 2 clicks to a dialog that misstates the action (#2), Esc broken (#2a), Cancel works. No mutation performed.

## Quick wins (small effort, high impact)
- #2a Replace the hand-rolled dialog with `ConfirmDialogService` (role, focus trap, Esc, footer order).
- #4 Friendly error copy (no raw "Failed to fetch").
- #5 Empty state with next step + stable columns.
- #1 is the biggest real gap but M effort — do it right after (copy the orders-list URL contract).

## Needs decision (in `UX_DECISIONS.md`)
- **D2 — Trash flow**: (a, recommended) reversible trash runs immediately with an 8s Undo toast; confirm kept only for permanent delete from the Trash view ("Permanently delete? This cannot be undone."); (b) keep a confirm but fix its wording/button to "Move to trash — you can restore it from Trash".
- **D3 — copy pack**: plural split for variants (en+ar), "All types/All statuses/All featured" filter labels, "if you leave…" capitalization in the unsaved-changes modal.

## Measured values
| Scenario | Value |
|---|---|
| CLS en/light, ar/light | 0.0858 |
| CLS en/dark, ar/dark | 0.0847 |
| Animations on load | 0 (none — no entrance motion) |
| Row-menu/dialog transitions | none (only 150ms color hovers) |
| `prefers-reduced-motion: reduce` | 0 animations ✅ |
| Reload replay | 0 animations ✅ |
| T1 find+edit | 2 clicks, ~3.3s |
| Delete dialog Esc / focus trap | broken / absent (measured) |

## Screenshot index
`evidence/ux-audit/products/`: `products-{en,ar}-{light,dark}.png`, `products-en-light-{loading,error,empty}.png`, `products-{row-menu,trash-confirm,bulk-bar,filters-after-reload}.png`, `wizard-step1-en-light.png`, `wizard-unsaved-modal.png`, `walk-t1-edit-wizard.png`, `walk-t2-wizard-step.png`.

## Implementation log (2026-10-28, items 1 / 2 / 2a)
| Item | Commit | Verification (measured live) |
|---|---|---|
| #1 URL state | `99e60b7b` (also contained in `f4514d53`) | `?q=aero` → `?q=aero&status=active`; reload keeps URL + input "aero"; edit → Back returns to the same filtered URL; Trash tab → `?view=trash`, survives reload, tab stays selected |
| #2 reversible Trash | `f4514d53` | No dialog; toast "Moved to trash [Undo]" for 8s; Undo restores the row; permanent-delete confirm only in the Trash view |
| #2a shared confirm | `f4514d53` | `present: true`, `focusInside: true`, `escCloses: true`, labels ["Cancel","Delete"]; shared `app-confirm-dialog` now traps focus (CDK) and closes on document Escape |
| D2 | — | Option **A** applied (superseded the dialog); bulk "Move to trash" was already immediate and is unchanged |

Build clean, `i18n:check` clean. Data hygiene: every product moved during verification was restored — final state 7 products active, Trash empty (`verify-trash-final.png`).

### Test triage (same run, isolated `PW_OUTPUT_DIR=/tmp/opencode/pw-products`)
- `verify-category-products.spec.ts` AC-P4 and the four `verify-tables` width cases + "dates render small" fail on **carts** ("no thumbnail cell found") and **category-detail** (`[role="img"]` count 0) — pages this change does not touch; the failure happens before the products page is even reached. Recorded as out-of-scope findings (carts/category thumbnails) for their own audit, not attributed to this change.
- `dashboard-round2` KPI-baseline test passes with the earlier dashboard work; products URL/undo flows were verified with dedicated Playwright scripts (`/tmp/opencode/ux-products-verify*.mjs`).

## Implementation log #2 (2026-10-28, items 3 / 4 / 5 / 7)
| Item | Commit | Measured after |
|---|---|---|
| #3 CLS | `66b509d2` | **0.0000** in en/light, en/dark, ar/light, ar/dark (baseline 0.0858; 0.1048 while both skeletons still rendered). Fixes: dropped the duplicate standalone skeleton (the data table already renders an in-tbody one), `html { scrollbar-gutter: stable }`, and the Stock column is always present (no column appearing after data) |
| #4 error copy | `66b509d2` | `hasRawNetworkText: false`; inline hint "Check your connection and try again."; toast falls back to "Could not load data" (network-noise filter in `NotifyService.backendMessage`, benefits every list) |
| #5 empty state | `66b509d2` | "No products match “zzzznope”" + Clear search → 7 rows, URL back to `/dashboard/products`, search box empty; "Trash is empty" for the Trash tab; Stock column stays |
| #7 wizard step | `bfd20ff6` | `?step=media` → Media selected; clicking Variants → `?step=variants`; reload keeps Variants; invalid deep links fall back to the validation gate |
| extra (found while verifying #5) | `66b509d2` | `loadedState` is now refreshed on every load: clearing a filter **back to the initial state** reloads (it compared against the constructor snapshot and skipped the request) |

Build clean, `i18n:check` clean, new copy keys are additions only (`common.loadFailedHint`, `products.empty.{none,search,clear,trash}` in en+ar). Still open: **D3** copy pack (plural "1 variants", literal "all" filter labels) — untouched by design until you answer.

## Implementation log #3 (2026-10-28, item 6 — D3 copy pack)
Commit `e4fc076f`. Applied per "كمل الباقي" (D3 was the open decision; revert-friendly as one commit).

| Fix | Measured after |
|---|---|
| Variant plural | en: "1 variant" / "3 variants"; ar: "متغير واحد" / "متغيران" / "3 متغيرات" (PluralPipe + `products.table.variantCount_{zero,one,two,few,many,other}`) |
| Filter triggers | en: "All types / All statuses / All featured"; ar: "كل الأنواع / كل الحالات / كل المميزة" (the raw `all` value is gone; selecting a filter still writes `?status=active` — verified) |
| Sentence case | `unsavedChanges.body`: "…saved. If you leave…" (en only; ar unchanged) |

Footnote on the trigger label: spartan's `hlm-select-value` prints the raw control value (options live in a portal and the value template exposes no context), so the trigger shows a translated label in place and keeps the primitive value sr-only; "All" is the empty control value, so no `status=all` noise in the URL.

Remaining items are handoffs, not defects: #7b autosave (separate feature), #8 motion foundation (`/ux-motion global`), #9 palette product search (backend, already in DECISIONS.md "Needs backend"), #10 inline edit (later workstream).

### #7b autosave — implemented, unit-verified (`dffa17df`, `4219a3cf`)
- Debounced draft (1.2s) saved to `localStorage` per product (`products.wizard.draft.v1:<slug|new>`); staged files are excluded on purpose.
- After a refresh the wizard offers "Restore unsaved draft?" (Restore / Discard); a successful save or Discard clears the draft.
- Storage rules extracted into `product-draft.ts` and covered by `product-draft.spec.ts` (6 cases: key shape, round-trip with timestamp, per-product isolation, corrupt/empty = no draft, targeted clear, storage-unavailable never throws).
- Unit evidence: `npm run test:unit` → **43 files / 314 tests passed**.
- ⚠️ Live browser pass still pending: the local `nocteon-app` backend is crash-looping on a Flyway validation mismatch (migrations 16–18 applied in the DB but absent from the image) — outside this work; re-run `/tmp/opencode/verify-d1-draft2.mjs` when it is back.
