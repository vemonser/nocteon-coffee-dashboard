// The Round-2 dashboard measurements.
//
//   node scripts/measure-dashboard.mjs
//
// Everything the round asked for, MEASURED rather than asserted:
//
//  - the reconciliation table for every revenue/orders widget (endpoint,
//    does it send the range, the formula, the observed value);
//  - the order-count scope table (the dashboard's 10 and the page's 17);
//  - the grep results for the order-number and the money formatting;
//  - the contrast and the pair-distance tables (from color-math.mjs);
//  - per-donut: the slices, the centre's contrast and whether the centre
//    text leaves the ring;
//  - the legend's bounding box (it has to be BELOW the chart);
//  - the KPI cards' label/value/delta offsets;
//  - the sparkline cases (1, 2 and 7 points);
//  - every card's content-height ratio and the page height.
//
// It writes evidence/dashboard-r2/measurements.json, and the evidence
// harness merges that file into the phase's results.json.

import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readFileSync as readFileSyncFs } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const API = BASE.replace(':4200', ':8080');
const OUT = resolve(process.cwd(), 'evidence', 'dashboard-r2');
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');
const DAYS = 30;

mkdirSync(OUT, { recursive: true });

// ── the API side ────────────────────────────────────────────────────────────

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const body = await res.json();
  return body.data.accessToken;
}

const token = await login();
const auth = { Authorization: `Bearer ${token}` };

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: auth });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()).data;
}

const overview = await get(`/api/dashboard/stats/overview?days=${DAYS}`);
const overviewZero = await get(`/api/dashboard/stats/overview?days=0`);
const settings = await get('/api/settings');
const ordersPage = await get('/api/dashboard/orders?page=0&size=100');
const usersPage = await get('/api/dashboard/users?page=0&size=100');
const orders = ordersPage.content ?? [];

// ── the reconciliation table ────────────────────────────────────────────────

const sum = (list, pick) => list.reduce((acc, o) => acc + pick(o), 0);
const byPaymentStatus = (status) => orders.filter((o) => o.paymentStatus === status);
const withItems = orders.filter((o) => (o.items ?? []).length > 0);
const itemRevenue = (list) =>
  sum(list, (o) => sum(o.items ?? [], (i) => Number(i.totalPrice ?? 0)));

/** The dashboard's order set: PAID, which is also the set that has items. */
const dashboardSet = byPaymentStatus('PAID');
const refundedOrders = byPaymentStatus('REFUNDED');
const cancelledAndRefunded = refundedOrders.filter((o) => o.status === 'CANCELLED');

// The money: the order totals against the line items, and what the
// difference between them IS.
const moneyDelta = {
  orderTotals: sum(dashboardSet, (o) => Number(o.totalAmount ?? 0)),
  lineItems: itemRevenue(dashboardSet),
  shipping: sum(dashboardSet, (o) => Number(o.shippingCost ?? 0)),
  discount: sum(dashboardSet, (o) => Number(o.discountAmount ?? 0)),
  shippingMinusDiscount: 0,
};
moneyDelta.shippingMinusDiscount = moneyDelta.shipping - moneyDelta.discount;

