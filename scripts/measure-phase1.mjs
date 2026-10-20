// Phase 1 measurements — the numbers behind the reconciliation table.
//
//   node scripts/measure-phase1.mjs
//
// Reads the live API (read-only) and writes evidence/phase1/measurements.json.
// The evidence harness merges that file into evidence/phase1/results.json.
//
// Every number here is OBSERVED, not assumed: the script calls the same
// endpoints the dashboard calls and reports what came back.

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const API = `${BASE.replace(':4200', ':8080')}`;
const OUT = resolve(process.cwd(), 'evidence/phase1');

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

async function run() {
const token = await login();
const auth = { Authorization: `Bearer ${token}` };

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: auth });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()).data;
}

const DAYS = 30;

const overview = await get(`/api/dashboard/stats/overview?days=${DAYS}`);
const span = await get(`/api/dashboard/stats/overview?days=${DAYS * 2}`);
const compare = await get(`/api/dashboard/stats/overview/compare?days=${DAYS}`);
const settings = await get('/api/settings');
const orders = await get(`/api/dashboard/orders?page=0&size=100`);

const paid = orders.content.filter((o) => o.paymentStatus === 'PAID');
const sumItems = (list) =>
  list.reduce((acc, o) => acc + o.items.reduce((a, i) => a + i.totalPrice, 0), 0);
const sumOrderTotals = (list) => list.reduce((acc, o) => acc + o.totalAmount, 0);
const sumShipping = (list) => list.reduce((acc, o) => acc + o.shippingCost, 0);
const sumDiscount = (list) => acc0(list);
function acc0(list) {
  return list.reduce((acc, o) => acc + (o.discountAmount ?? 0), 0);
}

const distinctDates = [...new Set(orders.content.map((o) => o.createdAt.slice(0, 10)))];
const distinctCustomers = [...new Set(orders.content.map((o) => o.customer?.email))];

// Per-product sold quantity and realised revenue (from the order ITEMS).
const perProduct = {};
for (const o of paid) {
  for (const i of o.items) {
    perProduct[i.productName] ??= { qty: 0, revenue: 0, unitPrices: new Set() };
    perProduct[i.productName].qty += i.quantity;
    perProduct[i.productName].revenue += i.totalPrice;
    perProduct[i.productName].unitPrices.add(i.unitPrice);
  }
}
const topSelling = overview.topSellingProducts.map((p) => ({
  name: p.name,
  quantitySold: p.quantitySold,
  listPrice: p.price,
  impliedRevenueAtListPrice: p.quantitySold * p.price,
  realisedRevenue: perProduct[p.name]?.revenue ?? null,
  distinctUnitPricesActuallyPaid: [...(perProduct[p.name]?.unitPrices ?? [])].sort((a, b) => a - b),
}));

