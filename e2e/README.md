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
| AC-2a | Non-admin is not routed to `/dashboard` | `AC-2a non-admin is not routed into the dashboard` | PASS |
| AC-2b | Non-admin sees an explanatory error | `AC-2b non-admin sees an explanatory error and stays on /login` | PASS |
| AC-3 | No email + no password cannot submit | `AC-3 …` | PASS |
| AC-4 | Email but no password cannot submit | `AC-4 …` | PASS |
| AC-5 | No email but password cannot submit | `AC-5 …` | PASS |
| AC-6a | Identifier accepts a username, not email-only | `AC-6a …` | PASS |
| AC-7 | Wrong password → error, stays on login | `AC-7 …` | PASS |
| AC-8 | Unknown email → error, stays on login | `AC-8 …` | PASS |
| AC-9 | Logged-out deep link → redirected to `/login` | `AC-9 …` | PASS |

### The review details dialog (ui/review-dialog-v3)

`e2e/review-dialog.spec.ts` — the dialog only; the table and the grid have
their own suite (`e2e/reviews.spec.ts`).

| AC | Requirement | Test | Status |
|---|---|---|---|
| AC-01 | The title is sentence case | `the title is sentence case, like the rest of the app` | PASS |
| AC-02 | The footer buttons have a gap and a hierarchy | `the footer buttons have a gap and a hierarchy` | PASS |
| AC-03 | The stars are large, with the number next to them | `the rating shows the stars and the number next to them` | PASS |
| AC-04 | The status is a labelled row | `the status is a LABELLED row, not a floating badge` | PASS |
| AC-05 | The product name links to the product page that exists | `the product name links to the product page that EXISTS` | PASS |
| AC-07 | The comment keeps its line breaks | `the comment keeps its line breaks` | PASS |
| AC-08 | Escape closes, the focus returns to the trigger | `Escape closes the dialog and the focus returns to the trigger` | PASS |
| AC-08b | The focus stays INSIDE the dialog | `the focus stays INSIDE the dialog` | PASS |
| AC-11 | In Arabic the footer is mirrored, the numerals still read "N / 5" | `in Arabic the footer is mirrored and the numerals still read "N / 5"` | PASS |
| AC-12 | Approving toasts; the button waits for the answer | `approving toasts, and the button waits for the answer` | PASS |
| AC-12b | Closing the dialog mid-request does not re-open it | `closing the dialog while the request is in flight does NOT re-open it` | PASS |
| AC-13 | The delete confirmation names the review | `the delete confirmation NAMES the review` | PASS |

## Known app defects (these are NOT broken tests)

### 1. AC-2a — no admin gate on `/dashboard`  ·  UI gate added, backend still open

**Fixed on the UI.** Two checks, both driven by the role the backend returns in
the login/refresh response (`currentUser()?.role`):

- `login.component.ts` — after a 200 login, if `res.data.user.role !== 'ADMIN'`
  it shows the existing `unauthorized.message` copy and calls `clearSession()`,
  so a non-admin never navigates to `/dashboard`.
- `core/auth/auth.guard.ts` — checks the same role for deep links/reloads and
  redirects a non-admin to `/login`.

Why the role can be trusted: `AuthService.setSession()` stores the whole `user`
object from `/api/auth/login` (and `/api/auth/refresh`), and the app initializer
runs `initializeSession()` **before** routing, so the role is populated by the
time the guard runs — no race.

**Security boundary — do not over-claim this.** The backend authenticates any
valid account (Sara gets `200` + a valid JWT), so `/api/dashboard/*` remains
reachable by an authenticated non-admin who calls the API directly. The UI gate
is defence-in-depth and correct UX; **real authorization must be enforced
server-side** and is not covered by this suite. `profile` (a child of
`/dashboard`) is covered by the parent guard.

### 2. AC-2b — explanatory error for an under-privileged user  ·  RESOLVED

Was `test.fixme` because `login.component.ts` only set `error()` from a 4xx
body and the backend returns `200` for a valid non-admin. It now checks the
role from the response and shows `unauthorized.message` (an existing
translation) without navigating.

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

