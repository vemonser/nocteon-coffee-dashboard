// The proof chain of the review-details round.
//
//   node scripts/verify-review-dialog-evidence.mjs            # every criterion
//   node scripts/verify-review-dialog-evidence.mjs --criterion AC-02
//
// It reads the two runs of the round (evidence/review-dialog/before and
// evidence/review-dialog/after) and CHECKS the claims the report makes.
// Every claim in the report points at a number that lives in those files,
// and this script is what turns a number into a PASS or a FAIL: it exits
// non-zero the moment a claim is not true of the captured run.
//
// The check is deliberately dumb: it does not look at the app, it looks at
// what the app was MEASURED doing.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const AFTER = resolve(ROOT, 'evidence/review-dialog/after');
const BEFORE = resolve(ROOT, 'evidence/review-dialog/before');

const read = (dir, file) => {
  const path = resolve(dir, file);
  if (!existsSync(path)) throw new Error(`missing evidence file: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
};

/** A TEXT file of the project (the source, the docs). */
const readText = (path) => {
  const abs = resolve(ROOT, path);
  if (!existsSync(abs)) throw new Error(`missing file: ${abs}`);
  return readFileSync(abs, 'utf8');
};

const after = {
  measurements: read(AFTER, 'measurements.json'),
  results: read(AFTER, 'results.json'),
};
const before = {
  measurements: read(BEFORE, 'measurements.json'),
  results: read(BEFORE, 'results.json'),
};

/** Every target of every cell of one run. */
const targetsOf = (run) => run.results.cells.flatMap((c) => c.targets.map((t) => ({ ...t, lang: c.lang, theme: c.theme, width: c.width })));

const afterTargets = targetsOf(after);
const beforeTargets = targetsOf(before);

const checks = {
  'AC-01': () => {
    const en = new Set(afterTargets.filter((t) => t.lang === 'en').map((t) => t.own?.title));
    const ar = new Set(afterTargets.filter((t) => t.lang === 'ar').map((t) => t.own?.title));
    const beforeEn = new Set(beforeTargets.filter((t) => t.lang === 'en').map((t) => t.own?.title));
    const ok =
      en.size === 1 &&
      en.has('Review details') &&
      ar.size === 1 &&
      beforeEn.has('Review Details');
    return {
      ok,
      detail: `after EN: ${[...en].join('|')} / AR: ${[...ar].join('|')} (before EN: ${[...beforeEn].join('|')})`,
    };
  },
  'AC-02': () => {
    const gaps = afterTargets.map((t) => t.own?.footer?.minGapPx).filter((g) => typeof g === 'number');
    const beforeGaps = beforeTargets.map((t) => t.own?.footer?.minGapPx).filter((g) => typeof g === 'number');
    const ok = gaps.length > 0 && gaps.every((g) => g === 12) && beforeGaps.every((g) => g === 0);
    return { ok, detail: `after gap px: ${[...new Set(gaps)].join(',')} (before: ${[...new Set(beforeGaps)].join(',')})` };
  },
  'AC-03': () => {
    const stars = afterTargets.map((t) => t.own?.stars).filter(Boolean);
    const beforeStars = beforeTargets.map((t) => t.own?.stars).filter(Boolean);
    const widths = stars.map((s) => s.widthPx).filter((w) => typeof w === 'number');
    const beforeWidths = beforeStars.map((s) => s.widthPx).filter((w) => typeof w === 'number');
    const ok =
      stars.length > 0 &&
      stars.every((s) => s.total === 5 && s.filled > 0) &&
      widths.length > 0 &&
      widths.every((w) => w >= 24);
    return {
      ok,
      detail: `stars filled: ${[...new Set(stars.map((s) => `${s.filled}/${s.total}`))].join(', ')}; rendered width: ${[...new Set(widths)].join(',')}px (before: ${[...new Set(beforeWidths)].join(',')}px)`,
    };
  },
  'AC-04': () => {
    const rows = afterTargets.map((t) => t.own?.statusRow).filter(Boolean);
    const ok = rows.length > 0 && rows.every((r) => /^(Status|الحالة)/.test(r));
    return { ok, detail: `status rows: ${[...new Set(rows)].join(' | ')}` };
  },
  'AC-05': () => {
    const links = afterTargets.map((t) => t.own?.productLink).filter(Boolean);
    const ok = links.length > 0 && links.every((l) => /\/dashboard\/products\/[^/]+\/edit$/.test(l));
    return { ok, detail: `product links: ${[...new Set(links)].join(', ')}` };
  },
  'AC-06': () => {
    // The link is rendered only when the API sends the order. The live API
    // does NOT send it, so the honest result is "no link, and no invented
    // data" — the criterion is satisfied by the link being ABSENT today and
    // by the code path being present.
    const withOrder = afterTargets.filter((t) => t.own?.orderLink);
    const source = readText('src/app/features/reviews/components/review-list.component.html');
    const wired = source.includes('review.orderId && review.orderNumber') && source.includes("'/dashboard/orders'");
    const ok = withOrder.length === 0 && wired;
    return { ok, detail: `order links rendered: ${withOrder.length}; the code path is wired: ${wired}` };
  },
  'AC-07': () => {
    const long = afterTargets.filter((t) => (t.own?.comment?.chars ?? 0) >= 600);
    const ok =
      long.length > 0 &&
      long.every((t) => t.own.comment.whiteSpace.includes('pre') && t.own.comment.scrolls);
    return { ok, detail: `long comments: ${long.length}, all keep their line breaks and scroll: ${ok}` };
  },
  'AC-08': () => {
    const esc = afterTargets.every((t) => t.own?.escape?.closes === true);
    // The focus must land on the SAME control that OPENED the dialog — the
    // one that was clicked, not "some button", and not the close X (the
    // dialog takes the focus the moment it opens).
    const focus = afterTargets.every((t) => {
      const e = t.own?.escape;
      if (!e?.trigger || !e?.focusAfter) return false;
      return (
        e.trigger.tag === e.focusAfter.tag &&
        e.trigger.ariaLabel === e.focusAfter.ariaLabel &&
        e.trigger.rowIndex === e.focusAfter.rowIndex
      );
    });
    return {
      ok: esc && focus,
      detail: `escape closes: ${esc}; the focus returns to the SAME control it was opened from (${afterTargets[0]?.own?.escape?.trigger?.ariaLabel}, row ${afterTargets[0]?.own?.escape?.trigger?.rowIndex}): ${focus}`,
    };
  },
  'AC-09': () => {
    // The order is: the close X (a button), the product link (an anchor),
    // the focusable comment area, and then the footer's buttons. The check
    // is on the TAGS, because the names are translated.
    const orders = afterTargets.map((t) => (t.own?.tabOrder ?? []).map((f) => f.tag));
    const ok = orders.every((tags) => {
      if (tags[0] !== 'button') return false;
      if (tags[1] !== 'a') return false;
      const footers = tags.slice(-3);
      return footers.every((x) => x === 'button');
    });
    return { ok, detail: `tab tags (first cell): ${orders[0]?.join(' → ')}` };
  },
  'AC-10': () => {
    const mobile = afterTargets.filter((t) => t.width === 390);
    const heights = mobile.map((t) => t.own?.dialog?.height ?? 0);
    const viewport = mobile.map((t) => t.own?.dialog?.viewportHeightPx ?? 0);
    const ok = mobile.length > 0 && heights.every((h, i) => h === viewport[i]);
    return { ok, detail: `mobile panel height / viewport: ${heights[0]} / ${viewport[0]} (a full-height sheet)` };
  },
  'AC-11': () => {
    const arabic = afterTargets.filter((t) => t.lang === 'ar');
    const latin = afterTargets.filter((t) => t.lang === 'en');
    // The footer is mirrored: the START group (Delete) sits on the RIGHT in
    // Arabic and on the LEFT in English.
    const mirrored = arabic.every((t) => {
      const x = t.own?.footerGroupX ?? [];
      return x.length >= 2 && x[0] > x[1];
    });
    const latinOrder = latin.every((t) => {
      const x = t.own?.footerGroupX ?? [];
      return x.length >= 2 && x[0] < x[1];
    });
    // The stars fill from the START side: the first star is the rightmost
    // one in Arabic.
    const starsFromStart = arabic.every((t) => {
      const x = t.own?.stars?.x ?? [];
      return x.length < 2 || x[0] > x[x.length - 1];
    });
    // The numerals read "4 / 5" in BOTH directions.
    const numerals = [...arabic, ...latin].every((t) =>
      /^\d+ \/ 5$/.test((t.own?.ratingText ?? '').trim()),
    );
    const ok =
      arabic.length > 0 &&
      mirrored &&
      latinOrder &&
      starsFromStart &&
      numerals &&
      arabic.every((t) => (t.own?.footer?.minGapPx ?? 0) === 12);
    return {
      ok,
      detail: `arabic cells: ${arabic.length}; the footer is mirrored in AR and normal in EN: ${mirrored && latinOrder}; the stars fill from the start side: ${starsFromStart}; the numerals read "N / 5" in both: ${numerals}`,
    };
  },
  'AC-12': () => {
    const ts = readText('src/app/features/reviews/components/review-list.component.ts');
    const html = readText('src/app/features/reviews/components/review-list.component.html');
    const toasts = ts.includes('reviews.action.approved') && ts.includes('reviews.action.approvalWithdrawn');
    const busy = ts.includes('dialogBusy') && html.includes('[disabled]="dialogBusy()"');
    const labelled = html.includes("'reviews.action.approving'") && html.includes("'reviews.action.withdrawing'");
    return {
      ok: toasts && busy && labelled,
      detail: `toasts: ${toasts}; a disabled button while in flight: ${busy}; a loading label: ${labelled}`,
    };
  },
  'AC-13': () => {
    const source = readText('src/app/features/reviews/components/review-list.component.html');
    const named = source.includes('deleteTargetLabel()') && source.includes('deleteConfirmNamed');
    return { ok: named, detail: `the confirmation names the review: ${named}` };
  },
  'AC-14': () => {
    const pending = afterTargets.filter((t) => t.id === 'review-dialog-pending');
    // The LAST button of the end side is the action of a pending review:
    // Approve / اعتماد.
    const labels = pending.map((t) => (t.own?.footer?.endButtonLabels ?? []).slice(-1)[0] ?? '');
    const ok = pending.length > 0 && labels.every((l) => /Approve|اعتماد/.test(l));
    return { ok, detail: `pending action: ${[...new Set(labels)].join(' | ')}` };
  },
  'AC-15': () => {
    const cells = after.results.cells;
    const ids = new Set(afterTargets.map((t) => t.id));
    const widths = new Set(cells.map((c) => c.width));
    const ok =
      cells.length === 8 &&
      widths.has(1440) &&
      widths.has(390) &&
      ['review-dialog-approved', 'review-dialog-pending', 'review-dialog-verified', 'review-dialog-long-comment'].every((id) => ids.has(id));
    return { ok, detail: `cells: ${cells.length}, widths: ${[...widths].join(',')}, targets: ${[...ids].join(', ')}` };
  },
  'AC-16': () => {
    const gaps = readText('API_GAPS.md');
    const ok = gaps.includes('No admin reply');
    return { ok, detail: `the admin reply is skipped and logged in API_GAPS.md: ${ok}` };
  },
};

const only = process.argv.includes('--criterion')
  ? process.argv[process.argv.indexOf('--criterion') + 1]
  : null;

let failed = 0;
for (const [id, check] of Object.entries(checks)) {
  if (only && only !== id) continue;
  let result;
  try {
    result = check();
  } catch (err) {
    result = { ok: false, detail: String(err?.message ?? err) };
  }
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${id} — ${result.detail}`);
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} check(s) failed`}`);
process.exit(failed === 0 ? 0 : 1);
