// Assertions over an evidence run — the machine-checkable half of the v3
// order-details review. A human (or an agent) reads the screenshots; this
// file fails the run when a measured invariant does not hold, so the evidence
// gate records an exit code that can be trusted instead of "it looked fine".
//
//   node scripts/assert-order-evidence.mjs after
//   node scripts/assert-order-evidence.mjs extra
//   node scripts/assert-order-evidence.mjs states
//   node scripts/assert-order-evidence.mjs return
//   node scripts/assert-order-evidence.mjs v4
//
// Each mode reads the results.json the harness wrote for that run.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODE = process.argv[2];
const ROOT = resolve(process.cwd());

const FILES = {
  after: 'evidence/order-details-v3/after/results.json',
  extra: 'evidence/order-details-v3/extra/results.json',
  states: 'evidence/order-details-v3/after/states/results.json',
  return: 'evidence/order-details-v3/after/verification/results.json',
  v4: 'evidence/order-details-v4/after/results.json',
};

const failures = [];
const notes = [];

/** Every captured target, flattened with its cell context. */
function rowsOf(results) {
  return (results.cells ?? []).flatMap((cell) =>
    (cell.targets ?? []).map((target) => ({
      cell: `${cell.lang}-${cell.theme}@${cell.width}`,
      lang: cell.lang,
      theme: cell.theme,
      width: cell.width,
      ...target,
    })),
  );
}

function fail(row, message) {
  failures.push(`${row.cell} ${row.id}: ${message}`);
}

/** The invariants every screen must satisfy, whatever the state. */
function genericInvariants(row) {
  const m = row.measurements ?? {};
  if (m.horizontalOverflowPx !== 0) fail(row, `horizontal overflow ${m.horizontalOverflowPx}px`);
  if ((m.verticalClipped ?? []).length) fail(row, `vertically clipped: ${m.verticalClipped.length}`);
  if ((m.horizontalClipped ?? []).length) fail(row, `horizontally clipped: ${m.horizontalClipped.length}`);
  if ((m.rawI18nKeys ?? []).length) fail(row, `raw i18n keys: ${m.rawI18nKeys.join(', ')}`);
  if ((m.ellipsised ?? []).length) fail(row, `ellipsised text: ${m.ellipsised.length}`);
}

const HAS_ARABIC = /[\u0600-\u06FF]/;

function checkAfter(rows) {
  const expected = ['delivered', 'shipped', 'cancelled', 'refunded', 'no-items'];
  const seen = new Set(rows.map((r) => r.id));
  for (const id of expected) if (!seen.has(id)) failures.push(`missing target ${id}`);

  for (const row of rows) {
    genericInvariants(row);
    const own = row.own ?? {};

    // The dead cards and the old Net paid row must be gone everywhere.
    if (own.tagsCard !== false) fail(row, 'Tags card is still rendered');
    if (own.netPaid !== '') fail(row, `netPaid still rendered: ${JSON.stringify(own.netPaid)}`);
    if ((own.totalsRows ?? []).some((r) => /net/i.test(r.row) || /net paid/i.test(r.label))) {
      fail(row, 'totals still contain a Net paid row');
    }

    // Breadcrumb: three crumbs ending in the order number.
    const crumb = own.breadcrumb ?? '';
    if (!/ORD-\d{4,}/.test(crumb)) fail(row, `breadcrumb has no order number: "${crumb}"`);

    // The activity log never claims zero real events (every order has a createdAt).
    if (!own.activity || own.activity.count < 1) fail(row, 'activity log renders no recorded event');

    // Progress tracker.
    if (row.id === 'delivered') {
      if (own.deliveredStep?.hasCheckIcon !== true) fail(row, 'Delivered step has no check icon');
      if (own.deliveredStep?.state !== 'done') fail(row, `Delivered step state is ${own.deliveredStep?.state}`);
      for (const step of own.steps ?? []) {
        if (step.hasCheckIcon !== true) fail(row, `step ${step.step} has no check icon`);
      }
    }
    if (row.id === 'refunded' && own.terminalState !== 'refunded') {
      fail(row, `refunded order has no refunded terminal (${own.terminalState})`);
    }
    if (row.id === 'cancelled' && own.cancelled !== true) {
      fail(row, 'cancelled order has no distinct cancelled branch');
    }

    // A PAID order with no paidAt/reference must warn, not show a silent dash.
    if (row.id === 'delivered' || row.id === 'shipped') {
      if (!own.payment?.warning) fail(row, 'paid order without paid facts shows no inline warning');
      if (own.payment?.paidAt !== 'Not recorded' && row.lang === 'en') {
        fail(row, `paidAt rendered as "${own.payment?.paidAt}" instead of "Not recorded"`);
      }
    }

    // Disabled actions must state why, in the active language.
    const disabled = (own.actions ?? []).filter((a) => a.disabled);
    for (const action of disabled) {
      if (!action.disabledReason) {
        fail(row, `${action.id} is disabled with no reason`);
        continue;
      }
      if (row.lang === 'en' && HAS_ARABIC.test(action.disabledReason)) {
        fail(row, `${action.id} reason is stale Arabic in an EN cell: ${action.disabledReason}`);
      }
      if (row.lang === 'ar' && ACTION_REASONS_ARE_TRANSLATED && !HAS_ARABIC.test(action.disabledReason)) {
        fail(row, `${action.id} reason is stale English in an AR cell: ${action.disabledReason}`);
      }
    }

    notes.push(`${row.cell} ${row.id}: activity=${own.activity?.count ?? 0} breadcrumb="${crumb}"`);
  }
}