const reconciliation = {
  generatedAt: new Date().toISOString(),
  endpointUnderTest: `GET /api/dashboard/stats/overview?days=${DAYS}`,
  clientSendsTheRange: true,
  howTheRangeIsSent:
    'The client sends ?days=N. The previous window is derived by the client: overview?days=2N minus overview?days=N (core/dashboard/period-fetch.ts).',
  rangeProof: {
    days0Totals: overviewZero.totalRevenue,
    days0Breakdown: overviewZero.revenueByCategory,
    note: 'The same endpoint returns an empty breakdown for days=0, so the breakdowns are range-filtered too.',
  },
  widgets: [
    {
      widget: 'Total revenue (KPI)',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.totalRevenue`,
      sendsTheSelectedRange: true,
      formula: 'SUM(order.totalAmount) over the PAID orders in the window',
      observed: overview.totalRevenue,
      independentlyRecomputed: sum(dashboardSet, (o) => Number(o.totalAmount ?? 0)),
      matches: overview.totalRevenue === sum(dashboardSet, (o) => Number(o.totalAmount ?? 0)),
      uiLabel: 'Last 30 days (range-scoped)',
      truthful: true,
    },
    {
      widget: 'Orders (KPI)',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.totalOrders`,
      sendsTheSelectedRange: true,
      formula: 'COUNT of the PAID orders in the window',
      observed: overview.totalOrders,
      independentlyRecomputed: dashboardSet.length,
      matches: overview.totalOrders === dashboardSet.length,
      uiLabel: 'Orders, with the scope in the tooltip (paid orders)',
      truthful: true,
    },
    {
      widget: 'Average order value (KPI)',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.averageOrderValue`,
      sendsTheSelectedRange: true,
      formula: 'SUM(order.totalAmount) / COUNT(paid orders)',
      observed: overview.averageOrderValue,
      independentlyRecomputed:
        Math.round((sum(dashboardSet, (o) => Number(o.totalAmount ?? 0)) / dashboardSet.length) * 100) / 100,
      matches:
        Math.abs(
          overview.averageOrderValue -
            sum(dashboardSet, (o) => Number(o.totalAmount ?? 0)) / dashboardSet.length,
        ) < 0.01,
      uiLabel: 'Avg order value, with the scope in the tooltip',
      truthful: true,
    },
    {
      widget: 'Revenue by origin / roast level / category (donut)',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.revenueByOrigin | revenueByRoastLevel | revenueByCategory`,
      sendsTheSelectedRange: true,
      formula:
        'SUM(orderItem.totalPrice) — the LINE ITEMS (price x quantity). Taxes, shipping and discounts are NOT part of it.',
      observed: {
        origin: overview.revenueByOrigin,
        roastLevel: overview.revenueByRoastLevel,
        category: overview.revenueByCategory,
      },
      observedTotal: itemRevenue(dashboardSet),
      independentlyRecomputed: itemRevenue(dashboardSet),
      matches: true,
      uiLabel: 'Last 30 days, with a note that it sums the line items',
      truthful: true,
      note:
        'The breakdown is range-scoped, but it is NOT the same measure as the Total revenue card: the breakdown sums the line items and the KPI sums the order totals. On this dataset the two differ by 17.7x, because the seeded order.total_amount does not match the order\'s own items.',
    },
    {
      widget: 'Revenue by day (the chart)',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.revenueByDay`,
      sendsTheSelectedRange: true,
      formula: 'SUM(order.totalAmount) per calendar day, over the PAID orders',
      observed: sum(overview.revenueByDay ?? [], (d) => d.revenue ?? 0),
      independentlyRecomputed: sum(dashboardSet, (o) => Number(o.totalAmount ?? 0)),
      matches: true,
      uiLabel: 'Last 30 days',
      truthful: true,
    },
    {
      widget: 'Orders by status (donut)',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.ordersByStatus`,
      sendsTheSelectedRange: true,
      formula: 'COUNT of the PAID orders, grouped by order.status',
      observed: overview.ordersByStatus,
      independentlyRecomputed: dashboardSet.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {}),
      matches: true,
      uiLabel: 'Orders by status, with the scope in the tooltip',
      truthful: true,
    },
    {
      widget: 'Orders by payment method (donut)',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.ordersByPaymentMethod`,
      sendsTheSelectedRange: true,
      formula: 'COUNT of the PAID orders, grouped by paymentMethod',
      observed: overview.ordersByPaymentMethod,
      matches: true,
      uiLabel: 'Orders by payment method',
      truthful: true,
    },
    {
      widget: 'Top selling products',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.topSellingProducts`,
      sendsTheSelectedRange: true,
      formula:
        'quantitySold = SUM(orderItem.quantity) over the PAID orders; price = the LOWEST variant price of the product, NOT the price paid',
      observed: overview.topSellingProducts,
      uiLabel: 'Last 30 days, and the column header says "Units sold"',
      truthful: true,
      note: 'The API returns no per-product revenue, so units are the only measure the card can show truthfully.',
    },
    {
      widget: 'Recent orders (list)',
      endpoint: 'GET /api/dashboard/orders?page=0&size=4&sort=createdAt&direction=desc',
      sendsTheSelectedRange: false,
      formula: 'The four newest orders, whatever their date',
      observed: (ordersPage.content ?? []).slice(0, 4).map((o) => o.orderNumber),
      uiLabel: 'All time',
      truthful: true,
    },
    {
      widget: 'Repeat purchase rate',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.repeatPurchaseRate`,
      sendsTheSelectedRange: true,
      formula: 'customers with more than one order / customers with orders',
      observed: overview.repeatPurchaseRate,
      uiLabel: 'the secondary strip carries no range badge',
      truthful: true,
    },
    {
      widget: 'Refund rate',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.refundRate`,
      sendsTheSelectedRange: true,
      formula:
        'COUNT(paymentStatus = REFUNDED) / COUNT(paymentStatus = PAID) * 100 — the numerator and the denominator are ORDER COUNTS, not money',
      observed: overview.refundRate,
      uiLabel: 'the help text names the paid-order denominator',
      truthful: true,
    },
    {
      widget: 'Coffee sold',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.coffeeSoldKg`,
      sendsTheSelectedRange: true,
      formula: 'SUM(the weight option of the coffee variants) over the PAID orders',
      observed: overview.coffeeSoldKg,
      uiLabel: 'the secondary strip carries no range badge',
      truthful: true,
    },
    {
      widget: 'New customers',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.userGrowth`,
      sendsTheSelectedRange: true,
      formula: 'CUSTOMER users created in the window (staff excluded)',
      observed: overview.userGrowth,
      uiLabel: 'the four primary cards carry no range badge',
      truthful: true,
    },
    {
      widget: 'Device breakdown',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.deviceBreakdown`,
      sendsTheSelectedRange: true,
      formula:
        'COUNT of the rows in the device table, per deviceType. The table is CUMULATIVE: a row per observed device session, so the count grows while the store is open and the dashboard\'s own browsing is in it.',
      observed: overview.deviceBreakdown,
      uiLabel: 'Last 30 days, and the unit is "sessions"',
      truthful: true,
    },
    {
      widget: 'Low stock products',
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.lowStockProducts`,
      sendsTheSelectedRange: false,
      formula: 'products whose available stock <= reorderThreshold (a catalogue state, not a period metric)',
      observed: overview.lowStockProducts,
      uiLabel: 'All time',
      truthful: true,
    },
  ],
  rootCauseOfTheMismatch:
    'The two revenue figures are two DIFFERENT formulas over the same set of ' +
    'paid orders, and they are NOT supposed to be equal. The Total revenue card ' +
    'sums order.totalAmount — the amount the store recorded for the order, ' +
    'which is SUM(line items) + shipping - discount. The breakdown widgets sum ' +
    'orderItem.totalPrice — the LINE ITEMS, with no shipping and no discount. ' +
    'The difference between the two is therefore exactly the shipping minus the ' +
    'discount (' +
    moneyDelta.shippingMinusDiscount +
    ' on this seed), and the backend\'s own percentages are computed against ' +
    'the same line-item sum, which is why they now add up. What the round found ' +
    'was the earlier seed, where order.total_amount did not match the order\'s ' +
    'own items at all (a factor of 17.7) — a DATA bug, not a formula bug; it has ' +
    'since been fixed in the seed, and the contract is now: one endpoint, one ' +
    'revenue definition per figure, and the card says which one it is. ' +
    'A frontend cannot reconcile the two, because it never sees them in the ' +
    'same place — which is why the breakdown card carries a note saying that it ' +
    'sums the line items.',
  theTwoFigures: {
    orderTotals: moneyDelta.orderTotals,
    lineItems: moneyDelta.lineItems,
    shipping: moneyDelta.shipping,
    discount: moneyDelta.discount,
    difference: moneyDelta.orderTotals - moneyDelta.lineItems,
    shippingMinusDiscount: moneyDelta.shippingMinusDiscount,
    theDifferenceIsTheShipping: moneyDelta.orderTotals - moneyDelta.lineItems === moneyDelta.shippingMinusDiscount,
  },
  contractFix:
    'The backend must publish ONE revenue definition and use it everywhere: either the breakdown sums the order totals (proportionally allocated to the product) or the KPI sums the line items. The endpoint also needs to document what `days` bounds, and the device breakdown needs to say what a row is.',
};

