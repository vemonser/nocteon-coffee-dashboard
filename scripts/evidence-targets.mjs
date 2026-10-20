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
  const disabled = await el.getAttribute('disabled');
  if (disabled !== null) {
    return { present: false, reason: `[data-testid="${testId}"] is disabled` };
  }
  await el.click();
  await page.waitForTimeout(600);
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
    // A screen-reader-only element is a 1px box BY DESIGN: its "clip" is
    // not a defect, it is how it is hidden.
    if (el.classList.contains('sr-only')) continue;
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

// ── colour helpers (in-page) ────────────────────────────────────────────────

const CONTRAST_HELPERS = `
  const rgb = (value) => {
    const m = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
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
`;

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
      return { cells: cells.length, texts: cells.map((c) => (c.textContent || '').trim().replace(/\s+/g, ' ')) };
    });

  const cards = Array.from(document.querySelectorAll('[data-testid="orders-stat-card"]')).map((el) => ({
    label: (el.querySelector('[data-testid="stat-label"]')?.textContent || '').trim(),
    value: (el.querySelector('[data-testid="stat-value"]')?.textContent || '').trim(),
  }));

  const headerCount = (document.querySelector('[data-testid="orders-total-count"]')?.textContent || '').trim();

  const tabs = Array.from(document.querySelectorAll('[data-testid="orders-status-tab"]')).map((el) => ({
    label: (el.textContent || '').trim().replace(/\s+/g, ' '),
    active: el.getAttribute('aria-selected') === 'true',
  }));

  // The badges, with the CONTRAST of their text on their own background and
  // of their background on the card they sit on.
  //
  //  - the text needs 4.5:1 (WCAG 2.x, normal text);
  //  - the badge's own colour against the surface needs 3:1 (the graphics
  //    target) — the badge's TEXT is what carries the meaning, so this is
  //    the softer of the two.
  const rgb = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const flatten = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
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

  const badges = [];
  const seen = new Set();
  for (const el of Array.from(document.querySelectorAll('app-status-badge'))) {
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const badge = el.querySelector('[data-slot="badge"]') || el;
    const span = el.querySelector('span');
    const textColor = rgb((span ? getComputedStyle(span) : getComputedStyle(el)).color);
    const bgRaw = rgb(getComputedStyle(badge).backgroundColor);
    const surface = surfaceOf(el);
    const bg = bgRaw ? flatten(bgRaw, surface) : surface;
    badges.push({
      text,
      color: getComputedStyle(span || el).color,
      background: getComputedStyle(badge).backgroundColor,
      // The text on its own badge (the text target: 4.5:1).
      textOnBadge: textColor ? ratio(textColor, bg) : null,
      // The badge's MEANING colour (the text) on the surface it sits on
      // (the graphics target: 3:1). The soft tint of the background is not
      // a meaningful contrast — the text is what carries the meaning.
      textOnSurface: textColor ? ratio(textColor, surface) : null,
      badgeOnSurface: ratio(bg, surface),
      textPasses4_5: textColor ? ratio(textColor, bg) >= 4.5 : null,
      graphicsPasses3: textColor ? ratio(textColor, surface) >= 3 : null,
    });
  }

  return { headers, rowCount: rows.length, rows, cards, headerCount, tabs, badges };
};

// ── order-detail specific measurements ──────────────────────────────────────

const MEASURE_ORDER_DETAIL = () => {
  const cards = Array.from(document.querySelectorAll('[data-testid="detail-card"]')).map((el) => {
    const r = el.getBoundingClientRect();
    const content = el.querySelector('[data-testid="detail-card-body"]');
    const contentHeight = content ? content.getBoundingClientRect().height : null;
    return {
      id: el.getAttribute('data-card'),
      title: (el.querySelector('[data-testid="detail-card-title"]')?.textContent || '').trim(),
      heightPx: Math.round(r.height),
      contentHeightPx: contentHeight === null ? null : Math.round(contentHeight),
      ratio: contentHeight && contentHeight > 0
        ? Math.round((r.height / contentHeight) * 100) / 100
        : null,
      top: Math.round(r.top + window.scrollY),
    };
  });

  const sidebar = Array.from(document.querySelectorAll('[data-testid="detail-sidebar-section"]')).map((el) => ({
    id: el.getAttribute('data-card'),
    title: (el.querySelector('[data-testid="detail-card-title"]')?.textContent || '').trim(),
    heightPx: Math.round(el.getBoundingClientRect().height),
    top: Math.round(el.getBoundingClientRect().top + window.scrollY),
  }));

  const actions = Array.from(
    document.querySelectorAll(
      '[data-testid="order-update-status"], [data-testid="order-print-invoice"],' +
        '[data-testid="order-resend-email"], [data-testid="order-more-actions"],' +
        '[data-testid="order-back"]',
    ),
  ).map((el) => ({
    id: el.getAttribute('data-testid'),
    text: (el.textContent || '').trim().replace(/\s+/g, ' '),
    disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
    title: el.getAttribute('title') || el.getAttribute('aria-label') || null,
  }));

  // The progress tracker: which step the order is at.
  const steps = Array.from(document.querySelectorAll('[data-step]')).map((el) => ({
    step: el.getAttribute('data-step'),
    state: el.getAttribute('data-state'),
  }));
  const cancelled = !!document.querySelector('[data-testid="order-progress-cancelled"]');

  // The totals, as they are shown.
  const total = (document.querySelector('[data-testid="order-total"]')?.textContent || '').trim();
  const netPaid = (document.querySelector('[data-testid="order-net-paid"]')?.textContent || '').trim();
  const mismatch = !!document.querySelector('[data-testid="order-totals-mismatch"]');

  return { cards, sidebar, actions, steps, cancelled, total, netPaid, totalsMismatchShown: mismatch };
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
      // The DELIVERED order with items — the totals mismatch is visible here.
      id: 'order-detail',
      url: '/dashboard/orders/1',
      measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL),
    },
    {
      // A CONFIRMED order — the tracker's mid-flow state, and the one whose
      // status can still change.
      id: 'order-detail-midflow',
      url: '/dashboard/orders/15',
      measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL),
    },
    {
      id: 'order-status-dialog',
      url: '/dashboard/orders/15',
      action: async (page) => {
        const clicked = await clickTestId(page, 'order-update-status');
        if (!clicked.present) return clicked;
        const options = await page.locator('[data-testid="status-option"]').allInnerTexts();
        return { present: await dialogOpen(page, 'status-dialog'), opened: true, options };
      },
    },
    {
      id: 'order-cancel-dialog',
      url: '/dashboard/orders/15',
      action: async (page) => {
        // Cancel lives in the row's overflow menu, so the menu is opened
        // first — the same path a user takes.
        const menu = await clickTestId(page, 'order-more-actions');
        if (!menu.present) return menu;
        await page.waitForTimeout(400);
        const clicked = await clickTestId(page, 'order-cancel');
        if (!clicked.present) return clicked;
        return { present: await dialogOpen(page, 'cancel-dialog'), opened: true };
      },
    },
    {
      id: 'order-refund-dialog',
      url: '/dashboard/orders/1',
      action: async (page) => {
        const menu = await clickTestId(page, 'order-more-actions');
        if (!menu.present) return menu;
        await page.waitForTimeout(400);
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

export { settle, GENERIC_MEASURE, CONTRAST_HELPERS };
