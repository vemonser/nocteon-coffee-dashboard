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
   all, no row actions, and the admin must open every single message to know what it says.
3. **Truthfulness** — the reply button implies the customer received an email. It does not:
   `ContactService.reply()` only flips `is_replied` and stores the text. The reply must **email
   the customer for real**, and the page must report what actually happened — sent, queued, or
   failed — rather than a generic success.

The two pages are also the only admin lists in the app that are **not** built on the shared
`app-data-table` / `app-order-dialog` / `app-localized-date` / `app-status-badge` vocabulary
that the Orders page established. That divergence is the root cause of most of the visual
findings: the pattern was reinvented, and the reinvented pattern drifted.

**Outcome:** the reviews page becomes the moderation console the workflow needs — same table,
same tokens, same glossary, same date helper as the Orders page, with the backend gaining the
endpoints the missing workflow requires. The contact messages page becomes the same kind of
console: the read-and-reply loop it needs is already in the API, the page's job is to make it
legible and fast, and the reply **emails the customer for real** — riding the `email_log` queue
and the retry worker the project already owns, with no new table and no migration.

---

## 2. Scope and non-goals

### In scope

- Backend: review bulk approval + date filter + statistics + order linkage; seed cleanup; and
  **one bounded change for the contact messages** — the reply really emails, riding the
  `email_log` queue and the retry worker the project already owns (§4.3.2). No migration, no
  new table.
- Dashboard: both pages rebuilt on the shared patterns; new shared components
  (`app-user-avatar`, relative-time helper); glossary + i18n; sidebar focus fix.
- Verification: 4 cells (light/dark × EN/AR) for both pages, plus interaction evidence.

### Non-goals

- The storefront. Reviews on a product page keep their current behaviour.
- Order status, payment status, catalogue pages, the Orders list — untouched except where a
  shared component changes behaviour for everyone (the sidebar focus fix).
- Transactional email for the contact form (`POST /api/contact`) — it stays as-is.
- Any change to the contact-message **schema**: no thread, no archive, no mark-as-unread, no
  customer lookup. §4.3.1 records exactly what that costs and what is given up.
- A configurable email template editor. The Brevo templates are edited in Brevo.

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
| 16 | Action — approve a review | Approve | اعتماد | `reviews.approve` = "اعتماد" (kept, now pinned) |
| 17 | Action — take the approval back | Withdraw approval | سحب الاعتماد | `reviews.unapprove` = "إلغاء الاعتماد" |
| 18 | Page title — the reviews list | Reviews | التقييمات | kept |
| 19 | Page title — the messages list | Contact messages | رسائل التواصل | `contactMessages.title` = "رسائل التواصل" (kept) |
| 20 | Count line — the counted reviews | reviews | تقييمات | the count line had no noun at all |
| 21 | Count line — the counted messages | messages | رسائل | — |
| 22 | The stored answer on a message | Your reply | ردّك | — |
| 23 | The reply — action | Send reply | إرسال رد | `contactMessages.sendReply` = "إرسال رد" (kept, now pinned) |
| 24 | The reply — email reached the customer | Email sent | تم إرسال الإيميل | — |
| 25 | The reply — email did not reach the customer | Email not sent | لم يتم إرسال الإيميل | — |
| 26 | The reply — email is queued for another attempt | Queued | في الانتظار | — |
| 27 | Action — try the email again | Send again | إعادة الإرسال | — |
| 28 | The language of the reply | English | الإنجليزية | — |

**Notes.**

- Rows 10 and 11 are a *new* concept, distinct from the order status "Pending"
  (`common.statuses.pending` = "قيد الانتظار"). Two different words for two different concepts
  is correct; the same word for two concepts is not. This mirrors how the Orders glossary
  pins its own status family.
