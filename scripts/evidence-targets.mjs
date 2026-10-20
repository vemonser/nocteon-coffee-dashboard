// Evidence targets — the WHAT of the evidence matrix.
//
//   npm run evidence -- orders            -> evidence/orders/<lang>-<theme>/…
//   npm run evidence -- orders --tag before
//
// Each target is one screen of the page under test. A target declares:
//
//   id         the file stem of its screenshot and of its result entry
//   url        the route to open (relative to the dev server)
//   action     optional async (page) => result — an interaction that has to
//              happen BEFORE the screenshot (open a dialog, …)
//   measure    optional async (page) => object — extra measurements for this
//              target only
//
// The actions and measurements are deliberately tolerant: a target whose
// control does not exist (yet) is recorded as `present: false` instead of
// failing the whole run. That is what makes the same harness usable for the
// "before" capture and for the final matrix.

/**
 * Wait until the app has settled: the initial route render plus its HTTP
 * round-trip. Uses the network-idle signal with a floor, because the app
 * keeps a websocket-ish activity filter alive.
 */
async function settle(page, ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** Click the first visible element matching a test id; report if it is absent. */
async function clickTestId(page, testId) {
  const el = page.locator(`[data-testid="${testId}"]`).first();
  if ((await el.count()) === 0) return { present: false, reason: `no [data-testid="${testId}"]` };
  if (!(await el.isVisible().catch(() => false))) {
    return { present: false, reason: `[data-testid="${testId}"] is not visible` };
  }
  await el.click();
  await page.waitForTimeout(500);
  return { present: true };
}

/** Is a dialog-like overlay on screen? */
async function dialogOpen(page, testId) {
  const el = page.locator(`[data-testid="${testId}"]`).first();
  return (await el.count()) > 0 && (await el.isVisible().catch(() => false));
}

// ── the generic in-page measurement ─────────────────────────────────────────
//
// Runs for EVERY target: the invariants that must hold on every screen of
// the app (no horizontal page scroll, nothing cut off, no raw i18n key).

const GENERIC_MEASURE = () => {
  const doc = document.documentElement;
  const RAW_KEY = /\b[a-z]+\.[a-z]+\.[A-Z_]+\b/;
  const all = Array.from(document.querySelectorAll('body *'));
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const desc = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: String(el.className || '').slice(0, 120),
    text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
  });

  const verticalClipped = [];
  const horizontalClipped = [];
  const ellipsised = [];
  const rawKeys = [];

  for (const el of all) {
    if (!isVisible(el)) continue;
    const cs = getComputedStyle(el);
    const oy = cs.overflowY;
    const ox = cs.overflowX;

    // Content cut off VERTICALLY: the card is shorter than what it holds.
    if ((oy === 'hidden' || oy === 'clip') && el.scrollHeight > el.clientHeight + 1) {
      verticalClipped.push({ ...desc(el), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
    }
    // Content cut off HORIZONTALLY by a clipping box.
    if ((ox === 'hidden' || ox === 'clip') && el.scrollWidth > el.clientWidth + 1) {
      horizontalClipped.push({ ...desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    }
    // Deliberate ellipsis — recorded so the "no truncation" rules can be
    // checked per column instead of guessed.
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
      ellipsised.push(desc(el));
    }
    // A raw translation key that reached the screen.
    if (el.children.length === 0) {
      const t = (el.textContent || '').trim();
      if (t && RAW_KEY.test(t)) rawKeys.push(t.slice(0, 90));
    }
  }

  return {
    horizontalOverflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth),
    pageHeightPx: doc.scrollHeight,
    verticalClipped,
    horizontalClipped,
    ellipsised,
    rawI18nKeys: Array.from(new Set(rawKeys)),
  };
};

// ── orders-list specific measurements ───────────────────────────────────────

const MEASURE_ORDERS_LIST = () => {
  const table = document.querySelector('app-data-table table');
  const headers = table
    ? Array.from(table.querySelectorAll('thead th')).map((th) => ({
        text: (th.textContent || '').trim().replace(/\s+/g, ' '),
        widthPx: Math.round(th.getBoundingClientRect().width),
      }))
    : [];

  const bodyRows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
  const rows = bodyRows
    .filter((tr) => !tr.hasAttribute('aria-hidden') && tr.querySelector('td'))
    .map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td'));
      const cell = (i) => (cells[i] ? (cells[i].textContent || '').trim().replace(/\s+/g, ' ') : '');
      return { cells: cells.length, texts: cells.map((c) => (c.textContent || '').trim().replace(/\s+/g, ' ')) };
    });

  // The KPI cards the header renders.
  const cards = Array.from(document.querySelectorAll('[data-testid="orders-stat-card"]')).map((el) => ({
    label: (el.querySelector('[data-testid="stat-label"]')?.textContent || '').trim(),
    value: (el.querySelector('[data-testid="stat-value"]')?.textContent || '').trim(),
  }));

  // The page-level count next to the title.
  const headerCount = (document.querySelector('[data-testid="orders-total-count"]')?.textContent || '').trim();

  // Status tabs and their counts.
  const tabs = Array.from(document.querySelectorAll('[data-testid="orders-status-tab"]')).map((el) => ({
    label: (el.textContent || '').trim().replace(/\s+/g, ' '),
    active: el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent'),
  }));

  // The Method column: a short label with an icon, never truncated.
  const methodCells = Array.from(document.querySelectorAll('tbody tr td')).filter((td) =>
    td.hasAttribute('data-col') ? td.getAttribute('data-col') === 'paymentMethod' : false,
  );

  return { headers, rowCount: rows.length, rows, cards, headerCount, tabs, methodCells: methodCells.length };
};

