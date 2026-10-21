# ui/review-dialog-v3 — work plan (approved)

Scope: the REVIEW DETAILS DIALOG only. The Reviews table/grid are NOT touched.
Base: `main` @ e9bedb65. Branch: `ui/review-dialog-v3`.

## Decisions (user-confirmed)
1. No Reject button — backend has no reject endpoint → API_GAPS.
2. Product link → `/dashboard/products/:slug/edit` (the only product page in the dashboard).
3. DialogShell: additive optional input for the mobile sheet; contact-messages untouched.
4. Long-comment evidence: create a REAL review via the public API, capture, then delete it.

## Phases
- [x] Phase 0 — evidence harness (`--widths`, `--out`, `review-dialog` targets, `measure-review-dialog.mjs`) + the `before/` capture
- [x] Phase 1 — API probes → API_GAPS.md + DECISIONS.md (append only)
- [x] Phase 2 — UI on DialogShell (title case, header, body, footer hierarchy, toasts, busy states)
- [x] Phase 3 — behavior / a11y / responsive / RTL + the `after/` capture
- [x] Final — build, unit tests, e2e, adversarial review, evidence gate, report table

## Guard rails
- No whitespace-only or formatting-only diffs.
- Tokens only (no raw hex). Spartan UI. i18n EN + AR.
- Never touch RatingStars (owned by the reviews-page task) — scale stars locally.
- Append to DECISIONS.md / API_GAPS.md, never overwrite.
- Every claim in the report points to an evidence path.

## The adversarial review round
The independent review found two real defects and a list of minor ones. All
of them are fixed in `fix(reviews): what the review found` — the dialog
re-opening itself after an in-flight response, two `aria-modal` panels open
at once, the dead tab stop in a short comment, the missing
`aria-describedby` on the confirmation, the focus-trap hole in the shared
shell, the inert Cancel button, the `\\s` in the name formatter, and the
English-only e2e spec. The evidence was re-captured with the measures the
review said were missing (the star size, the RTL positions, the identity of
the focused control).