// The AR cells are captured after a runtime switch; a reason that stays
// English there is the exact stale-language defect the harness exists for.
const ACTION_REASONS_ARE_TRANSLATED = true;

function checkExtra(rows) {
  for (const row of rows) {
    genericInvariants(row);
    const own = row.own ?? {};
    const action = row.action ?? {};

    if (row.id === 'not-found') {
      if (own.states?.notFound !== true) fail(row, '404 does not render the not-found state');
    }

    if (row.id === 'kebab') {
      if (action.present !== true) fail(row, `overflow menu did not open: ${JSON.stringify(action)}`);
      if ((action.items ?? []).length < 4) {
        fail(row, `overflow menu has ${(action.items ?? []).length} items: ${JSON.stringify(action.items)}`);
      }
    }

    if (row.id === 'status-dialog') {
      if (action.present !== true) fail(row, `status dialog did not open: ${JSON.stringify(action)}`);
      if ((action.options ?? []).length === 0) fail(row, 'status dialog offers no transition');
      if (action.note !== true) fail(row, 'status dialog has no note field');
      if (action.notify !== true) fail(row, 'status dialog has no notify control');
    }

    if (row.id === 'print') {
      if (own.actionsVisible !== false) fail(row, `print still shows the actions: ${own.actionsVisible}`);
      if (own.backVisible !== false) fail(row, `print still shows the back button: ${own.backVisible}`);
      if (own.noteVisible !== false) fail(row, `print still shows the note editor: ${own.noteVisible}`);
      if (own.dark !== false) fail(row, 'print keeps the dark class');
      if (own.printClass !== true) fail(row, 'print sheet is not scoped by html.order-print');
      if (own.sidebarChrome !== 'none') fail(row, `print still shows the sidebar: ${own.sidebarChrome}`);
      // `afterprint` must put the screen back exactly as it was.
      if (own.darkAfterRestore !== (row.theme === 'dark')) {
        fail(row, `afterprint restored dark=${own.darkAfterRestore}, expected ${row.theme === 'dark'}`);
      }
      if (own.printClassAfter !== false) fail(row, 'afterprint left html.order-print behind');
    }

    if (row.id === 'populated') {
      if ((own.activity?.count ?? 0) < 8) {
        fail(row, `populated order shows ${own.activity?.count} events, expected the recorded history/notes/shipment/payment`);
      }
      if (!/Aramex/.test(own.shipmentText ?? '')) fail(row, 'shipment card does not show the recorded carrier');
      if (!/ARX-4471902/.test(own.shipmentText ?? '')) fail(row, 'shipment card does not show the tracking number');
      if (own.payment?.warning) fail(row, `populated payment still warns: ${own.payment.warning}`);
      if (own.payment?.transactionReference !== 'TXN-8891-2026') {
        fail(row, `transaction reference not shown: "${own.payment?.transactionReference}"`);
      }
      const datedSteps = (own.steps ?? []).filter((s) => s.date).length;
      if (datedSteps < 4) fail(row, `only ${datedSteps} steps carry a recorded date`);
    }
  }
}

function checkStates(rows) {
  for (const row of rows) {
    genericInvariants(row);
    const action = row.action ?? {};
    if (row.id === 'loading' && action.loading !== 1) fail(row, 'loading skeleton not rendered');
    if (row.id === 'error' && action.error !== 1) fail(row, 'error state not rendered');
  }
}

