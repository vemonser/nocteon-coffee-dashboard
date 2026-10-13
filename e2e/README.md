# Auth E2E Suite

Playwright tests covering the login flow, the admin gate, and credential
validation. These run against a **live** stack — they do not mock HTTP, because
an auth test that mocks its own backend proves nothing about authorization.

## Prerequisites

| Requirement | Why |
|---|---|
| `npm start` on `:4200` | Angular dev server. Auto-started by Playwright unless already running. |
| Backend on `:8080` | Your aurum API. **Not** managed by Playwright — start it yourself. |
| `.env.local` | Credentials. Copy from `.env.example`. |

```bash
cp .env.example .env.local
$EDITOR .env.local       # fill in the four values
npm test                 # or: npm run test:e2e
```

`.env.local` is gitignored. **Never commit real credentials.**

## ⚠ Credentials leak into traces

Playwright records `locator.fill()` values in plaintext. Any `test-results/**/trace.zip`
from a run using real accounts contains those passwords in the clear.

- `/test-results/` and `/playwright-report/` are gitignored.
- Do **not** attach traces, screenshots, or the HTML report to bug reports or
  CI artifacts from a run that used real accounts.
- For CI, inject secrets as environment variables instead of writing a file.

## Requirement → test map

| AC | Requirement | Test | Status |
|---|---|---|---|
| AC-1 | Admin with valid creds reaches `/dashboard` | `AC-1 admin with valid credentials lands on the dashboard` | PASS |
| AC-2a | Non-admin is not routed to `/dashboard` | `AC-2a non-admin is not routed into the dashboard` | **FAIL — real defect** |
| AC-2b | Non-admin sees an explanatory error | `AC-2b …` | `test.fixme` — not implemented |
| AC-3 | No email + no password cannot submit | `AC-3 …` | PASS |
| AC-4 | Email but no password cannot submit | `AC-4 …` | PASS |
| AC-5 | No email but password cannot submit | `AC-5 …` | PASS |
| AC-6a | Identifier accepts a username, not email-only | `AC-6a …` | PASS |
| AC-7 | Wrong password → error, stays on login | `AC-7 …` | PASS |
| AC-8 | Unknown email → error, stays on login | `AC-8 …` | PASS |
| AC-9 | Logged-out deep link → redirected to `/login` | `AC-9 …` | PASS |

## Known app defects (these are NOT broken tests)

### 1. AC-2a — no admin gate on `/dashboard`  ·  CRITICAL

`src/app/core/auth/auth.guard.ts` checks only `auth.isLoggedIn()`, which is
`!!currentUser()` — **no role check**:

```ts
if (auth.isLoggedIn()) return true;
return router.createUrlTree(['/login']);
```

`src/app/app.routes.ts:15` applies only `canActivate: [authGuard]` to
`/dashboard`. A `CUSTOMER` reaches the dashboard and sees every admin nav link.
The `profile` child route (line 455) has **no guard at all**.

**Verified**: the failing run's `error-context.md` shows a CUSTOMER session
rendering the full dashboard sidebar.

**Scope limit — read this before "fixing" it.** The backend authenticates any
valid account (Sara gets `200` + a valid JWT). So `/dashboard` can currently be
gated in the UI only. Adding `role === 'ADMIN'` to the guard would turn AC-2a
green **without changing any real security** — the dashboard APIs remain
reachable by any authenticated user. Backend authorization on `/api/dashboard/*`
is the actual control and is **not covered by this suite**.

### 2. AC-2b — no error path for an under-privileged user  ·  MEDIUM

`login.component.ts` sets `error()` only from `err.error?.message` on a 4xx.
Since the backend returns `200` for a valid non-admin, no error path fires. The
copy shown to a blocked user is an open product decision — hence `test.fixme`.

### 3. AC-6 — dead template code  ·  LOW

`login.component.html` renders `<hlm-field-error validator="email">` and
`validator="minlength"`, but the form declares `Validators.required` only — so
neither error can ever fire.

**Do not "fix" this by adding `Validators.email`.** The field is labelled
"Email or Username" and the backend error is
`"Invalid email/username or password"` — username login is a supported flow,
and an email-only validator would break it. Removing the dead markup, or wiring
a conditional validator, is a product decision.

## Out of scope / uncovered

Not exercised here: `/unauthorized`, per-route `permissionGuard` behaviour on
child routes, session persistence across reload, `logout()`, and the
`/api/auth/refresh` boot path via `initializeSession()`. Given defect #1, the
suite gives **false confidence about authorization generally** — treat AC-1/AC-7
as login-correctness evidence, not authorization evidence.

## Related finding (outside this suite)

`sara@example.com` has role `CUSTOMER` but holds `user:read`, `user:update`,
`order:read`, `cart:manage`. A customer being granted user-administration
permissions is a privilege concern worth reviewing on the backend.