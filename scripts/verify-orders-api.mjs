// The live proof of the new backend contract: every endpoint the orders pages
// need, called against the running API with a real admin session.
//   node scripts/verify-orders-api.mjs
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const API = process.env.E2E_API_URL ?? 'http://localhost:8080';

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
  return body?.data?.accessToken;
}

const token = await login();
const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text: text.slice(0, 200) };
};

const results = {};
const show = (name, r) => {
  results[name] = { status: r.status, data: r.json?.data };
  console.log(`${name}: ${r.status}`, JSON.stringify(r.json?.data ?? r.text).slice(0, 220));
};

show('stats', await call('GET', '/api/dashboard/orders/stats'));
show('stats-filtered', await call('GET', '/api/dashboard/orders/stats?status=CANCELLED'));
show('history', await call('GET', '/api/dashboard/orders/1/history'));
show('notes', await call('GET', '/api/dashboard/orders/1/notes'));
show('payment', await call('GET', '/api/dashboard/orders/1/payment'));
show('shipment', await call('GET', '/api/dashboard/orders/1/shipment'));
show('list-filtered', await call('GET', '/api/dashboard/orders?paymentStatus=PAID&size=3'));
show('list-search', await call('GET', '/api/dashboard/orders?search=ORD-2026-000001'));
show('list-daterange', await call('GET', '/api/dashboard/orders?dateFrom=2026-10-19&dateTo=2026-10-21'));

// The state machine: a delivered order cannot go back to pending.
show('invalid-transition', await call('PUT', '/api/dashboard/orders/1/status', { status: 'PENDING' }));

// A note.
show('add-note', await call('POST', '/api/dashboard/orders/1/notes', { body: 'Checked the packing slip.' }));

// The shipment.
show('update-shipment', await call('PUT', '/api/dashboard/orders/1/shipment', {
  carrier: 'Bosta',
  trackingNumber: 'BST-123456789',
  trackingUrl: 'https://bosta.com/track/BST-123456789',
}));

// The refund (a recorded, MANUAL one).
show('refund', await call('POST', '/api/dashboard/orders/1/refund', {
  amount: 20.5,
  reason: 'One bag was damaged.',
}));

show('payment-after-refund', await call('GET', '/api/dashboard/orders/1/payment'));

// The history is still the old order's: the order is DELIVERED, so no status
// change was possible. The refund and the note are the new events.
show('history-after', await call('GET', '/api/dashboard/orders/1/history'));
show('notes-after', await call('GET', '/api/dashboard/orders/1/notes'));

console.log('\nSUMMARY');
for (const [name, r] of Object.entries(results)) {
  console.log(`  ${name}: ${r.status}`);
}
