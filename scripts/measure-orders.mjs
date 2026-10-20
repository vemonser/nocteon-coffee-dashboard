// Orders API audit — the numeric ground truth behind Phases 1.1 - 1.4.
//
//   npm run evidence -- orders      -> runs this at the end of the capture
//
// The backend is the single source of truth for totals, so the audit reads
// the API directly instead of inferring numbers from the DOM. It answers:
//
//   1.1  Do the stored totals agree with their own items? Where is the
//        total computed (creation vs read), and what is the root cause of
//        the mismatch?
//   1.2  What does each KPI card actually show, which endpoint feeds it,
//        and does it follow the active filters?
//   1.3  What is the order-status enum, the payment-status enum, the
//        payment methods, the allowed transitions, and is "Refunded" a
//        status or a flag?
//   1.4  How many orders have no items, and WHY (no data / not in the API /
//        no image)?
//
// Writes evidence/orders/measurements.json, which the evidence harness
// merges into results.json under "measurements".

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const API = process.env.E2E_API_URL ?? 'http://localhost:8080';
const OUT = resolve(process.cwd(), 'evidence', 'orders');

const money = (n) => Math.round(Number(n ?? 0) * 100) / 100;

/**
 * One login for the whole audit. The backend rate-limits
 * POST /api/auth/login (5/min per identifier), so the audit authenticates
 * exactly once and reuses the token.
 */
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
  const token = body?.data?.accessToken;
  if (!token) throw new Error('login response carried no accessToken');
  return token;
}

async function api(token, path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  const body = await res.json();
  return body?.data;
}

/**
 * The backend facts this audit is checked against. They are read from the
 * backend source, and the paths are recorded so the claim can be re-checked
 * rather than trusted.
 */
