# Frontend backlog

Written after the auth / notifications / catalogue audit (28 Oct 2026). One
task per cycle: implement → verify → evidence → review → merge.

Status: `[ ]` todo · `[~]` in progress · `[x]` done. Keep this file updated;
it is the source of the order.

Scope tags: **FE** the Angular dashboard, **BE** Spring API, **FS** both.

---

## Done in this cycle (reference)

- [x] Forgot/reset password, change-password contract, session lifecycle, the
      401 interceptor fix, OAuth2 one-time code callback.
- [x] Notification store: pagination, unread view, rollback, session-aware
      polling, badge, delete confirmation, bulk endpoints.
- [x] Permission-based dashboard entry (`dashboard:read`), MODERATOR role set
      (V13/V14), admin account-takeover guard (e-mail needs `user:change_role`).
- [x] Dashboard 500s after `open-in-view=false`: overview, 9 catalogue lists,
      farms, product options, shipping zones, public product list/detail/
      available-options.
- [x] N+1: batched translations + `DashboardListQueryBudgetTest`.
- [x] Bundle 927 kB → 814 kB (lazy GSAP, Quill config moved).
- [x] Product story per language (V15) + wizard field per language + e2e.
- [x] Home KPIs wired to their real comparison; phone search trigger.
- [x] 25-console smoke suite + roles/auth/notifications e2e.

---

## Wave 1 — Security and the blog authoring loop

### FE-01 · Sanitize journal HTML (security)
**Why** The journal body is admin-authored HTML from Quill, stored and rendered
verbatim. No sanitizer exists anywhere in the backend. Stored XSS if an admin
account is compromised or a role is added later.
**Scope** FS.
**Acceptance**
- Journal content is sanitized on write with an allowlist (jsoup `Safelist`):
  p, h1-h6, strong/em/u/s, a[href] (https/mailto only), ul/ol/li, blockquote,
  code/pre, img[src] (own CDN only), br, hr, table if the toolbar gains it.
- A malicious payload (`<script>`, `onerror=`, `javascript:` href) is stripped
  before persistence; a test asserts the stored value.
- Rendering uses `innerHTML` only on sanitized content (document the contract).
**Files** `JournalService`, a new `HtmlSanitizer` service, `journal-form` preview.
**Effort** 0.5 day. **Deps** none.

### FE-02 · Journal inline images
**Why** A blog post needs images inside the body, not only a cover.
**Scope** FS.
**Acceptance**
- Quill image handler uploads through the existing media pipeline and inserts
  the returned URL (no base64 blobs in the body).
- Images resize/align in the editor; the public page keeps the same layout.
- Upload failure keeps the editor state and shows a toast.
**Files** `journal-form.component.ts`, `QUILL_CONFIG_TOKEN`, backend upload
endpoint (reuse Cloudinary service).
**Effort** 1 day. **Deps** FE-01 (sanitizer must allow own-CDN img src).

### FE-03 · Scheduled publishing
**Why** `publishedAt` exists but the public query only checks `status =
PUBLISHED`, so a future-dated post is live immediately.
**Scope** FS.
**Acceptance**
- Public list + detail add `publishedAt <= now` (or `publishedAt IS NULL` for
  posts published immediately).
- The dashboard shows a "Scheduled" badge on future-dated PUBLISHED posts.
- Test: a post dated tomorrow is absent from the public API and present in the
  dashboard.
**Files** `JournalPostRepository`, journal list/row component.
**Effort** 0.5 day. **Deps** none.

### FE-04 · Journal preview
**Why** Editors publish blind today.
**Scope** FE.
**Acceptance** A preview action renders the draft (title, cover, body, tags,
related products) in a full-screen dialog using the same styles as the public
post, without changing status.
**Files** `journal-form`, a preview dialog component.
**Effort** 0.5 day. **Deps** FE-01.