function checkV4(rows) {
  const expected = ['delivered', 'shipped', 'cancelled', 'refunded', 'no-items', 'populated'];
  const seen = new Set(rows.map((r) => r.id));
  for (const id of expected) if (!seen.has(id)) failures.push(`missing target ${id}`);

  for (const row of rows) {
    genericInvariants(row);
    const own = row.own ?? {};

    // Issue 5: "Not recorded" spans must not carry text-warning.
    if ((own.missingTextWarningCount ?? 0) > 0) {
      fail(row, `Not recorded span uses text-warning (${own.missingTextWarningCount} occurrences)`);
    }

    // Issue 1: customer summary must reflect only this customer's orders, not 17.
    if (row.id === 'delivered' && own.customerOrderCount === '17 orders') {
      fail(row, 'customer order count is store-wide (17) instead of customer-scoped');
    }

    // Issue 2: visible "Regular price" label on struck-through compare-at prices.
    if (row.id === 'delivered') {
      if (!own.regularPriceLabel) fail(row, 'regular price label not rendered for delivered order');
      else {
        if (row.lang === 'en' && !/regular/i.test(own.regularPriceLabel)) {
          fail(row, `regular price label wrong in EN: "${own.regularPriceLabel}"`);
        }
        if (row.lang === 'ar' && !/\u0633\u0639\u0631/.test(own.regularPriceLabel)) {
          fail(row, `regular price label stale English in AR: "${own.regularPriceLabel}"`);
        }
      }
    }

    // Issue 3: displaySku resolves from the variant (non-empty).
    if (row.id === 'delivered' && !own.displaySkuText) {
      fail(row, 'displaySku not rendered for delivered order');
    }

    // Issues 4 & 6: populated fixture exercises the full timeline.
    if (row.id === 'populated') {
      if ((own.activity?.count ?? 0) < 8) {
        fail(row, `populated order shows ${own.activity?.count} events, expected >= 8`);
      }
      if (!/Aramex/.test(own.shipmentText ?? '')) fail(row, 'shipment card does not show the carrier');
      if (!/ARX-4471902/.test(own.shipmentText ?? '')) fail(row, 'shipment card does not show the tracking number');
      if (own.payment?.transactionReference !== 'TXN-8891-2026') {
        fail(row, `transaction reference not shown: "${own.payment?.transactionReference}"`);
      }
      if (own.payment?.warning) fail(row, `populated payment still warns: ${own.payment.warning}`);
    }

    // No Tags card, no Net paid row in the v4 page.
    if (row.id === 'delivered') {
      if (own.tagsCard !== false) fail(row, 'Tags card is still rendered');
      if (own.netPaid !== '') fail(row, `netPaid still rendered: ${JSON.stringify(own.netPaid)}`);
    }

    notes.push(`${row.cell} ${row.id}: activity=${own.activity?.count ?? 0} orderCount="${own.customerOrderCount}"`);
  }
}

function checkReturn(rows) {
  for (const row of rows) {
    // The walk ENDS on the orders list, which is out of scope here and uses
    // deliberate ellipsis in its table cells. Only the page-level invariants
    // apply to this target.
    const m = row.measurements ?? {};
    if (m.horizontalOverflowPx !== 0) fail(row, `horizontal overflow ${m.horizontalOverflowPx}px`);
    if ((m.rawI18nKeys ?? []).length) fail(row, `raw i18n keys: ${m.rawI18nKeys.join(', ')}`);

    const action = row.action ?? {};
    if (action.present !== true) {
      fail(row, `could not walk list -> detail -> crumb: ${JSON.stringify(action)}`);
      continue;
    }
    if (!/\/dashboard\/orders\/\d+$/.test(action.detailUrl ?? '')) {
      fail(row, `row did not open the detail page: ${action.detailUrl}`);
    }
    if (!/status=DELIVERED/i.test(action.crumbHref ?? '')) {
      fail(row, `Orders crumb lost the filter: ${action.crumbHref}`);
    }
    if (!/status=DELIVERED/i.test(action.backUrl ?? '')) {
      fail(row, `returning did not restore the filtered list: ${action.backUrl}`);
    }
  }
}

const file = FILES[MODE];
if (!file) {
  console.error(`usage: node scripts/assert-order-evidence.mjs <after|extra|states|return|v4>`);
  process.exit(2);
}

let results;
try {
  results = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'));
} catch (err) {
  console.error(`cannot read ${file}: ${err.message}`);
  process.exit(2);
}

const rows = rowsOf(results);
if (rows.length === 0) {
  console.error(`${file} has no captured targets`);
  process.exit(2);
}

const check = { after: checkAfter, extra: checkExtra, states: checkStates, return: checkReturn, v4: checkV4 }[MODE];
check(rows);

if (failures.length) {
  console.error(`${MODE}: ${failures.length} failed assertion(s) across ${rows.length} targets`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`${MODE}: ${rows.length} targets, all assertions passed`);
for (const note of notes.slice(0, 6)) console.log(`  ${note}`);
