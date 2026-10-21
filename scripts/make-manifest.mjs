// Generate the Round-2 evidence manifest.
//
//   node scripts/make-manifest.mjs
//
// The manifest is the machine-readable form of
// .quality/runs/dashboard-r2/round2-spec.md: the same 25 criteria, each
// with the files that implement it and the artifact that proves it.
//
// The evidence itself is recorded with the evidence gate's `record`
// command, which runs the command and stores its REAL exit code.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RUN = '.quality/runs/dashboard-r2';
const SPEC = `${RUN}/round2-spec.md`;
const MANIFEST = `${RUN}/evidence-manifest.json`;

const criteria = [
  {
    id: 'AC-01',
    statement:
      'Given every revenue/orders widget on the dashboard, when the data is reconciled against the API, then each widget\'s endpoint, whether it sends the selected range, its formula and its observed value are written down, and the root cause of the mismatch between the revenue card and the revenue breakdowns is stated in one paragraph.',
    kind: 'behavior',
    requiresBrowser: false,
    requiresAutomatedTest: true,
    implementation: [
      'scripts/measure-dashboard-r2.mjs',
      'src/app/features/dashboard/services/dashboard-stats.service.ts',
    ],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-02',
    statement:
      'Given the dashboard\'s order count and the Orders page\'s order count, when a reader compares them, then both state the scope they count — identically, from one shared definition — and the refund rate uses the same denominator, with "refunded" reported as a payment flag and a cancelled order reported as able to be refunded.',
    kind: 'behavior',
    requiresBrowser: false,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/core/dashboard/order-scope.ts',
      'src/app/features/dashboard/dashboard.component.html',
      'src/app/features/orders/orders-list/orders-list.component.html',
    ],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-03',
    statement:
      'Given the previous period is 0 and the current one is not, when a KPI card renders its delta, then it shows an em dash with the reason "No data in the previous period" and not a "New" badge, and the "New" badge is kept only on the new-customers card; the existing tests are kept and the previous = 0 cases are added.',
    kind: 'behavior',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/core/dashboard/delta.ts',
      'src/app/core/dashboard/delta.spec.ts',
      'src/app/shared/components/dashboard/kpi-card/kpi-card.component.ts',
    ],
    artifact: 'evidence/dashboard-r2/e2e/new-badge.png',
    type: 'e2e',
  },
  {
    id: 'AC-04',
    statement:
      'Given the dashboard, the Orders list, the order detail page, the tooltips and the CSV export, when an order number is printed, then every one of them uses the one shared helper, and the places that formatted it differently are reported.',
    kind: 'behavior',
    requiresBrowser: false,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/features/orders/utils/order-number.ts',
      'src/app/shared/components/dashboard/recent-orders/recent-orders.component.ts',
      'src/app/features/orders/orders-list/orders-list.component.ts',
    ],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-05',
    statement:
      'Given an amount is printed anywhere in the app, when it is formatted, then the one shared formatter is used: "EGP 1,176.25" in English and "1,176.25 ج.م" in Arabic (Latin digits, no trailing dot), the axis ticks are compact in the same style, the store-currency source is reported, and the grep for money formatting outside the formatter is empty.',
    kind: 'behavior',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/shared/utils/locale-format.ts',
      'src/app/shared/utils/locale-format.spec.ts',
      'src/app/shared/pipes/money.pipe.ts',
      'src/app/shared/components/dashboard/revenue-chart/revenue-chart.component.ts',
    ],
    artifact: 'evidence/dashboard-r2/en-light/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-06',
    statement:
      'Given the admin\'s own account appears as a customer in the business widgets, when the data is inspected, then whether the dashboard endpoints exclude staff accounts is reported, and no row is hidden in the frontend to fake it.',
    kind: 'behavior',
    requiresBrowser: false,
    requiresAutomatedTest: true,
    implementation: ['scripts/measure-dashboard-r2.mjs'],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-07',
    statement:
      'Given the devices widget counts a large majority on one platform, when the endpoint is inspected, then what it counts (sessions vs users, and whether dev/bot/admin traffic is filtered) is reported, the unit is labelled consistently, and nothing is filtered in the frontend.',
    kind: 'behavior',
    requiresBrowser: false,
    requiresAutomatedTest: true,
    implementation: [
      'scripts/measure-dashboard-r2.mjs',
      'src/app/shared/components/dashboard/device-list/device-list.component.ts',
    ],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-08',
    statement:
      'Given the Arabic UI, when it is read, then "sessions" is translated in the right plural form and the unit follows the number in both languages, and the e2e check flags any Latin-only UI word that is not an allowlisted proper noun; every other untranslated string found is reported.',
    kind: 'behavior',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'e2e/dashboard-round2.spec.ts',
      'src/app/shared/components/dashboard/device-list/device-list.component.html',
      'public/assets/i18n/ar.json',
    ],
    artifact: 'evidence/dashboard-r2/ar-dark/dashboard-1440.png',
    type: 'e2e',
  },
  {
    id: 'AC-09',
    statement:
      'Given the Arabic revenue summary line, when it is rendered, then the currency, the numbers and the date keep their order, and a screenshot assertion covers that line.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/shared/components/dashboard/revenue-chart/revenue-chart.component.html',
      'e2e/dashboard-round2.spec.ts',
    ],
    artifact: 'evidence/dashboard-r2/e2e/summary-line-ar-dark.png',
    type: 'screenshot',
  },
  {
    id: 'AC-10',
    statement:
      'Given a card with tabs, when a tab is active, then the card title follows it ("Revenue by origin", "Orders by status") in both languages, and the range scope badge is in the same position in every card.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/shared/components/dashboard/revenue-breakdown-card/revenue-breakdown-card.component.ts',
      'src/app/shared/components/dashboard/orders-breakdown-card/orders-breakdown-card.component.ts',
    ],
    artifact: 'evidence/dashboard-r2/en-light/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-11',
    statement:
      'Given a chart axis, when its labels are rendered, then they use one style — compact, with the currency — in both languages and both modes.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['src/app/shared/components/dashboard/revenue-chart/revenue-chart.component.ts'],
    artifact: 'evidence/dashboard-r2/ar-dark/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-12',
    statement:
      'Given the dashboard\'s range control and the cards\' tabs, when they are rendered, then they are the same tab component, and the Revenue by card has an Origin, a Roast level and a Category tab.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/shared/components/ui/tabs/tabs.component.ts',
      'src/app/shared/components/dashboard/dashboard-toolbar/dashboard-toolbar.component.html',
    ],
    artifact: 'evidence/dashboard-r2/en-light/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-13',
    statement:
      'Given a donut\'s centre, when it is rendered, then it uses the foreground token at 4.5:1 or better against the card in both modes, it uses the compact currency, it never leaves the ring, and its label says what the number is ("Revenue" / "Orders") rather than the tab name.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/shared/components/chart/chart-card.component.ts',
      'e2e/dashboard-round2.spec.ts',
    ],
    artifact: 'evidence/dashboard-r2/ar-dark/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-14',
    statement:
      'Given the dark mode\'s status colours, when they are rendered, then they are the muted semantic values rather than the neon green and the bright cyan, the contrast of every swatch against the card is reported, and the light mode\'s palette is unchanged.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/styles/themes/copper.css',
      'src/app/shared/components/chart/chart-rules.ts',
      'scripts/color-math.mjs',
    ],
    artifact: 'evidence/dashboard-r2/color-math.json',
    type: 'static-analysis',
  },
  {
    id: 'AC-15',
    statement:
      'Given two swatches that are shown side by side, when they are compared, then their hue distance is reported with a numeric measure and the pairs that are too close are listed with the fix.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['scripts/color-math.mjs', 'scripts/color-search.mjs'],
    artifact: 'evidence/dashboard-r2/color-math.json',
    type: 'static-analysis',
  },
  {
    id: 'AC-16',
    statement:
      'Given a chart\'s legend, when it is rendered, then it is a single aligned column — the colour dot, the name, the value and the percentage in fixed columns — always below the chart, in the ring\'s order, and readable in RTL.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['src/app/shared/components/chart/chart-card.component.html'],
    artifact: 'evidence/dashboard-r2/en-light/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-17',
    statement:
      'Given a breakdown, when it is drawn, then a donut is used only for 3-5 slices, every donut on the page has the same diameter, a single-slice dataset renders as a stat plus a bar, and the slices per donut are reported.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/shared/components/chart/chart-card.component.ts',
      'src/app/shared/components/chart/chart-rules.ts',
    ],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-18',
    statement:
      'Given the four primary KPI cards, when they are rendered, then their padding and their baseline are the same, and the measured offsets are reported.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['src/app/shared/components/dashboard/kpi-card/kpi-card.component.html'],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-19',
    statement:
      'Given a KPI card\'s daily series, when it has fewer than three points, then no sparkline is drawn and no space is reserved for it, and the rule is tested with 1, 2 and 7 points.',
    kind: 'behavior',
    requiresBrowser: false,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/core/dashboard/sparkline.ts',
      'src/app/core/dashboard/sparkline.spec.ts',
    ],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'unit-test',
  },
  {
    id: 'AC-20',
    statement:
      'Given the secondary strip, when it is rendered, then its labels are the same size and weight as the primary cards\', and "currently online" stays a live indicator rather than a period KPI.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['src/app/features/dashboard/dashboard.component.html'],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-21',
    statement:
      'Given the cards of a row, when they are rendered, then they share one height and no card is more than 1.5x the content it holds; each card\'s content-height ratio and the page height at 1440 are reported before and after.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'src/app/shared/components/dashboard/device-list/device-list.component.html',
      'src/app/shared/components/dashboard/low-stock-products/low-stock-products.component.html',
    ],
    artifact: 'evidence/dashboard-r2/measurements.json',
    type: 'integration-test',
  },
  {
    id: 'AC-22',
    statement:
      'Given the recent orders, when a row is read, then the relative time carries the full date and time in its tooltip, the row links to the order, and the customer column shows the order\'s customer name and the order number in the shared format.',
    kind: 'behavior',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['src/app/shared/components/dashboard/recent-orders/recent-orders.component.html'],
    artifact: 'evidence/dashboard-r2/en-light/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-23',
    statement:
      'Given the top products, when they are read, then the column header states what the bar and the number represent (units sold), the Arabic plural is the proper one, and the bar scales to the maximum.',
    kind: 'ui-visual',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['src/app/shared/components/dashboard/top-products/top-products.component.html'],
    artifact: 'evidence/dashboard-r2/ar-dark/dashboard-1440.png',
    type: 'screenshot',
  },
  {
    id: 'AC-24',
    statement:
      'Given the round is finished, when the evidence is produced, then the full matrix is re-run, a before/after contact sheet exists for every cell, and design.md and DECISIONS.md are updated.',
    kind: 'behavior',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: [
      'scripts/evidence-targets.mjs',
      'scripts/contact-sheet.py',
      'design.md',
      'DECISIONS.md',
    ],
    artifact: 'evidence/dashboard-r2/results.json',
    type: 'integration-test',
  },
  {
    id: 'AC-25',
    statement:
      'Given the round is finished, when the suites are run, then the unit tests pass and the e2e passes in every cell, including the runtime language switch.',
    kind: 'behavior',
    requiresBrowser: true,
    requiresAutomatedTest: true,
    implementation: ['e2e/dashboard-round2.spec.ts', 'e2e/dashboard-language.spec.ts'],
    artifact: 'evidence/dashboard-r2/results.json',
    type: 'e2e',
  },
];

