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

/**
 * Click the first visible element matching a test id; report if it is absent.
 *
 * <p>A menu item is waited for before it is clicked: the overflow menu
 * animates, and clicking during the animation loses the click. That showed up
 * as one cell out of twenty with no screenshot of the dialog.
 */
async function clickTestId(page, testId, { waitFor = 0 } = {}) {
  const el = page.locator(`[data-testid="${testId}"]`).first();
  if ((await el.count()) === 0) return { present: false, reason: `no [data-testid="${testId}"]` };
  if (waitFor > 0) {
    try {
      await el.waitFor({ state: 'visible', timeout: waitFor });
    } catch {
      return { present: false, reason: `[data-testid="${testId}"] never became visible` };
    }
  }
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
    if ((ox === 'hidden' || ox === 'clip') && el.scrollWidth > el.clientWidth) {
      horizontalClipped.push({ ...desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    }
    // Deliberate ellipsis — recorded so the "no truncation" rules can be
    // checked per column instead of guessed.
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth) {
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

  // The truncation report: which cells are cut, and by how much. The
  // Method and the Order # must NOT be cut; a value that IS cut must
  // carry a tooltip.
  const truncation = { byColumn: {}, mustNotTruncate: ['Method', 'Order #'], withoutTooltip: [] };
  const columnIndex = (label) => headers.findIndex((h) => h.text.replace(/[↕↑↓]/g, '').trim() === label);
  const listTable = document.querySelector('app-data-table table');
  if (listTable) {
    for (const th of Array.from(listTable.querySelectorAll('thead th'))) {
      const label = (th.textContent || '').trim().replace(/[↕↑↓]/g, '').trim();
      if (!label) continue;
      const cut = [];
      for (const el of Array.from(th.querySelectorAll('*'))) {
        const cs = getComputedStyle(el);
        if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth) {
          cut.push({ header: true, text: (el.textContent || '').trim() });
        }
      }
      truncation.byColumn[label] = cut;
    }
    const bodyRows = Array.from(listTable.querySelectorAll('tbody tr'));
    for (const tr of bodyRows) {
      const tds = Array.from(tr.querySelectorAll('td'));
      tds.forEach((td, i) => {
        const label = headers[i]?.text.replace(/[↕↑↓]/g, '').trim() ?? `#${i}`;
        for (const el of Array.from(td.querySelectorAll('*'))) {
          const cs = getComputedStyle(el);
          if (cs.textOverflow !== 'ellipsis') continue;
          if (el.scrollWidth <= el.clientWidth) continue;
          const entry = {
            column: label,
            text: (el.textContent || '').trim().slice(0, 40),
            missingPx: el.scrollWidth - el.clientWidth,
            hasTooltip: !!td.querySelector('[title]'),
          };
          truncation.byColumn[label] = truncation.byColumn[label] || [];
          truncation.byColumn[label].push(entry);
          if (!entry.hasTooltip) truncation.withoutTooltip.push(entry);
        }
      });
    }
  }
  truncation.methodTruncated = (truncation.byColumn['Method'] || []).length;
  truncation.orderNumberTruncated = (truncation.byColumn['Order #'] || []).length;
  truncation.headersTruncated = Object.entries(truncation.byColumn)
    .filter(([, cuts]) => cuts.some((c) => c.header))
    .map(([label]) => label);

  return { headers, rowCount: rows.length, rows, cards, headerCount, tabs, badges, truncation };
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

  const text = (selector) =>
    (document.querySelector(selector)?.textContent || '').trim().replace(/\s+/g, ' ');

  const actions = Array.from(
    document.querySelectorAll(
      '[data-testid="order-update-status"], [data-testid="order-print-invoice"],' +
        '[data-testid="order-resend-email"], [data-testid="order-more-actions"],' +
        '[data-testid="order-back"], [data-testid="order-refund-action"]',
    ),
  ).map((el) => ({
    id: el.getAttribute('data-testid'),
    text: (el.textContent || '').trim().replace(/\s+/g, ' '),
    disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
    title: el.getAttribute('title') || el.getAttribute('aria-label') || null,
    /** The reason a disabled control gives. Added by the v3 page. */
    disabledReason: el.getAttribute('data-disabled-reason') || null,
    /** Does the control (or its wrapper) carry a tooltip? */
    hasTooltip: !!el.getAttribute('data-tooltip') || !!el.closest('[data-tooltip]'),
  }));

  // The progress tracker: which step the order is at, whether it is drawn
  // as done (a check, not a number) and what it says per step.
  const steps = Array.from(document.querySelectorAll('[data-step]')).map((el) => {
    // The date/actor live in the step's text column, a SIBLING of the circle's
    // wrapper, so the whole <li> is the scope — not `el.parentElement`.
    const item = el.closest('li');
    return {
      step: el.getAttribute('data-step'),
      state: el.getAttribute('data-state'),
      label: (item?.querySelector('span.block.text-sm')?.textContent || '').trim().replace(/\s+/g, ' '),
      hasCheckIcon: !!el.querySelector('svg'),
      numericLabel: (el.textContent || '').trim(),
      date: item?.querySelector('[data-step-date]')?.textContent?.trim() || null,
      actor: item?.querySelector('[data-step-actor]')?.textContent?.trim() || null,
    };
  });
  const deliveredStep = steps.find((s) => s.step === 'DELIVERED') || null;
  const cancelled = !!document.querySelector('[data-testid="order-progress-cancelled"]');
  const terminalState =
    document.querySelector('[data-testid="order-terminal-state"]')?.getAttribute('data-terminal') || null;

  // The activity log: the number of rendered events and whether the page is
  // showing its real empty state.
  const activityItems = Array.from(document.querySelectorAll('[data-testid="order-activity"] li'));
  const activity = {
    count: activityItems.length,
    empty: !!document.querySelector('[data-testid="order-no-activity"]'),
    emptyText: text('[data-testid="order-no-activity"]'),
    titles: activityItems.map((el) =>
      (el.querySelector('[data-event-title]')?.textContent || '').trim(),
    ),
    warning: text('[data-testid="order-activity-warning"]'),
  };

  // The payment card: what is missing on a PAID order, what it warns about.
  const paymentCard = document.querySelector('[data-card="payment"]');
  const payment = {
    text: (paymentCard?.textContent || '').trim().replace(/\s+/g, ' '),
    transactionReference: text('[data-testid="order-transaction-reference"]'),
    paidAt: text('[data-testid="order-paid-at"]'),
    warning: text('[data-testid="order-payment-warning"]'),
    dashes: (paymentCard?.textContent || '').split('—').length - 1,
    refundActionDisabled:
      document.querySelector('[data-testid="order-refund-action"]')?.hasAttribute('disabled') ?? null,
    copyReference: !!document.querySelector('[data-testid="order-copy-reference"]'),
  };

  // The totals, as they are shown.
  const total = text('[data-testid="order-total"]');
  const netPaid = text('[data-testid="order-net-paid"]');
  const mismatch = !!document.querySelector('[data-testid="order-totals-mismatch"]');
  const totalsRows = Array.from(document.querySelectorAll('[data-testid="order-totals"] [data-total-row]')).map(
    (el) => ({
      row: el.getAttribute('data-total-row'),
      label: (el.querySelector('dt')?.textContent || '').trim(),
      value: (el.querySelector('dd')?.textContent || '').trim(),
    }),
  );

  // The breadcrumb trail, as one line.
  const breadcrumb = (document.querySelector('nav ol')?.textContent || '')
    .trim()
    .replace(/\s+/g, ' ');

  // Which cards exist, and whether the dead Tags card is still among them.
  const tagsCard = !!document.querySelector('[data-card="tags"]');
  const shipmentText = text('[data-card="shipment"]');
  const customerText = text('[data-card="customer"]');
  const addressText = text('[data-card="address"]');

  // The section order, as it is on the page (the main column first, then
  // the sidebar).
  const sectionOrder = {
    main: cards.map((c) => c.id),
    sidebar: sidebar.map((c) => c.id),
  };

  return {
    cards,
    sidebar,
    actions,
    steps,
    deliveredStep,
    cancelled,
    terminalState,
    activity,
    payment,
    total,
    netPaid,
    totalsRows,
    totalsMismatchShown: mismatch,
    breadcrumb,
    tagsCard,
    shipmentText,
    customerText,
    addressText,
    states: {
      loading: !!document.querySelector('[data-testid="order-detail-loading"]'),
      error: !!document.querySelector('[data-testid="order-detail-error"]'),
      notFound: !!document.querySelector('[data-testid="order-detail-notfound"]'),
    },
    sectionOrder,
    cardHeightRatios: cards.map((c) => ({ id: c.id, heightPx: c.heightPx, ratio: c.ratio })),
  };
};

// ── the review details dialog (ui/review-dialog-v3) ─────────────────────────
//
// The four states the brief asks for are four SCREENS of the same dialog, so
// every target opens the dialog on a review of a given kind.

/**
 * The View button of a row.
 *
 * <p>The label is translated, so the selector names BOTH labels and the icon:
 * a target that only matched "View" would silently find nothing in the
 * Arabic cells — the run would look green and prove nothing.
 */
const VIEW_BUTTON_SELECTOR =
  'button[aria-label="View"], button[aria-label="عرض"], button:has(ng-icon[name="lucideEye"])';

/** The index of the row that shows a given kind of review. */
const REVIEW_ROW_INDEX = () => {
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  const commentOf = (row) =>
    (row.querySelector('td[data-column="comment"]')?.textContent || '').trim();
  return {
    total: rows.length,
    long: rows.findIndex((row) => commentOf(row).length >= 600),
    short: rows.findIndex((row) => commentOf(row).length > 0 && commentOf(row).length < 200),
    verified: rows.findIndex((row) => !!row.querySelector('app-verified-badge [aria-label]')),
  };
};

/**
 * The identity of a control: its tag, its accessible name, and WHICH row
 * or card it belongs to.
 *
 * <p>"Focus is on some button" is not a claim; "focus is on the SAME
 * button that opened the dialog" is. The row index is what makes two
 * controls comparable.
 */
const identityOf = (locator) =>
  locator.evaluate((el) => {
    const card = el.closest('tr, hlm-card');
    const siblings = card?.parentElement ? Array.from(card.parentElement.children) : [];
    return {
      tag: el.tagName.toLowerCase(),
      ariaLabel: el.getAttribute('aria-label'),
      rowIndex: card ? siblings.indexOf(card) : -1,
    };
  });

/**
 * The control that opened the dialog, recorded WHEN it was clicked.
 *
 * <p>The measurement runs after the dialog is open, and the dialog takes
 * the focus the moment it opens — so the trigger has to be remembered at
 * click time, or "the focus came back" cannot be compared with anything.
 */
let lastTrigger = null;

/** Open the dialog on the first row of the given kind. */
async function openReviewDialog(page, kind) {
  const index = await page.evaluate(REVIEW_ROW_INDEX);
  const rowIndex = index[kind];
  if (rowIndex === undefined || rowIndex < 0) {
    return { present: false, reason: `no row of kind "${kind}"`, rows: index };
  }
  const button = page.locator('tbody tr').nth(rowIndex).locator(VIEW_BUTTON_SELECTOR).first();
  if ((await button.count()) === 0) return { present: false, reason: 'no view button' };
  lastTrigger = await identityOf(button);
  await button.click();
  await page.waitForTimeout(700);
  return { present: await dialogOpen(page, 'dialog-shell'), opened: true, rowIndex };
}

/** Open the dialog from a GRID card — the other trigger of the same dialog. */
async function openReviewDialogFromGrid(page) {
  const cards = page.locator('hlm-card');
  if ((await cards.count()) === 0) return { present: false, reason: 'no grid cards' };
  const button = cards.first().locator(VIEW_BUTTON_SELECTOR).first();
  if ((await button.count()) === 0) return { present: false, reason: 'no view button on the card' };
  lastTrigger = await identityOf(button);
  await button.click();
  await page.waitForTimeout(700);
  return { present: await dialogOpen(page, 'dialog-shell'), opened: true, trigger: 'grid-card' };
}

/**
 * The measurements of the OPEN dialog.
 *
 * <p>Everything here is read from the live DOM: the gap between the footer
 * buttons, the height of the panel against the viewport, the tab order, the
 * stars (filled vs outline — the shared RatingStars question), the badge
 * contrast, and the links the header and the body carry.
 */
const MEASURE_REVIEW_DIALOG = `${CONTRAST_HELPERS}
  const panel = document.querySelector('[role="dialog"]');
  if (!panel) return { present: false };

  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  };

  // The footer: the START slot and the END slot.
  const footer = panel.querySelector('footer');
  const footerGroups = footer ? Array.from(footer.children) : [];
  const endGroup = footerGroups[footerGroups.length - 1] || null;
  const endButtons = endGroup ? Array.from(endGroup.querySelectorAll('button')) : [];
  const startButtons = footerGroups[0]
    ? Array.from(footerGroups[0].querySelectorAll('button'))
    : [];

  // The gap BETWEEN two adjacent buttons: the distance between the edges
  // that face each other, in either direction.
  const gapBetween = (a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return ra.left <= rb.left ? Math.round(rb.left - ra.right) : Math.round(ra.left - rb.right);
  };
  const footerGaps = [];
  for (let i = 1; i < endButtons.length; i += 1) footerGaps.push(gapBetween(endButtons[i - 1], endButtons[i]));

  const labelOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;
    const text = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    return text.slice(0, 40);
  };

  // The tab order: the focusable elements of the panel, in DOM order.
  const focusables = Array.from(
    panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => el.offsetParent !== null);

  // The stars: the shared RatingStars component draws the filled star with
  // fill="currentColor" and the empty one with fill="none".
  const starSvgs = Array.from(panel.querySelectorAll('app-rating-stars svg'));
  const filledStars = starSvgs.filter((s) => {
    const p = s.querySelector('path');
    return p && (p.getAttribute('fill') || '').toLowerCase() === 'currentcolor';
  });

  // The DIRECTION of the dialog, read from the document: the footer groups
  // and the stars are laid out by it, so their x positions are what proves
  // the mirroring.
  const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
  const groupX = footerGroups.map((g) => Math.round(g.getBoundingClientRect().left));
  const starX = starSvgs.map((s) => Math.round(s.getBoundingClientRect().left));
  const ratingText = (panel.querySelector('[data-testid="review-dialog-rating"]')?.textContent || '').trim();

  // The status badge: its own text against its own tint, and against the
  // card it sits on.
  const badge = panel.querySelector('hlm-badge');
  let badgeContrast = null;
  if (badge) {
    const cs = getComputedStyle(badge);
    const bg = rgb(cs.backgroundColor);
    const fg = rgb(cs.color);
    const card = panel.querySelector('.bg-card') || panel;
    const surface = surfaceOf(card);
    badgeContrast = {
      label: (badge.textContent || '').trim(),
      textVsBadgeBg: bg && fg ? ratio(fg, bg) : null,
      textVsCard: fg ? ratio(fg, surface) : null,
      badgeBg: cs.backgroundColor,
      badgeText: cs.color,
    };
  }

  const heading = panel.querySelector('h2');
  const productLink = Array.from(panel.querySelectorAll('a[href]')).find((a) =>
    (a.getAttribute('href') || '').includes('/products'),
  );
  const orderLink = Array.from(panel.querySelectorAll('a[href]')).find((a) =>
    (a.getAttribute('href') || '').includes('/orders'),
  );
  const commentBlock = panel.querySelector('blockquote');

  // The TABLE behind the dialog: the row of a long comment, and the clamp
  // on its cell. A comment that is not clamped grows the row to half a
  // page, and the table stops being scannable.
  const longRow = Array.from(document.querySelectorAll('tbody tr')).find(
    (r) => (r.querySelector('td[data-column="comment"]')?.textContent || '').trim().length >= 600,
  );
  const longRowCell = longRow?.querySelector('td[data-column="comment"] span') ?? null;
  const tableRow = longRow
    ? {
        heightPx: Math.round(longRow.getBoundingClientRect().height),
        cellHeightPx: longRowCell ? longRowCell.clientHeight : null,
        cellScrollHeightPx: longRowCell ? longRowCell.scrollHeight : null,
        clamped: longRowCell ? longRowCell.scrollHeight > longRowCell.clientHeight : null,
        lineClamp: longRowCell ? getComputedStyle(longRowCell).webkitLineClamp : null,
      }
    : null;

  return {
    present: true,
    title: heading ? (heading.textContent || '').trim() : null,
    dialog: { ...rect(panel), viewportHeightPx: window.innerHeight, fitsViewport: panel.getBoundingClientRect().height <= window.innerHeight },
    footer: {
      endButtonLabels: endButtons.map(labelOf),
      startButtonLabels: startButtons.map(labelOf),
      gapsPx: footerGaps,
      minGapPx: footerGaps.length ? Math.min(...footerGaps) : null,
      endVariants: endButtons.map((b) => b.getAttribute('data-slot') + ':' + (b.className || '').split(' ').filter((c) => c.includes('bg-') || c.includes('border-')).slice(0, 2).join(' ')),
    },
    tabOrder: focusables.map((el) => ({ tag: el.tagName.toLowerCase(), name: labelOf(el) })),
    stars: {
      total: starSvgs.length,
      filled: filledStars.length,
      outline: starSvgs.length - filledStars.length,
      color: starSvgs.length ? getComputedStyle(starSvgs[0]).color : null,
      widthPx: starSvgs.length ? Math.round(starSvgs[0].getBoundingClientRect().width) : null,
      x: starX,
    },
    direction: rtl ? 'rtl' : 'ltr',
    footerGroupX: groupX,
    ratingText,
    badgeContrast,
    productLink: productLink ? productLink.getAttribute('href') : null,
    orderLink: orderLink ? orderLink.getAttribute('href') : null,
    comment: commentBlock
      ? {
          chars: (commentBlock.textContent || '').trim().length,
          scrollHeightPx: commentBlock.scrollHeight,
          clientHeightPx: commentBlock.clientHeight,
          scrolls: commentBlock.scrollHeight > commentBlock.clientHeight + 1,
          whiteSpace: getComputedStyle(commentBlock).whiteSpace,
        }
      : null,
    statusRow: (() => {
      const text = (panel.textContent || '');
      const m = text.match(/(Status|الحالة)\\s*[:\\u061F]?\\s*([A-Za-z\\u0600-\\u06FF]+)/);
      return m ? m[0].trim() : null;
    })(),
    tableRow,
  };
`;

/**
 * The open-dialog measurement, plus the two BEHAVIOUR checks that need the
 * keyboard: Escape closes the dialog, and the focus returns to the control
 * that opened it.
 */
async function measureReviewDialog(page) {
  // The measurement is a STRING of in-page code, so it is evaluated as an
  // IIFE: a bare string is an EXPRESSION to Playwright, and a top-level
  // "return" inside one is a syntax error.
  const open = await page.evaluate(`(() => {\n${MEASURE_REVIEW_DIALOG}\n})()`);

  /**
   * The identity of the focused control: its tag, its accessible name, and
   * WHICH row or card it belongs to.
   *
   * <p>"Focus is on some button" is not a claim; "focus is on the SAME
   * button that opened the dialog" is. The row index is what makes the two
   * comparable.
   */
  const focusKey = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const card = el.closest('tr, hlm-card');
      const siblings = card?.parentElement ? Array.from(card.parentElement.children) : [];
      return {
        tag: el.tagName.toLowerCase(),
        ariaLabel: el.getAttribute('aria-label'),
        testId: el.getAttribute('data-testid'),
        rowIndex: card ? siblings.indexOf(card) : -1,
      };
    });

  const trigger = await focusKey();

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const afterEscape = await focusKey();
  const dialogOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));

  // The focus must come back to the control that OPENED the dialog — the
  // one that was clicked, not "some button".
  const expected = lastTrigger ?? trigger;
  const sameControl =
    !!expected &&
    !!afterEscape &&
    expected.tag === afterEscape.tag &&
    expected.ariaLabel === afterEscape.ariaLabel &&
    expected.rowIndex === afterEscape.rowIndex;

  return {
    ...open,
    escape: {
      closes: !dialogOpen,
      focusReturned: sameControl,
      focusBefore: trigger,
      focusAfter: afterEscape,
      trigger: expected,
    },
  };
}

