# Design — Reviews & Contact Messages: a moderation console that can actually be worked

**Date:** 2026-10-20
**Status:** awaiting review
**Scope:** `nocteon-dashboard` (primary) + `nocteon-backend` (API + seed)
**Supersedes:** the current `features/reviews` and `features/contact-messages` pages

---

## 1. Why

Both pages were screenshotted and reviewed. The findings fall into three buckets:

1. **Correctness** — Arabic review comments render with their punctuation on the wrong side
   (`.Not my favorite roast level`), dates print as `10/20/26`, the review product column
   shows a slug instead of the name, the "15 of · 13 Enabled · 2 Disabled" line is missing the
   word "reviews" and uses the wrong vocabulary.
2. **Workflow** — the reviews that need a decision (pending) are visually indistinguishable
   from the settled ones; there is no bulk approve, no product/date filter, no statistics;
   the card view burns a full page for 15 rows. Contact messages have no read/unread state at
   all, no thread, no row actions, and the admin must open every single message to know what
   it says.
3. **Truthfulness** — the "Send reply" button implies the customer received an email. It does
   not: `ContactService.reply()` only flips `is_replied` and stores the text. The button must
   either send a real email or say plainly that it does not.

The two pages are also the only admin lists in the app that are **not** built on the shared
`app-data-table` / `app-order-dialog` / `app-localized-date` / `app-status-badge` vocabulary
that the Orders page established. That divergence is the root cause of most of the visual
findings: the pattern was reinvented, and the reinvented pattern drifted.

**Outcome:** both pages become the same console the Orders page already is — same table, same
dialog, same tokens, same glossary, same date helper — and the backend gains the endpoints the
missing workflow requires. Nothing is faked: where the API cannot yet do something, the API
grows.

---

## 2. Scope and non-goals

### In scope

- Backend: contact-message thread + archive + unread + customer lookup + **email-sending reply**;
  review bulk approval + date filter + statistics + order linkage; seed cleanup.
- Dashboard: both pages rebuilt on the shared patterns; new shared components
  (`app-user-avatar`, relative-time helper); glossary + i18n; sidebar focus fix.
- Verification: 4 cells (light/dark × EN/AR) for both pages, plus interaction evidence.

### Non-goals

- The storefront. Reviews on a product page keep their current behaviour.
- Order status, payment status, catalogue pages, the Orders list — untouched except where a
  shared component changes behaviour for everyone (the sidebar focus fix).
- Transactional email for the contact form (`POST /api/contact`) — it stays as-is.
- Bulk actions other than the ones named: approve reviews; mark read/unread, archive, delete
  messages.
- A configurable email template editor. The reply template is a fixed, translatable string.

### Out of scope but worth recording

`GET /api/dashboard/reviews` currently treats `productSlug` as a `LIKE` search. Once a product
**filter** exists, the same parameter would have to mean two things. It becomes an exact match;
the free-text search moves to a `search` parameter (see §4.2).

---

## 3. Terminology (the glossary)

One concept, one term, in both languages, in every surface (tab, button, badge, toast, dialog,
column header, empty state). New rows pinned in `docs/glossary.md` and enforced by
`src/app/core/i18n/i18n-keys.spec.ts`.

