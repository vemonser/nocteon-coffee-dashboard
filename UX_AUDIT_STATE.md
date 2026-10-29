# UX_AUDIT_STATE.md — resume state for `/ux-audit all`

- [x] dashboard (home) → `UX_AUDIT_dashboard.md` (2026-10-28)
- [x] products (list + wizard) → `UX_AUDIT_products.md` (2026-10-28)
- [ ] orders
- [ ] products (catalog)
- [ ] reviews
- [ ] contact-messages
- [ ] users / access
- [ ] store-settings
- [ ] journal / content

Notes:
- Login flow for captures: `.env.local` creds via dotenv at runtime (never printed); wait for either the auth bounce (`/login`) or `app-kpi-card` — the guard redirect happens after `goto` resolves.
- Language-agnostic dashboard marker: `app-kpi-card` ("Commerce overview" is EN-only).
- Backend on :8080 must be up; frontend `npm start` on :4200.
- Block data APIs for error state but keep `/api/auth/**` live, and log in *before* installing the block, or the auth guard bounces to /login.
- Reusable scripts: `/tmp/opencode/ux-audit-capture.mjs`, `/tmp/opencode/ux-audit-walk.mjs`, `/tmp/opencode/ux-ar-pass.mjs`, `/tmp/opencode/ux-states.mjs`.

## Ad-hoc area fix — Store settings (2026-10-29)
Requested directly (not a full audit): the table header "Free shipping…" was truncated and the boolean printed as raw `false`.
- Column widths: `freeShippingThreshold` 120px → **200px**, `isFreeShippingActive` **160px**; measured `clipped: false` for every header (en+ar).
- Headers gained keys: `common.freeShippingActive`, `common.currency`; the shared table now renders any **boolean cell** as an Enabled/Disabled badge (`common.active`/`common.inactive`) instead of `true`/`false` — measured EN "Enabled", AR "مُفعّل".
- Page title "Store setting" → "Store settings" (matches the sidebar).
- Commit `f57b8192`; evidence `evidence/ux-audit/store-settings/{before,after}-{en,ar}.png`.

### Store settings — follow-up (2026-10-29, `e29b8e71`)
- Removed the **Created at** and **Updated at** columns (headers measured: Currency / Free shipping threshold / Free shipping active / Actions only).
- The edit modal's **checkbox is now a toggle** (`hlm-switch`, label associated via `for`, `aria-label`), verified `hasSwitch: true`, `hasCheckbox: false`; screenshot `evidence/ux-audit/store-settings/after-toggle-dialog-en.png`.
- Same pass fixed the modal's keyboard path (it had none): `role="dialog"`, `aria-modal`, labelled by its title, CDK focus trap with auto-capture, and **Esc closes** (measured `escCloses: true`).

### Pairing + shared list behaviour (2026-10-29, `3a207a59` + `189309aa` + `c326ca3f`)
- **Columns-open popover** now closes on outside click AND Esc in all 10 lists that have the toggle (verified on pairing + categories: outsideCloses true, escCloses true).
- **Row delete** on pairing (and the other 10 soft-delete-enabled lists) runs immediately with an **Undo toast (6s)** instead of a confirm dialog that wrongly said "cannot be undone"; the confirm survives only for permanent delete from the Trash view. Verified on pairing + categories: no dialog, toast "Moved to trash [Undo]", Undo restores the row.
- Pushed to `main`: `2bf1ac0e` (build clean, 317 unit tests pass).