// ── the target registry ─────────────────────────────────────────────────────

export const TARGET_SETS = {
  dashboard: [{ id: 'dashboard', url: '/dashboard?days=30' }],

  // The Round-2 dashboard matrix: the same screen, captured with the
  // language switched at runtime, and measured by
  // scripts/measure-dashboard-r2.mjs.
  'dashboard-r2': [{ id: 'dashboard', url: '/dashboard?days=30' }],

  carts: [
    {
      id: 'carts-list',
      url: '/dashboard/carts',
      measure: async (page) => page.evaluate(() => ({
        cartRows: document.querySelectorAll('tr, [data-testid="cart-row"]').length,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      })),
    },
    {
      id: 'cart-dialog',
      url: '/dashboard/carts',
      action: async (page) => {
        const row = page.locator('tr, [data-testid="cart-row"]').first();
        if ((await row.count()) === 0) return { present: false, reason: 'no cart row' };
        await row.click();
        await page.waitForTimeout(600);
        return { present: await dialogOpen(page, 'cart-dialog') || true };
      },
    },
  ],

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
        const clicked = await clickTestId(page, 'order-cancel', { waitFor: 5000 });
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
        const clicked = await clickTestId(page, 'order-refund', { waitFor: 5000 });
        if (!clicked.present) return clicked;
        return { present: await dialogOpen(page, 'refund-dialog'), opened: true };
      },
    },
  ],

  // The order-details v3 matrix: one real order per terminal/flow state.
  // The ids come from the seeded backend (17 orders, verified 2026-10-21):
  //   1 Delivered+Paid with items   8 Shipped+Paid
  //   6 Cancelled+Failed, no items  9 Delivered+Refunded, no items
  //  15 Confirmed+COD pending, no items
  'order-details-v3': [
    { id: 'delivered', url: '/dashboard/orders/1', measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL) },
    { id: 'shipped', url: '/dashboard/orders/8', measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL) },
    { id: 'cancelled', url: '/dashboard/orders/6', measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL) },
    { id: 'refunded', url: '/dashboard/orders/9', measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL) },
    { id: 'no-items', url: '/dashboard/orders/15', measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL) },
  ],

  // The states that are not one of the five orders: the overflow menu's
  // contents and the not-found page.
  'order-details-v3-extra': [
    {
      id: 'kebab',
      url: '/dashboard/orders/1',
      action: async (page) => {
        const menu = await clickTestId(page, 'order-more-actions');
        if (!menu.present) return menu;
        const items = await page.locator('[role="menuitem"]').allInnerTexts();
        return { present: true, items: items.map((i) => i.trim()).filter(Boolean) };
      },
      measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL),
    },
    {
      id: 'not-found',
      url: '/dashboard/orders/999999',
      measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL),
    },
    {
      // Only the transitions the state machine allows: a SHIPPED order can
      // move to DELIVERED and nothing else. The note and notify controls
      // travel with the request.
      id: 'status-dialog',
      url: '/dashboard/orders/8',
      action: async (page) => {
        const clicked = await clickTestId(page, 'order-update-status');
        if (!clicked.present) return clicked;
        return {
          present: await dialogOpen(page, 'status-dialog'),
          options: await page.locator('[data-testid="status-option"]').allInnerTexts(),
          note: (await page.locator('[data-testid="status-note"]').count()) > 0,
          notify: (await page.locator('[data-testid="status-notify"]').count()) > 0,
        };
      },
      measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL),
    },
    {
      // The invoice sheet: print media must drop the chrome and the actions,
      // and the page must be in its LIGHT tokens even when the screen is dark.
      id: 'print',
      url: '/dashboard/orders/1',
      action: async (page) => {
        // `window.print()` fires `beforeprint`; emulateMedia does not. Dispatch
        // it so the captured sheet is the sheet a real print produces (the
        // page removes `.dark` in that handler).
        await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
        await page.emulateMedia({ media: 'print' });
        return { media: 'print' };
      },
      measure: async (page) => {
        const result = await page.evaluate(() => {
          const display = (selector) =>
            document.querySelector(selector)
              ? getComputedStyle(document.querySelector(selector)).display
              : null;
          // `print-hidden` sits on the WRAPPER of some controls, so the
          // control itself still computes `display: inline-flex` with no box.
          // What paper sees is "no box": measure the rect, not the display.
          const visible = (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          const sidebar = document.querySelector('[data-slot="sidebar-container"]');
          const grid = document.querySelector('[data-testid="order-detail-sidebar"]')?.parentElement;
          return {
            actions: display('[data-testid="order-print-invoice"]'),
            back: display('[data-testid="order-back"]'),
            noteEditor: display('[data-testid="order-note-input"]'),
            actionsVisible: visible('[data-testid="order-print-invoice"]'),
            backVisible: visible('[data-testid="order-back"]'),
            noteVisible: visible('[data-testid="order-note-input"]'),
            sidebarChrome: sidebar ? getComputedStyle(sidebar).display : 'absent',
            layout: grid ? getComputedStyle(grid).display : null,
            dark: document.documentElement.classList.contains('dark'),
            printClass: document.documentElement.classList.contains('order-print'),
            background: getComputedStyle(document.body).backgroundColor,
          };
        });
        // Restore the screen through the SAME event a real print fires. This
        // proves the light sheet did not leave a dark screen light.
        const restore = await page.evaluate(() => {
          window.dispatchEvent(new Event('afterprint'));
          return {
            darkAfterRestore: document.documentElement.classList.contains('dark'),
            printClassAfter: document.documentElement.classList.contains('order-print'),
          };
        });
        await page.emulateMedia({ media: 'screen' });
        return { ...result, ...restore };
      },
    },
    {
      // The page with the data this store does NOT record yet: a status
      // history, internal notes, a shipment and a payment reference.
      //
      // <p>FIXTURE, NOT PRODUCT DATA. The real order is fetched first and only
      // the missing fields are added, so the money, the items and the customer
      // stay real. This proves the populated branches render — and keeps the
      // empty states in the other targets honest, because those run with no
      // fixtures at all.
      id: 'populated',
      url: '/dashboard/orders/1',
      routes: [
        {
          url: /\/api\/dashboard\/orders\/1$/,
          handler: async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            json.data.shipment = {
              carrier: 'Aramex',
              trackingNumber: 'ARX-4471902',
              trackingUrl: 'https://www.aramex.com/track/ARX-4471902',
              shippedAt: '2026-10-20T09:20:00Z',
              deliveredAt: '2026-10-21T09:02:00Z',
            };
            await route.fulfill({ response, json });
          },
        },
        {
          url: /\/api\/dashboard\/orders\/1\/history$/,
          handler: (route) =>
            route.fulfill({
              json: {
                success: true,
                message: null,
                data: [
                  { id: 1, orderId: 1, fromStatus: null, toStatus: 'PENDING', note: null, changedBy: 'system', notifyCustomer: false, createdAt: '2026-10-20T05:49:48Z' },
                  { id: 2, orderId: 1, fromStatus: 'PENDING', toStatus: 'CONFIRMED', note: 'Payment captured.', changedBy: 'admin@aurum.local', notifyCustomer: true, createdAt: '2026-10-20T06:05:00Z' },
                  { id: 3, orderId: 1, fromStatus: 'CONFIRMED', toStatus: 'PROCESSING', note: null, changedBy: 'admin@aurum.local', notifyCustomer: false, createdAt: '2026-10-20T06:20:00Z' },
                  { id: 4, orderId: 1, fromStatus: 'PROCESSING', toStatus: 'SHIPPED', note: 'Handed to Aramex.', changedBy: 'admin@aurum.local', notifyCustomer: true, createdAt: '2026-10-20T09:15:00Z' },
                  { id: 5, orderId: 1, fromStatus: 'SHIPPED', toStatus: 'DELIVERED', note: null, changedBy: 'admin@aurum.local', notifyCustomer: true, createdAt: '2026-10-21T09:05:00Z' },
                ],
                errors: [],
                timestamp: '2026-10-21T10:00:00Z',
              },
            }),
        },
        {
          url: /\/api\/dashboard\/orders\/1\/notes$/,
          handler: (route) =>
            route.fulfill({
              json: {
                success: true,
                message: null,
                data: [
                  { id: 2, orderId: 1, author: 'admin@aurum.local', body: 'Customer asked for a coarser grind next time.', internal: true, createdAt: '2026-10-21T09:30:00Z' },
                  { id: 1, orderId: 1, author: 'admin@aurum.local', body: 'Double-checked the roast date before dispatch.', internal: true, createdAt: '2026-10-20T10:40:00Z' },
                ],
                errors: [],
                timestamp: '2026-10-21T10:00:00Z',
              },
            }),
        },
        {
          url: /\/api\/dashboard\/orders\/1\/payment$/,
          handler: async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            json.data.transactionReference = 'TXN-8891-2026';
            json.data.paidAt = '2026-10-20T06:02:00Z';
            await route.fulfill({ response, json });
          },
        },
      ],
      action: async (page) => ({
        fixture: 'populated',
        note: 'history, notes, shipment and payment reference are injected; all other data is the real order',
      }),
      measure: async (page) => page.evaluate(MEASURE_ORDER_DETAIL),
    },
  ],

  // The page's non-happy states, made reachable by stalling or failing the
  // order request. Fixtures only — nothing here runs in the app.
  'order-details-v3-states': [
    {
      id: 'loading',
      url: '/dashboard/orders/1',
      routes: [
        {
          url: /\/api\/dashboard\/orders\/1$/,
          handler: async (route) => {
            // Hold the response past the harness's network-idle timeout
            // (30 s) so the screenshot lands on the skeleton, not on the
            // loaded page. The run then navigates away, which aborts it.
            await new Promise((resolve) => setTimeout(resolve, 90_000));
            await route.continue().catch(() => {});
          },
        },
      ],
      action: async (page) => ({
        loading: await page.locator('[data-testid="order-detail-loading"]').count(),
      }),
    },
    {
      id: 'error',
      url: '/dashboard/orders/2',
      routes: [
        {
          url: /\/api\/dashboard\/orders\/2$/,
          handler: (route) =>
            route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                message: 'The order could not be loaded.',
                data: null,
                errors: [],
                timestamp: '2026-10-21T10:00:00Z',
              }),
            }),
        },
      ],
      action: async (page) => ({
        error: await page.locator('[data-testid="order-detail-error"]').count(),
        retry: await page.locator('[data-testid="order-detail-error"] button').first().innerText(),
      }),
    },
  ],

  // The return path: open a FILTERED list, click a row, then click the
  // "Orders" crumb. The crumb must hand the list back its filters.
  'order-details-v3-return': [
    {
      id: 'filtered-return',
      url: '/dashboard/orders?status=DELIVERED',
      action: async (page) => {
        const row = page.locator('tbody tr').first();
        if ((await row.count()) === 0) return { present: false, reason: 'no rows' };
        await row.click();
        await page.waitForURL('**/dashboard/orders/*', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const detailUrl = page.url();
        // The last crumb is the CURRENT page (no href, aria-disabled); the
        // one before it is "Orders".
        const crumb = page.locator('nav ol a[href]').last();
        const crumbHref = await crumb.getAttribute('href').catch(() => null);
        await crumb.click();
        await page.waitForTimeout(1500);
        return {
          present: true,
          detailUrl,
          crumbHref,
          backUrl: page.url(),
          preservedFilters: /status=DELIVERED/i.test(page.url()),
        };
      },
      measure: async (page) =>
        page.evaluate(() => ({
          url: location.pathname + location.search,
          breadcrumb: (document.querySelector('nav ol')?.textContent || '').trim().replace(/\s+/g, ' '),
        })),
    },
  ],

  reviews: [
    { id: 'reviews-table', url: '/dashboard/reviews?view=list' },
    { id: 'reviews-grid', url: '/dashboard/reviews?view=grid' },
    { id: 'reviews-pending', url: '/dashboard/reviews?status=pending' },
  ],

  // The review DETAILS DIALOG (ui/review-dialog-v3): the same dialog in the
  // four states the brief names, plus the grid trigger.
  'review-dialog': [
    {
      id: 'review-dialog-approved',
      url: '/dashboard/reviews?status=approved&view=list',
      action: (page) => openReviewDialog(page, 'short'),
      measure: (page) => measureReviewDialog(page),
    },
    {
      id: 'review-dialog-pending',
      url: '/dashboard/reviews?status=pending&view=list',
      action: (page) => openReviewDialog(page, 'short'),
      measure: (page) => measureReviewDialog(page),
    },
    {
      id: 'review-dialog-verified',
      url: '/dashboard/reviews?status=all&view=list',
      action: (page) => openReviewDialog(page, 'verified'),
      measure: (page) => measureReviewDialog(page),
    },
    {
      id: 'review-dialog-long-comment',
      url: '/dashboard/reviews?status=all&view=list',
      action: (page) => openReviewDialog(page, 'long'),
      measure: (page) => measureReviewDialog(page),
    },
    {
      id: 'review-dialog-grid',
      url: '/dashboard/reviews?status=all&view=grid',
      action: (page) => openReviewDialogFromGrid(page),
      measure: (page) => measureReviewDialog(page),
    },
  ],

  'global-search': [
    {
      id: 'gsp-empty',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(300);
        return { state: 'empty' };
      },
      measure: async (page) => page.evaluate(() => ({ modalWidth: (document.querySelector('[role="dialog"]')||{}).getBoundingClientRect?.()?.width||null, groups: document.querySelectorAll('[role="listbox"] .tracking-wider').length, activeReachable: !!document.querySelector('[role="option"]') })),
    },
    {
      id: 'gsp-results-ah',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('ahmed', { delay: 20 });
        await page.waitForTimeout(800);
        return { state: 'results-ah' };
      },
      measure: async (page) => page.evaluate(() => ({ modalWidth: (document.querySelector('[role="dialog"]')||{}).getBoundingClientRect?.()?.width||null, groups: document.querySelectorAll('[role="listbox"] .tracking-wider').length, activeReachable: !!document.querySelector('[role="option"]') })),
    },
    {
      id: 'gsp-results-ar',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('احمد', { delay: 20 });
        await page.waitForTimeout(800);
        return { state: 'results-ar' };
      },
      measure: async (page) => page.evaluate(() => ({ modalWidth: (document.querySelector('[role="dialog"]')||{}).getBoundingClientRect?.()?.width||null, groups: document.querySelectorAll('[role="listbox"] .tracking-wider').length, activeReachable: !!document.querySelector('[role="option"]') })),
    },
    {
      id: 'gsp-no-results',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('zzzzzz', { delay: 20 });
        await page.waitForTimeout(800);
        return { state: 'no-results' };
      },
      measure: async (page) => page.evaluate(() => ({ modalWidth: (document.querySelector('[role="dialog"]')||{}).getBoundingClientRect?.()?.width||null, groups: document.querySelectorAll('[role="listbox"] .tracking-wider').length, activeReachable: !!document.querySelector('[role="option"]') })),
    },
    {
      id: 'gsp-error',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('error', { delay: 20 });
        await page.waitForTimeout(800);
        return { state: 'error' };
      },
      measure: async (page) => page.evaluate(() => ({ modalWidth: (document.querySelector('[role="dialog"]')||{}).getBoundingClientRect?.()?.width||null, groups: document.querySelectorAll('[role="listbox"] .tracking-wider').length, activeReachable: !!document.querySelector('[role="option"]') })),
    },
  ],
  'contact-reviews': [
    {
      id: 'contact-list',
      url: '/dashboard/contact-messages',
      measure: async (page) => page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('[data-testid="message-row"]'));
        return { rowCount: rows.length, horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
      }),
    },
    {
      id: 'contact-dialog-empty',
      url: '/dashboard/contact-messages',
      action: async (page) => {
        const row = page.locator('[data-testid="message-row"]').first();
        if ((await row.count()) === 0) return { present: false, reason: 'no rows' };
        await row.click();
        await page.waitForTimeout(600);
        return { present: await dialogOpen(page, 'dialog-shell'), opened: true };
      },
    },
    {
      id: 'contact-dialog-thread',
      url: '/dashboard/contact-messages',
      action: async (page) => {
        const row = page.locator('[data-testid="message-row"]').filter({ hasText: /replied/i }).first();
        if ((await row.count()) === 0) return { present: false, reason: 'no replied rows' };
        await row.click();
        await page.waitForTimeout(600);
        return { present: await dialogOpen(page, 'dialog-shell'), opened: true };
      },
    },
    {
      id: 'reviews-table',
      url: '/dashboard/reviews',
      measure: async (page) => page.evaluate(() => {
        const table = document.querySelector('app-data-table table');
        const headers = table ? Array.from(table.querySelectorAll('thead th')).map((th) => ({ text: (th.textContent||'').trim().replace(/\\s+/g,' '), widthPx: Math.round(th.getBoundingClientRect().width) })) : [];
        const gap = (() => {
          const ths = table ? Array.from(table.querySelectorAll('thead th')) : [];
          const ratingIdx = ths.findIndex((th) => /rating|التقييم/i.test((th.textContent||'').trim()));
          const commentIdx = ths.findIndex((th) => /comment|التعليق/i.test((th.textContent||'').trim()));
          if (ratingIdx < 0 || commentIdx < 0) return null;
          const r = ths[ratingIdx].getBoundingClientRect();
          const c = ths[commentIdx].getBoundingClientRect();
          return Math.round(c.left - r.right);
        })();
        const truncatedProducts = Array.from(document.querySelectorAll('td[data-column^="main_"]')).filter((td) => {
          const el = td.querySelector('*');
          return !!el && getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth;
        }).length;
        return {
          horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          gapRatingCommentPx: gap,
          truncatedProductNames: truncatedProducts,
          headers,
          rowCount: table ? table.querySelectorAll('tbody tr').length : 0,
        };
      }),
    },
    {
      id: 'reviews-grid',
      url: '/dashboard/reviews',
      action: async (page) => {
        const btn = page.locator('button[aria-label*="Grid"], button[title*="Grid"]').first();
        if ((await btn.count()) === 0) return { present: false, reason: 'no grid toggle' };
        await btn.click();
        await page.waitForTimeout(600);
        return { present: true, opened: true };
      },
      measure: async (page) => page.evaluate(() => ({
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      })),
    },
    {
      id: 'review-dialog-pending',
      url: '/dashboard/reviews',
      action: async (page) => {
        const row = page.locator('tr').filter({ hasText: /pending|قيد المراجعة/i }).first();
        const btn = row.locator('button[aria-label="View"]').first();
        if ((await btn.count()) === 0) return { present: false, reason: 'no view button' };
        await btn.click();
        await page.waitForTimeout(600);
        return { present: await dialogOpen(page, 'dialog-shell'), opened: true };
      },
    },
    {
      id: 'review-dialog-approved',
      url: '/dashboard/reviews',
      action: async (page) => {
        const row = page.locator('tr').filter({ hasText: /approved|معتمد/i }).first();
        const btn = row.locator('button[aria-label="View"]').first();
        if ((await btn.count()) === 0) return { present: false, reason: 'no view button' };
        await btn.click();
        await page.waitForTimeout(600);
        return { present: await dialogOpen(page, 'dialog-shell'), opened: true };
      },
    },
  ],

  'global-search': [
    {
      id: 'gsp-empty',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(300);
        const input = page.locator('app-global-search-palette input').first();
        if (await input.count()) await input.focus();
        return { state: 'empty' };
      },
      measure: async (page) => page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        const trigger = document.querySelector('button[aria-label*="Search"], button[aria-label*="search"]');
        const modalRect = modal ? modal.getBoundingClientRect() : null;
        const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
        const groups = document.querySelectorAll('[role="listbox"] .uppercase, [role="listbox"] [class*="tracking-wider"]').length;
        const active = document.querySelector('[aria-selected="true"], [role="option"]');
        const mark = document.querySelector('mark');
        const badge = document.querySelector('[class*="bg-success-soft"], [class*="bg-warning-soft"], [class*="bg-info-soft"]');
        function parseRgb(str){const m=str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0];}
        function relLum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
        function contrast(fg,bg){const l1=relLum(parseRgb(fg));const l2=relLum(parseRgb(bg));const hi=Math.max(l1,l2);const lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}
        const activeStyle = active ? getComputedStyle(active) : null;
        const markStyle = mark ? getComputedStyle(mark) : null;
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        const activeContrast = activeStyle ? contrast(activeStyle.color, activeStyle.backgroundColor) : null;
        const markContrast = markStyle ? contrast(markStyle.color, markStyle.backgroundColor) : null;
        const badgeContrast = badgeStyle ? contrast(badgeStyle.color, badgeStyle.backgroundColor) : null;
        return {
          modalWidth: modalRect ? Math.round(modalRect.width) : null,
          triggerWidth: triggerRect ? Math.round(triggerRect.width) : null,
          widthRatio: modalRect && triggerRect ? +(modalRect.width/triggerRect.width).toFixed(2) : null,
          entityGroupsShown: groups,
          activeRowKeyboardReachable: !!active,
          hasHighlightMark: !!mark,
          markBg: mark ? getComputedStyle(mark).backgroundColor : null,
          activeRowBg: active ? getComputedStyle(active).backgroundColor : null,
          contrastActiveRow: activeContrast,
          contrastHighlight: markContrast,
          contrastBadge: badgeContrast,
        };
      }),
    },
    {
      id: 'gsp-loading',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('ah', { delay: 20 });
        await page.waitForTimeout(300);
        return { state: 'loading' };
      },
      measure: async (page) => page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        const trigger = document.querySelector('button[aria-label*="Search"], button[aria-label*="search"]');
        const modalRect = modal ? modal.getBoundingClientRect() : null;
        const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
        const groups = document.querySelectorAll('[role="listbox"] .uppercase, [role="listbox"] [class*="tracking-wider"]').length;
        const active = document.querySelector('[aria-selected="true"], [role="option"]');
        const mark = document.querySelector('mark');
        const badge = document.querySelector('[class*="bg-success-soft"], [class*="bg-warning-soft"], [class*="bg-info-soft"]');
        function parseRgb(str){const m=str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0];}
        function relLum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
        function contrast(fg,bg){const l1=relLum(parseRgb(fg));const l2=relLum(parseRgb(bg));const hi=Math.max(l1,l2);const lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}
        const activeStyle = active ? getComputedStyle(active) : null;
        const markStyle = mark ? getComputedStyle(mark) : null;
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        const activeContrast = activeStyle ? contrast(activeStyle.color, activeStyle.backgroundColor) : null;
        const markContrast = markStyle ? contrast(markStyle.color, markStyle.backgroundColor) : null;
        const badgeContrast = badgeStyle ? contrast(badgeStyle.color, badgeStyle.backgroundColor) : null;
        return {
          modalWidth: modalRect ? Math.round(modalRect.width) : null,
          triggerWidth: triggerRect ? Math.round(triggerRect.width) : null,
          widthRatio: modalRect && triggerRect ? +(modalRect.width/triggerRect.width).toFixed(2) : null,
          entityGroupsShown: groups,
          activeRowKeyboardReachable: !!active,
          hasHighlightMark: !!mark,
          markBg: mark ? getComputedStyle(mark).backgroundColor : null,
          activeRowBg: active ? getComputedStyle(active).backgroundColor : null,
          contrastActiveRow: activeContrast,
          contrastHighlight: markContrast,
          contrastBadge: badgeContrast,
        };
      }),
    },
    {
      id: 'gsp-results-ah',
      url: '/dashboard?days=30',
      action: async (page) => {
        let reqs = 0;
        const handler = (req) => { if (req.url().includes('/api/')) reqs++; };
        page.on('request', handler);
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('ahmed', { delay: 20 });
        await page.waitForTimeout(800);
        page.off('request', handler);
        return { state: 'results-ah', requestsFired: reqs };
      },
      measure: async (page) => page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        const trigger = document.querySelector('button[aria-label*="Search"], button[aria-label*="search"]');
        const modalRect = modal ? modal.getBoundingClientRect() : null;
        const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
        const groups = document.querySelectorAll('[role="listbox"] .uppercase, [role="listbox"] [class*="tracking-wider"]').length;
        const active = document.querySelector('[aria-selected="true"], [role="option"]');
        const mark = document.querySelector('mark');
        const badge = document.querySelector('[class*="bg-success-soft"], [class*="bg-warning-soft"], [class*="bg-info-soft"]');
        function parseRgb(str){const m=str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0];}
        function relLum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
        function contrast(fg,bg){const l1=relLum(parseRgb(fg));const l2=relLum(parseRgb(bg));const hi=Math.max(l1,l2);const lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}
        const activeStyle = active ? getComputedStyle(active) : null;
        const markStyle = mark ? getComputedStyle(mark) : null;
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        const activeContrast = activeStyle ? contrast(activeStyle.color, activeStyle.backgroundColor) : null;
        const markContrast = markStyle ? contrast(markStyle.color, markStyle.backgroundColor) : null;
        const badgeContrast = badgeStyle ? contrast(badgeStyle.color, badgeStyle.backgroundColor) : null;
        return {
          modalWidth: modalRect ? Math.round(modalRect.width) : null,
          triggerWidth: triggerRect ? Math.round(triggerRect.width) : null,
          widthRatio: modalRect && triggerRect ? +(modalRect.width/triggerRect.width).toFixed(2) : null,
          entityGroupsShown: groups,
          activeRowKeyboardReachable: !!active,
          hasHighlightMark: !!mark,
          markBg: mark ? getComputedStyle(mark).backgroundColor : null,
          activeRowBg: active ? getComputedStyle(active).backgroundColor : null,
          contrastActiveRow: activeContrast,
          contrastHighlight: markContrast,
          contrastBadge: badgeContrast,
        };
      }),
    },
    {
      id: 'gsp-results-ar',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('احمد', { delay: 20 });
        await page.waitForTimeout(800);
        return { state: 'results-ar' };
      },
      measure: async (page) => page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        const trigger = document.querySelector('button[aria-label*="Search"], button[aria-label*="search"]');
        const modalRect = modal ? modal.getBoundingClientRect() : null;
        const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
        const groups = document.querySelectorAll('[role="listbox"] .uppercase, [role="listbox"] [class*="tracking-wider"]').length;
        const active = document.querySelector('[aria-selected="true"], [role="option"]');
        const mark = document.querySelector('mark');
        const badge = document.querySelector('[class*="bg-success-soft"], [class*="bg-warning-soft"], [class*="bg-info-soft"]');
        function parseRgb(str){const m=str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0];}
        function relLum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
        function contrast(fg,bg){const l1=relLum(parseRgb(fg));const l2=relLum(parseRgb(bg));const hi=Math.max(l1,l2);const lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}
        const activeStyle = active ? getComputedStyle(active) : null;
        const markStyle = mark ? getComputedStyle(mark) : null;
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        const activeContrast = activeStyle ? contrast(activeStyle.color, activeStyle.backgroundColor) : null;
        const markContrast = markStyle ? contrast(markStyle.color, markStyle.backgroundColor) : null;
        const badgeContrast = badgeStyle ? contrast(badgeStyle.color, badgeStyle.backgroundColor) : null;
        return {
          modalWidth: modalRect ? Math.round(modalRect.width) : null,
          triggerWidth: triggerRect ? Math.round(triggerRect.width) : null,
          widthRatio: modalRect && triggerRect ? +(modalRect.width/triggerRect.width).toFixed(2) : null,
          entityGroupsShown: groups,
          activeRowKeyboardReachable: !!active,
          hasHighlightMark: !!mark,
          markBg: mark ? getComputedStyle(mark).backgroundColor : null,
          activeRowBg: active ? getComputedStyle(active).backgroundColor : null,
          contrastActiveRow: activeContrast,
          contrastHighlight: markContrast,
          contrastBadge: badgeContrast,
        };
      }),
    },
    {
      id: 'gsp-no-results',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('zzzzzz', { delay: 20 });
        await page.waitForTimeout(800);
        return { state: 'no-results' };
      },
      measure: async (page) => page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        const trigger = document.querySelector('button[aria-label*="Search"], button[aria-label*="search"]');
        const modalRect = modal ? modal.getBoundingClientRect() : null;
        const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
        const groups = document.querySelectorAll('[role="listbox"] .uppercase, [role="listbox"] [class*="tracking-wider"]').length;
        const active = document.querySelector('[aria-selected="true"], [role="option"]');
        const mark = document.querySelector('mark');
        const badge = document.querySelector('[class*="bg-success-soft"], [class*="bg-warning-soft"], [class*="bg-info-soft"]');
        function parseRgb(str){const m=str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0];}
        function relLum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
        function contrast(fg,bg){const l1=relLum(parseRgb(fg));const l2=relLum(parseRgb(bg));const hi=Math.max(l1,l2);const lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}
        const activeStyle = active ? getComputedStyle(active) : null;
        const markStyle = mark ? getComputedStyle(mark) : null;
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        const activeContrast = activeStyle ? contrast(activeStyle.color, activeStyle.backgroundColor) : null;
        const markContrast = markStyle ? contrast(markStyle.color, markStyle.backgroundColor) : null;
        const badgeContrast = badgeStyle ? contrast(badgeStyle.color, badgeStyle.backgroundColor) : null;
        return {
          modalWidth: modalRect ? Math.round(modalRect.width) : null,
          triggerWidth: triggerRect ? Math.round(triggerRect.width) : null,
          widthRatio: modalRect && triggerRect ? +(modalRect.width/triggerRect.width).toFixed(2) : null,
          entityGroupsShown: groups,
          activeRowKeyboardReachable: !!active,
          hasHighlightMark: !!mark,
          markBg: mark ? getComputedStyle(mark).backgroundColor : null,
          activeRowBg: active ? getComputedStyle(active).backgroundColor : null,
          contrastActiveRow: activeContrast,
          contrastHighlight: markContrast,
          contrastBadge: badgeContrast,
        };
      }),
    },
    {
      id: 'gsp-error',
      url: '/dashboard?days=30',
      action: async (page) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(200);
        await page.keyboard.type('error', { delay: 20 });
        await page.waitForTimeout(800);
        return { state: 'error' };
      },
      measure: async (page) => page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        const trigger = document.querySelector('button[aria-label*="Search"], button[aria-label*="search"]');
        const modalRect = modal ? modal.getBoundingClientRect() : null;
        const triggerRect = trigger ? trigger.getBoundingClientRect() : null;
        const groups = document.querySelectorAll('[role="listbox"] .uppercase, [role="listbox"] [class*="tracking-wider"]').length;
        const active = document.querySelector('[aria-selected="true"], [role="option"]');
        const mark = document.querySelector('mark');
        const badge = document.querySelector('[class*="bg-success-soft"], [class*="bg-warning-soft"], [class*="bg-info-soft"]');
        function parseRgb(str){const m=str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0];}
        function relLum(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
        function contrast(fg,bg){const l1=relLum(parseRgb(fg));const l2=relLum(parseRgb(bg));const hi=Math.max(l1,l2);const lo=Math.min(l1,l2);return +((hi+0.05)/(lo+0.05)).toFixed(2);}
        const activeStyle = active ? getComputedStyle(active) : null;
        const markStyle = mark ? getComputedStyle(mark) : null;
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        const activeContrast = activeStyle ? contrast(activeStyle.color, activeStyle.backgroundColor) : null;
        const markContrast = markStyle ? contrast(markStyle.color, markStyle.backgroundColor) : null;
        const badgeContrast = badgeStyle ? contrast(badgeStyle.color, badgeStyle.backgroundColor) : null;
        return {
          modalWidth: modalRect ? Math.round(modalRect.width) : null,
          triggerWidth: triggerRect ? Math.round(triggerRect.width) : null,
          widthRatio: modalRect && triggerRect ? +(modalRect.width/triggerRect.width).toFixed(2) : null,
          entityGroupsShown: groups,
          activeRowKeyboardReachable: !!active,
          hasHighlightMark: !!mark,
          markBg: mark ? getComputedStyle(mark).backgroundColor : null,
          activeRowBg: active ? getComputedStyle(active).backgroundColor : null,
          contrastActiveRow: activeContrast,
          contrastHighlight: markContrast,
          contrastBadge: badgeContrast,
        };
      }),
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

