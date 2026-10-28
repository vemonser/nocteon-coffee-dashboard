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