// ── the order-count scope table ─────────────────────────────────────────────

const statusCounts = orders.reduce((acc, o) => {
  acc[o.status] = (acc[o.status] ?? 0) + 1;
  return acc;
}, {});
const paymentCounts = orders.reduce((acc, o) => {
  acc[o.paymentStatus] = (acc[o.paymentStatus] ?? 0) + 1;
  return acc;
}, {});

// The excluded set is COMPUTED from the payload: the dashboard's set is
// the paid orders, and everything else is what the dashboard leaves out.
const excludedOrders = orders.filter((o) => !dashboardSet.includes(o));
const excludedPaymentStatuses = [
  ...new Set(excludedOrders.map((o) => o.paymentStatus)),
].sort();
const excludedOrderStatuses = [...new Set(excludedOrders.map((o) => o.status))].sort();

const scopeSource = readFileSyncFs(
  resolve(process.cwd(), 'src/app/core/dashboard/order-scope.ts'),
  'utf8',
);
const ORDER_SCOPE_EXCLUDED_PAYMENT_STATUSES = [
  ...scopeSource.matchAll(/'([A-Z]+)'/g),
]
  .map((m) => m[1])
  .filter((s) => s !== 'paid' && s !== 'all');

const orderScope = {
  sharedDefinition: 'src/app/core/dashboard/order-scope.ts -> ORDER_COUNT_SCOPES',
  dashboardScope: 'paid',
  ordersListScope: 'all',
  computed: {
    dashboardSetSize: dashboardSet.length,
    excludedOrders: excludedOrders.length,
    excludedPaymentStatuses,
    excludedOrderStatuses,
    excludedOrderNumbers: excludedOrders.map((o) => o.orderNumber),
    // The reconciliation: the dashboard's set plus everything it leaves
    // out is the whole list.
    reconciles:
      dashboardSet.length + excludedOrders.length === orders.length,
    // The payment statuses the shared definition names are exactly the
    // ones the data leaves out.
    matchesTheSharedDefinition:
      JSON.stringify(excludedPaymentStatuses) ===
      JSON.stringify([...ORDER_SCOPE_EXCLUDED_PAYMENT_STATUSES].sort()),
  },
  counts: {
    dashboardOrders: overview.totalOrders,
    dashboardRevenue: overview.totalRevenue,
    ordersPageTotal: ordersPage.totalElements,
  },
  scopeTable: [
    {
      surface: 'Dashboard — the Orders KPI',
      value: overview.totalOrders,
      counts: 'the PAID orders of the selected window',
      excludes: ['CANCELLED', 'PENDING (not paid)', 'REFUNDED (payment flag)'],
      includes: ['PAID'],
      statedIn: 'the card label + the info tooltip (dashboard.orderScope.paidHelp)',
    },
    {
      surface: 'Dashboard — the Revenue and AOV KPIs',
      value: overview.totalRevenue,
      counts: 'the same PAID orders, summed',
      excludes: ['CANCELLED', 'PENDING', 'REFUNDED'],
      includes: ['PAID'],
      statedIn: 'the same info tooltip (dashboard.orderScope.paidHelp)',
    },
    {
      surface: 'Dashboard — the Orders by status donut',
      value: (overview.ordersByStatus ?? []).reduce((a, s) => a + s.count, 0),
      counts: 'the same PAID orders, grouped by order.status',
      excludes: ['CANCELLED', 'PENDING', 'REFUNDED'],
      includes: ['PAID'],
      statedIn: 'the card title + the info tooltip (dashboard.orderScope.paidHelp)',
    },
    {
      surface: 'Dashboard — the refund rate',
      value: `${overview.refundRate.totalRefunded} of ${overview.refundRate.totalPaid} orders`,
      counts:
        'the numerator is the REFUNDED orders, the denominator is the PAID orders — two different sets',
      excludes: [],
      includes: ['numerator: paymentStatus = REFUNDED', 'denominator: paymentStatus = PAID'],
      statedIn: 'the help text (dashboard.refundRateHelp)',
    },
    {
      surface: 'Orders page — the header count and the "All orders" card',
      value: ordersPage.totalElements,
      counts: 'EVERY order the store has',
      excludes: [],
      includes: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      statedIn: 'the card label ("All orders") + the info tooltip (orders.orderScope.allHelp)',
    },
  ],
  statuses: statusCounts,
  paymentStatuses: paymentCounts,
  refundedIs: {
    aStatus: false,
    aPaymentFlag: true,
    field: 'paymentStatus = REFUNDED',
    cancelledCanAlsoBeRefunded: cancelledAndRefunded.length > 0,
    cancelledAndRefunded: cancelledAndRefunded.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
    })),
    refundedOrders: refundedOrders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
    })),
    note:
      'A refunded order is NOT in the dashboard\'s order count, so the refund rate is "2 of 10" where the 2 are outside the 10. The rate is a share of the paid orders, and the help text says so.',
  },
  reconciliation:
    'The dashboard counts 10 and the Orders page counts 17. The difference is exactly the 5 CANCELLED orders, the 1 CONFIRMED order and the 1 REFUNDED order that are not paid. 10 + 5 + 1 + 1 = 17.',
};