- The count line **names the entity**: `15 reviews · 13 approved · 2 pending` /
  `15 تقييمات · 13 معتمد · 2 قيد المراجعة`. A bare "15 من · 13 مُفعّل" is not a count line.
  The counted noun is pinned (rows 20–21) so it cannot drift from the page title.
- `common.active` ("مُفعّل") and `common.inactive` ("معطّل") stay exactly as they are — they
  are the *entity* status family (categories, users, products). They must simply stop being
  used for review moderation.
- The existing global Arabic scan forbids the "نشط" family. None of the new terms use it.

---

## 4. Backend (`nocteon-backend`)

### 4.1 No contact-message migration

**There is no contact-message schema change.** The thread, the archive and the mark-as-unread
come off the list — the contact page is a read-and-reply console, not a correspondence system.
The reply **email** needs no schema change either: it rides the existing `email_log` queue
(§4.3). The only migration in this spec is the seed one (§4.4).

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

### 4.3 Contact messages — one bounded backend change: the reply really emails

The console itself needs no backend change (§4.3.1). What the console does need is for
**"Send reply" to mean what it says**, and the machinery for that is already in the project.

#### 4.3.1 The console — existing endpoints

| Endpoint | Used for |
|---|---|
| `GET /api/dashboard/contact-messages` | The **All** tab. `search` + paging, as today. |
| `GET /api/dashboard/contact-messages/unread` | The **Unread** tab. Server-side, so the count and the list are the real ones. |
| `GET /api/dashboard/contact-messages/{id}` | Opening a message. |
| `PATCH /api/dashboard/contact-messages/{id}/read` | Marking a message read when it is opened. |
| `POST /api/dashboard/contact-messages/{id}/reply` | Sending the reply (and queueing its email, §4.3.2). |
| `DELETE /api/dashboard/contact-messages/{id}` | Deleting a message (behind a confirmation). |
| `GET /api/dashboard/stats/unread-contact-count` | The **true** unread count for the subtitle and the tab badge — server-side, so it is not a guess. |

**What the existing API does not support, and how the page copes:**

| Wanted | Without a backend change | Decision |
|---|---|---|
| A **Replied** tab | `isReplied` is already on every message, so the tab filters the loaded set client-side. | Kept. The count is the count within the loaded set. |
| A **date-range** filter | The endpoint takes no dates. | Kept, filtered client-side over the loaded set. |
| An **Archived** tab | No `archived` flag exists. | **Dropped.** Filing a message away is not worth a schema change for this console. |
| **Mark as unread** | No endpoint; `PATCH /read` only sets it to read. | **Dropped.** A message is read once it has been opened. |
| **Archive** | No endpoint. | **Dropped**, with the tab. |
| A reply **thread** with dates and authors | `replyContent` is a single string with no timestamp and no author. | **Dropped.** The dialog shows the stored reply as one muted block, labelled "Your reply" (row 22), with no date. |
| A **customer link** ("Ahmed Hassan · 3 orders") | No lookup by email. | **Dropped.** |
| **Bulk** actions | No bulk endpoint; N individual calls would work but the page is meant to stay small. | **Kept to one action** — "mark as read" for the selected rows, using the existing per-row endpoint. |

#### 4.3.2 The email — riding the queue that is already there

The project already owns a durable email queue and a retry worker. The reply email uses them
rather than inventing a second mechanism.

| Piece that already exists | What it gives us |
|---|---|
| `email_log` table (`V6`) | A durable queue: `idempotency_key`, `email_type`, `recipient_email`, `related_entity_type` / `related_entity_id`, `status` (PENDING / SENT / FAILED / DEAD), `attempt_count`, `last_error`, `sent_at`, plus an index on `(related_entity_type, related_entity_id)`. |
| `TransactionalEmailService.enqueueEmail(...)` | Idempotent enqueue that **attempts the send inline**, and on failure records the attempt and the error. |
| `EmailRetryScheduler` | `@Scheduled(fixedDelay = 60_000)` → `retryPendingEmails()` → picks `PENDING` **and** `FAILED` rows with `attempt_count < 5`, oldest first. |
| `EmailRetryPolicy` | The backoff: `0 → 1 min → 5 min → 30 min → 2 h`, then `DEAD`. |
| `EmailTemplateDataProvider` / `EmailTemplateDataResolver` | One provider per `EmailType`, resolving the template params. |
| `BrevoClient` | The provider call — Brevo `/smtp/email` with a template id and a params map. |
| `BrevoTemplateProperties` | The template ids, bound from `application.brevo.templates.*`. |

