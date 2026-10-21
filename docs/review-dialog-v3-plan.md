# ui/review-dialog-v3 — work plan (approved)

Scope: the REVIEW DETAILS DIALOG only. The Reviews table/grid are NOT touched.
Base: `main` @ e9bedb65. Branch: `ui/review-dialog-v3`.

## Decisions (user-confirmed)
1. No Reject button — backend has no reject endpoint → API_GAPS.
2. Product link → `/dashboard/products/:slug/edit` (the only product page in the dashboard).
3. DialogShell: additive optional input for the mobile sheet; contact-messages untouched.
4. Long-comment evidence: create a REAL review via the public API, capture, then delete it.

## Phases
- [ ] Phase 0 — evidence harness (`--widths`, `review-dialog` targets, `measure-review-dialog.mjs`) + `before/` capture
- [ ] Phase 1 — API probes → API_GAPS.md + DECISIONS.md (append only)
- [ ] Phase 2 — UI on DialogShell (title case, header, body, footer hierarchy, toasts, busy states)
- [ ] Phase 3 — behavior / a11y / responsive / RTL + `after/` capture
- [ ] Final — build, unit tests, e2e, adversarial review, evidence gate, report table

## Guard rails
- No whitespace-only or formatting-only diffs.
- Tokens only (no raw hex). Spartan UI. i18n EN + AR.
- Never touch RatingStars (owned by the reviews-page task) — scale stars locally.
- Append to DECISIONS.md / API_GAPS.md, never overwrite.
- Every claim in the report points to an evidence path.
