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
    cancelled,
    total,
    netPaid,
    totalsMismatchShown: mismatch,
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
      measure: async (page) => page.evaluate(() => ({
        rowCount: document.querySelectorAll('[data-testid="message-row"]').length,
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      })),
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
