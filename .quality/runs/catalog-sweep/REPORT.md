# Catalog & Products Verification Report

**Date:** 2026-10-14
**Stack:** Angular 22 dashboard (`nocteon-dashboard`) + Spring Boot 4 backend (`nocteon-backend`)
**Stack status at time of run:** dev server `:4200` up, backend `:8080` up
**Authenticated as:** `admin@aurum.local` (admin — bypasses all permission checks)
**Tool:** gsd-browser MCP (live session, recording `rec_8d56cc38`)

> **Scope note.** This run covered the **Products wizard deep-dive** and the **API wiring
> audit** in full. The 12 remaining catalog pages received a targeted sweep, not the full
> add/edit/delete round-trip that was planned. Coverage status is stated per finding below;
> nothing here is marked verified unless a real request/response was observed.

---

## Executive summary

| # | Severity | Finding | Status |
|---|---|---|---|
| F-1 | **CRITICAL** | Coffee-variety update sends `multipart`, backend requires JSON → `415` | CONFIRMED (live, 415) |
| F-2 | **CRITICAL** | Product create returns `409`, product not created, **no error shown** | CONFIRMED (live, 409) |
| F-3 | **HIGH** | 160 Transloco keys used in templates are missing from **both** `en.json` and `ar.json` | CONFIRMED (static + live render) |
| F-4 | **HIGH** | Systematic **silent-failure** pattern: server errors produce no UI message and no console output | CONFIRMED (3 independent instances) |
| F-5 | **MEDIUM** | Negative price accepted; banner renders *"On sale - showing -5"* | CONFIRMED (live) |
| F-6 | **MEDIUM** | Required-but-unmarked fields block the wizard with **no explanation** | CONFIRMED (live) |
| F-7 | **MEDIUM** | 22 backend dashboard endpoints have no working frontend wiring | CONFIRMED (static) |
| F-8 | **MEDIUM** | 4 frontend service methods call backend paths that **do not exist** | CONFIRMED (static) |
| F-9 | **LOW** | Product wizard text fields render labels without programmatic association | CONFIRMED (live DOM) |

---

## F-1 — CRITICAL · Coffee-variety update always fails with 415

**Observed:** Editing an existing coffee variety and clicking *Save Changes* produced:

```
PUT /api/dashboard/coffee-varieties/gesha   Content-Type: FormData   →  415 Unsupported Media Type
```

The edit silently did nothing — dialog stayed open, no toast, no console error.

**Root cause** — the frontend sends `multipart/form-data`, the backend expects a JSON `@RequestBody`:

- Backend: `CoffeeVarietyController.java:75-79` — `PUT` with `@Valid @RequestBody CoffeeVarietyRequest`
- Frontend: `coffee-variety.service.ts:45-55` — `update` overrides `format = 'multipart'` and wraps via `buildFormData`
- Caller passes no format arg: `coffee-variety-list.component.ts:177`

**Coffee-variety is the sole outlier.** Every sibling service correctly defaults to `'json'`:
`processing-method.service.ts:48`, `tasting-note.service.ts:47`, `brewing-method.service.ts:47`.

**Fix:** change the override in `coffee-variety.service.ts:45` to `'json'` and drop the
`buildRequestBody`/`buildFormData` wrapping so the payload matches `@RequestBody`.

**Impact:** coffee-variety edit is **100% broken**. Create/delete work because they use the
correct paths. This is the highest-confidence, most immediately fixable finding.

---

## F-2 — CRITICAL · Product create returns 409 and the failure is invisible

**Observed:** Completing all 5 wizard steps and clicking *Create Product* produced:

```
POST /api/dashboard/products   →  409 Conflict
```

Product was **not** created (list still shows 7 rows, no `QA-PROBE-*` record). The wizard
stayed on step 5 with all entered data intact and **no error message of any kind**.

**What is confirmed:** the 409, that no product was persisted, and that the user gets zero
diagnostic feedback.

**What is NOT confirmed:** the *cause* of the 409. Candidate causes I could not distinguish
within this run:
- duplicate slug / SKU collision at the backend
- a referenced product-option (Weight / Grind Type / Size) conflicting
- a backend rule the payload violates

This needs backend log inspection to close out. **Do not treat the fix as known.**

---

## F-3 — HIGH · 160 translation keys are missing from both language files

566 keys are used via `| transloco` in templates. **160 of them exist in neither `en.json`
nor `ar.json`.** `en.json` and `ar.json` are perfectly symmetric (0 asymmetric keys) — these
were simply never added.

**Browser-confirmed** on the Add Roast Level dialog, which renders the literal strings:

```
roastLevels.name
roastLevels.description
```

**Every catalog page is affected.** Affected namespaces and counts of missing keys:

