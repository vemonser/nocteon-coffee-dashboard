// The colour maths for the dashboard charts.
//
//   node scripts/color-math.mjs
//
// It answers three questions with NUMBERS, not with opinions:
//
//  1. What is the contrast of every swatch against the card it is drawn
//     on? (the WCAG graphics target: 3:1)
//  2. How far apart are two swatches that are shown SIDE BY SIDE? The
//     distance is the OKLab distance (deltaE), scaled by 100 — the same
//     scale design.md already uses for its "known tension" note.
//  3. Which pairs are TOO CLOSE to be told apart?
//
// The BEFORE palettes are the ones the dashboard shipped with; the AFTER
// palettes are the ones in src/styles/themes/copper.css now. The report
// therefore shows what the change actually bought.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ── colour maths ────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const value = hex.replace('#', '').trim();
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function linear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

function oklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function deltaE(a, b) {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.round(Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 1000) / 10;
}

// ── the palettes ────────────────────────────────────────────────────────────

const CARD = { light: '#ffffff', dark: '#1e1813' };

/** The categorical palette — unchanged by this round. */
const CATEGORICAL = {
  light: {
    'chart-1 copper': '#8a4b22',
    'chart-2 ochre': '#b07d2b',
    'chart-3 olive': '#5f7a1f',
    'chart-4 teal': '#3b7f86',
    'chart-5 slate': '#55688f',
    'chart-6 plum': '#8a5370',
  },
  dark: {
    'chart-1 copper': '#d9955b',
    'chart-2 ochre': '#e0b45a',
    'chart-3 olive': '#a9bf6a',
    'chart-4 teal': '#6fb6bb',
    'chart-5 slate': '#93a7d1',
    'chart-6 plum': '#c58da8',
  },
};

/** The status swatches BEFORE this round. */
const STATUS_BEFORE = {
  light: {
    'status-delivered': '#137333',
    'status-processing': '#0e7490',
    'status-shipped': '#55688f',
    'status-pending': '#7a5700',
    'status-cancelled': '#b83232',
    'status-refunded': '#6b5d52',
  },
  dark: {
    'status-delivered': '#4ade80',
    'status-processing': '#22d3ee',
    'status-shipped': '#93a7d1',
    'status-pending': '#fbbf24',
    'status-cancelled': '#f28b82',
    'status-refunded': '#a89a8c',
  },
};

/** The status swatches AFTER this round (src/styles/themes/copper.css). */
const STATUS_AFTER = {
  light: {
    'status-delivered': '#137333',
    'status-processing': '#0e7490',
    'status-shipped': '#482a6f',
    'status-pending': '#7a5700',
    'status-cancelled': '#b83232',
    'status-refunded': '#6b5d52',
  },
  dark: {
    'status-delivered': '#497c53',
    'status-processing': '#287992',
    'status-shipped': '#6865a9',
    'status-pending': '#8a6a20',
    'status-cancelled': '#a8493f',
    'status-refunded': '#6f6a62',
  },
};

const OTHER = {
  light: { 'chart-other': '#8a8178', 'roast-1': '#d9ae82' },
  dark: { 'chart-other': '#8f857b', 'roast-1': '#ebcba3' },
};

/**
 * The distance below which two swatches read as the same colour.
 *
 * The categorical palette is a deliberate RAMP: its neighbours are 7-15
 * dE apart and that is accepted (design.md §2b). So 15 is the bar: a
 * pair that is closer than the ramp's own neighbours is a collision.
 */
const TOO_CLOSE = 15;

const report = {
  generatedAt: new Date().toISOString(),
  method: {
    contrast: 'WCAG 2.x relative luminance, opaque colours, rounded to 2 dp',
    distance:
      'OKLab Euclidean distance x 100. The categorical ramp has neighbours 7-15 apart, so 15 is the bar for "too close".',
    threshold: { graphics: 3, text: 4.5, tooClose: TOO_CLOSE },
  },
  modes: {},
};

function paletteOf(mode, status) {
  return { ...CATEGORICAL[mode], ...status[mode], ...OTHER[mode] };
}