| # | Concept | EN | AR | Replaces |
|---|---|---|---|---|
| 10 | Review moderation state — settled | Approved | معتمد | `reviews.approved` = "موافق عليه" |
| 11 | Review moderation state — awaiting a decision | Pending | قيد المراجعة | `reviews.unapproved` = "غير معتمدة"; `common.active`/`common.inactive` on this page |
| 12 | Review — the purchase behind it is confirmed | Verified purchase | شراء موثق | `reviews.verifiedPurchase` = "شراء موثق" |
| 13 | Message state — not yet opened | Unread | غير مقروءة | — |
| 14 | Message state — opened, no answer yet | Read | مقروءة | — |
| 15 | Message state — answered | Replied | تم الرد عليها | `contactMessages.reply` = "رد" |
| 16 | Message state — filed away | Archived | مؤرشفة | — |
| 17 | Action — approve a review | Approve | اعتماد | `reviews.approve` = "اعتماد" (kept, now pinned) |
| 18 | Action — take the approval back | Withdraw approval | سحب الاعتماد | `reviews.unapprove` = "إلغاء الاعتماد" |
| 19 | Page title — the reviews list | Reviews | التقييمات | kept |
| 20 | Page title — the messages list | Contact messages | رسائل التواصل | `contactMessages.title` = "رسائل التواصل" (kept) |
| 21 | Count line — the counted reviews | reviews | تقييمات | the count line had no noun at all |
| 22 | Count line — the counted messages | messages | رسائل | — |

**Notes.**

- Rows 10 and 11 are a *new* concept, distinct from the order status "Pending"
  (`common.statuses.pending` = "قيد الانتظار"). Two different words for two different concepts
  is correct; the same word for two concepts is not. This mirrors how the Orders glossary
  pins its own status family.
- The count line **names the entity**: `15 reviews · 13 approved · 2 pending` /
  `15 تقييمات · 13 معتمد · 2 قيد المراجعة`. A bare "15 من · 13 مُفعّل" is not a count line.
  The counted noun is pinned (rows 21–22) so it cannot drift from the page title.
- `common.active` ("مُفعّل") and `common.inactive` ("معطّل") stay exactly as they are — they
  are the *entity* status family (categories, users, products). They must simply stop being
  used for review moderation.
- The existing global Arabic scan forbids the "نشط" family. None of the new terms use it.

---

## 4. Backend (`nocteon-backend`)

### 4.1 Migration `V110__contact_message_thread.sql`

```sql
ALTER TABLE contact_messages
  ADD COLUMN is_archived   BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN replied_at    TIMESTAMPTZ NULL,
  ADD COLUMN replied_by    BIGINT      NULL REFERENCES users(id);

CREATE TABLE contact_message_replies (
  id                BIGSERIAL PRIMARY KEY,
  contact_message_id BIGINT    NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
  content           TEXT      NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        BIGINT    NULL REFERENCES users(id)
);

-- Backfill: the single legacy reply_content becomes the first thread entry.
INSERT INTO contact_message_replies (contact_message_id, content, created_at, created_by)
SELECT id, reply_content, updated_at, NULL
FROM contact_messages
WHERE reply_content IS NOT NULL AND reply_content <> '';
```

`is_replied` on `contact_messages` stays (it is the cheap list-level flag) and is kept in sync
with the thread: it becomes TRUE when the first reply row is written and is never unset
except by archive/reset.

### 4.2 Reviews

| Change | Detail |
|---|---|
| `GET /api/dashboard/reviews` | Add `search` (free text over comment/username), `createdFrom`, `createdTo` (ISO dates). `productSlug` becomes an **exact** match. |
| `GET /api/dashboard/reviews/stats` | **New.** `{ total, pending, approved, averageRating, distribution: { "1".."5": n } }`. Counts respect the same soft-delete rule; `averageRating` counts approved reviews only (a pending review must not move the public average). |
| `PATCH /api/dashboard/reviews/approval` | **New.** Body `{ ids: number[], approved: boolean }` → `{ updated: number }`. Reuses `setApproval` per id inside one transaction. Rejects an empty `ids` with 400. |
| `ReviewResponse` | `+ orderId: Long`, `+ orderNumber: String` — both nullable. Populated **only** when the purchase is confirmed and a qualifying order exists (`status NOT IN ('CANCELLED','PENDING')`, the same rule `hasUserPurchasedProduct` already uses). |

The order lookup is a new repository query: the most recent qualifying `Order` for the review's
`(user, product)` pair. One extra query per page of reviews, or a single join — the
implementation picks whichever keeps the list query at one round trip.

### 4.3 Contact messages

