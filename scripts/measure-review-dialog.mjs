// The summary of the review-dialog evidence run.
//
//   npm run evidence -- review-dialog --out evidence/review-dialog/before
//
// The capture already measured the dialog in every cell (the per-target
// `own` numbers in results.json). This script does NOT take a second pass:
// it reads the run's own results.json and REDUCES it to the numbers the
// brief asks for — the footer gap, the dialog height against the viewport,
// the tab order, Escape + focus return, the stars, and the badge contrast —
// so a before/after comparison is one table and not a JSON diff.
//
// Writes evidence/<run>/measurements.json, which the harness merges back
// into results.json under "measurements".

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), process.env.EVIDENCE_OUT ?? 'evidence/review-dialog');

/** The numbers the report quotes, per target, per cell. */
function summariseCell(cell) {
  const targets = (cell.targets ?? []).map((t) => {
    const own = t.own ?? {};
    return {
      id: t.id,
      file: t.file,
      action: t.action,
      title: own.title ?? null,
      footerGapPx: own.footer?.minGapPx ?? null,
      footerButtons: own.footer?.endButtonLabels ?? [],
      dialogHeightPx: own.dialog?.height ?? null,
      viewportHeightPx: own.dialog?.viewportHeightPx ?? null,
      fitsViewport: own.dialog?.fitsViewport ?? null,
      tabOrder: (own.tabOrder ?? []).map((f) => f.name || f.tag),
      escapeCloses: own.escape?.closes ?? null,
      focusReturned: own.escape?.focusReturned ?? null,
      focusAfter: own.escape?.focusAfter ?? null,
      stars: own.stars ?? null,
      badgeContrast: own.badgeContrast ?? null,
      productLink: own.productLink ?? null,
      orderLink: own.orderLink ?? null,
      comment: own.comment ?? null,
      statusRow: own.statusRow ?? null,
    };
  });

  const gaps = targets.map((t) => t.footerGapPx).filter((g) => typeof g === 'number');
  const stars = targets.map((t) => t.stars).filter(Boolean);
  return {
    lang: cell.lang,
    theme: cell.theme,
    width: cell.width,
    dir: cell.observed?.dir ?? null,
    dark: cell.observed?.dark ?? null,
    footerGapPx: gaps.length ? { min: Math.min(...gaps), max: Math.max(...gaps) } : null,
    allEscClose: targets.every((t) => t.escapeCloses === true),
    allFocusReturned: targets.every((t) => t.focusReturned === true),
    allFitViewport: targets.every((t) => t.fitsViewport === true),
    starsFilled: stars.length ? stars.map((s) => `${s.filled}/${s.total}`) : [],
    targets,
  };
}

export function run() {
  const resultsFile = `${OUT}/results.json`;
  const results = JSON.parse(readFileSync(resultsFile, 'utf8'));

  const cells = (results.cells ?? []).map(summariseCell);
  const allGaps = cells
    .flatMap((c) => c.targets.map((t) => t.footerGapPx))
    .filter((g) => typeof g === 'number');
  const allStars = cells.flatMap((c) => c.starsFilled);
  const contrast = cells
    .flatMap((c) => c.targets.map((t) => t.badgeContrast?.textVsBadgeBg))
    .filter((v) => typeof v === 'number');

  const measurements = {
    generatedAt: new Date().toISOString(),
    source: resultsFile.replace(resolve(process.cwd()) + '/', ''),
    headline: {
      footerGapPx: allGaps.length ? { min: Math.min(...allGaps), max: Math.max(...allGaps) } : null,
      everyCellEscCloses: cells.every((c) => c.allEscClose),
      everyCellFocusReturned: cells.every((c) => c.allFocusReturned),
      everyCellFitsViewport: cells.every((c) => c.allFitViewport),
      stars: allStars,
      badgeContrastVsBadgeBg: contrast.length ? { min: Math.min(...contrast) } : null,
      cells: cells.length,
    },
    cells,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
  console.log(`measurements -> ${OUT.replace(resolve(process.cwd()) + '/', '')}/measurements.json`);
  console.log(JSON.stringify(measurements.headline, null, 2));
}