**The flow:** the admin presses **Send reply** → the reply is saved → the email is enqueued and
**attempted immediately** → if Brevo accepts it, the row is `SENT` and the admin is told the
email went out; if Brevo rejects or times out, the row is `FAILED` with the error recorded, and
the **worker retries it** on the backoff schedule until it is sent or dead. That is the
"try now, let the worker finish the job" behaviour, and the worker was already written for it.

**What to add:**

| # | Change | Detail |
|---|---|---|
| 1 | `EmailType.CONTACT_REPLY_EN` and `EmailType.CONTACT_REPLY_AR` | Two constants, so the language of the wrapper is recorded in `email_log.email_type` and a retry rebuilds the same language. Two types, not one type plus a column — that is what keeps the migration away. |
| 2 | `ContactReplyDataProvider` | One provider per language, resolving `{ recipientName, originalSubject, originalMessage, replyContent }` from the contact message. `replyContent` comes from `contact_messages.reply_content`, so a retry sends the current answer to that message. |
| 3 | `BrevoTemplateProperties.contactReplyEn` / `.contactReplyAr` + the `resolveTemplateId` switch + `BREVO_TEMPLATE_CONTACT_REPLY_EN` / `_AR` in `.env` | The two Brevo template ids. **This is the one external step: two templates must be created in the Brevo dashboard.** They render `{{params.recipientName}}`, `{{params.originalSubject}}`, `{{params.originalMessage}}` and `{{params.replyContent}}`. |
| 4 | `ContactService.reply()` | After saving, call the enqueue with `relatedEntityType = "contact_message"` and `relatedEntityId = message.getId()`. The idempotency key is `"contact-reply:" + id` — **one email row per message**, so a second reply re-sends the current answer rather than queueing a second copy of an old one. The existing `enqueueEmail` skips a key it has already seen, so the resend path needs a small sibling that resets the row to `PENDING`, zeroes `attempt_count` and re-attempts. |
| 5 | `POST /api/dashboard/contact-messages/{id}/resend-email` | **New.** Re-enqueues the stored reply. `contact:update`. This is the manual escape hatch when the worker is off or the address is wrong. |
| 6 | `ContactResponse` gains `emailStatus` | `NONE` (never emailed) / `PENDING` / `SENT` / `FAILED` / `DEAD`, read from `email_log` for that message. The list endpoint reads them for the whole page in **one** batched query. |
| 7 | `nocteon.mail.retry-enabled` | **A separate flag** from `nocteon.mail.scheduling-enabled` (which stays off). The retry worker needs to run for a failed reply email to be retried, but turning on the existing flag would also start `AbandonedCartScheduler` — abandoned-cart reminders to real addresses — which is not a decision this feature gets to make. The new flag gates the retry worker only. |

#### 4.3.3 The honesty rule

The page must tell the truth about what happened, in both directions:

- the button reads **"Send reply"** / **"إرسال رد"** — and it does send;
- a line under the reply box says where the reply goes: *"The reply is emailed to {email} and
  saved here."* / *"الرد بيتبعت إيميل على {email} وبيتحفظ هنا."*;
- on success the toast says **"Reply sent"** / **"تم إرسال الرد"** **only** when the email
  actually went out (`emailStatus = SENT`);
- on failure the reply is still saved, the toast says **"Reply saved, but the email could not be
  sent"** / **"تم حفظ الرد، بس الإيميل ما اتبعتش"**, and the dialog offers **"Send again"**;