### FE-05 · Journal categories CRUD
**Why** Categories are seed-only; the editor can pick one but nobody can create
or rename them.
**Scope** FS.
**Acceptance** A `journal/categories` page lists, creates, renames and deletes
unused categories; the journal form's category select reads the same endpoint;
deleting a category in use is refused with the count.
**Effort** 0.5 day. **Deps** none.

### FE-06 · Rich text toolbar upgrade
**Why** Current toolbar: bold/italic/underline, h1-h3, link, quote, lists,
clean. A blog needs more.
**Scope** FE.
**Acceptance** Add image (FE-02), video embed (allowlisted providers), code
block, horizontal rule, undo/redo, and h4. Every addition survives FE-01's
allowlist.
**Effort** 0.5 day. **Deps** FE-01, FE-02.

---

## Wave 2 — Products

### FE-07 · Product SEO per language
**Why** No meta title/description/OG image; product links share poorly.
**Scope** FS.
**Acceptance** `product_translations` gains `meta_title`, `meta_description`,
plus a product-level `og_image_url` (defaults to the primary media); the wizard
edits them per language; the public product endpoint exposes them.
**Effort** 1 day. **Deps** none.

### FE-08 · Rich story (reuse the journal editor)
**Why** Story is a plain textarea; the blog gets rich text first.
**Scope** FE.
**Acceptance** The story field uses the same Quill component and toolbar as the
journal, stores HTML, renders on the product page; assistant/legacy plain
stories still render as paragraphs.
**Effort** 0.5 day. **Deps** FE-01 (sanitize story too), FE-02.

### FE-09 · Variant images
**Why** A 250 g bag and a 1 kg bag cannot show different photos.
**Scope** FS.
**Acceptance** `product_variants` gains `image_url`; the variants step uploads
one image per variant; the product page swaps the gallery image on variant
selection.
**Effort** 1 day. **Deps** none.

### FE-10 · Product tags / collections
**Why** Merchandising beyond category/origin: "New arrivals", "Gift boxes".
**Scope** FS.
**Acceptance** `product_tags` (or a collections table) with slug + translated
name; the wizard assigns tags; the products list filters by tag; the storefront
exposes a tag filter.
**Effort** 1 day. **Deps** none.

### FE-11 · Related / upsell products
**Why** Pairings are taste pairings, not cross-sell.
**Scope** FS.
**Acceptance** A product can reference 1-6 "You may also like" products; the
wizard picks them; the public product page renders the block (hidden when
empty).
**Effort** 0.5 day. **Deps** none.

### FE-12 · Duplicate product
**Why** Creating a near-identical product is manual today.
**Scope** FS.
**Acceptance** A row action duplicates the product (translations, variants,
media, relations) with a `-copy` slug and inactive status; the wizard opens on
the copy.
**Effort** 0.5 day. **Deps** none.

### FE-13 · Inventory movement log
**Why** Stock is a number with no history, so reconciliation is manual.
**Scope** FS.
**Acceptance** Every stock change writes a row (order, manual adjustment,
restock) with before/after, actor and reason; the variant panel shows the last
changes; a manual adjustment asks for a reason.
**Effort** 1.5 days. **Deps** none.

### FE-14 · Rating aggregate on product cards
**Scope** FS.
**Acceptance** The product card/list response carries `averageRating` and
`reviewCount`; the storefront card shows stars; the dashboard list shows them
as a column.
**Effort** 0.5 day. **Deps** none.

### FE-15 · Barcode / GTIN on variants
**Scope** FS.
**Acceptance** Optional `barcode` field (unique when set), searchable in the
products list, included in the CSV export.
**Effort** 0.5 day. **Deps** none.

---

## Wave 3 — Orders

### FE-16 · Invoice PDF + resend confirmation
**Why** Support cannot send a receipt or re-send a lost confirmation.
**Scope** FS.
**Acceptance** `GET /api/dashboard/orders/{id}/invoice` returns a PDF (order,
customer, items, totals, payment); the order detail has "Download invoice" and
"Resend confirmation" actions; resend records an `email_log` row and shows the
backend message.
**Effort** 1 day. **Deps** none.