| Change | Detail |
|---|---|
| `GET /api/dashboard/contact-messages` | Add `status` (`all` \| `unread` \| `read` \| `replied` \| `archived`), `createdFrom`, `createdTo`, and `search` over name/email/subject/message. The legacy `/unread` endpoint stays (it is used by the dashboard drill-down) and is re-expressed in terms of the new filter. |
| `GET /api/dashboard/contact-messages/stats` | **New.** `{ total, unread, read, replied, archived }` for the tab badges. |
| `PATCH /api/dashboard/contact-messages/{id}/unread` | **New.** Marks unread. `id` may be any message, not only a read one. |
| `PATCH /api/dashboard/contact-messages/{id}/archive` | **New.** Body `{ archived: boolean }` — archives and un-archives. Archiving does not delete. |
| `GET /api/dashboard/contact-messages/{id}/customer` | **New.** Matches the message email against registered customers. → `{ matched: boolean, customerId, name, email, orderCount, lastOrderId }`. `matched: false` when there is no customer with that email. |
| `POST /api/dashboard/contact-messages/{id}/reply` | **Changed.** Writes a `contact_message_replies` row, sets `is_replied` / `replied_at` / `replied_by`, marks the message read, then **sends an email** to the sender through the existing `common/email/EmailService`. Response: `{ message: ContactResponse, replies: ReplyResponse[], emailSent: boolean, emailError: string? }`. |

**Reply semantics (decided):** the reply is **saved first**, the email is attempted second. If
the email fails, the API still returns 200 with `emailSent: false` and a human-readable
`emailError`. The dashboard shows a warning toast — *"Reply saved, but the email could not be
sent"* — and keeps the reply in the thread. The admin never loses their work, and the UI never
claims an email went out when it did not. A "Retry sending the email" action re-attempts the
send for that reply without creating a second thread entry.

The email itself: a fixed, translatable subject/body template rendered per language, sent from
`MAIL_FROM`, to the message's stored email. The content is the reply text the admin typed.

**Quick reply templates** (offered in the reply box, translatable, editable before sending):
"شكرًا لتواصلك معنا. هنرد عليك خلال ٢٤ ساعة." / "Thanks for reaching out — we'll get back to
you within 24 hours." · "للأسف الطلب ده لسه قيد التجهيز." / "Unfortunately, this order is still
being prepared." · "هل تحب نرسل لك قائمة الأسعار؟" / "Would you like us to send you our
price list?"

### 4.4 Seed (`V111__fix_review_and_media_seed.sql`)

- **Brazil Mogiana's primary media** is a party photo. It is replaced with the product's own
  coffee imagery (the same source the other products in `V105` use).
- **Seeded reviews belong to `user_id` 1..5**, and `user_id = 1` is the admin account — so a
  moderator is shown reviewing their own store's products. The seeded reviews are re-pointed at
  non-admin customer accounts (`V101__seed_users`).
- The migration is idempotent and reversible-by-guard (`WHERE NOT EXISTS` / `IF EXISTS`),
  matching the style of `V107`.

---

## 5. Dashboard (`nocteon-dashboard`)

### 5.1 Shared changes

