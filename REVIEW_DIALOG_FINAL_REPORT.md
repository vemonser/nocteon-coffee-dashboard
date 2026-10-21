# Review details dialog v3 — final report (ui/review-dialog-v3)

Base: `main` @ `e9bedb65` · Branch: `ui/review-dialog-v3` · 6 commits ·
scope: the REVIEW DETAILS DIALOG only (the Reviews table and grid are not
touched — see the diff stat at the end).

## The one table

| # | Item | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Title "Review details" (sentence case) | done | `evidence/review-dialog/after/en-light/review-dialog-approved-1440.png` · `after/measurements.json` (AC-01) | was "Review Details"; EN + AR |
| 2 | Product thumbnail + name, linked to the product page that EXISTS | done | `after/en-light/review-dialog-approved-1440.png` (AC-05) | `/dashboard/products/:slug` is not a route; the link now points to `/dashboard/products/:slug/edit` |
| 3 | Reviewer avatar + proper-cased name + VerifiedBadge (tooltip + aria-label) | done (already in `main`) | `after/en-light/review-dialog-approved-1440.png` | the shared `VerifiedBadge` already carries `title` + `aria-label` = "Verified purchase"; not changed here |
| 4 | Date and time, through the shared formatter | done | `after/en-light/review-dialog-approved-1440.png` | `<app-localized-date [showTime]="true">` |
| 5 | Rating: LARGE stars with "4 / 5" right next to them | done | `after/en-light/review-dialog-approved-1440.png` (AC-03) | the shared `RatingStars` is NOT touched: the stars are scaled locally, the number is the dialog's own text (`dir="ltr"`) |
| 6 | Comment as a quote block, line breaks kept, its own scroll area | done | `after/en-light/review-dialog-long-comment-1440.png` (AC-07) | `whitespace-pre-wrap` + `max-h-40 overflow-y-auto`; the area is focusable, so a keyboard can scroll it |
| 7 | Status as a LABELLED row ("Status: Approved") | done | `after/en-light/review-dialog-approved-1440.png` (AC-04) | was a floating badge |
| 8 | "View order ORD-…" link | blocked on backend | `after/en-light/review-dialog-verified-1440.png` (AC-06) | the live API sends no `orderId`/`orderNumber`; the code path is wired and renders the link the day the API sends it. Nothing is invented. Logged in `API_GAPS.md` |
| 9 | Delete on the footer start side (ghost, destructive) + a confirmation that NAMES the review | done | `after/en-light/review-dialog-approved-1440.png` (AC-13) | the confirmation is the shared `DialogShell` with `role="alertdialog"`; the subtitle names the review ("Hario V60 Dripper (Admin)") |
| 10 | Footer end side: Close (ghost) then the action, 12px apart, with a hierarchy | done | `after/en-light/review-dialog-approved-1440.png` (AC-02) | the gap was **0px**, it is **12px** now; Close is a ghost, Approve is the primary button, Withdraw approval is the secondary one (a reversal must not look like the thing the admin came to do) |
| 11 | Reject on a pending review | blocked on backend | `after/en-light/review-dialog-pending-1440.png` (AC-14) | the API has no reject endpoint and no rejected state; the button is NOT rendered (not even disabled). Logged in `API_GAPS.md` |
| 12 | Toasts (success + failure) and a disabled, labelled button while in flight | done | `after/en-light/review-dialog-pending-1440.png` (AC-12) | "Approving…" / "Withdrawing…"; the ROW's own Approve button keeps its silent behaviour — the table is not in scope |
| 13 | Escape closes, the focus is trapped, the focus returns to the trigger | done (already in `main`, re-proved) | `after/ar-dark/review-dialog-pending-1440.png` (AC-08) · `e2e/review-dialog.spec.ts` | true in every one of the 8 cells |
| 14 | Keyboard order: close X → product link → order link → footer | partial | `after/en-dark/review-dialog-approved-1440.png` (AC-09) | the order is the close X, the product link, the order link (when the API sends it), the footer. ONE extra stop sits between the product link and the footer: the focusable comment scroll area (WCAG 2.1.1 — a scrollable region a keyboard cannot reach is a region a keyboard cannot read) |
| 15 | Mobile 390: a full-width sheet with a sticky footer | done | `after/en-light/review-dialog-approved-390.png` (AC-10) | the panel is 900/900 of the viewport; the body scrolls, the footer stays |
| 16 | RTL: the footer mirrored, the stars, the numerals | done | `after/ar-dark/review-dialog-approved-1440.png` (AC-11) | Delete stays on the start side, the stars fill from the start side, "4 / 5" stays "4 / 5" |
| 17 | The evidence: 4 states × 4 language/theme cells × 2 widths, with the numbers in results.json | done | `evidence/review-dialog/{before,after}/results.json` + `measurements.json` (AC-15) | 40 screenshots per run; the footer gap, the dialog height, the tab order, the Escape/focus result and the badge contrast are measured, not guessed |
| 18 | The admin's public reply | blocked on backend (skipped) | `API_GAPS.md` (AC-16) | no endpoint and no column; logged in `API_GAPS.md` and in `DECISIONS.md` |
| 19 | The shared `RatingStars` | not broken — nothing to fix | `before/en-light/review-dialog-approved-1440.png` | the stars FILLED (4/5, 2/5, 5/5) in the "before" run as well: the outline-star screenshot came from a pre-merge build. The shared component was left untouched |
| 20 | `npm run evidence` | fixed (pre-existing) | `scripts/evidence-targets.mjs` | the harness could not PARSE on `main`: a bad merge (`9997e176`, carried in by `e9bedb65`) dropped the `},` that closes the last global-search target. One line, fixed here, because nothing in the evidence round runs without it |
| 21 | `DECISIONS.md` / `API_GAPS.md` | done (appended) | `DECISIONS.md`, `API_GAPS.md` | nothing was overwritten |
| 22 | The Reviews table and the grid | untouched | the diff stat below | the dialog lives in the same template; only the dialog block and the delete confirmation changed |

