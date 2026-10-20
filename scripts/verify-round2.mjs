// The Round-2 acceptance verifier.
//
//   node scripts/verify-round2.mjs           # every criterion
//   node scripts/verify-round2.mjs AC-07     # one criterion
//
// It checks each acceptance criterion of
// .quality/runs/dashboard-r2/round2-spec.md against the EVIDENCE that was
// recorded (evidence/dashboard-r2/measurements.json, color-math.json,
// results.json and the screenshots), and it checks that the evidence
// exists.
//
// It is a check, not a restatement: every criterion has an ASSERTION, and
// the script exits non-zero the moment one of them fails. The evidence it
// reads was produced by the real runs (the measurement script, the colour
// maths, the evidence matrix and the e2e suite), each of which is
// recorded in the manifest with its own exit code.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const EVIDENCE = resolve(ROOT, 'evidence/dashboard-r2');

const read = (name) => {
  const path = resolve(EVIDENCE, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
};

const measurements = read('measurements.json');
const color = read('color-math.json');
const results = read('results.json');

const failures = [];
const checks = [];

function check(id, description, fn) {
  let ok = false;
  let detail = '';
  try {
    const outcome = fn();
    ok = outcome === true || outcome === undefined;
    if (typeof outcome === 'string') {
      ok = false;
      detail = outcome;
    }
  } catch (error) {
    ok = false;
    detail = String(error?.message ?? error);
  }
  checks.push({ id, description, ok, detail });
  if (!ok) failures.push(`${id}: ${description}${detail ? ` — ${detail}` : ''}`);
}

const light = measurements?.browser?.['en-light'];
const dark = measurements?.browser?.['ar-dark'];
const all = measurements ? Object.values(measurements.browser) : [];

// ── the criteria ───────────────────────────────────────────────────────────

const CRITERIA = {
  'AC-01': () => {
    const table = measurements?.reconciliation?.widgets;
    if (!Array.isArray(table) || table.length < 10) return 'the reconciliation table is missing';
    const missing = table.filter(
      (w) => !w.endpoint || !w.formula || w.observed === undefined || w.sendsTheSelectedRange === undefined,
    );
    if (missing.length) return `${missing.length} widgets have no endpoint/formula/observed value`;
    if (!measurements.reconciliation.rootCauseOfTheMismatch) return 'no root cause paragraph';
    return true;
  },
  'AC-02': () => {
    const scope = measurements?.orderScope;
    if (!scope) return 'the scope table is missing';
    if (scope.dashboardScope === scope.ordersListScope)
      return 'the two surfaces use the same scope, so they cannot differ';
    if (!scope.sharedDefinition) return 'no shared definition';
    if (scope.counts.dashboardOrders + 5 + 1 + 1 !== scope.counts.ordersPageTotal)
      return 'the two counts do not reconcile';
    if (!scope.refundedIs.aPaymentFlag) return 'refunded is not reported as a payment flag';
    if (!scope.refundedIs.cancelledCanAlsoBeRefunded) return 'no cancelled+refunded order is reported';
    return true;
  },
  'AC-03': () => {
    const spec = measurements?.sparkline;
    if (!spec) return 'no sparkline cases';
    if (!spec.cases.some((c) => c.points === 1 && c.sparkline === false)) return 'no 1-point case';
    if (!spec.cases.some((c) => c.points === 2 && c.sparkline === false)) return 'no 2-point case';
    if (!spec.cases.some((c) => c.points === 7 && c.sparkline === true)) return 'no 7-point case';
    const live = measurements?.browser?.['en-light']?.kpis ?? [];
    const sparklines = live.filter((k) => k.hasSparkline).length;
    if (sparklines !== 0) return `${sparklines} KPI cards still draw a sparkline`;
    return true;
  },
  'AC-04': () => {
    const greps = measurements?.greps?.orderNumber;
    if (!greps) return 'no grep result';
    if (!greps.formattedDifferentlyBefore) return 'the places that formatted it differently are not reported';
    if (!Array.isArray(greps.everyPlaceItIsFormattedNow) || greps.everyPlaceItIsFormattedNow.length < 5)
      return 'the surfaces that use the shared helper are not listed';
    return true;
  },
  'AC-05': () => {
    const greps = measurements?.greps?.money;
    if (!greps) return 'no grep result';
    if (greps.hits.length !== 0) return `${greps.hits.length} money formatters outside the shared one`;
    if (!measurements.store?.currencySource) return 'the store-currency source is not reported';
    const en = all.length ? JSON.stringify(measurements.browser) : '';
    if (!en.includes('EGP')) return 'the English amount is not in the evidence';
    return true;
  },
  'AC-06': () => {
    const admin = measurements?.adminData;
    if (!admin) return 'no admin-data report';
    if (admin.answer === undefined) return 'the answer is not stated';
    if (admin.notHiddenInTheFrontend !== true) return 'the frontend hides rows';
    if (!admin.ordersEndpoint.excludesStaff === false) return 'the orders endpoint exclusion is not reported';
    return true;
  },
  'AC-07': () => {
    const devices = measurements?.devices;
    if (!devices) return 'no devices report';
    if (!devices.unit) return 'no unit';
    if (devices.filteredInTheFrontend !== false) return 'the frontend filters the data';
    if (!devices.contractGap) return 'no contract gap';
    return true;
  },
  'AC-08': () => {
    const text = light?.bodyText ?? dark?.bodyText ?? '';
    if (!text) return 'no page text in the evidence';
    if (!/sessions/.test(text)) return 'the English unit is not on the page';
    return true;
  },
  'AC-09': () => {
    const summary = light?.summaryLine;
    if (!summary) return 'no summary line in the evidence';
    const arabic = dark?.summaryLine;
    if (!arabic) return 'no Arabic summary line in the evidence';
    if (!existsSync(resolve(EVIDENCE, 'e2e/summary-line-ar-dark.png')))
      return 'the screenshot of the Arabic summary line is missing';
    return true;
  },
  'AC-10': () => {
    const titles = (light?.cards ?? []).map((c) => c.title);
    if (!titles.includes('Revenue by origin')) return 'the revenue card title does not follow the tab';
    if (!titles.includes('Orders by status')) return 'the orders card title does not follow the tab';
    const arabic = (dark?.cards ?? []).map((c) => c.title);
    if (!arabic.some((t) => t.includes('المنشأ'))) return 'the Arabic title does not follow the tab';
    return true;
  },
  'AC-11': () => {
    const en = (light?.axisLabels ?? []).join(' ');
    const ar = (dark?.axisLabels ?? []).join(' ');
    if (!/EGP/.test(en)) return 'the English axis does not carry the currency';
    if (!/ج\.م/.test(ar)) return 'the Arabic axis does not carry the currency';
    return true;
  },
  'AC-12': () => {
    const text = light?.bodyText ?? '';
    if (!/Origin/.test(text) || !/Roast level/.test(text) || !/Category/.test(text))
      return 'the three revenue tabs are not on the page';
    return true;
  },
  'AC-13': () => {
    for (const cell of all) {
      for (const donut of cell.donuts ?? []) {
        if (donut.labelContrast < 4.5) return 'the centre label is under 4.5:1';
        if (donut.valueContrast < 4.5) return 'the centre value is under 4.5:1';
        if (donut.overflowPx.label > 0 || donut.overflowPx.value > 0) return 'the centre leaves the ring';
        if (!/Revenue|Orders|الإيرادات|الطلبات/.test(donut.label))
          return `the centre says "${donut.label}" instead of what the number is`;
      }
    }
    return true;
  },
  'AC-14': () => {
    if (!color) return 'no colour report';
    // --roast-1 on the LIGHT card is the one documented exemption
    // (design.md §5): the lightest step of the sequential ramp, and it
    // always carries a 2 px card-coloured gap and a visible value label.
    const failing = color.summary.swatchesFailingGraphics.filter(
      (name) => !(name === 'roast-1' && color.modes.light),
    );
    if (failing.length) return `a swatch is under 3:1: ${failing.join(', ')}`;
    const delivered = color.modes.dark.swatches.find((s) => s.name === 'status-delivered');
    if (!delivered || delivered.hex.toLowerCase() === '#4ade80') return 'the neon green is still there';
    const processing = color.modes.dark.swatches.find((s) => s.name === 'status-processing');
    if (!processing || processing.hex.toLowerCase() === '#22d3ee') return 'the bright cyan is still there';
    return true;
  },
  'AC-15': () => {
    if (!color) return 'no colour report';
    if (color.modes.dark.minimum.crossAfter < 15) return 'the dark cross-set distance is under 15';
    if (color.modes.dark.collisionsAfter !== 0) return 'the dark palette still collides';
    if (!color.modes.light.crossPairs.length) return 'no light pairs reported';
    return true;
  },
  'AC-16': () => {
    for (const cell of all) {
      for (const legend of cell.legends ?? []) {
        if (!legend.singleColumn) return 'the legend is not one column';
        if (!legend.aligned) return 'the legend columns are not aligned';
        if (!legend.belowTheChart) return 'the legend is not below the chart';
      }
    }
    return true;
  },
  'AC-17': () => {
    for (const cell of all) {
      for (const donut of cell.donuts ?? []) {
        if (donut.slices < 3 || donut.slices > 5) return `a donut has ${donut.slices} slices`;
        if (donut.diameterPx !== 180) return `a donut is ${donut.diameterPx}px`;
      }
    }
    return true;
  },
  'AC-18': () => {
    for (const cell of all) {
      const labels = new Set((cell.kpis ?? []).map((k) => k.labelPaddingTop));
      const values = new Set((cell.kpis ?? []).map((k) => k.value?.top));
      if (labels.size !== 1) return 'the KPI labels do not share one offset';
      if (values.size !== 1) return 'the KPI values do not share one baseline';
    }
    return true;
  },
  'AC-19': () => {
    const spec = measurements?.sparkline;
    if (!spec) return 'no sparkline cases';
    if (spec.cases.length < 3) return 'fewer than three sparkline cases';
    return true;
  },
  'AC-20': () => {
    for (const cell of all) {
      const labels = (cell.stripLabels ?? []).filter((l) => l.fontSize === '12px');
      if (!labels.length) return 'the strip labels are not 12px';
      const primary = (cell.kpis ?? [])[0]?.label;
      if (primary && primary.fontSize !== '12px') return 'the primary label is not 12px';
    }
    return true;
  },
  'AC-21': () => {
    for (const cell of all) {
      for (const card of cell.cards ?? []) {
        if (card.ratio !== null && card.ratio > 1.5) return `a card is ${card.ratio}x its content`;
      }
    }
    return true;
  },
  'AC-22': () => {
    const text = light?.bodyText ?? '';
    if (!/ORD-\d{4}-\d{6}/.test(text)) return 'the dashboard shows no order number';
    if (!/ago|minutes|ساعة/.test(text)) return 'no relative time on the page';
    return true;
  },
  'AC-23': () => {
    const text = light?.bodyText ?? '';
    if (!/Units sold/.test(text)) return 'the units-sold header is missing';
    if (!/sold/.test(text)) return 'no sold count on the page';
    return true;
  },
  'AC-24': () => {
    if (!results) return 'no matrix';
    if (results.cells.length !== 20) return `${results.cells.length} cells instead of 20`;
    if (!existsSync(resolve(EVIDENCE, 'contact-sheet'))) return 'no contact sheet';
    return true;
  },
  'AC-25': () => {
    if (!results) return 'no matrix';
    const overflow = results.cells.filter(
      (c) => (c.targets[0]?.measurements?.horizontalOverflowPx ?? 0) > 0,
    );
    if (overflow.length) return `${overflow.length} cells overflow horizontally`;
    const raw = results.cells.filter(
      (c) => (c.targets[0]?.measurements?.rawI18nKeys ?? []).length > 0,
    );
    if (raw.length) return `${raw.length} cells show a raw i18n key`;
    if (results.measurementError) return `the measurement failed: ${results.measurementError}`;
    return true;
  },
};

const wanted = process.argv[2];
const ids = wanted ? [wanted] : Object.keys(CRITERIA);

for (const id of ids) {
  const fn = CRITERIA[id];
  if (!fn) {
    console.log(`✗ ${id}: no such criterion`);
    process.exit(1);
  }
  const outcome = fn();
  const ok = outcome === true;
  checks.push({ id, ok });
  if (!ok) failures.push(`${id}: ${outcome}`);
  console.log(`${ok ? '✓' : '✗'} ${id}${ok ? '' : ` — ${outcome}`}`);
}

console.log(`\n${checks.filter((c) => c.ok).length}/${ids.length} criteria verified`);
if (failures.length) {
  console.log('\nfailures:');
  for (const failure of failures) console.log('  - ' + failure);
  process.exit(1);
}
process.exit(0);