| Component | Change |
|---|---|
| `app-data-table` | New `HEADER_KEYS` entries for the new columns (a missing entry leaves the header in English inside an Arabic page — the trap `ORDERS §2.1` documents). New `columnWidths` entries. Text cells render inside `<bdi>` / `dir="auto"` so a Latin review comment inside an RTL page keeps its own direction — this is the fix for `.Not my favorite roast level`. |
| `app-status-badge` | New `StatusKind` values: `approved` (success-soft + `lucideCheckCircle`) and `reviewed`/message states as needed. `pending` already exists (warning-soft + `lucideClock`). |
| **new** `app-user-avatar` | `src/app/shared/ui/user-avatar/` — image when a URL exists, otherwise the first letter on `bg-primary/10` in `text-primary`. Replaces the broken-image icon in the reviews cards and gives the messages list a consistent sender mark. |
| **new** relative-time helper | `src/app/core/i18n/relative-time.ts` — extracted from `shared/components/dashboard/recent-orders` so both pages and the table share one implementation and one set of locale keys. `Intl.RelativeTimeFormat`, `< 60 s` → "Just now" / "الآن". |
| `app-localized-date` | Used by both pages instead of Angular's `| date`. It is the only date renderer in the app; `10/20/26` cannot come from it. |
| Sidebar | The persistent ring on the **Reviews** item is `focus-visible:ring-2` staying painted after a mouse click: the `<a>` keeps DOM focus and the SPA does not move it. **Fix:** on `NavigationEnd`, the sidebar moves focus to the page heading (`<h1 tabindex="-1">`) — the standard SPA pattern, which also gives screen-reader users a focus target. Keyboard focus stays visible (`focus-visible` only). |

### 5.2 Reviews page (`features/reviews`)

Rebuilt on `app-data-table`. Structure, top to bottom:

1. **Header** — `Reviews` + subtitle `15 reviews · 13 approved · 2 pending`
   (`15 تقييمات · 13 معتمد · 2 قيد المراجعة`). The subtitle is the count line: it always names
   the entity.
2. **Tabs** — `Pending (2) | Approved (13) | All (15)`, in that order, **Pending selected by
   default**. Counts come from `GET /api/dashboard/reviews/stats`. `?status=pending` (the
   dashboard drill-down) selects the Pending tab.
3. **Toolbar** — product select (populated from `GET /api/dashboard/products`, showing the
   translated product name), date range (the Orders preset pattern: All time / Today / 7d /
   30d / custom), minimum-rating select, verification select, free-text search.
   Every label is a Transloco key — no hardcoded `All Ratings` / `All Verification`. The
   approval select is labelled `Status: All` / `الحالة: الكل`.
4. **Statistics strip** — average rating (one decimal), a 5-bucket star distribution with
   bars, and the pending count. Numbers are end-aligned and tabular.