| Namespace | Missing |
|---|---|
| `promoCodes.*` | 20 |
| `users.*` | 21 |
| `farms.*` | 15 |
| `origins.*` | 15 |
| `shippingZones.*` | 11 |
| `categories.*` | 15 |
| `roastLevels.*` | 9 |
| `profile.*` | 12 |
| `notifications.*` | 8 |
| `processingMethods.*` | 9 |
| `brewingMethods.detail.*` | 8 |
| `carts.*` | 6 |
| `tastingNotes.detail.*` | 2 |
| `common.*` (price, type, featured, deleteConfirm, …) | 6 |

Full enumerated table with source `file:line` for each key:
**`missing-i18n-keys.md`** (168 lines, in this directory).

**Fix:** add all 160 keys to **both** `en.json` and `ar.json`. Note `common.*` is the widest
blast radius — it is used by categories, brewing methods, and promo codes alike.

---

## F-4 — HIGH · Systematic silent-failure pattern

Three independent server-side failures were observed. In **all three** the dashboard:
1. performed no visible UI change,
2. displayed **no** error, toast, or inline message,
3. logged **nothing** to the browser console.

| Instance | Request | Status | User sees |
|---|---|---|---|
| Coffee-variety save | `PUT /api/dashboard/coffee-varieties/gesha` | 415 | nothing |
| Product create | `POST /api/dashboard/products` | 409 | nothing |
| Wizard step advance (F-6) | *no request made* | n/a | nothing, form silently frozen |

Console error count across the whole recorded session: **0**.

This is arguably the most damaging defect in the set: an admin cannot tell a successful save
from a rejected one. A 415 or 409 leaves the operator believing they saved data that was
never stored.

**Fix direction:** every `callCreate`/`callUpdate`/`callDelete` error branch in
`BaseListComponent` and `ProductWizardState` must surface the server message to the user. The
delete path already sets `submitting` on error (`base-list.component.ts:183`) but never
displays anything.

---

## F-5 — MEDIUM · Negative price accepted

Entering `price = -5` on the Variants step:

- the field accepted the value (no min attribute, no error),
- the banner rendered **`On sale - showing -5 (was 30)`**,
- the wizard refused to advance — **but displayed no reason** (see F-6).

The negative value is echoed straight into user-facing copy. Client-side validation should
reject `price < 0` (and arguably `compareAtPrice < price`), and the sale banner must never
render a negative amount.

---

## F-6 — MEDIUM · Wizard blocks with no explanation

On the Variants step, progression was refused **three separate times** with no message:

1. after entering `price = -5` (F-5),
2. after restoring a valid price — still refused,
3. only after additionally selecting **Weight / Grind Type / Size** did *Next* work.

Those three option selects render placeholder text **"Select a value"** with **no `*` required
marker**, so nothing tells the user they are mandatory.

**Caveat — partially inferred.** I did not isolate each blocker individually, so I cannot
state with certainty that the option selects (rather than a validation-tick timing issue) were
the sole cause of block #2. Treat the "required-but-unmarked" conclusion as **likely** and
confirm before fixing.

**Fix:** mark genuinely required fields, and when a step blocks, either focus the first invalid
field or state which field failed.

---

## F-7 — MEDIUM · 22 backend endpoints unwired

Of **118** dashboard-facing backend endpoints: **94 wired**, **2 mismatched**, **22 unwired**.

**No frontend surface at all (12):**
- `AiAdminController` — both endpoints (`POST /ai/reindex`, `GET /ai/stats`). The entire AI
  admin capability is invisible in the UI.
- `ContactController` — **5 of 6** endpoints. The dashboard can only *list* messages; there is
  no detail view, mark-as-read, reply, delete, or unread filter.
- `GET /orders/{id}` — order detail page does not exist (list + status change only).
- Standalone image replace for 4 entities: `POST /{slug}/image` on categories, farms, origins,
  pairings. Images can only be set at create/update time.

**Service method exists but nothing calls it (10):**
`brewing-method.getProducts`, `broadcast.getById`, `carts.getById`, `journal.uploadCover`,
`product.addMedia`, `product.deleteMedia`, `productOption.getById`,
`productOption.attachToProduct`, `productOption.detachFromProduct`, plus broadcast delete
(whose `callDelete` explicitly throws — `broadcast-list.component.ts:100`).

**Notably relevant to products:** `POST /products/{slug}/media` and
`DELETE /products/media/{mediaId}` exist in both backend and service but are never called.
Post-creation media management is therefore unreachable — consistent with F-2, where a product
could not be created at all through the wizard.

---

## F-8 — MEDIUM · 4 phantom frontend calls (no backend mapping)

These are the inverse problem — the frontend calls paths the backend does not implement:

| Frontend call | Location | Backend reality |
|---|---|---|
| `GET /api/dashboard/journal/{slug}` | `journal.service.ts:29-31`, called on **every journal edit** | No such mapping. `JournalController` has list/POST/PUT/cover/DELETE only. Correct path is `GET /api/journal/{slug}` (`JournalController.java:47`). **Will 404.** |
| `POST /api/settings` | inherited `BaseCrudService.create` → `store-settings-list.component.ts:112` | No POST exists; only `GET /api/settings` and `PUT /api/dashboard/settings` |
| `DELETE /api/settings/{id}` | inherited → `store-settings-list.component.ts:120` | No DELETE exists |
| `PUT /api/dashboard/broadcasts/{id}` | inherited `update` | `BroadcastController` has no PUT |

The journal one is the serious case: it fires on every edit, and the failure is **swallowed**
by `catchError(() => of(null))` at `journal-form.component.ts:100`, which then shows
*"Journal post not found"*. A correct existing product gets reported as missing.

The three store-settings paths are currently latent (unreachable while `loadPage` always
yields a row), but they are live code that will 404/405 if that logic changes.

---

## F-9 — LOW · Labels not programmatically associated (accessibility)

In the product wizard, `name`, `shortDescription`, and `description` render visible label text
(`Name *`, `Short Description`, `Description`) but expose **no** `<label for>`, no `aria-label`,
and `input.labels` resolves to `null`. Screen readers will announce these as unlabelled.

The checkboxes (`isActive`, `featured`) *do* have proper labels, so the gap is specific to the
text inputs.

Also: step buttons (`Basic Info`/`Variants`/…) carry no `aria-current`.

---

## Coverage status

| Planned work | Status | Notes |
|---|---|---|
| Products wizard step mapping | **COVERED** | All 5 steps mapped and exercised |
| Products empty-form validation | **COVERED** | Passes — "Product type is required", "Category is required", "Name is required" ×2 (EN+AR) |
| Products create happy path | **FAIL** | Blocked by F-2 (409) — create is not confirmed working |
| Products variant step | **PARTIAL** | Fields mapped, happy path filled, blocked by F-5/F-6 |
| Products media upload | **NOT COVERED** | Skipped — create never succeeded |
| Products edit | **NOT COVERED** | No product could be created to edit |
| Products delete / orphan check | **NOT COVERED** | Dependent on create |
| Negative-price edge case | **COVERED** | F-5 |
| Missing-i18n detection | **COVERED** | F-3, static + live |
| API wiring audit | **COVERED** | F-7, F-8, all 118 endpoints classified |
| 12 other catalog pages CRUD | **NOT COVERED** | Out of budget for this run; roast-levels + coffee-varieties only |
| en/ar × light/dark visual matrix | **NOT COVERED** | Not started |

**No catalog data was mutated.** Every probe was rejected server-side before persisting
(F-1 415, F-2 409), so the database and Cloudinary are unchanged — verified by the products
list still showing the original 7 rows. This is a happy accident of the bugs, not a cleanup I
performed; if F-1/F-2 are fixed and re-run, probe rows **will** persist and need cleanup.

---

## Evidence

| Artifact | Path |
|---|---|
| Session recording (events, frames, manifest) | `recording/` (322 KB events.jsonl) |
| Missing-key enumeration with `file:line` | `missing-i18n-keys.md` |
| F-3 live render | session transcript — Add Roast Level dialog |
| F-1 live 415 | in-page `XMLHttpRequest` interceptor capture, session transcript |
| F-2 live 409 | in-page `XMLHttpRequest` interceptor capture, session transcript |

**Honest limitations:**
- `browser_screenshot`'s `path` argument is ignored by the MCP server (it returns base64 only),
  so **no PNG screenshots were written to disk**. The `screenshots/` directory is empty. Visual
  proof lives in the live viewer session and the recording frames instead.
- The recording's `logs/network.jsonl` is **empty**. The 415/409 statuses come from an in-page
  interceptor installed during the run, recorded in the transcript — not from the recording
  artifact. If you need network evidence as a durable artifact, re-run with the interceptor
  writing to a file.

## Recommended fix order

1. **F-4 first** (silent failures) — it masks every other defect from users and from us.
2. **F-1** — one-line service change, unbreaks coffee-variety edit entirely.
3. **F-2** — needs backend logs to identify the 409 cause before any fix.
4. **F-3** — mechanical, but bulk; `common.*` first as it has the widest reach.
5. **F-8** journal 404 — self-contained fix (change one path), currently actively misleading.
6. F-5, F-6, F-9 — UX/a11y polish.
7. F-7 — decide per endpoint whether the UI should exist at all; some are deliberate scope cuts.