// ── order-detail specific measurements ──────────────────────────────────────

const MEASURE_ORDER_DETAIL = () => {
  const cards = Array.from(document.querySelectorAll('[data-testid="detail-card"]')).map((el) => {
    const r = el.getBoundingClientRect();
    const content = el.querySelector('[data-testid="detail-card-body"]');
    return {
      id: el.getAttribute('data-testid'),
      title: (el.querySelector('[data-testid="detail-card-title"]')?.textContent || '').trim(),
      heightPx: Math.round(r.height),
      contentHeightPx: content ? Math.round(content.getBoundingClientRect().height) : null,
      ratio: content && content.getBoundingClientRect().height > 0
        ? Math.round((r.height / content.getBoundingClientRect().height) * 100) / 100
        : null,
      top: Math.round(r.top + window.scrollY),
    };
  });

  const sidebar = Array.from(document.querySelectorAll('[data-testid="detail-sidebar-section"]')).map((el) => ({
    title: (el.querySelector('[data-testid="detail-card-title"]')?.textContent || '').trim(),
    heightPx: Math.round(el.getBoundingClientRect().height),
    top: Math.round(el.getBoundingClientRect().top + window.scrollY),
  }));

  const actions = Array.from(document.querySelectorAll('[data-testid="detail-action"]')).map((el) => ({
    id: el.getAttribute('data-testid'),
    text: (el.textContent || '').trim().replace(/\s+/g, ' '),
    disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
    title: el.getAttribute('title') || el.getAttribute('aria-label') || null,
  }));

  return { cards, sidebar, actions };
};

// ── the target registry ─────────────────────────────────────────────────────

export const TARGET_SETS = {
  dashboard: [{ id: 'dashboard', url: '/dashboard?days=30' }],

  orders: [
    {
      id: 'orders-list',
      url: '/dashboard/orders',
      measure: async (page) => page.evaluate(MEASURE_ORDERS_LIST),
    },
    {
      id: 'order-detail',
      url: '/dashboard/orders/1',
      measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL),
    },
    {
      id: 'order-status-dialog',
      url: '/dashboard/orders/1',
      action: async (page) => {
        const clicked = await clickTestId(page, 'order-update-status');
        if (!clicked.present) return clicked;
        return { present: await dialogOpen(page, 'status-dialog'), opened: true };
      },
    },
    {
      id: 'order-cancel-dialog',
      url: '/dashboard/orders/1',
      action: async (page) => {
        const clicked = await clickTestId(page, 'order-cancel');
        if (!clicked.present) return clicked;
        return { present: await dialogOpen(page, 'cancel-dialog'), opened: true };
      },
    },
    {
      id: 'order-refund-dialog',
      url: '/dashboard/orders/1',
      action: async (page) => {
        const clicked = await clickTestId(page, 'order-refund');
        if (!clicked.present) return clicked;
        return { present: await dialogOpen(page, 'refund-dialog'), opened: true };
      },
    },
  ],
};

/** The target list for a phase, or the legacy single-URL list. */
export function targetsFor(phase, urlOverride) {
  if (urlOverride) return [{ id: 'dashboard', url: urlOverride }];
  const set = TARGET_SETS[phase];
  if (!set) {
    throw new Error(
      `No evidence target set named "${phase}". Known sets: ${Object.keys(TARGET_SETS).join(', ')}`,
    );
  }
  return set;
}

export { settle, GENERIC_MEASURE };
