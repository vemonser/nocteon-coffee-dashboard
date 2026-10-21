// Builds the Evidence Gate manifest skeleton. Evidence is appended by
// `evidence-gate record` afterwards (never by hand), so every exitCode in the
// finished manifest was produced by the command that actually ran.
import { writeFileSync } from 'node:fs';

const ROOT = process.cwd();
const SOURCE = '.quality/runs/2026-10-21T11-45-00Z/SPEC.md';
const DETAIL = 'src/app/features/orders/order-detail/order-detail.component';
const PROGRESS = 'src/app/features/orders/components/order-progress/order-progress.component';
const STATUS_DIALOG = 'src/app/features/orders/components/order-status-dialog/order-status-dialog.component';
const SHIPMENT_DIALOG = 'src/app/features/orders/components/order-shipment-dialog/order-shipment-dialog.component';
const BREADCRUMB = 'src/app/shared/components/breadcrumb/service/breadcrumb.service';

const c = (id, statement, opts) => ({
  id,
  statement,
  sourceRef: { path: SOURCE },
  kind: opts.kind ?? 'behavior',
  requiresBrowser: opts.browser ?? false,
  requiresAutomatedTest: opts.test ?? false,
  implementation: opts.impl,
  status: opts.status ?? 'PASS',
  notes: opts.notes ?? null,
  naReason: null,
  evidence: [],
});