- the dialog always shows the email state as it is recorded — sent, queued, failed — never a
  guess. The chip is read from `email_log`, so it cannot lie even if the worker is off.

An admin must never walk away believing a customer was answered when the email did not go out.

#### 4.3.4 The reply language

The reply box carries a language toggle — **English / العربية** — defaulting to the dashboard's
current language. The admin writes the reply, and the toggle says which language the email
wrapper (greeting, subject) is in. The reply text itself is sent exactly as typed. The choice
selects the `EmailType` (`CONTACT_REPLY_EN` / `CONTACT_REPLY_AR`), so the language is recorded
in `email_log` and a retry rebuilds the same one. No new column, no migration.

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

A small console: see what has not been read, open it, write a reply, move on. No backend work
(§4.3), no thread, no archive.

1. **Header** — `Contact messages` (sentence case) + subtitle `5 messages · 2 unread`
   (`5 رسائل · 2 غير مقروءة`). The unread number comes from
   `GET /api/dashboard/stats/unread-contact-count`, so it is the true count.
2. **Tabs** — `All (5) | Unread (2) | Replied (1)`. The **Unread** tab loads from
   `/api/dashboard/contact-messages/unread` (server-side, so the list and the count agree);
   the others load from the main endpoint. `?status=unread` (the dashboard "Needs attention"
   link) selects Unread. The **Replied** tab filters the loaded set by `isReplied`.
3. **Toolbar** — search (server-side, as today), plus a state filter and a date range
   (client-side over the loaded set, as §4.3 records).
4. **List** — one clickable row per message:
   - an unread **dot** and a **bold** subject for unread messages; normal weight for read ones;
   - the sender name and email, an initials avatar;
   - a **one-line preview** of the message under the subject — the admin must not have to open
     every message to know what it says;
   - the state chip (`Unread` / `Replied`);
   - a **relative** date (`2 hours ago`) with the absolute value in the tooltip.
   The whole row is a button: clickable, keyboard-focusable, with a visible focus ring and a
   hover state.
5. **Row actions** — Copy email, Delete (behind a confirmation). Opening a message marks it
   read, so there is no separate "mark as read" button to press. A **bulk** selection offers
   one action: **mark as read**, using the existing per-row endpoint.