5. **Table** (default view):

   | Select | Product | Reviewer | Rating | Comment | Status | Created | Actions |
   |---|---|---|---|---|---|---|---|

   - **Product** — a 40 px thumbnail + the translated product name, linked to the product.
     The slug is never shown.
   - **Reviewer** — initials avatar + username; a small check icon next to the name when the
     purchase is confirmed, linking to the order. Nothing is shown when it is not verified —
     no "Not verified" column, no chip.
   - **Rating** — amber filled stars, empty stars in `text-muted-foreground/30`, and the
     numeric `4/5` beside them.
   - **Comment** — start-aligned, clamped to two lines.
   - **Status** — one column: `Approved` / `Pending` badge.
   - **Created** — relative time with the absolute value in the `title` tooltip.
   - **Actions** — a **labelled `Approve` button** (primary, the row's main action) plus a
     `⋮` menu holding View, Withdraw approval, and Delete. Delete confirms.

   Text columns are start-aligned, numeric columns end-aligned, headers are sentence case
   (not uppercase). The Actions column is sticky at the inline end.
6. **Bulk bar** — appears when rows are selected: `2 selected` + `Approve selected`.
   Selection is a checkbox column; the header checkbox toggles the page.
7. **Grid** (optional view) — the same content as compact cards: a **small** thumbnail beside
   the text (not a full-bleed image), product name, relative date, rating, comment, status,
   an `Approve` button and a `⋮` menu (delete moves into the menu; the red delete button is
   not on the card face). All three buttons share one height.
8. **View persistence** — table/grid choice stored in `localStorage` under
   `nocteon-reviews-view-mode`; the rest of the page state (tab, filters, page, sort) lives in
   the URL, as on the Orders page.
9. **Review drawer** — a side panel (inline-end) with the product, the order, the rating, the
   full comment, the date, and the status, plus Approve / Withdraw approval / Delete.
   Replaces the current full-screen modal.

### 5.3 Contact messages page (`features/contact-messages`)

1. **Header** — `Contact messages` (sentence case) + subtitle `5 messages · 2 unread`
   (`5 رسالة · 2 غير مقروءة`).
2. **Tabs** — `All (5) | Unread (2) | Replied (1) | Archived (0)`. `?status=unread` (the
   dashboard "Needs attention" link) selects Unread.
3. **Toolbar** — state select, date range, search.
4. **List** — one clickable row per message:
   - an unread **dot** and a **bold** subject for unread messages; normal weight for read ones;
   - the sender name and email, an initials avatar;
   - a **one-line preview** of the message under the subject;
   - the state chip (`Unread` / `Replied` / `Archived`);
   - a **relative** date (`2 hours ago`) with the absolute value in the tooltip.
   The whole row is a button: clickable, keyboard-focusable, with a visible focus ring and a
   hover state.
5. **Row actions** — Mark as read / Mark as unread, Archive, Delete (confirms), Copy email.
   Plus a **bulk** selection with the same actions.
6. **Message dialog** — the shared `app-order-dialog` shell:
   - the subject, with the **date as dimmed text under it** (no seconds, not a pill);
   - the **thread**: the original message, then each reply below it with its date and the
     admin who sent it;
   - the reply box: a textarea with a placeholder (`Reply to ahmed@test.com`), **autofocus**,
     and quick reply templates;
   - the **Send reply** button: disabled with an explanation when the box is empty; a loading
     state while sending; a success toast on success; **on failure the reply stays saved**, an
     explicit error, and a Retry action. The button's label states that an email is sent.
   - opening a message marks it read; the dialog header carries Mark as unread, Archive and
     Delete; **Escape** closes; focus is trapped inside and restored to the trigger on close.
7. **Customer link** — when `GET /contact-messages/{id}/customer` matches, the dialog shows
   `Ahmed Hassan · 3 orders` linking to that customer's orders. Nothing is shown when there is
   no match.

### 5.4 i18n and glossary

- New keys in `public/assets/i18n/en.json` and `ar.json` for both pages: tab labels and
  counts, column headers, filter labels, statuses, dialog strings, reply templates, toasts,
  empty and error states.
- The `contactMessages` namespace grows from 5 keys to a full set.
- `docs/glossary.md` gains rows 10–20; `src/app/core/i18n/i18n-keys.spec.ts` gains a
  `REVIEWS_MESSAGES_GLOSSARY` block that fails when a concept drifts to a second term in
  either locale (the pattern `ORDERS_GLOSSARY` already uses).
- `DataTableComponent.HEADER_KEYS` gains the new headers, so no column header is left in
  English inside an Arabic page.

---

## 6. Acceptance criteria

Each criterion is verifiable and is the unit of evidence.

### Reviews

- **AC-R1** — An English review comment inside the Arabic page renders with its punctuation
  at the end of the sentence (no leading `.` / `!`); the cell is direction-isolated.
- **AC-R2** — The count line names the entity: `15 reviews · 13 approved · 2 pending` /
  `15 تقييمات · 13 معتمد · 2 قيد المراجعة`.
- **AC-R3** — The reviews page uses exactly one term per language for each moderation state
  (`Approved`/`معتمد`, `Pending`/`قيد المراجعة`); `موافق عليه`, `غير معتمدة`, `مُفعّل` and
  `معطّل` do not appear anywhere on the page.
- **AC-R4** — Every filter label is localized; the approval filter reads `Status: All` /
  `الحالة: الكل`; the strings `All Ratings` and `All Verification` do not appear in the Arabic
  page.
- **AC-R5** — The tabs read `Pending (2) | Approved (13) | All (15)`, Pending is selected on
  arrival, and the counts are live.
- **AC-R6** — Each pending row offers a labelled `Approve` action.
- **AC-R7** — Multiple reviews can be selected and approved in one action.
- **AC-R8** — The product filter and the date-range filter narrow the list.
- **AC-R9** — The statistics strip shows the average rating, the star distribution and the
  pending count.
- **AC-R10** — The table is the default view; the grid is available; the choice survives a
  reload.
- **AC-R11** — The product column shows a thumbnail and the translated product name; the slug
  does not appear.
- **AC-R12** — A confirmed purchase shows a small check icon next to the reviewer name linking
  to the order; an unconfirmed purchase shows nothing.
- **AC-R13** — Approval and status are one column, not two.
- **AC-R14** — Row actions are a labelled `Approve` button plus a `⋮` menu; delete is inside
  the menu and asks for confirmation.
- **AC-R15** — Text cells are start-aligned, numeric cells end-aligned, headers are sentence
  case and not uppercase.
- **AC-R16** — A long comment clamps to two lines and opens in full in the drawer, which also
  shows the product, the order, the rating and the date.
- **AC-R17** — A reviewer without a picture shows initials, never a broken-image icon.
- **AC-R18** — Dates render through the shared date helper (`13 Oct 2026`), never `10/20/26`,
  and carry a relative value plus an absolute tooltip.

### Contact messages

- **AC-C1** — Unread messages are marked with a dot and a bold subject; read messages are not.
- **AC-C2** — The tabs read `All | Unread | Replied | Archived` with live counts.
- **AC-C3** — The count line reads `5 messages · 2 unread` / `5 رسالة · 2 غير مقروءة`.
- **AC-C4** — Every row shows a one-line preview of the message under the subject.
- **AC-C5** — Each row offers mark read/unread, archive, delete (with confirmation) and copy
  email; the same actions work on a bulk selection.
- **AC-C6** — The whole row is clickable and keyboard-operable, with a visible focus ring and a
  hover state.
- **AC-C7** — The English page title is `Contact messages` (sentence case).
- **AC-C8** — The list can be filtered by state and by date range, and searched.
- **AC-C9** — The date is relative (`2 hours ago`) with the absolute value in the tooltip.
- **AC-C10** — The dialog shows the date as dimmed text under the subject, with no seconds and
  no pill.
- **AC-C11** — The dialog shows a thread: the original message, then the replies with their
  date and the name of the admin who sent them.
- **AC-C12** — Sending a reply sends an email to the customer; the button and the success
  message say so. When the email fails, the reply is still saved, the failure is stated
  explicitly, and a Retry action is offered.
- **AC-C13** — The reply box has a placeholder, receives focus when the dialog opens, and the
  send button is disabled with an explanation while the box is empty.
- **AC-C14** — Opening a message marks it read; the dialog offers Mark as unread, Archive and
  Delete; Escape closes it; focus is trapped inside and returned to the trigger.
- **AC-C15** — When the sender is a known customer, a link `Ahmed Hassan · 3 orders` opens
  their orders; nothing is shown otherwise.

### Shared

- **AC-S1** — After navigating to a sidebar item, it shows no persistent ring; keyboard focus
  remains visible.
- **AC-S2** — Both pages use the shared date helper, the shared translated-name/status tokens
  and the shared table and dialog shells.
- **AC-S3** — The dashboard "Needs attention → Unread messages" link opens the contact
  messages page on the Unread tab.
- **AC-S4** — Both pages render correctly in all four cells: light/dark × English/Arabic.

### Seed

- **AC-D1** — Brazil Mogiana's primary image is coffee imagery, not a party photo.
- **AC-D2** — No seeded review belongs to an admin account.

---

## 7. Validation and evidence

| Layer | What runs |
|---|---|
| Unit (Vitest) | `i18n-keys.spec.ts` (new glossary block), `locale-format.spec.ts`, any new spec for the relative-time helper and `app-user-avatar`. |
| Integration (backend) | New endpoint tests for the bulk approval, the thread, the archive/unread transitions and the reply-with-failed-email path. |
| E2E (Playwright) | Reviews: default tab, filter, bulk approve, drawer. Messages: unread tab, open → read, reply → thread, mark unread, archive. |
| Browser evidence | Screenshots of **both pages × 4 cells** (light/dark × EN/AR), the table, the grid, the drawer, the message dialog, and the empty states. |
| Gate | The Evidence Gate (`/factory/evidence`) must exit 0 with every criterion mapped to a real artifact. |

The backend runs at `localhost:8080` and the dashboard at `localhost:4200`; both are already up
in this environment, so the browser pass is a live run against real data, not a mock.

**Order of work:** backend schema + endpoints → backend seed → shared dashboard components →
Reviews page → Contact messages page → i18n/glossary → browser evidence → gate. The dashboard
work for a page cannot land before the endpoint it consumes exists.

### Delivery phases

This is one intent but four independently verifiable increments. The implementation plan is
written against these phases; each phase ends green and is separately revertible.

| Phase | Content | Ends when |
|---|---|---|
| **1 — Backend foundation** | `V110` migration, the contact-message thread/archive/unread/customer endpoints, the review stats/bulk/date endpoints, `orderId`/`orderNumber` on `ReviewResponse`. | The new endpoints answer correctly against the running backend; backend tests pass. |
| **2 — Seed cleanup** | `V111`: Brazil Mogiana's image, reviews moved off the admin account. | The database holds no party photo and no admin-authored review. |
| **3 — Shared dashboard** | `app-user-avatar`, the shared relative-time helper, `app-data-table` header/width entries and direction isolation, the `approved` status badge, the sidebar focus fix. | The shared components are in place; the sidebar shows no persistent ring. |
| **4 — Reviews page** | The full rebuild: tabs, toolbar, statistics, table, grid, bulk, drawer. | AC-R1…AC-R18 pass with browser evidence in 4 cells. |
| **5 — Contact messages page** | The full rebuild: tabs, list, row actions, dialog, thread, customer link, email-sending reply. | AC-C1…AC-C15 pass with browser evidence in 4 cells. |
| **6 — Terminology & gate** | Glossary rows, `i18n-keys.spec.ts` pins, the full i18n set, the Evidence Gate. | The gate exits 0 with every criterion mapped to an artifact. |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| The reply now sends real email to real addresses. The seed addresses are `@test.com` (reserved, non-routable), but a live message would reach a real inbox. | The email only fires from an explicit admin action on a real message. Seed data uses `@test.com`. The failure path is non-destructive. |
| Adding a replies table changes the shape of `ContactResponse`; other consumers (the dashboard's unread count, notifications) read it. | The legacy `is_replied` flag is kept and kept in sync; the existing endpoints keep their response shape plus an additive `replies` field. |
| `productSlug` changes from `LIKE` to exact match — any caller relying on partial matching changes behaviour. | The dashboard is the only caller of the dashboard endpoint, and it moves to a dedicated `search` parameter in the same change. |
| The sidebar focus move touches global navigation behaviour for every admin. | Keyboard focus is moved to the page `<h1>`, which is the documented pattern; the change is covered by an E2E assertion that the active nav item carries no ring. |
| A new `is_archived` column changes the unarchived default for existing rows. | The column defaults to `FALSE`; the migration backfills nothing because every existing row is unarchived. |
| The pending tab as the default changes what a moderator sees first. | Intended: pending is the work queue. `?status=pending` still lands on the same tab, and the Orders-style URL state makes the tab explicit in the address. |

## 9. Rollback

- **Backend:** the migration is additive. Rolling back means dropping `contact_message_replies`
  and the three columns; the reply text already in `contact_message_replies` would be lost, so
  the deployment keeps the previous `reply_content` column in place for one release.
- **Dashboard:** both pages are behind their routes; reverting the two feature directories
  restores the previous behaviour. The shared components are additive except the sidebar focus
  change, which is a single, separately revertible commit.
