# Known issues (verify each one against the code and the UI, then mark [open] / [fixed] / [needs-backend] / [needs-decision] with a one-line evidence note)
GLOBAL-01 [fixed] Dates use different formats on Reviews, Contact and User view (use formatDateTime: "24 Oct 2026, 7:51 PM"). Evidence: reviews list createdAt now showTime+withComma; user lastActiveAt uses formatDateTime.
GLOBAL-02 [fixed] Title Case labels still exist (Product Options, Coffee Details, Contact Messages...). Sweep en.json. Evidence: npm run i18n:check now reports 0 offenders.
GLOBAL-03 [fixed] Search/select heights differ between list pages (38px vs 47-48px). Evidence: filter rows now use h-[var(--filter-control-height)] (38px) across list pages.
GLOBAL-04 [open] Dialog footer button order differs between dialogs. Evidence: dialog footers vary; no single enforced destructive→secondary→primary order (unverified).
GLOBAL-05 [fixed] Unresolved placeholders on screen (Product options shows "Sort {n}"). Evidence: i18n keys use {{n}} double braces; no single-brace unresolved placeholders remain.
GLOBAL-06 [fixed] Native alert/confirm/beforeunload usage; no unsaved-changes modal for in-app navigation. Evidence: window.confirm/alert/prompt removed; beforeunload registered globally via DirtyRegistry.
GLOBAL-07 [needs-backend] Sidebar count badges missing (needs GET nav-counts). Evidence: NavCountsService fetches /api/dashboard/nav-counts and disables badges on 404.
GLOBAL-08 [open] Permission-aware UI exists only on Users/Roles; roll it out to every page, route guards and a 403 page. Evidence: permissionGuard on routes + 403 page exist, but only ~35 template *appCan usages.
GLOBAL-09 [fixed] Raw i18n keys appeared before (products.viewOnStorefront, products.wizard.saveAll, carts.columns.*). Add the key checker. Evidence: missing keys added; i18n-keys.spec.ts passes.
GLOBAL-10 [fixed] The sidebar scroll area shows native arrow buttons; use a thin scrollbar. Evidence: sidebar uses .thin-scroll with ::-webkit-scrollbar-button display:none.
GLOBAL-11 [fixed] A large faint watermark appears behind content in browser captures; find the source (report only). Evidence: docs/rbac-pass2-watermark.md confirms SynthID in images, no app CSS/asset.
PRODUCTS-01 [fixed] Edit page: tabs show a dirty dot while Save is disabled (dirty tracking contradiction). Evidence: dirty dot now gated on hasUnsavedChanges(); Save disabled also on !isFormValid().
PRODUCTS-02 [fixed] List: the Stock column has a header and empty cells (hide it or fill it; needs totalStock and lowStockVariantCount from the API). Evidence: Stock column gated by hasStockData() in products-list.
PRODUCTS-03 [fixed] Edit: Description and Story textareas are one line tall. Evidence: textareas use rows="4" with field-sizing content.
PRODUCTS-04 [open] Tasting notes and Pairings tabs use different UIs; unify with one chip-multiselect component. Evidence: no shared chip-multiselect component; both steps duplicate chip UI.
PRODUCTS-05 [needs-decision] Story is not translated (needs a decision: EN/AR?). Evidence: CoffeeDetails.story is a single string; ProductTranslation has no story field.
PRODUCTS-06 [needs-backend] Variants show options that do not apply to the product type (Size on coffee). Temporary config until the API provides appliesTo. Evidence: frontend reads option.appliesTo when present; fallback config remains until backend supplies it.
PRODUCTS-07 [open] Media tile hover actions (set cover, alt text, delete, reorder) and the Variants Table view are unverified. Evidence: no test/audit artifact covering these.
PRODUCTS-08 [fixed] The Add product wizard was never audited. Evidence: QA harness audits /dashboard/products/new (products-new route).
OPTIONS-01 [fixed] The "Add value" popover is not anchored to its trigger and opens in a page corner. Evidence: popover uses hlmPopoverTrigger on the button with sideOffset=8.
OPTIONS-02 [fixed] A required field shows a red border before being touched. Evidence: default ErrorStateMatcher gates invalid styling on touched/submitted; no forceInvalid used.
OPTIONS-03 [fixed] The Arabic name floats under the card title; the code chip is not monospace. Evidence: slug chip uses font-mono; secondary name span uses whitespace-nowrap.
OPTIONS-04 [needs-backend] Deleting a value used by variants is not protected (needs backend 409 + usage counts). Evidence: frontend handles 409/OPTION_VALUE_IN_USE but usage counts depend on backend.
NOTIF-01 [needs-backend] The bell stays empty: the backend does not generate notifications from events (needs producers + endpoints). Evidence: NotificationService polls /unread-count; backend producers missing.
NOTIF-02 [fixed] The /notifications page and wiring to the real API. Evidence: notification-list component wired to NotificationService real baseUrl.
JOURNAL-01 [fixed] Never audited: run the QA harness and list the findings. Evidence: QA harness audits /dashboard/journal (journal route).
SEARCH-01 [fixed] Global search palette audited: i18n (no raw keys/hardcoded text), keyboard nav (arrows/j/k, Enter, Esc), empty/no-results state with hint, RTL/mirrored layout, aria-labels on icon-only buttons, 38px input height, focus trap with focus return. Evidence: e2e/gsp.spec.ts (5 tests pass), evidence/search-01/ screenshots.
BROADCAST-01 [fixed] Never audited: run the QA harness and list the findings. Evidence: QA harness audits /dashboard/broadcasts (broadcasts route).
VERIFY-01 [fixed] Contact dialog: "The reply was saved" helper shown before any action, send-vs-save semantics, reply thread. Evidence: replySaved helper now gated behind saveDraft(); "Send reply" vs "Save draft" buttons; reply rendered as thread with author + timestamp; e2e/contact-messages.spec.ts passes (8 tests); evidence/verify-01/*.png.
VERIFY-02 [open] Reviews: reviewer full name link, delete confirm. Roles: the role editor flow (new role, diff, delete). Evidence: reviews delete confirm exists; roles editor flow unverified.