// ── the fixtures of the review-dialog phase ─────────────────────────────────
//
// The "very long comment" state needs a review with 600+ characters, and the
// seed has none. The fixture is a REAL review: it is created through the
// public API (the same call the storefront makes) and removed again through
// the admin delete endpoint, so the evidence shows the app with real data and
// the database is left as it was found.

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';

/** A comment long enough to prove the body scrolls (600+ characters). */
const LONG_COMMENT = [
  'This is a deliberately long review comment used by the dashboard evidence',
  'harness to prove that the review details dialog scrolls a 600+ character',
  'comment instead of growing past the viewport, and that the body scrolls',
  'while the footer stays put. A moderator reads the first sentence, decides,',
  'and never scrolls — the rest of the paragraph is here to make the point: a',
  'dialog that grows with its content pushes the actions off the screen, and',
  'the actions are the reason the dialog is open in the first place. The',
  'paragraph keeps going so that the scroll area is real and not a rounding',
  'error, and so that the measurement has something to measure at all.',
].join(' ');

/**
 * The access token of the running app, taken from the Authorization header
 * the auth interceptor puts on every API call. A second login is NOT made:
 * the backend rate-limits POST /api/auth/login.
 */
export async function captureToken(page) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off('request', onRequest);
      reject(new Error('no API request carried an Authorization header'));
    }, 30_000);
    function onRequest(request) {
      const header = request.headers()['authorization'];
      if (!header || !header.startsWith('Bearer ')) return;
      clearTimeout(timer);
      page.off('request', onRequest);
      resolve(header.slice('Bearer '.length));
    }
    page.on('request', onRequest);
  });
}