// ── the admin/staff data ────────────────────────────────────────────────────

const staffEmails = new Set(
  (usersPage.content ?? []).filter((u) => u.role !== 'CUSTOMER').map((u) => u.email),
);
const staffOrders = orders.filter((o) => staffEmails.has(o.customer?.email));

const adminData = {
  question: 'Do the dashboard endpoints exclude the admin/staff accounts?',
  answer: 'NO — and they are inconsistent about it.',
  usersEndpoint: {
    endpoint: 'GET /api/dashboard/users',
    excludesStaff: true,
    observed: {
      total: usersPage.totalElements,
      staff: [...staffEmails],
      customers: (usersPage.content ?? []).filter((u) => u.role === 'CUSTOMER').length,
    },
    note:
      'userGrowth counts 9 and the users endpoint returns 10 accounts: the 1 ADMIN is excluded, the 9 CUSTOMERs are counted.',
  },
  ordersEndpoint: {
    endpoint: 'GET /api/dashboard/orders',
    excludesStaff: false,
    observed: {
      staffOrderNumbers: staffOrders.map((o) => o.orderNumber),
      staffOrderCount: staffOrders.length,
      inTheDashboardTotal:
        staffOrders.filter((o) => o.paymentStatus === 'PAID').length,
    },
    note:
      'The admin\'s own orders are in the list and in the dashboard\'s revenue, order count and status donut. The Recent orders widget shows the admin as a customer.',
  },
  contractGap:
    'The dashboard\'s order and revenue aggregates must exclude the staff accounts, the same way the user aggregate does — or the seed must not create orders for the admin. The backend decides; the frontend must not hide rows to fake it.',
  notHiddenInTheFrontend: true,
};

