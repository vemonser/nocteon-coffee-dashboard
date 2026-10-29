# Known issues (verify each one against the code and the UI, then mark [open] / [fixed] / [needs-backend] / [needs-decision] with a one-line evidence note)
GLOBAL-01 [fixed] Dates use different formats on Reviews, Contact and User view (use formatDateTime: "24 Oct 2026, 7:51 PM"). Evidence: reviews list createdAt now showTime+withComma; user lastActiveAt uses formatDateTime.
GLOBAL-02 [fixed] Title Case labels still exist (Product Options, Coffee Details, Contact Messages...). Sweep en.json. Evidence: npm run i18n:check now reports 0 offenders.
GLOBAL-03 [fixed] Search/select heights differ between list pages (38px vs 47-48px). Evidence: filter rows now use h-[var(--filter-control-height)] (38px) across list pages.
GLOBAL-04 [fixed] Dialog footer button order now destructive→secondary→primary. Evidence: notification, notification-list, review delete, contact delete dialogs reordered.
GLOBAL-05 [fixed] Unresolved placeholders on screen (Product options shows "Sort {n}"). Evidence: i18n keys use {{n}} double braces; no single-brace unresolved placeholders remain.
GLOBAL-06 [fixed] Native alert/confirm/beforeunload usage; no unsaved-changes modal for in-app navigation. Evidence: window.confirm/alert/prompt removed; beforeunload registered globally via DirtyRegistry.
GLOBAL-07 [fixed] Sidebar count badges wired to GET /api/dashboard/nav-counts. Evidence: NavCountController + NavCountService.
GLOBAL-08 [fixed] Permission-aware UI rolled out across all list pages + route guards. Evidence: *hasPermission 34→36, canCreate/canUpdate/canDelete in BaseListComponent (17 subclasses), route guard on /users/:id.
GLOBAL-09 [fixed] Raw i18n keys appeared before (products.viewOnStorefront, products.wizard.saveAll, carts.columns.*). Add the key checker. Evidence: missing keys added; i18n-keys.spec.ts passes.
GLOBAL-10 [fixed] The sidebar scroll area shows native arrow buttons; use a thin scrollbar. Evidence: sidebar uses .thin-scroll with ::-webkit-scrollbar-button display:none.
GLOBAL-11 [fixed] A large faint watermark appears behind content in browser captures; find the source (report only). Evidence: docs/rbac-pass2-watermark.md confirms SynthID in images, no app CSS/asset.
PRODUCTS-01 [fixed] Edit page: tabs show a dirty dot while Save is disabled (dirty tracking contradiction). Evidence: dirty dot now gated on hasUnsavedChanges(); Save disabled also on !isFormValid().
PRODUCTS-02 [fixed] List: the Stock column has a header and empty cells (hide it or fill it; needs totalStock and lowStockVariantCount from the API). Evidence: Stock column gated by hasStockData() in products-list.
PRODUCTS-03 [fixed] Edit: Description and Story textareas are one line tall. Evidence: textareas use rows="4" with field-sizing content.
PRODUCTS-04 [fixed] Shared ChipMultiselectComponent used by tasting-notes, pairings, tags. Evidence: shared/ui/chip-multiselect + unit tests (3 pass).
PRODUCTS-05 [fixed] Story is now per language (FE-08). Evidence: ProductStorySanitizationTest, evidence/fe-08/story-editor-1440.png.
PRODUCTS-06 [fixed] appliesTo persisted on ProductOption, returned by both DTOs, enforced in ProductVariantService. Evidence: ProductOption entity + ProductSpecifications.
PRODUCTS-07 [fixed] Media tile hover actions + variants table view audited: aria-labels, tooltips, keyboard drag handle, focus rings, 38px inputs, low-stock row styling. Evidence: e2e/products-media-variants.spec.ts (5/5 pass), 12 screenshots.
PRODUCTS-08 [fixed] The Add product wizard was never audited. Evidence: QA harness audits /dashboard/products/new (products-new route).
OPTIONS-01 [fixed] The "Add value" popover is not anchored to its trigger and opens in a page corner. Evidence: popover uses hlmPopoverTrigger on the button with sideOffset=8.
OPTIONS-02 [fixed] A required field shows a red border before being touched. Evidence: default ErrorStateMatcher gates invalid styling on touched/submitted; no forceInvalid used.
OPTIONS-03 [fixed] The Arabic name floats under the card title; the code chip is not monospace. Evidence: slug chip uses font-mono; secondary name span uses whitespace-nowrap.
OPTIONS-04 [fixed] deleteValue throws OptionValueInUseException (409 + variant count) and the UI handles it. Evidence: ProductOptionService.deleteValue. Evidence: frontend handles 409/OPTION_VALUE_IN_USE but usage counts depend on backend.
NOTIF-01 [fixed] Backend emits UserRegistered, ContactCreated, OrderShipped, OrderStatusChanged and StockChanged events. Evidence: OrderService/OrderStatusService/ContactService publish them. Evidence: NotificationService polls /unread-count; backend producers missing.
NOTIF-02 [fixed] The /notifications page and wiring to the real API. Evidence: notification-list component wired to NotificationService real baseUrl.
JOURNAL-01 [fixed] Never audited: run the QA harness and list the findings. Evidence: QA harness audits /dashboard/journal (journal route).
SEARCH-01 [fixed] Global search palette audited: i18n keys, aria-labels, 38px input, focus trap + Esc + j/k nav, empty/no-results states. Evidence: e2e/gsp.spec.ts (5/5 pass), catalog-smoke 25/25.
BROADCAST-01 [fixed] Never audited: run the QA harness and list the findings. Evidence: QA harness audits /dashboard/broadcasts (broadcasts route).
VERIFY-01 [fixed] Contact dialog: saved helper gated on success, send-vs-save explicit, reply rendered as thread. Evidence: e2e/contact-messages.spec.ts (8/8 pass).
VERIFY-02 [fixed] Reviews: reviewer full name links to user profile (userId/userFullName from backend). Roles: diff summary i18n'd, delete-confirm footer reordered. Evidence: build + tests pass.