6. **Message dialog** — the shared `app-order-dialog` shell:
   - the subject, with the **date as dimmed text under it** (no seconds, not a pill);
   - the sender's name and email, with a copy button;
   - the original message;
   - the stored reply, if there is one, as one muted block labelled **"Your reply"** — there
     is no date and no author to show, because the API does not record them (§4.3.1);
   - the **email state chip** next to the sender: `Email sent` / `Queued` / `Email not sent`,
     read from `email_log` — and a **Send again** action when the email did not go out;
   - the reply box: a textarea with a placeholder (`Reply to ahmed@test.com`), **autofocus**,
     a **language toggle** (English / العربية, defaulting to the dashboard's language), and
     quick reply templates;
   - the honesty line under the box: *"The reply is emailed to {email} and saved here."* /
     *"الرد بيتبعت إيميل على {email} وبيتحفظ هنا."*;
   - the **Send reply** button: disabled with an explanation when the box is empty; a loading
     state while sending; a success toast **only when the email actually went out**; on failure
     an explicit warning, the typed text still in the box, and a Retry action.
   - **Escape** closes; focus is trapped inside and restored to the trigger on close.

### 5.4 i18n and glossary

- New keys in `public/assets/i18n/en.json` and `ar.json` for both pages: tab labels and
  counts, column headers, filter labels, statuses, dialog strings, reply templates, toasts,
  empty and error states.
- The `contactMessages` namespace grows from 5 keys to a full set.
- `docs/glossary.md` gains rows 10–22; `src/app/core/i18n/i18n-keys.spec.ts` gains a
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
- **AC-C2** — The tabs read `All | Unread | Replied` with live counts; the unread count is the
  server's, not an estimate.
- **AC-C3** — The count line reads `5 messages · 2 unread` / `5 رسائل · 2 غير مقروءة`.
- **AC-C4** — Every row shows a one-line preview of the message under the subject.
- **AC-C5** — Each row offers copy email and delete (with confirmation); a bulk selection offers
  mark as read.
- **AC-C6** — The whole row is clickable and keyboard-operable, with a visible focus ring and a
  hover state.
- **AC-C7** — The English page title is `Contact messages` (sentence case).
- **AC-C8** — The list can be filtered by state and by date range, and searched.
- **AC-C9** — The date is relative (`2 hours ago`) with the absolute value in the tooltip.
- **AC-C10** — The dialog shows the date as dimmed text under the subject, with no seconds and
  no pill.
- **AC-C11** — The dialog shows the original message, and the stored reply (if any) as a block
  labelled "Your reply" / "ردّك".
- **AC-C12** — **The page never claims an email went out when it did not.** The button reads
  `Send reply` / `إرسال رد` and a line under the box says the reply is emailed to the customer
  and saved here. The success toast ("Reply sent" / "تم إرسال الرد") appears **only** when the
  email status is `SENT`.
- **AC-C13** — The reply box has a placeholder, receives focus when the dialog opens, offers an
  English / العربية language toggle that defaults to the dashboard's language, and the send
  button is disabled with an explanation while the box is empty.
- **AC-C14** — Opening a message marks it read; the dialog offers Delete; Escape closes it;
  focus is trapped inside and returned to the trigger.
- **AC-C15** — A failed send shows an explicit warning, keeps the typed text in the box, and
  offers a Retry action; the reply itself is still saved and visible as "Your reply".
- **AC-C16** — The dialog shows the recorded email state (`Email sent` / `Queued` /
  `Email not sent`), and a **Send again** action re-enqueues the email for a message whose
  email did not go out.
- **AC-C17** — The reply email is actually attempted at send time, is recorded in `email_log`
  with its status, and a failed attempt is picked up by the retry worker.

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
| Integration (backend) | The review bulk approval, the statistics endpoint and the order linkage; the contact-reply email enqueue, its `email_log` row, and the failure path. |
| E2E (Playwright) | Reviews: default tab, filter, bulk approve, drawer. Messages: unread tab, open → read, send a reply (and its email state), copy email, delete. |
| Browser evidence | Screenshots of **both pages × 4 cells** (light/dark × EN/AR), the table, the grid, the drawer, the message dialog, and the empty states. |
| Gate | The Evidence Gate (`/factory/evidence`) must exit 0 with every criterion mapped to a real artifact. |

The backend runs at `localhost:8080` and the dashboard at `localhost:4200`; both are already up
in this environment, so the browser pass is a live run against real data, not a mock.

**Order of work:** backend endpoints → backend seed → shared dashboard components → Reviews page
→ Contact messages page → i18n/glossary → browser evidence → gate. The dashboard work for a page
cannot land before the endpoint it consumes exists.

### Delivery phases

This is one intent but four independently verifiable increments. The implementation plan is
written against these phases; each phase ends green and is separately revertible.

| Phase | Content | Ends when |
|---|---|---|
| **1a — Review backend** | The review stats / bulk-approval / date-filter endpoints and `orderId`/`orderNumber` on `ReviewResponse`. | The new endpoints answer correctly against the running backend; backend tests pass. |
| **1b — Contact reply email** | `EmailType.CONTACT_REPLY_EN/_AR`, the data provider, the Brevo template ids, the enqueue in `ContactService.reply()`, `emailStatus` on the response, `POST /{id}/resend-email`, and the separate `nocteon.mail.retry-enabled` flag. | A reply produces an `email_log` row; a failed send is picked up by the worker. |
| **2 — Seed cleanup** | `V110`: Brazil Mogiana's image, reviews moved off the admin account. | The database holds no party photo and no admin-authored review. |
| **3 — Shared dashboard** | `app-user-avatar`, the shared relative-time helper, `app-data-table` header/width entries and direction isolation, the `approved` status badge, the sidebar focus fix. | The shared components are in place; the sidebar shows no persistent ring. |
| **4 — Reviews page** | The full rebuild: tabs, toolbar, statistics, table, grid, bulk, drawer. | AC-R1…AC-R18 pass with browser evidence in 4 cells. |
| **5 — Contact messages page** | The rebuild: tabs, list, preview line, row actions, the dialog, the reply box with its language toggle, the email-state chip. | AC-C1…AC-C17 pass with browser evidence in 4 cells. |
| **6 — Terminology & gate** | Glossary rows, `i18n-keys.spec.ts` pins, the full i18n set, the Evidence Gate. | The gate exits 0 with every criterion mapped to an artifact. |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| `productSlug` changes from `LIKE` to exact match — any caller relying on partial matching changes behaviour. | The dashboard is the only caller of the dashboard endpoint, and it moves to a dedicated `search` parameter in the same change. |
| The sidebar focus move touches global navigation behaviour for every admin. | Keyboard focus is moved to the page `<h1>`, which is the documented pattern; the change is covered by an E2E assertion that the active nav item carries no ring. |
| The pending tab as the default changes what a moderator sees first. | Intended: pending is the work queue. `?status=pending` still lands on the same tab, and the Orders-style URL state makes the tab explicit in the address. |
| The **Replied** tab and the date-range filter are client-side over the loaded set, so they see only the loaded page(s), not every message. | The page loads with a raised size (100, the API's maximum) and the limitation is recorded in the code. The counts that matter — total and unread — come from the server. |
| **The reply email reaches real inboxes.** The seed addresses are `@test.com` (reserved, non-routable), but a real message would reach a real person. | The email only fires from an explicit admin action. The seed uses `@test.com`. The `email_log` row records every attempt, so there is a trail. |
| **The reply email needs two Brevo templates** that have to be created in the Brevo dashboard by hand — the one step that is not in the repo. | Listed as an explicit prerequisite in the plan, with the env var names. Without them the send fails loudly (the `email_log` row goes FAILED) and the UI says the email did not go out. |
| Turning on the retry worker with the **existing** flag would also start the abandoned-cart emails to real addresses. | The spec gives the retry worker its own flag (`nocteon.mail.retry-enabled`); the existing flag stays off and keeps gating the abandoned-cart job. |
| A **retry rebuilds the params from the database**, so it sends the *current* `reply_content` — if the admin has since replied again, the earlier failed attempt sends the newer text. | One email row per message, and the row carries the type, so a message never has two divergent emails in flight. The newer text is what should reach the customer anyway. |
| The `reply_content` column holds one reply; a second reply overwrites the first. | Accepted for a console this small. The dialog labels the stored text "Your reply" so it is never mistaken for a thread. |
| Enabling the retry worker drains a queue that has never been inspected — `email_log` may hold old PENDING rows from earlier traffic. | The worker is off by default and gets its own flag. Before enabling it, the plan includes reading the current `email_log` for stale rows. |

## 9. Rollback

- **Backend:** the only changes are additive — a new statistics endpoint, a new bulk endpoint, two
  nullable fields on `ReviewResponse`, one seed migration, and the contact-reply email wiring
  (a new `EmailType`, a provider, an env var and one new flag). Rolling back is a code revert;
  the seed migration is guarded and idempotent. The `email_log` rows survive a revert — they are
  a delivery trail, and deleting them would destroy the record of what was sent.
- **Dashboard:** both pages are behind their routes; reverting the two feature directories
  restores the previous behaviour. The shared components are additive except the sidebar focus
  change, which is a single, separately revertible commit.