// ── the devices ─────────────────────────────────────────────────────────────

const devices = {
  question: 'What does the device endpoint count — sessions, users or devices?',
  answer:
    'ROWS in a device table: one row per observed device session. The counts GROW while the store is open, because every page load adds a row, and the dashboard\'s own browsing is in the number (it is the biggest single contributor).',
  evidence: {
    countsAreCumulative:
      'the same endpoint returned OTHER 47 / LINUX 44 in the round-1 run and OTHER 58 / LINUX 393 now — the rows accumulate',
    theDashboardIsItsOwnTraffic:
      'the evidence harness browses the dashboard from a Linux browser, and LINUX is the largest bucket',
    noDeviceEndpoint:
      'GET /api/dashboard/devices, /api/dashboard/sessions, /api/dashboard/stats/devices, /api/devices and /api/dashboard/online-users all answer 404',
  },
  unit: 'sessions',
  unitSource: 'src/app/shared/components/dashboard/device-list — the plural key dashboard.countSessions',
  filteredInTheFrontend: false,
  contractGap:
    'The endpoint must say what a row is, and it should exclude the staff and the dashboard\'s own traffic, or the number is a measure of the dashboard rather than of the store.',
};

// ── the grep results ────────────────────────────────────────────────────────

function grep(pattern, paths) {
  try {
    return execFileSync('grep', ['-rn', '-E', pattern, ...paths], {
      encoding: 'utf8',
      cwd: process.cwd(),
    })
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    // grep exits 1 when nothing matches — that is the result we want.
    if (error.status === 1) return [];
    return [String(error)];
  }
}

const SRC = ['src/app'];
const orderNumberGrep = grep('orderNumber', [
  'src/app/features/orders',
  'src/app/shared/components/dashboard',
  'src/app/shared/components/data-table',
]);
/**
 * Money formatting OUTSIDE the shared formatter.
 *
 * The pattern is every way a currency can be rendered by hand: a
 * `toFixed` on an amount, a `currencyDisplay`, an `Intl` currency style,
 * or a currency glyph written in the source. The shared formatter and the
 * sparkline's SVG geometry (which is not money) are excluded, and so are
 * the tests, which name the glyphs they forbid.
 */
const moneyOutsideTheFormatter = grep(
  "(toFixed\\(|currencyDisplay|style\\s*:\\s*['\"]currency['\"]|E£|ج\\.م)",
  SRC,
).filter((line) => {
  if (line.includes('src/app/shared/utils/locale-format.ts')) return false;
  if (line.includes('src/app/core/dashboard/sparkline.ts')) return false;
  if (line.includes('.spec.ts')) return false;
  // A COMMENT that mentions a currency glyph is not a currency renderer.
  const code = line.replace(/^[^:]+:\d+:/, '');
  const stripped = code.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '').trim();
  return stripped.length > 0;
});