export const PHASE_HOOKS = {
  'review-dialog': {
    /**
     * Make sure a long review exists, and reuse it when it does.
     *
     * <p>The fixture is reused on purpose: the "before" and the "after" runs
     * must show the SAME review, or the comparison is not a comparison.
     */
    setup: async (page) => {
      const tokenPromise = captureToken(page);
      await page.goto(`${process.env.E2E_BASE_URL ?? 'http://localhost:4200'}/dashboard/reviews`, {
        waitUntil: 'domcontentloaded',
      });
      const token = await tokenPromise;
      const headers = { Authorization: `Bearer ${token}` };

      const list = await page.request.get(`${API_URL}/api/dashboard/reviews?size=100`, { headers });
      const body = await list.json();
      const existing = (body?.data?.content ?? []).find((r) => (r.comment ?? '').length >= 600);
      if (existing) {
        return { fixtureId: existing.id, slug: existing.productSlug, created: false, token };
      }

      const products = await page.request.get(`${API_URL}/api/dashboard/products?size=100`, {
        headers,
      });
      const productBody = await products.json();
      const slugs = (productBody?.data?.content ?? []).map((p) => p.slug);

      const failures = [];
      for (const slug of slugs) {
        const created = await page.request.post(`${API_URL}/api/products/reviews`, {
          headers: { ...headers, 'Content-Type': 'application/json' },
          data: { productSlug: slug, rating: 4, comment: LONG_COMMENT },
        });
        if (created.ok()) {
          const createdBody = await created.json();
          return {
            fixtureId: createdBody?.data?.id ?? null,
            slug,
            created: true,
            token,
            failures,
          };
        }
        failures.push({ slug, status: created.status() });
      }
      return { fixtureId: null, slug: null, created: false, token, failures };
    },

    /** Remove the fixture — only when the run was asked to clean up. */
    teardown: async (page, context) => {
      if (!process.argv.includes('--cleanup-fixtures')) return { cleaned: false };
      if (!context?.fixtureId) return { cleaned: false, reason: 'no fixture was created' };
      const headers = { Authorization: `Bearer ${context.token}` };
      const res = await page.request.delete(`${API_URL}/api/dashboard/reviews/${context.fixtureId}`, {
        headers,
      });
      return { cleaned: res.ok(), status: res.status(), fixtureId: context.fixtureId };
    },
  },
};

export { settle, GENERIC_MEASURE, CONTRAST_HELPERS };