### FE-17 · Notify the customer on status change
**Why** Status updates are silent; customers learn nothing.
**Scope** FS.
**Acceptance** A status transition queues a transactional email (shipped →
tracking link, delivered, cancelled → reason); an explicit toggle on the status
dialog allows "no email"; failures land in `email_log`.
**Effort** 1 day. **Deps** FE-16 (email plumbing).

### FE-18 · Bulk status update
**Why** The orders list is the only console without bulk actions.
**Scope** FS.
**Acceptance** Select rows → set status (allowed transitions only, with a
per-row failure list); one toast with the count.
**Effort** 0.5 day. **Deps** none.

### FE-19 · Orders CSV export
**Why** "Export report" exports KPIs only; support needs the order rows.
**Scope** FE.
**Acceptance** The orders list exports the current filter (not just the page)
to CSV with a UTF-8 BOM; the button states the row count.
**Effort** 0.5 day. **Deps** none.

### FE-20 · Returns / RMA (optional, large)
**Why** Refunds exist, returned stock does not come back into inventory.
**Scope** FS.
**Acceptance** A return record (items, quantity, reason, status) restocks on
approval and links to the refund; the order timeline shows it.
**Effort** 3 days. **Deps** FE-13.

---

## Wave 4 — Shell, look, and cross-cutting

### FE-21 · Public storefront smoke
**Why** Three public endpoints were 500 and nothing noticed; the 25-console
smoke only covers the dashboard.
**Scope** FS.
**Acceptance** A Playwright suite probes every public read endpoint
(products, product detail, available options, categories, journal, journal
post, reviews, settings) and fails on non-200; runs in CI.
**Effort** 0.5 day. **Deps** none.

### FE-22 · Audit log page
**Why** `audit:read` exists with no UI; the permission is dead.
**Scope** FS.
**Acceptance** A `settings/audit` page lists audit rows with actor, action,
entity, time and a JSON detail drawer; filters by action/actor/date; paginated.
**Effort** 1 day. **Deps** none.

### FE-23 · Real-time notifications
**Why** The bell polls every 60 s; new orders can be a minute late.
**Scope** FS.
**Acceptance** SSE (or WebSocket) pushes the unread count and new items; the
poll stays as a fallback; reconnect backoff is visible in the console only.
**Effort** 2 days. **Deps** none.

### FE-24 · Export menu completion
**Why** "Export report" offers a PDF that is disabled ("soon").
**Scope** FE.
**Acceptance** Either implement the PDF (print stylesheet is enough) or remove
the option; no disabled placeholder ships.
**Effort** 0.5 day. **Deps** none.

### FE-25 · Shell pass (design)
**Scope** FE.
**Acceptance** Sidebar density (a section summary or sub-items), the phone range
strip gets a scroll affordance, tablet (768) verified, mobile drawer focus
trapped, theme toggle announces the next theme.
**Effort** 1 day. **Deps** none.

### FE-26 · Orders / products visual pass (design)
**Scope** FE.
**Acceptance** Table density, column priorities and empty/loading/error states
match the home page; both pages verified at 1440/375, light/dark, EN/AR.
**Effort** 1 day. **Deps** FE-25.

### FE-27 · States audit (design + UX)
**Scope** FE.
**Acceptance** Every console page has a designed empty state (with the action
that resolves it), a skeleton, and an error with retry; a Playwright check
fails a page that renders a blank body.
**Effort** 1 day. **Deps** FE-25.

---

## Suggested order

1. FE-01 (security) → FE-03 → FE-02 → FE-06 → FE-04 → FE-05
2. FE-07 → FE-08 → FE-09 → FE-10 → FE-11 → FE-12 → FE-13 → FE-14 → FE-15
3. FE-16 → FE-17 → FE-18 → FE-19 → (FE-20 if approved)
4. FE-21 → FE-22 → FE-24 → FE-23
5. FE-25 → FE-26 → FE-27 (the look, after the flows are complete)