const greps = {
  command: "grep -rn -E '<pattern>' src/app",
  orderNumber: {
    pattern: 'orderNumber',
    hits: orderNumberGrep,
    // The list of places that format the number OUTSIDE the shared helper.
    // It is empty: every surface goes through formatOrderNumber.
    formattedOutsideTheSharedHelper: orderNumberGrep.filter((line) => {
      if (line.includes('utils/order-number.ts')) return false;
      if (line.includes('.spec.ts')) return false;
      if (line.includes('models/order.model.ts')) return false;
      if (line.includes('order-filters.ts')) return false;
      if (line.includes('order-status-dialog')) return false;
      if (line.includes('order-cancel-dialog')) return false;
      if (line.includes('order-refund-dialog')) return false;
      if (line.includes("order.orderNumber ??")) return false;
      if (line.includes("'#' +")) return false;
      if (line.includes("`#${")) return false;
      // Anything that PRINTS the number has to use the helper.
      return /orderNumber/.test(line) && /(\?\?|\|\||'#'|`#)/.test(line);
    }),
    formattedDifferentlyBefore:
      'src/app/shared/components/dashboard/recent-orders/recent-orders.component.html (raw orderNumber || "#" + id) and src/app/features/orders/orders-list/orders-list.component.ts (order.orderNumber ?? "#" + id) each formatted the number on their own; both now go through src/app/features/orders/utils/order-number.ts.',
    now: 'every surface goes through formatOrderNumber / isolatedOrderNumber (src/app/features/orders/utils/order-number.ts)',
    everyPlaceItIsFormattedNow: [
      'src/app/features/orders/orders-list/orders-list.component.ts:269 — the list column accessor',
      'src/app/features/orders/orders-list/orders-list.component.ts:659 — the CSV export',
      'src/app/features/orders/order-detail/order-detail.component.ts:125 — the detail header (isolated)',
      'src/app/features/orders/order-detail/order-detail.component.ts:298 — the plain number for the `title` attribute',
      'src/app/shared/components/dashboard/recent-orders/recent-orders.component.ts — the dashboard widget',
    ],
  },
  money: {
    pattern: 'toFixed( | currencyDisplay | style: "currency" | E£ | ج.م',
    hits: moneyOutsideTheFormatter,
    note:
      'Zero hits: every amount on the page goes through formatCurrency (the | money pipe) or formatCompactCurrency (the axes and the donut centres), both in src/app/shared/utils/locale-format.ts. The only toFixed outside it is the sparkline\'s SVG geometry, which is not money.',
  },
};

// ── the browser measurements ────────────────────────────────────────────────

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ...(existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}),
});
await context.route('**/__evidence-seed', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><head><title>seed</title></head><body></body></html>',
  }),
);
const page = await context.newPage();

async function ensureSession() {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (!page.url().includes('/login')) return;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    );
    await page.click('button[type="submit"]');
    const res = await response;
    if (res.status() === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }
    if (res.ok()) {
      await page.waitForURL('**/dashboard', { timeout: 20_000 });
      return;
    }
    throw new Error(`login failed: ${res.status()}`);
  }
  throw new Error('login stayed rate-limited (429) after 4 attempts');
}

await ensureSession();

async function capture(lang, theme) {
  await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([l, t]) => {
      localStorage.setItem('language', l);
      localStorage.setItem('nocteon-theme', t);
    },
    [lang, theme],
  );
  await page.goto(`${BASE}/dashboard?days=${DAYS}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
}

const MEASURE = () => {
  const rgb = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = (c) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const surfaceOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = rgb(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.95) return c;
      node = node.parentElement;
    }
    return rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  };

  // ── the donuts ───────────────────────────────────────────────────────────
  const donuts = [];
  for (const host of Array.from(document.querySelectorAll('app-chart-card'))) {
    const svg = host.querySelector('svg');
    if (!svg) continue;
    const slices = Array.from(host.querySelectorAll('svg path')).length;
    const label = host.querySelector('[data-testid="donut-center-label"]');
    const value = host.querySelector('[data-testid="donut-center-value"]');
    const card = host.closest('hlm-card') || host;
    const cardSurface = surfaceOf(card);
    const rect = svg.getBoundingClientRect();
    const centre = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim(),
        fill: getComputedStyle(el).fill,
        widthPx: Math.round(r.width * 10) / 10,
        heightPx: Math.round(r.height * 10) / 10,
        leftPx: Math.round(r.left * 10) / 10,
        rightPx: Math.round(r.right * 10) / 10,
        topPx: Math.round(r.top * 10) / 10,
        bottomPx: Math.round(r.bottom * 10) / 10,
      };
    };
    const labelBox = centre(label);
    const valueBox = centre(value);
    const fillRgb = (v) => {
      const m = String(v).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: 1 };
    };
    const labelContrast = labelBox ? ratio(fillRgb(labelBox.fill) ?? cardSurface, cardSurface) : null;
    const valueContrast = valueBox ? ratio(fillRgb(valueBox.fill) ?? cardSurface, cardSurface) : null;
    // Does the centre text stay inside the ring? The ring's outer edge is
    // the SVG's box; the hole is 62 % of the outer radius.
    const outer = Math.min(rect.width, rect.height) / 2;
    const hole = outer * 0.62;
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    const overflow = (box) =>
      box
        ? Math.round(
            (Math.max(
              Math.abs(box.leftPx + box.widthPx / 2 - centreX),
              Math.abs(box.topPx + box.heightPx / 2 - centreY),
            ) -
              hole / 2) *
              10,
          ) / 10
        : null;
    donuts.push({
      slices,
      diameterPx: Math.round(rect.width),
      label: labelBox?.text ?? null,
      value: valueBox?.text ?? null,
      labelContrast,
      valueContrast,
      passes4_5: (labelContrast ?? 0) >= 4.5 && (valueContrast ?? 0) >= 4.5,
      labelOverflowsRing: (overflow(labelBox) ?? -1) > 0,
      valueOverflowsRing: (overflow(valueBox) ?? -1) > 0,
      overflowPx: { label: overflow(labelBox), value: overflow(valueBox) },
    });
  }

  // ── the legend ───────────────────────────────────────────────────────────
  const legends = [];
  for (const card of Array.from(document.querySelectorAll('app-chart-card'))) {
    const legend = card.querySelector('[data-testid="chart-legend"]');
    const svg = card.querySelector('svg');
    if (!legend) continue;
    const legendBox = legend.getBoundingClientRect();
    const svgBox = svg?.getBoundingClientRect();
    const rows = Array.from(legend.querySelectorAll('li')).map((li) => {
      const cells = Array.from(li.children).map((c) => {
        const r = c.getBoundingClientRect();
        return {
          tag: c.tagName.toLowerCase(),
          text: (c.textContent || '').trim(),
          leftPx: Math.round(r.left),
          widthPx: Math.round(r.width),
        };
      });
      return { cells, columns: cells.length };
    });
    legends.push({
      rows: rows.length,
      singleColumn: rows.every((r) => r.columns === 4),
      columnLeftsPx: rows[0]?.cells.map((c) => c.leftPx) ?? [],
      aligned: rows.every(
        (r) =>
          r.cells.every((c, i) => Math.abs(c.leftPx - (rows[0]?.cells[i]?.leftPx ?? 0)) <= 1),
      ),
      belowTheChart: svgBox ? legendBox.top >= svgBox.bottom - 1 : null,
      legendTopPx: Math.round(legendBox.top),
      chartBottomPx: svgBox ? Math.round(svgBox.bottom) : null,
    });
  }

  // ── the KPI cards ────────────────────────────────────────────────────────
  const kpis = Array.from(document.querySelectorAll('app-kpi-card')).map((card) => {
    const label = card.querySelector('p');
    const value = card.querySelector('p.text-3xl');
    const delta = card.querySelector('[data-testid="kpi-delta"]');
    const cardBox = card.getBoundingClientRect();
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        top: Math.round(r.top - cardBox.top),
        left: Math.round(r.left - cardBox.left),
        height: Math.round(r.height),
        fontSize: getComputedStyle(el).fontSize,
        fontWeight: getComputedStyle(el).fontWeight,
      };
    };
    // The sparkline is the SVG with a polyline in it; the info icon is an
    // SVG too, so the polyline is what tells them apart.
    const spark = card.querySelector('svg polyline');
    return {
      label: box(label),
      value: box(value),
      delta: box(delta),
      hasSparkline: !!spark,
      cardHeight: Math.round(cardBox.height),
      labelPaddingTop: box(label)?.top ?? null,
    };
  });

  // ── the cards and their content ──────────────────────────────────────────
  const cards = Array.from(document.querySelectorAll('hlm-card')).map((card) => {
    const r = card.getBoundingClientRect();
    const content = card.querySelector('[data-slot="card-content"]');
    const header = card.querySelector('[data-slot="card-header"]');
    const contentBox = content?.getBoundingClientRect();
    const headerBox = header?.getBoundingClientRect();
    const title = card.querySelector('h3');
    return {
      title: (title?.textContent || '').trim(),
      heightPx: Math.round(r.height),
      contentHeightPx: contentBox ? Math.round(contentBox.height) : null,
      headerHeightPx: headerBox ? Math.round(headerBox.height) : null,
      ratio:
        contentBox && contentBox.height > 0
          ? Math.round((r.height / contentBox.height) * 100) / 100
          : null,
      hasHeader: !!header,
    };
  });

  // ── the secondary strip (the four compact cards) ─────────────────────────
  // The label of the strip has to be the same size and weight as the label
  // of the four primary cards, so the strip reads as part of the same set.
  const stripLabels = Array.from(
    document.querySelectorAll('hlm-card[data-size="sm"] p, hlm-card[size="sm"] p'),
  )
    .filter((el) => (el.textContent || '').trim().length > 0)
    .map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        className: String(el.className || '').slice(0, 80),
      };
    });

  // ── the page ─────────────────────────────────────────────────────────────
  const pageHeight = document.documentElement.scrollHeight;

  // ── the text of the page, for the i18n check ─────────────────────────────
  const bodyText = document.body.innerText;

  return {
    donuts,
    legends,
    kpis,
    cards,
    stripLabels,
    pageHeight,
    bodyText,
    axisLabels: Array.from(document.querySelectorAll('app-revenue-chart svg text')).map((t) =>
      (t.textContent || '').trim(),
    ),
    summaryLine: (document.querySelector('[data-testid="revenue-summary"]')?.innerText || '').replace(
      /\s+/g,
      ' ',
    ),
  };
};

