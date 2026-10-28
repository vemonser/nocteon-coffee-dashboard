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