## The numbers, before and after

| Measurement | Before | After | Where |
|---|---|---|---|
| The gap between the two footer buttons | **0px** (they touched) | **12px** | `measurements.json` → `headline.footerGapPx` |
| The dialog height at 1440 (a long comment) | 598px of 900 | 514px of 900 | `after/measurements.json` → `targets[].dialogHeightPx` |
| The dialog height at 390 | 398–738px of 900 | 900px of 900 (the sheet) | idem |
| The long comment | grew the dialog, no scroll area | scrolls inside its own area (`scrollHeight 252 > clientHeight 158`) | `targets[].comment` |
| Escape closes | true | true | `targets[].escape.closes` |
| The focus returns to the trigger | true | true | `targets[].escape.focusReturned` |
| The badge contrast (text on its own tint) | 5.29:1 | 5.29:1 | `headline.badgeContrastVsBadgeBg` (WCAG AA needs 4.5:1) |
| The title | "Review Details" | "Review details" | `targets[].title` |
| The product link | `/dashboard/products/{slug}` (not a route) | `/dashboard/products/{slug}/edit` | `targets[].productLink` |

## The diff stat (no whitespace-only changes)

```
 .quality/runs/2026-10-21T13-00-00Z/evidence-manifest.json | 564 ++++++++++
 API_GAPS.md                                        |  33 ++
 DECISIONS.md                                       | 150 ++++++
 docs/review-dialog-v3-plan.md                      |  24 +
 docs/review-dialog-v3-spec.md                      |  83 +++
 e2e/review-dialog.spec.ts                          | 138 +++++
 public/assets/i18n/ar.json                         |  11 +
 public/assets/i18n/en.json                         |  15 +-
 scripts/evidence-targets.mjs                       | 370 +++++++++++++++++++++
 scripts/evidence.mjs                               | 124 +++--
 scripts/measure-review-dialog.mjs                  |  96 ++++++
 scripts/verify-review-dialog-evidence.mjs          | 198 ++++++++++++++++++++++
 .../reviews/components/review-list.component.html  | 159 ++++++--
 .../reviews/components/review-list.component.ts    |  65 ++-
 .../ui/dialog-shell/dialog-shell.component.ts      |  39 +-
 15 files changed, 1981 insertions(+), 88 deletions(-)
```

`git diff --check e9bedb65..HEAD` is empty: no whitespace errors, and no
file was reformatted for its own sake.

## What ran

| Check | Command | Result |
|---|---|---|
| The build | `npx ng build` | exit 0 (the warnings are pre-existing) |
| The new e2e suite | `npx playwright test e2e/review-dialog.spec.ts` | **8 passed** |
| The reviews console (unchanged by this round) | `npx playwright test e2e/reviews.spec.ts` | **4 passed** |
| The other DialogShell user (regression) | `npx playwright test e2e/contact-messages.spec.ts` | **5 passed** |
| The unit suite | `npm run test:unit` | 178 passed, **3 failed — the same 3 that fail on `main`** (a raw `<button>` in the navigation bar, and two `nav.*` i18n keys) |
| The evidence harness | `npm run evidence -- review-dialog --out evidence/review-dialog/{before,after} --widths 1440,390` | 2 runs × 8 cells × 5 targets = 80 screenshots |
| The claim checker | `node scripts/verify-review-dialog-evidence.mjs` | **16/16 PASS** (exit 0) |
| The evidence gate | `node …/evidence-gate validate .quality/runs/2026-10-21T13-00-00Z/evidence-manifest.json` | **PASS** (exit 0) |

## How the two runs were captured

Both runs used the SAME harness and the SAME method: a production build
served by `scripts/serve-with-proxy.mjs` (the repo's own tool for a shared
working tree — the backend's CORS allows one origin, `http://localhost:4200`).

- **before** — the base commit `e9bedb65`, served on `:4397`.
- **after** — this branch, served on `:4398`.

The "before" run uses the FIXED harness against the base APP: the base
commit's own harness is the broken one (it cannot parse), which is finding
#20 above.

## The state of the machine

- The branch `ui/review-dialog-v3` is checked out in the worktree
  `../nocteon-dashboard-review-dialog` — this repository is shared with a
  second session, which took the main checkout's branch and port while this
  round was running. The worktree keeps the two apart.
- The evidence artifacts were copied to `evidence/review-dialog/` in the
  main checkout (they are gitignored, so they are files, not commits).
- The fixture review (a 653-character review created through the public
  API for the long-comment state) was deleted again: the database holds the
  15 seeded reviews it held before this round.