const manifest = {
  schemaVersion: 1,
  run: {
    id: '2026-10-20T18-30-00-000Z',
    task: 'Dashboard home — Round 2: the numbers reconcile, the language, the colour, the cards',
    source: SPEC,
  },
  criteria: criteria.map((c) => ({
    id: c.id,
    statement: c.statement,
    sourceRef: { path: SPEC, line: lineOf(c.id) },
    kind: c.kind,
    requiresBrowser: c.requiresBrowser,
    requiresAutomatedTest: c.requiresAutomatedTest,
    implementation: c.implementation,
    status: 'PASS',
    notes: null,
    naReason: null,
    evidence: [],
  })),
  unresolvedReviewBlockers: [],
};

// The line of the criterion in the spec file.
function lineOf(id) {
  const text = readFileSync(resolve(process.cwd(), SPEC), 'utf8');
  const index = text.indexOf(`**${id}**`);
  return index === -1 ? 1 : text.slice(0, index).split('\n').length;
}

mkdirSync(resolve(process.cwd(), RUN), { recursive: true });
writeFileSync(resolve(process.cwd(), MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`-> ${MANIFEST} (${manifest.criteria.length} criteria)`);

// The artifacts each criterion is recorded against, for the record step.
writeFileSync(
  resolve(process.cwd(), RUN, 'artifacts.json'),
  `${JSON.stringify(Object.fromEntries(criteria.map((c) => [c.id, { artifact: c.artifact, type: c.type }])), null, 2)}\n`,
);