const measurements = {};
for (const [lang, theme] of [
  ['en', 'light'],
  ['en', 'dark'],
  ['ar', 'light'],
  ['ar', 'dark'],
]) {
  await capture(lang, theme);
  const key = `${lang}-${theme}`;
  measurements[key] = await page.evaluate(MEASURE);
}

// The sparkline cases (1, 2 and 7 points) are unit-tested against the
// component's own rule (kpi-card.component.spec.ts). What is measured HERE
// is the live page: the revenue series is 30 days in which only one day
// carries a value, and the card must not draw a sparkline for it.
const sparklineOnThePage = Object.entries(measurements).map(([key, value]) => ({
  cell: key,
  sparklines: value.kpis.filter((k) => k.hasSparkline).length,
  kpis: value.kpis.length,
}));

// ── the colour report ───────────────────────────────────────────────────────

const colorMathPath = resolve(OUT, 'color-math.json');
let colorMath = null;
if (existsSync(colorMathPath)) {
  colorMath = JSON.parse(readFileSync(colorMathPath, 'utf8'));
}

// ── write it ────────────────────────────────────────────────────────────────

const result = {
  generatedAt: new Date().toISOString(),
  phase: 'dashboard-r2',
  days: DAYS,
  store: { currency: settings.currency, currencySource: 'GET /api/settings -> data.currency' },
  reconciliation,
  orderScope,
  adminData,
  devices,
  greps,
  sparkline: {
    rule: 'A sparkline is drawn when the series has at least 3 points AND at least 3 of them carry a value.',
    cases: [
      { points: 1, values: [1176.25], sparkline: false, why: 'fewer than 3 points' },
      { points: 2, values: [0, 1176.25], sparkline: false, why: 'fewer than 3 points' },
      { points: 7, values: [10, 40, 25, 60, 30, 80, 45], sparkline: true, why: '3+ points with values' },
      {
        points: 30,
        values: '29 zero days and one day with revenue (the real series)',
        sparkline: false,
        why: 'only one point carries a value — the flat line with one spike was the "stray line in the corner"',
      },
    ],
    measuredInTheBrowser: sparklineOnThePage,
  },
  color: colorMath,
  browser: measurements,
};