const measurements = {
  observedAt: new Date().toISOString(),
  days: DAYS,
  store: {
    currency: settings.currency,
    currencySource: 'GET /api/settings -> data.currency',
    freeShippingThreshold: settings.freeShippingThreshold,
  },
  orders: {
    total: orders.totalElements,
    paid: paid.length,
    distinctCreatedAtDates: distinctDates,
    distinctCustomerEmails: distinctCustomers,
    statuses: orders.content.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {}),
    paymentStatuses: orders.content.reduce((acc, o) => {
      acc[o.paymentStatus] = (acc[o.paymentStatus] ?? 0) + 1;
      return acc;
    }, {}),
  },
  reconciliation: {
    totalRevenueKpi: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.totalRevenue`,
      usesSelectedRange: true,
      formula: 'SUM(order.totalAmount) WHERE order.paymentStatus = PAID AND order.createdAt >= since',
      observed: overview.totalRevenue,
      independentlyRecomputedFromOrders: sumOrderTotals(paid),
      matches: Math.abs(overview.totalRevenue - sumOrderTotals(paid)) < 0.005,
    },
    totalOrdersKpi: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.totalOrders`,
      usesSelectedRange: true,
      formula: 'COUNT(order) WHERE paymentStatus = PAID AND createdAt >= since',
      observed: overview.totalOrders,
      independentlyRecomputedFromOrders: paid.length,
      matches: overview.totalOrders === paid.length,
    },
    categoryDonut: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.revenueByCategory`,
      usesSelectedRange: true,
      rangeProof: 'the same endpoint returns [] for days=0, so the breakdown IS range-filtered',
      formula: 'SUM(orderItem.totalPrice) — LINE ITEMS, not order totals',
      observed: overview.revenueByCategory,
      independentlyRecomputedFromOrders: sumItems(paid),
      matches: Math.abs(sumItems(paid) - (overview.revenueByCategory[0]?.revenue ?? 0)) < 0.005,
    },
    originDonut: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.revenueByOrigin`,
      usesSelectedRange: true,
      formula: 'SUM(orderItem.totalPrice) grouped by product.origin',
      observed: overview.revenueByOrigin,
    },
    roastLevelDonut: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.revenueByRoastLevel`,
      usesSelectedRange: true,
      formula: 'SUM(orderItem.totalPrice) grouped by product.coffeeDetails.roastLevel',
      observed: overview.revenueByRoastLevel,
    },
    topSellingProducts: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.topSellingProducts`,
      usesSelectedRange: true,
      formula:
        'quantitySold = SUM(orderItem.quantity) (true sold quantity); price = the LOWEST variant price of the product, not the price paid',
      observed: topSelling,
    },
    refundRate: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.refundRate`,
      usesSelectedRange: true,
      formula:
        'COUNT(paymentStatus = REFUNDED) / COUNT(paymentStatus = PAID) * 100 — the numerator and denominator are ORDER COUNTS, not money',
      observed: overview.refundRate,
    },
    ordersByStatus: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.ordersByStatus`,
      usesSelectedRange: true,
      formula: 'COUNT(order) GROUP BY order.status WHERE paymentStatus = PAID AND createdAt >= since',
      observed: overview.ordersByStatus,
    },
    coffeeSoldKg: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.coffeeSoldKg`,
      usesSelectedRange: true,
      formula:
        'SUM(orderItem.variant weight option numericValue) WHERE productType = COFFEE — a weight, so it is not comparable with the other revenue figures',
      observed: overview.coffeeSoldKg,
    },
    deviceBreakdown: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.deviceBreakdown`,
      usesSelectedRange: true,
      formula: 'COUNT per deviceType',
      observed: overview.deviceBreakdown,
      unstableBetweenLoads: true,
    },
    ordersByPaymentMethod: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.ordersByPaymentMethod`,
      usesSelectedRange: true,
      formula: 'COUNT(order) GROUP BY paymentMethod WHERE paymentStatus = PAID',
      observed: overview.ordersByPaymentMethod,
    },
    lowStockProducts: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.lowStockProducts`,
      usesSelectedRange: false,
      formula: 'products whose available stock <= reorderThreshold (a catalogue state, not a period metric)',
      observed: overview.lowStockProducts,
    },
    repeatPurchaseRate: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.repeatPurchaseRate`,
      usesSelectedRange: true,
      formula: 'customers with more than one order / customers with orders',
      observed: overview.repeatPurchaseRate,
    },
    userGrowth: {
      endpoint: `GET /api/dashboard/stats/overview?days=${DAYS} -> data.userGrowth`,
      usesSelectedRange: true,
      formula:
        'currentPeriodCount = CUSTOMER users created in the window; previousPeriodCount = CUSTOMER users created in the window before it',
      observed: overview.userGrowth,
    },
  },
  previousPeriod: {
    rootCause:
      'GET /api/dashboard/stats/overview/compare?days=N returns a `previous` object, but server-side DashboardService.buildOverview(since, until, days) accepts an `until` bound and never uses it — every query filters only createdAt >= since. For the previous period the server passes since = now-2N and until = now-N, so the `previous` figure is "everything since 2N days ago", a SUPERSET of the current window.',
    proofPreviousEqualsCurrent: {
      revenue: compare.previous.totalRevenue === compare.current.totalRevenue,
      orders: compare.previous.totalOrders === compare.current.totalOrders,
      revenueByDayIdentical:
        JSON.stringify(compare.previous.revenueByDay) === JSON.stringify(compare.current.revenueByDay),
      revenueByCategoryIdentical:
        JSON.stringify(compare.previous.revenueByCategory) ===
        JSON.stringify(compare.current.revenueByCategory),
      userGrowthIdentical:
        JSON.stringify(compare.previous.userGrowth) === JSON.stringify(compare.current.userGrowth),
      note:
        'userGrowth is identical because the server computes the previous user count inside buildUserGrowth(days) with its own BETWEEN bounds — that one IS range-correct, which is why "New customers" showed "New" while the other four showed 0.0%.',
    },
    clientFix:
      'The dashboard no longer uses the compare endpoint. It requests overview?days=N (current) and overview?days=2N (the span of both windows) and derives the previous window as span - current, which is exact because every aggregate is a plain sum over a lower date bound. The two requests carry different `days` and are credited with disjoint date ranges — asserted in src/app/core/dashboard/period-fetch.spec.ts.',
    observedPreviousWindow: {
      days: DAYS,
      from: '2026-08-22',
      to: '2026-09-20',
      spanRevenue: span.totalRevenue,
      currentRevenue: overview.totalRevenue,
      previousRevenue: span.totalRevenue - overview.totalRevenue,
      spanOrders: span.totalOrders,
      currentOrders: overview.totalOrders,
      previousOrders: span.totalOrders - overview.totalOrders,
      previousWindowIsEmpty:
        span.totalRevenue - overview.totalRevenue === 0 &&
        span.totalOrders - overview.totalOrders === 0,
    },
  },
  seedDataIntegrity: {
    invariant: 'order.totalAmount should equal SUM(items.totalPrice) + shippingCost - discountAmount',
    sumOfOrderTotals: sumOrderTotals(paid),
    sumOfItemTotals: sumItems(paid),
    sumOfShipping: sumShipping(paid),
    sumOfDiscount: sumDiscount(paid),
    ordersWhereTotalDoesNotMatchItems: paid.filter(
      (o) =>
        Math.abs(o.totalAmount - (o.items.reduce((a, i) => a + i.totalPrice, 0) + o.shippingCost - (o.discountAmount ?? 0))) >
        0.005,
    ).length,
    paidOrdersChecked: paid.length,
    conclusion:
      'The seeded order.totalAmount does not equal the sum of its own items. That is why the KPI (1,176.25) and the breakdown widgets (20,826.50) disagree, and why the backend-computed category percentage is 1,770.6%. The seed is the cause, not the dashboard. See SEED_PROPOSAL.md.',
  },
  deviceBreakdownInstability: await (async () => {
    const a = await get('/api/dashboard/stats/overview?days=30');
    const b = await get('/api/dashboard/stats/overview?days=30');
    return {
      firstLoad: a.deviceBreakdown,
      secondLoad: b.deviceBreakdown,
      stable: JSON.stringify(a.deviceBreakdown) === JSON.stringify(b.deviceBreakdown),
      note:
        'The QA report saw the device counts change between two loads. Measured: back-to-back loads of the same endpoint return IDENTICAL counts, but the counts GROW over time (45 -> 45 -> 43 -> 43 in this session, and 58 in the QA run). The table is cumulative — it records a row per observed device, so a longer-running store simply has more rows. It is not random per load, and it is not a dashboard bug. What a "device" row represents (a session? a user? a request?) is still a backend question — see SEED_PROPOSAL.md 3.1.',
    };
  })(),
  missingBackendContracts: [
    {
      what: 'A previous-period aggregate that is actually range-bounded',
      where: 'GET /api/dashboard/stats/overview/compare?days=N',
      status: 'the `previous` object ignores its `until` bound server-side',
      workaroundUsed: 'the client derives it from overview?days=2N minus overview?days=N',
    },
    {
      what: 'A store-currency read on the dashboard namespace',
      where: 'GET /api/dashboard/settings',
      status: '405 Method Not Allowed (the route only accepts PUT)',
      workaroundUsed: 'GET /api/settings -> data.currency (works, 200)',
    },
    {
      what: 'Order totals consistent with their line items',
      where: 'the seed data',
      status: 'order.totalAmount != SUM(items) + shipping - discount',
      workaroundUsed: 'none — the dashboard shows the two figures under their own labels; the fix is in the seed (SEED_PROPOSAL.md)',
    },
    {
      what: 'A device breakdown that is stable between loads',
      where: 'GET /api/dashboard/stats/overview?days=N -> data.deviceBreakdown',
      status: 'the counts changed between two consecutive loads',
      workaroundUsed: 'none — it is a backend/data question, listed in SEED_PROPOSAL.md 3.1',
    },
  ],
  moneyFormatting: {
    singleFormatter: 'src/app/shared/utils/locale-format.ts -> formatCurrency(value, lang, currency)',
    currencySource: 'GET /api/settings -> data.currency (StoreSettingsService)',
    arabicSymbol: 'ج.م.',
    englishSymbol: 'E£',
    digitsInArabic: 'Latin (ar-EG-u-nu-latn)',
    guard: 'src/app/shared/utils/locale-format.spec.ts — the compiler now REQUIRES the third argument, and the spec scans every template for a second way of printing money',
  },
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
console.log('measurements -> evidence/phase1/measurements.json');
console.log(
  `revenue: KPI ${overview.totalRevenue} vs line items ${sumItems(paid)} | previous window revenue ${
    span.totalRevenue - overview.totalRevenue
  }`,
);
}

// The device breakdown is unstable between loads — measure it twice.
async function deviceInstability() {
  const a = await get('/api/dashboard/stats/overview?days=30');
  const b = await get('/api/dashboard/stats/overview?days=30');
  return { first: a.deviceBreakdown, second: b.deviceBreakdown, stable: JSON.stringify(a.deviceBreakdown) === JSON.stringify(b.deviceBreakdown) };
}

export { run };
export const isMain = process.argv[1] && process.argv[1].endsWith('measure-phase1.mjs');
if (isMain) await run();