for (const mode of ['light', 'dark']) {
  const card = CARD[mode];
  const before = paletteOf(mode, STATUS_BEFORE);
  const after = paletteOf(mode, STATUS_AFTER);

  const swatches = Object.entries(after).map(([name, hex]) => {
    const ratio = contrast(hex, card);
    return {
      name,
      hex,
      contrastOnCard: ratio,
      passesGraphics3: ratio >= 3,
      passesText4_5: ratio >= 4.5,
      contrastBefore: contrast(before[name] ?? hex, card),
    };
  });

  /** Every categorical swatch against every status swatch. */
  const crossPairs = [];
  for (const [sName, sHex] of Object.entries(STATUS_AFTER[mode])) {
    for (const [cName, cHex] of Object.entries(CATEGORICAL[mode])) {
      crossPairs.push({
        status: sName,
        categorical: cName,
        statusHex: sHex,
        categoricalHex: cHex,
        deltaE: deltaE(sHex, cHex),
        deltaEBefore: deltaE(before[sName], before[cName]),
        tooClose: deltaE(sHex, cHex) < TOO_CLOSE,
        tooCloseBefore: deltaE(before[sName], before[cName]) < TOO_CLOSE,
      });
    }
  }

  /** Every status swatch against every other status swatch. */
  const withinPairs = [];
  const statusEntries = Object.entries(STATUS_AFTER[mode]);
  for (let i = 0; i < statusEntries.length; i += 1) {
    for (let j = i + 1; j < statusEntries.length; j += 1) {
      withinPairs.push({
        a: statusEntries[i][0],
        b: statusEntries[j][0],
        deltaE: deltaE(statusEntries[i][1], statusEntries[j][1]),
        deltaEBefore: deltaE(before[statusEntries[i][0]], before[statusEntries[j][0]]),
        tooClose: deltaE(statusEntries[i][1], statusEntries[j][1]) < TOO_CLOSE,
      });
    }
  }

  report.modes[mode] = {
    card,
    swatches,
    crossPairs,
    withinPairs,
    minimum: {
      crossBefore: Math.min(...crossPairs.map((p) => p.deltaEBefore)),
      crossAfter: Math.min(...crossPairs.map((p) => p.deltaE)),
      withinBefore: Math.min(...withinPairs.map((p) => p.deltaEBefore)),
      withinAfter: Math.min(...withinPairs.map((p) => p.deltaE)),
    },
    collisionsBefore: crossPairs.filter((p) => p.tooCloseBefore).length,
    collisionsAfter: crossPairs.filter((p) => p.tooClose).length,
  };
}

report.summary = {
  swatchesFailingGraphics: Object.values(report.modes)
    .flatMap((m) => m.swatches)
    .filter((s) => !s.passesGraphics3)
    .map((s) => s.name),
  crossCollisionsBefore: report.modes.light.collisionsBefore + report.modes.dark.collisionsBefore,
  crossCollisionsAfter: report.modes.light.collisionsAfter + report.modes.dark.collisionsAfter,
  minCrossDistance: {
    light: report.modes.light.minimum.crossAfter,
    dark: report.modes.dark.minimum.crossAfter,
  },
  minCrossDistanceBefore: {
    light: report.modes.light.minimum.crossBefore,
    dark: report.modes.dark.minimum.crossBefore,
  },
};

const out = resolve(process.cwd(), 'evidence', 'dashboard-r2', 'color-math.json');
mkdirSync(resolve(process.cwd(), 'evidence', 'dashboard-r2'), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));

for (const mode of ['light', 'dark']) {
  const m = report.modes[mode];
  console.log(`\n=== ${mode} (card ${m.card}) ===`);
  for (const s of m.swatches) {
    console.log(
      `  ${s.passesGraphics3 ? ' ' : '!'} ${s.name.padEnd(20)} ${s.hex}  ${String(s.contrastOnCard).padStart(6)}:1   (before ${s.contrastBefore}:1)`,
    );
  }
  console.log(
    `  cross-set minimum: ${m.minimum.crossBefore} -> ${m.minimum.crossAfter} dE   collisions: ${m.collisionsBefore} -> ${m.collisionsAfter}`,
  );
  console.log(
    `  within-set minimum: ${m.minimum.withinBefore} -> ${m.minimum.withinAfter} dE`,
  );
  const still = m.crossPairs.filter((p) => p.tooClose);
  for (const p of still) {
    console.log(`  ! still close: ${p.status} / ${p.categorical}  dE ${p.deltaE} (was ${p.deltaEBefore})`);
  }
}
console.log('\n->', out);