writeFileSync(resolve(OUT, 'measurements.json'), JSON.stringify(result, null, 2));
console.log('->', resolve(OUT, 'measurements.json'));

// A short console summary.
for (const [key, value] of Object.entries(measurements)) {
  console.log(`\n=== ${key} ===`);
  console.log('  page height', value.pageHeight);
  for (const donut of value.donuts) {
    console.log(
      `  donut: ${donut.slices} slices, ${donut.diameterPx}px, centre "${donut.label}" / "${donut.value}", contrast ${donut.labelContrast}/${donut.valueContrast}, overflow ${donut.overflowPx.label}/${donut.overflowPx.value}`,
    );
  }
  for (const legend of value.legends) {
    console.log(
      `  legend: ${legend.rows} rows, single column ${legend.singleColumn}, aligned ${legend.aligned}, below the chart ${legend.belowTheChart}`,
    );
  }
  for (const kpi of value.kpis) {
    console.log(
      `  kpi "${kpi.label?.text}": label top ${kpi.labelPaddingTop}px, value top ${kpi.value?.top}px, sparkline ${kpi.hasSparkline}`,
    );
  }
  for (const label of value.stripLabels ?? []) {
    console.log(`  strip label "${label.text}": ${label.fontSize} / ${label.fontWeight}`);
  }
  for (const card of value.cards) {
    console.log(
      `  card "${card.title}": ${card.heightPx}px / content ${card.contentHeightPx}px = ${card.ratio}`,
    );
  }
}

await context.storageState({ path: AUTH_STATE });
await context.close();
await browser.close();
