# UX_DECISIONS.md — decisions requested by the dashboard-ux program

One question at a time, two options + a recommendation each. I keep working on non-blocking items meanwhile.

## D1 — Relative-time casing inside composed labels (from UX_AUDIT_dashboard.md #6)
Context: `formatRelativeTime` hardcodes `"Just now"` (capital J) for en; the dashboard toolbar renders "Updated Just now". Sentence-case rule (AGENTS #2) says "Updated just now".
- **Option A (recommended)**: when the relative time is composed after a label, lowercase it ("Updated just now"); keep "Just now" standalone (e.g. table cells where it starts the string). One helper parameter, spec updated, en.json untouched.
- **Option B**: keep "Just now" everywhere (status quo, zero code).

Your answer: [x] A — **applied** (`b7ca121c`): `formatRelativeTime(..., { lowercase: true })` for composed labels; standalone uses keep "Just now". Spec updated ("lowercases the phrase when it is composed after a label").

## D2 — Trash flow on the products list (from UX_AUDIT_products.md #2)
Context: "Move to trash" opens "Delete product — this action cannot be undone — [Delete]", but the action is a soft delete the Trash tab can restore. The dialog also bypasses `ConfirmDialogService` (no role, no focus trap, Esc broken) — that part is code and is fixed regardless of this choice.
- **Option A (recommended)**: trash runs immediately with an 8s Undo toast (skill principle 3: reversible → undo, no confirm); keep the confirm only for permanent delete from the Trash view, stating the real consequence ("Permanently delete aerpress? This cannot be undone.").
- **Option B**: keep a confirm for trash too, but correct it: title "Move to trash?", body "You can restore it from Trash.", primary button "Move to trash" (destructive first in the footer).

Your answer: [ ] A  [ ] B

## D3 — Copy pack for products (from UX_AUDIT_products.md #6)
Three small wording fixes bundled (translation values change, so they need your sign-off):
1. Variants caption plural split: "1 variant" / "{{n}} variants" (en) + correct ar plural forms.
2. Filter selects read literal "all" today → "All types" / "All statuses" / "All featured".
3. Unsaved-changes modal: "…saved. if you leave…" → "If you leave…".

Your answer: [x] Approve pack — **applied** (`e4fc076f`): plural variants (en+ar), descriptive filter labels, sentence case.

## D2 — ANSWERED (2026-10-28): option A implemented
"Move to trash" now runs immediately with an 8s Undo toast; the confirm dialog is kept only for permanent delete from the Trash view. Implemented in `f4514d53` (see UX_AUDIT_products.md implementation log).

## D4 — Sidebar density: what the section row should be (FE-25b)
Context: the nav is six sections (`Operations`, `Access`, `Content`, `Catalog`, `Coffee data`, `Settings`). Every section holds exactly ONE collapsible parent whose label is the section label, so the reader sees six accordions and never sees the section name as a heading (`sectionLabels` in `shared/data/sidebar-nav-items.ts` is not rendered anywhere). Sub-items, permissions and routes are already grouped, so the nav is not a flat wall today — the remaining density gain is in how the group is *labelled*.
- **Option A (recommended)**: render the section label once as a small group heading and put its children directly under it; the parent row (a duplicate of the section name) disappears. Result: one heading + N sub-rows per section, and collapsing a section collapses straight to its heading. Re-parenting, so it changes the information architecture — needs your answer before anyone ships it.
- **Option B**: keep the current one-accordion-per-section (the section label IS the summary) and change nothing. Zero risk, no visual gain.

Your answer: [x] A (2026-10-29) — **accepted, shipped** in the FE-25 D4+A commit (`ux(shell): FE-25 D4+A D5+A — one section heading, theme toggle at every width`). What shipped:
- `app-sidebar.component.html` renders the section label ONCE, as a 12px muted micro-label that IS the disclosure control (`<button>` + `aria-expanded` + `aria-controls` → the panel that holds the rows). Latin is uppercased (`ltr:uppercase ltr:tracking-wider`); Arabic is not, per design.md §8.
- The children that sat under the parent row sit directly under the heading (same bullet + badge language, `ps-6` inline-start indent). The parent row — a copy of the section name with a second chevron — is gone: no duplicate label, no second chevron.
- Collapsing a section collapses straight to its heading (the `.nav-collapse` grid animation is unchanged, and `visibility:hidden` still takes the closed links out of the tab order).
- Auto-open now keys on the SECTION (`sectionKeyForRoute`), and the open/closed choice persists under `nocteon-sidebar-sections-open` (section keys, not the old parent routes — an old stored value simply opens nothing). Rail-collapsed dot badges, the pinned Home item and the active-link scroll are unchanged.
- `sidebar-sections.spec.ts` pins it: one heading per visible section, the label never repeated as a row, `aria-expanded`/`aria-controls` wired to the panel that holds the links, a section with no permitted row renders no heading, and the drawer contract still holds.

*Done meanwhile*: the drawer's focus/Esc/name/close-on-navigate behaviour (FE-25a) is independent of this choice and is shipped.

## D5 — The theme toggle is invisible below 640px (FE-25, observation)
Context: `theme-toggle.component.html` carries `hidden ... sm:flex`, so on a phone there is no theme control at all — a phone user is locked to whatever theme the device got on first visit. The toggle now announces the next theme properly (FE-25a); it just cannot be reached on the smallest screens.
- **Option A (recommended)**: show the toggle at every width and let the breadcrumb drop below 400px (it already truncates), keeping one row and no horizontal overflow.
- **Option B**: leave it hidden on phones (theme stays a stored preference there).

Your answer: [x] A (2026-10-29) — **accepted, shipped** in the same FE-25 D5+A commit. What shipped:
- `theme-toggle.component.html`: `hidden items-center justify-center sm:flex` → `flex items-center justify-center`, so the switch is reachable at every width (it keeps its round 32px target and its existing hover ring).
- `navigation-bar.component.html`: the left cluster is `min-w-0` and the separator `shrink-0`, so the breadcrumb shrinks instead of pushing the header wide. The trail's hide breakpoint moved from `sm` (640px) to `min-[400px]`, so the row at 375px is: menu trigger, search, notifications, theme, avatar.
- `breadcrumb.component.html`: the crumbs truncate instead of wrapping (`min-w-0` + `overflow-hidden` on the nav, `flex-nowrap` + `min-w-0` on the list — the library list is `flex-wrap` by default — and `truncate` on the crumb labels). That is what keeps one row between 400px and 640px, where the trail used to be hidden outright.
- `npm run i18n:check`, `npm run qa:static` (181, unchanged) and the unit suite cover this statically; the pixel check at 375 / 768 / 1440 in light + dark + Arabic is the browser pass.

I did not touch the navbar layout while the question was open: adding a control there is a layout-structure change (AGENTS.md). With D5 answered A, the layout change above ships in this pass and the 375px overflow check stays part of the browser pass.
