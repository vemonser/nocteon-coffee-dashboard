# QA Harness

## Run
- `npm run qa` — full audit (Playwright) on running dev server + backend.
- `npm run qa:static` — static checks only (i18n parity, Title Case, native dialogs, RTL lint).

Flags: `--pages=dashboard,users` `--themes=light,dark` `--locales=en,ar` `--fast` (light/en only, no mobile).

Env: `QA_USER`, `QA_PASS` (defaults to E2E_ADMIN_*).

## Add a page
Add an entry to `qa/routes.ts`. Param routes resolve the first row of their list page.

## Add a scenario
Add to `qa/scenarios.ts`.

## Allowlist
Static allowlists live in `scripts/qa-static.mjs` (proper nouns, brand names).

## Limits
Browser tab close and reload can only trigger the native prompt; in-app navigation uses the app modal.