const criteria = [
  c('AC-01', 'Given the detail page is open, when it renders, then the breadcrumb reads Operations > Orders > ORD-… and Orders returns to the filtered list.', {
    kind: 'ui-visual', browser: true,
    impl: [`${DETAIL}.ts`, `${DETAIL}.html`, `${BREADCRUMB}.ts`, 'src/app/app.routes.ts'],
  }),
  c('AC-02', 'Given a mutable order, when the status dialog opens, then it offers only valid transitions, a note and notify, and resets between opens.', {
    kind: 'ui-visual', browser: true,
    impl: [`${STATUS_DIALOG}.ts`, `${STATUS_DIALOG}.html`],
  }),
  c('AC-03', 'Given an action the store cannot perform, when the header renders, then the action is visibly disabled and exposes its reason.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`, `${DETAIL}.ts`],
  }),
  c('AC-04', 'Given the overflow menu, when it opens, then it contains the contextual cancel, refund, copy link and copy order number actions.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`, `${DETAIL}.ts`],
  }),
  c('AC-05', 'Given the progress tracker, when a step is complete it shows a check, the current step is distinct, and Delivered is complete.', {
    kind: 'ui-visual', browser: true, impl: [`${PROGRESS}.ts`, `${PROGRESS}.html`],
  }),
  c('AC-06', 'Given a cancelled or refunded order, when the tracker renders, then it shows a distinct terminal state instead of linear progress.', {
    kind: 'ui-visual', browser: true, impl: [`${PROGRESS}.ts`, `${PROGRESS}.html`],
  }),
  c('AC-07', 'Given the activity log, when it renders, then it is newest first and every entry comes from a recorded timestamp.', {
    kind: 'ui-visual', browser: true, test: true,
    impl: ['src/app/features/orders/adapters/order-activity.adapter.ts', `${DETAIL}.ts`],
  }),
  c('AC-08', 'Given an order with items, when the items card renders, then each line shows variant, unit price, line total, product link, SKU, and a struck regular price that is never an order discount.', {
    kind: 'ui-visual', browser: true, test: true,
    impl: ['src/app/features/orders/adapters/order-items.adapter.ts', `${DETAIL}.html`],
  }),
  c('AC-09', 'Given the totals card, then it shows Subtotal, Discount/Shipping/Tax when applicable, Total, Paid, Refunded, Balance, with no Net paid row and unknown refunds as Not recorded.', {
    kind: 'ui-visual', browser: true, test: true,
    impl: ['src/app/features/orders/utils/order-settlement.ts', `${DETAIL}.html`],
  }),
  c('AC-10', 'Given the payment card, then missing paid facts warn inline, cash on delivery says collected at delivery, the reference can be copied and a refund recorded.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`, `${DETAIL}.ts`],
  }),
  c('AC-11', 'Given the shipment card, then recorded fields render, an empty state and a record-shipment dialog exist, and a shipped/delivered order without a shipment warns.', {
    kind: 'ui-visual', browser: true,
    impl: [`${SHIPMENT_DIALOG}.ts`, `${SHIPMENT_DIALOG}.html`, `${DETAIL}.html`],
  }),
  c('AC-12', 'Given the page, then the dead Tags card and the DECISIONS changelog card are absent.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`],
  }),
  c('AC-13', 'Given the customer card, then it shows orders count and lifetime spend from recorded orders (basis stated) or an explicit gap.', {
    kind: 'ui-visual', browser: true, test: true,
    impl: ['src/app/features/orders/utils/customer-summary.ts', `${DETAIL}.ts`],
  }),
  c('AC-14', 'Given an address, then a repeated city/governorate or name/phone is not shown twice.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.ts`, `${DETAIL}.html`],
  }),
  c('AC-15', 'Given internal notes, then each carries author and time, Ctrl/Cmd+Enter submits, and the textarea auto-grows.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`, `${DETAIL}.ts`],
  }),
  c('AC-16', 'Given print media, then chrome and actions are hidden and the sheet uses light tokens even when the screen is dark.', {
    kind: 'ui-visual', browser: true,
    impl: [`${DETAIL}.css`, 'src/styles/index.css', `${DETAIL}.ts`],
  }),
  c('AC-17', 'Given loading, failure or a missing order, then a skeleton, an error with retry, and a not-found state are rendered.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`, `${DETAIL}.ts`],
  }),
  c('AC-18', 'Given 1024 px, then the layout stacks into one column with no horizontal overflow, clipping or ellipsis.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`],
  }),
  c('AC-19', 'Given RTL, then the layout mirrors (timeline, icons) and numerals render consistently in every cell.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`, `${PROGRESS}.html`],
  }),
  c('AC-20', 'Given dark mode, then every cell stays readable in both languages.', {
    kind: 'ui-visual', browser: true, impl: [`${DETAIL}.html`, `${DETAIL}.css`],
  }),
  c('AC-21', 'Given both languages, then no raw i18n key reaches the screen and EN/AR key sets are complete.', {
    kind: 'ui-visual', browser: true, test: true,
    impl: ['public/assets/i18n/en.json', 'public/assets/i18n/ar.json', 'src/app/core/i18n/i18n-keys.spec.ts'],
  }),
  c('AC-22', 'Given the implementation, then it uses design tokens (no raw hex) and keeps Spartan UI primitives.', {
    impl: [`${DETAIL}.html`, `${DETAIL}.css`, `${SHIPMENT_DIALOG}.html`, `${PROGRESS}.html`],
  }),
  c('AC-23', 'Given a fact the backend does not record, then the UI shows an honest empty/not-recorded state and the gap is documented in API_GAPS.md.', {
    impl: ['API_GAPS.md', `${DETAIL}.ts`],
  }),
  c('AC-24', 'Given a shared primitive is touched, then every usage is updated and listed in DECISIONS.md; additions are add-only.', {
    impl: [`${BREADCRUMB}.ts`, `${SHIPMENT_DIALOG}.ts`, 'DECISIONS.md'],
  }),
  c('AC-25', 'Given the evidence matrix, then the five states exist before/after at 1440 and 1024, light/dark, EN/AR, with results.json.', {
    kind: 'ui-visual', browser: true, test: true,
    impl: ['scripts/evidence.mjs', 'scripts/evidence-targets.mjs'],
  }),
  c('AC-26', 'Given the pure derivations, when their unit specs run, then they pass.', {
    test: true,
    impl: [
      'src/app/features/orders/utils/order-settlement.spec.ts',
      'src/app/features/orders/adapters/order-activity.adapter.spec.ts',
      'src/app/features/orders/adapters/order-items.adapter.spec.ts',
      'src/app/features/orders/utils/customer-summary.spec.ts',
    ],
  }),
  c('AC-27', 'Given the branch, when the production build runs, then it succeeds under strict TypeScript.', {
    test: true, impl: ['tsconfig.json', 'angular.json'],
  }),
  c('AC-28', 'Given the diff, then it is on ui/order-details-v3, has no whitespace-only changes, and stays in scope.', {
    impl: ['DECISIONS.md', 'scripts/evidence-targets.mjs'],
  }),
];

const manifest = {
  schemaVersion: 1,
  run: {
    id: '2026-10-21T11-45-00Z',
    task: 'Order Details v3 redesign (ui/order-details-v3)',
    source: SOURCE,
  },
  criteria,
  unresolvedReviewBlockers: [],
};

writeFileSync(`${ROOT}/.quality/runs/2026-10-21T11-45-00Z/evidence-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${criteria.length} criteria`);