const BACKEND_SOURCE = {
  repo: 'nocteon-backend (sibling repository)',
  orderStatusEnum: {
    file: 'src/main/java/com/nocteon/nocteon_api/order/enums/OrderStatus.java',
    values: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  },
  paymentStatusEnum: {
    file: 'src/main/java/com/nocteon/nocteon_api/payment/enums/PaymentStatus.java',
    values: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
  },
  paymentMethodEnum: {
    file: 'src/main/java/com/nocteon/nocteon_api/payment/enums/PaymentMethod.java',
    values: ['ONLINE', 'CASH_ON_DELIVERY'],
  },
  strictTransitions: {
    file: 'src/main/java/com/nocteon/nocteon_api/order/service/OrderStatusService.java',
    note: 'OrderStatusService.ALLOWED_TRANSITIONS — but NO controller calls this service; it is only referenced by its own unit test.',
    map: {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    },
  },
  endpointTransitions: {
    file: 'src/main/java/com/nocteon/nocteon_api/order/service/OrderService.java (updateStatus) + controller OrderController PUT /api/dashboard/orders/{id}/status',
    note: 'The endpoint the dashboard calls only refuses a change when the CURRENT status is DELIVERED or CANCELLED. Every other pair is accepted, so PENDING -> DELIVERED is allowed.',
    map: {
      PENDING: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      CONFIRMED: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      PROCESSING: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      SHIPPED: ['PENDING', 'CONFIRMED', 'PROCESSING', 'DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    },
  },
  totalsAtCreation: {
    file: 'src/main/java/com/nocteon/nocteon_api/order/service/OrderService.java (createOrder)',
    formula: 'totalAmount = (sum(variant.price * cartItem.quantity) - discountAmount) + shippingCost',
    note: 'Computed at CREATION and stored in orders.total_amount. The read path (OrderQueryService.buildResponse) returns the stored column unchanged.',
  },
  seedData: {
    file: 'src/main/resources/db/migration/V107__seed_orders_reviews_contacts.sql',
    note: 'The seed INSERTs orders.total_amount by hand, independently of the order_items rows it inserts later in the same file.',
  },
  missingBackendCapabilities: {
    tax: 'No tax column, field or calculation anywhere in the backend (grep for "tax" over src/main/java returns nothing).',
    refundAmount: 'PaymentStatus.REFUNDED is a flag with no amount. There is no refund entity, no refund amount, no refund endpoint and no gateway refund call (PaymentService only notes that a manual refund may be needed).',
    orderStatusHistory: 'No order_status_history table, entity, repository or endpoint.',
    orderNotes: 'No internal-notes entity or endpoint. orders.notes is a single customer-facing TEXT column.',
    shipment: 'No shipment entity: no carrier, tracking number, tracking URL, shipped_at or delivered_at.',
    orderStats: 'No GET /api/dashboard/orders/stats (counts grouped by status). The dashboard overview carries ordersByStatus, but it is bounded by the dashboard\'s date window and ignores the list\'s filters.',
    resendOrderEmail: 'Order e-mail is sent on order placed and on order shipped, but there is no endpoint to re-send it on demand.',
    transactionReference: 'No payment transaction reference, paid_at or per-order refund list is exposed on OrderResponse.',
  },
};

async function run() {
  const token = await login();

  // The backend caps `size` at 100 (BaseFilterRequest: @Max(100)), so the audit
  // pages through the list instead of asking for everything at once.
  const SIZE = 100;
  const first = await api(token, `/api/dashboard/orders?page=0&size=${SIZE}`);
  const totalPages = first?.totalPages ?? 1;
  const content = [...(first?.content ?? [])];
  for (let p = 1; p < totalPages; p += 1) {
    const next = await api(token, `/api/dashboard/orders?page=${p}&size=${SIZE}`);
    content.push(...(next?.content ?? []));
  }
  const page = { ...first, content, totalPages };

  const settings = await api(token, '/api/settings');
  const overview = await api(token, '/api/dashboard/stats/overview?days=30');
  const overview90 = await api(token, '/api/dashboard/stats/overview?days=90');

  // ── 1.1 totals ────────────────────────────────────────────────────────────
  const perOrder = content.map((o) => {
    const items = o.items ?? [];
    const itemsSubtotal = money(items.reduce((a, i) => a + Number(i.totalPrice ?? 0), 0));
    const itemsRecomputed = money(
      items.reduce((a, i) => a + Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0), 0),
    );
    const shipping = money(o.shippingCost);
    const discount = money(o.discountAmount);
    const expected = money(itemsSubtotal - discount + shipping);
    const stored = money(o.totalAmount);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      itemCount: items.length,
      itemsSubtotal,
      itemsRecomputed,
      lineTotalsAgree: money(itemsSubtotal - itemsRecomputed) === 0,
      shipping,
      discount,
      expectedTotal: expected,
      storedTotal: stored,
      delta: money(stored - expected),
      consistent: money(stored - expected) === 0,
      netPaidKnown: o.paymentStatus !== 'REFUNDED',
    };
  });

  const mismatched = perOrder.filter((o) => !o.consistent);
  const lineTotalsDisagree = perOrder.filter((o) => !o.lineTotalsAgree);

  const totals = {
    currency: settings?.currency ?? null,
    ordersAudited: perOrder.length,
    apiTotalElements: page?.totalElements ?? null,
    consistent: perOrder.length - mismatched.length,
    inconsistent: mismatched.length,
    affectedOrders: mismatched.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      itemsSubtotal: o.itemsSubtotal,
      shipping: o.shipping,
      discount: o.discount,
      expectedTotal: o.expectedTotal,
      storedTotal: o.storedTotal,
      delta: o.delta,
    })),
    itemLineTotalsDisagree: lineTotalsDisagree.map((o) => o.orderNumber),
    taxFieldPresent: false,
    refundsWithAmountPresent: false,
    note:
      'The backend stores orders.total_amount and returns it verbatim. The seed migration writes that column by hand, so the stored total and the order_items rows of the same order can disagree. The runtime formula (OrderService.createOrder) is correct.',
  };

  // ── 1.2 KPI cards vs the table ────────────────────────────────────────────
  const byStatus = {};
  for (const o of content) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  const byPaymentStatus = {};
  for (const o of content) byPaymentStatus[o.paymentStatus] = (byPaymentStatus[o.paymentStatus] ?? 0) + 1;
  const byMethod = {};
  for (const o of content) byMethod[o.paymentMethod] = (byMethod[o.paymentMethod] ?? 0) + 1;

  const chart30 = overview?.ordersByStatus ?? [];
  const chart90 = overview90?.ordersByStatus ?? [];

  const kpi = {
    sourceOfTruth: 'GET /api/dashboard/orders (the list itself) vs GET /api/dashboard/stats/overview (the dashboard)',
    listHeaderCount: {
      endpoint: 'GET /api/dashboard/orders?page=0&size=N',
      value: page?.totalElements ?? null,
      formula: 'ApiResponse<PageResponse<OrderResponse>>.totalElements — the backend count of orders matching the filter (none applied here)',
      followsFilters: true,
    },
    cards: [
      {
        card: 'Total orders',
        endpoint: 'GET /api/dashboard/stats/overview?days=30',
        field: 'ordersByStatus (sum of counts)',
        formula: 'sum(overview.ordersByStatus[].count)',
        observed: chart30.reduce((a, s) => a + (s.count ?? 0), 0),
        observedAt90Days: chart90.reduce((a, s) => a + (s.count ?? 0), 0),
        actualAllOrders: content.length,
        followsListFilters: false,
        note: 'The card counts the DASHBOARD window, not the orders list. It is not a count of "all orders" either — it is a count of the last 30 days.',
      },
      {
        card: 'Pending',
        endpoint: 'GET /api/dashboard/stats/overview?days=30',
        field: 'ordersByStatus',
        formula: 'PENDING + CONFIRMED + PROCESSING',
        observed:
          (chart30.find((s) => s.status === 'PENDING')?.count ?? 0) +
          (chart30.find((s) => s.status === 'CONFIRMED')?.count ?? 0) +
          (chart30.find((s) => s.status === 'PROCESSING')?.count ?? 0),
        actualAllOrders:
          (byStatus.PENDING ?? 0) + (byStatus.CONFIRMED ?? 0) + (byStatus.PROCESSING ?? 0),
        followsListFilters: false,
      },
      {
        card: 'Completed',
        endpoint: 'GET /api/dashboard/stats/overview?days=30',
        field: 'ordersByStatus',
        formula: 'DELIVERED + SHIPPED',
        observed:
          (chart30.find((s) => s.status === 'DELIVERED')?.count ?? 0) +
          (chart30.find((s) => s.status === 'SHIPPED')?.count ?? 0),
        actualAllOrders: (byStatus.DELIVERED ?? 0) + (byStatus.SHIPPED ?? 0),
        followsListFilters: false,
      },
      {
        card: 'Cancelled',
        endpoint: 'GET /api/dashboard/stats/overview?days=30',
        field: 'ordersByStatus',
        formula: 'CANCELLED',
        observed: chart30.find((s) => s.status === 'CANCELLED')?.count ?? 0,
        actualAllOrders: byStatus.CANCELLED ?? 0,
        followsListFilters: false,
        note: 'The card reads the dashboard window; the table reads the list. That is why the card said 0 while rows said "Cancelled".',
      },
    ],
    requiredContract: {
      method: 'GET',
      path: '/api/dashboard/orders/stats',
      query: 'the same filters the list uses (status, paymentStatus, paymentMethod, dateFrom, dateTo, search)',
      responseShape: {
        success: 'boolean',
        message: 'string',
        data: {
          total: 'number',
          byStatus: 'Array<{ status: string, count: number }>',
          byPaymentStatus: 'Array<{ paymentStatus: string, count: number }>',
          byPaymentMethod: 'Array<{ paymentMethod: string, count: number }>',
        },
      },
      note: 'Does not exist. Without it a card that follows the list filters can only be built by paging the whole list, which is wrong for a large store.',
    },
  };

  // ── 1.3 status model ──────────────────────────────────────────────────────
  const statusModel = {
    orderStatus: {
      enumSource: BACKEND_SOURCE.orderStatusEnum,
      observedInOrders: Object.keys(byStatus).sort(),
      counts: byStatus,
    },
    paymentStatus: {
      enumSource: BACKEND_SOURCE.paymentStatusEnum,
      observedInOrders: Object.keys(byPaymentStatus).sort(),
      counts: byPaymentStatus,
    },
    paymentMethod: {
      enumSource: BACKEND_SOURCE.paymentMethodEnum,
      observedInOrders: Object.keys(byMethod).sort(),
      counts: byMethod,
    },
    refundedIs: {
      answer: 'a PAYMENT STATUS (a flag), not an order status',
      evidence: 'PaymentStatus.REFUNDED; OrderStatus has no REFUNDED value. The order status of a refunded order is whatever the fulfilment reached (the seed uses DELIVERED + payment_status REFUNDED, and CANCELLED + payment_status REFUNDED).',
    },
    transitions: {
      strict: BACKEND_SOURCE.strictTransitions,
      actuallyEnforcedByTheEndpoint: BACKEND_SOURCE.endpointTransitions,
      mismatch: 'The strict map lives in OrderStatusService, which no controller calls. The dashboard endpoint (PUT /api/dashboard/orders/{id}/status -> OrderService.updateStatus) refuses only DELIVERED and CANCELLED as the CURRENT status, so PENDING -> DELIVERED is accepted. The UI must therefore enforce the strict map itself, and the backend should be fixed to use the strict map.',
    },
    chartSet: {
      endpoint: 'GET /api/dashboard/stats/overview?days=30',
      statuses: chart30.map((s) => s.status),
      matchesOrderStatusEnum:
        chart30.map((s) => s.status).sort().join(',') ===
        BACKEND_SOURCE.orderStatusEnum.values.slice().sort().join(','),
      note: 'The chart reports only the statuses that occur in the window, so a status with a count of 0 is simply absent.',
    },
    orderNumberFormat: {
      backendFormat: 'ORD-YYYY-NNNNNN (OrderService.generateOrderNumber, e.g. ORD-2026-000001)',
      observed: content.slice(0, 3).map((o) => o.orderNumber),
      note: 'The ticket asked for an "ORD-0001" style. The backend already owns the number; the UI displays what the backend gives and never re-formats it.',
    },
  };

  // ── 1.4 orders without items ──────────────────────────────────────────────
  const noItems = perOrder.filter((o) => o.itemCount === 0);
  const withItems = perOrder.filter((o) => o.itemCount > 0);
  const itemsWithoutImage = withItems.filter((o) =>
    (content.find((c) => c.id === o.id)?.items ?? []).every((i) => !i.primaryImageUrl),
  );
  const someItemWithoutImage = withItems.filter((o) =>
    (content.find((c) => c.id === o.id)?.items ?? []).some((i) => !i.primaryImageUrl),
  );

  const withoutItems = {
    apiIncludesItems: true,
    apiEvidence: 'OrderQueryService.buildResponse always maps order.getItems() into OrderResponse.items, and each item carries productName + primaryImageUrl.',
    ordersWithNoItems: noItems.length,
    ordersWithNoItemsDetail: noItems.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      cause: 'DATA — the order has no order_items rows in the database',
    })),
    ordersWithItemsButNoImage: itemsWithoutImage.length,
    ordersWithAtLeastOneItemMissingImage: someItemWithoutImage.length,
    ordersWithItemsButNoImageDetail: itemsWithoutImage.map((o) => o.orderNumber),
    causeBreakdown: {
      data: noItems.length,
      apiOmission: 0,
      missingImage: itemsWithoutImage.length,
    },
  };

  const measurements = {
    generatedAt: new Date().toISOString(),
    api: { base: API, currency: settings?.currency ?? null },
    totals,
    kpi,
    statusModel,
    withoutItems,
    backendSource: BACKEND_SOURCE,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
  console.log(
    `orders audit: ${perOrder.length} orders, ${mismatched.length} with a stored total that disagrees with their items`,
  );
  return measurements;
}

export { run };

// Run standalone: `node scripts/measure-orders.mjs`
if (process.argv[1] && process.argv[1].endsWith('measure-orders.mjs')) {
  await run();
}