Not exercised here: the `/unauthorized` page itself, per-route `permissionGuard`
behaviour on child routes, session persistence across reload, `logout()`, and
the `/api/auth/refresh` boot path via `initializeSession()`. The suite now
covers the **UI** admin gate (AC-2a/AC-2b) but gives **no** authorization
evidence for the backend — `/api/dashboard/*` server-side authorization is
uncovered and remains the real boundary (see defect #1).

## Related finding (outside this suite)

`sara@example.com` has role `CUSTOMER` but holds `user:read`, `user:update`,
`order:read`, `cart:manage`. A customer being granted user-administration
permissions is a privilege concern worth reviewing on the backend.

## Non-auth regression guards

Four specs here are not part of the auth AC set. Each guards layout behaviour
that was reported as broken and fixed, and is written to fail if the fix is
reverted:

| Spec | Guards | Notes |
|---|---|---|
| `verify-sidebar.spec.ts` | Every sidebar section opens, its children are reachable, and the nav scrolls with all five groups open at once | Also asserts no nav child is squashed below its content height. That was the bug: `hlm-sidebar-content` is a `flex-column` scroll container whose children default to `flex-shrink: 1`, and `.nav-collapse` hides its overflow (automatic minimum size `0`), so open groups were compressed to a few px — `scrollHeight` stayed equal to `clientHeight`, no scrollbar appeared, and the links were clipped unreachable. |
| `verify-tables.spec.ts` | Data tables: no `id` column, actions column width, square rounded thumbnails, date/bulk fields sized down, no horizontal overflow at 390px, EN + AR, light + dark | Uses ONE context + ONE login and loads pages strictly in sequence. Refresh-token rotation plus reuse detection revokes the whole token family if a saved `storageState` is replayed or two page loads overlap. |
| `verify-slug-links.spec.ts` | A list row's slug is a control that opens that entity's own page, on all 9 lists that expose one (8 with a `slug` column + categories, whose slug lives inside the main cell). Clicks through and asserts the resulting URL pins the clicked slug. | Locates the control through `data-testid="slug-link"` — the project's first test id, added because the two render paths share no other stable, user-facing handle. |
| `verify-category-products.spec.ts` | Category detail products are the SHARED TABLE only: rows render through the DataTable (main cell with name link + slug handle), the card grid and its grid/list toggle no longer exist, the pagination footer shows the range line + per-page select (10/20/50, default 20) and changing per-page refetches page 0 with the new `size`, the featured star lives in the Featured column (featured rows only, tooltip + `aria-label`), the row's name link resolves to an existing route (the product editor, not the non-existent `products/{slug}`), and a failed fetch shows an error state + Retry instead of the empty-category copy. | Uses ONE context + ONE login and 429 backoff/retry on login (mirrors `verify-tables`). Counts are read live from the page, so a seed change moves the expectation with it. AC-P5 (45-row pager) and AC-P7 (500 → Retry) mock the products endpoint; everything else reads the live seed. Replaced `verify-category-grid.spec.ts` when the card grid was removed in favour of the table. |

### Known coverage gap — AC-SL2

`verify-slug-links.spec.ts` also asserts that the categories **trash** tab renders
no slug control (trashed rows are hidden from the detail queries, so a link there
would be a dead end). The seeded trash is empty, so the test **skips** with that
reason instead of passing vacuously over an empty table. Give the trash a row and
the assertion starts running; until then treat that rule as unproven.

Login is rate limited to 5/min per IP **and** per identifier, so running these
specs repeatedly in quick succession starts returning `429`.

---

## The orders pages — v5 (2026-10-22)

| Spec | What it proves |
|---|---|
| `e2e/orders.spec.ts` | The list: the four cards are the API's numbers, the seven tabs, the pager's range, the NOT_COLLECTED badge, the measured table |
| `e2e/order-detail.spec.ts` | The order: the actions follow the state, the timeline's recorded history, the customer's own numbers, the items, the totals, the RTL |
| `e2e/orders-states.spec.ts` | The states: loading, empty (with a Clear filters button), error with a retry, the a11y rules |
| `e2e/orders-do-d.spec.ts` | The Definition of Done: four screenshots (light/dark × EN/AR) at 1440×900, the three states, and no overflow, no clipping, no raw key |

### The requirements they pin

| Requirement | Test |
|---|---|
| The pager says "1-10 of 17" and exactly ten rows are on screen | `the pager says 1-10 of 17 and exactly ten rows are on screen` |
| Changing the page changes the rows; the total never changes | `changing the page changes the rows, and the total never changes` |
| The revenue card is the API's revenue | `the four cards are the numbers the API reports` |
| The average is the revenue over the PAID orders | `the four cards are the numbers the API reports` |
| The cancel rate is the cancelled orders over the orders shown | `the cancel rate is the cancelled orders over the orders shown` |
| The seven tabs, and Confirmed has none | `the seven tabs are the ones the spec names` |
| The Refunded tab filters on the payment status | `the Refunded tab filters by the payment status` |
| A cancelled COD order says "Not collected", not "Failed" | `a cancelled cash-on-delivery order says "Not collected", not "Failed"` |
| The table never scrolls sideways at 1440 | `the table does not scroll sideways at 1440` |
| A terminal order offers no status change | `a DELIVERED order offers no status change` |
| A cancelled order cannot be cancelled again | `a CANCELLED order offers neither a status change nor a cancel` |
| The status change offers only the allowed transitions | `the status dialog offers only the transitions the backend allows` |
| The customer card shows the CUSTOMER's numbers | `the customer card shows the CUSTOMER numbers, not the store numbers` |
| The SKU appears once; the regular price is a reference | `the items show the SKU once, and no invented discount` |
| The settlement is honest about what the store does not record | `the totals add up, and the settlement is honest` |
| The timeline shows the recorded history | `the timeline shows the recorded history, with its dates and actors` |
| The empty state offers a way out | `the list has a loading, an empty and an error state` |
| Arabic reads right to left, the numbers stay Latin | `the page is readable in Arabic, and the numbers stay Latin` |

### Two notes for whoever runs them

**The API is rate-limited** (200 requests a minute per identifier) and a suite
that opens many pages gets close to it. The waits are WAITS, not sleeps: a
fixed sleep is a race against the limiter. A page that trips the limit shows
the error state with the API's own message — the message is rendered, not
swallowed, so a rate limit is visible instead of looking like a defect.

**The orders page asks the stats endpoint twice** — once for the tab counts
(the filtered set without the tab) and once for the cards (with the tab). That
is deliberate: each scope is explicit in the code, and the browser never
reads the whole set to add it up.
