// The search for the CONFIRMED swatch, and for the dark status set.
//
//   node scripts/color-confirmed.mjs
//
// Two jobs:
//
//  1. CONFIRMED needs its OWN swatch. It used to share the delivered
//     green, which means two slices of the SAME ring can be the same
//     colour — the exact defect the round set out to remove.
//  2. The DARK set is re-optimised with two hard bars: every status
//     swatch at least 15 OKLab dE from every categorical swatch (the two
//     palettes are read against each other), and every status swatch at
//     least MIN_WITHIN from every OTHER status swatch (the slices of one
//     ring must be told apart), and every one of them at least 3:1 on the
//     card.
//
// The LIGHT status swatches keep the values the light mode already had
// (the brief says the light mode is acceptable); only CONFIRMED is new
// there.

import { writeFileSync } from 'node:fs';

const CATEGORICAL = {
  light: ['#8a4b22', '#b07d2b', '#5f7a1f', '#3b7f86', '#55688f', '#8a5370'],
  dark: ['#d9955b', '#e0b45a', '#a9bf6a', '#6fb6bb', '#93a7d1', '#c58da8'],
};
const CARD = { light: '#ffffff', dark: '#1e1813' };

/** The bar between a status swatch and a categorical one. */
const CROSS_BAR = 15;
/** The bar between two status swatches (the slices of ONE ring). */
const MIN_WITHIN = 9.6;
/** The WCAG graphics target. */
const MIN_CONTRAST = 3.35;

const hexToRgb = (hex) => {
  const v = hex.replace('#', '').trim();
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
function oklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const dE = (a, b) => {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
};
function oklchToHex(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const raw = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (raw.some((v) => v < -0.001 || v > 1.001)) return null;
  const rgb = raw.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  });
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ── 1. the CONFIRMED swatch, in the light mode ─────────────────────────────
//
// The light status swatches keep their values; CONFIRMED has to be a green
// (it means "paid, on its way") that is far from the delivered green AND
// from the categorical olive, which is the green the origin donut uses.

const LIGHT_FIXED = {
  delivered: '#137333',
  processing: '#0e7490',
  shipped: '#482a6f',
  pending: '#7a5700',
  cancelled: '#b83232',
  refunded: '#6b5d52',
};

function searchConfirmed(mode, fixed) {
  let best = null;
  for (let h = 130; h <= 200; h += 1) {
    for (let L = 0.35; L <= 0.75; L += 0.01) {
      for (let C = 0.03; C <= 0.13; C += 0.005) {
        const hex = oklchToHex(L, C, h);
        if (!hex) continue;
        if (contrast(hex, CARD[mode]) < MIN_CONTRAST) continue;
        let cross = Infinity;
        for (const c of CATEGORICAL[mode]) cross = Math.min(cross, dE(hex, c));
        let within = Infinity;
        for (const v of Object.values(fixed)) within = Math.min(within, dE(hex, v));
        if (cross < CROSS_BAR) continue;
        if (within < MIN_WITHIN) continue;
        // Prefer the largest cross distance, then the largest within one.
        const score = cross * 1000 + within;
        if (!best || score > best.score) best = { hex, cross, within, h, L, C, score };
      }
    }
  }
  return best;
}

const lightConfirmed = searchConfirmed('light', LIGHT_FIXED);
console.log('light confirmed:', lightConfirmed);

// ── 2. the dark set, re-optimised with both bars ───────────────────────────

const DARK_SLOTS = {
  delivered: { hue: [135, 200], chroma: [0.04, 0.12], lightness: [0.40, 0.62] },
  processing: { hue: [210, 260], chroma: [0.04, 0.12], lightness: [0.42, 0.62] },
  shipped: { hue: [275, 340], chroma: [0.04, 0.12], lightness: [0.46, 0.68] },
  pending: { hue: [50, 88], chroma: [0.04, 0.12], lightness: [0.50, 0.72] },
  cancelled: { hue: [2, 38], chroma: [0.05, 0.13], lightness: [0.38, 0.54] },
  refunded: { hue: [20, 90], chroma: [0.0, 0.02], lightness: [0.45, 0.72] },
  confirmed: { hue: [140, 200], chroma: [0.03, 0.10], lightness: [0.62, 0.82] },
};

function candidates(slot) {
  const out = [];
  for (let h = slot.hue[0]; h <= slot.hue[1]; h += 2) {
    for (let L = slot.lightness[0]; L <= slot.lightness[1]; L += 0.02) {
      for (let C = slot.chroma[0]; C <= slot.chroma[1]; C += 0.01) {
        const hex = oklchToHex(L, C, h);
        if (hex) out.push(hex);
      }
    }
  }
  return [...new Set(out)];
}

function evaluate(set, mode) {
  const categorical = CATEGORICAL[mode];
  const card = CARD[mode];
  const values = Object.entries(set);
  let cross = Infinity;
  let within = Infinity;
  let penalty = 0;
  for (const [id, hex] of values) {
    const ratio = contrast(hex, card);
    if (ratio < MIN_CONTRAST) penalty += (MIN_CONTRAST - ratio) * 10000;
    for (const c of categorical) cross = Math.min(cross, dE(hex, c));
    for (const [otherId, otherHex] of values) {
      if (otherId === id) continue;
      within = Math.min(within, dE(hex, otherHex));
    }
  }
  if (within < MIN_WITHIN) penalty += (MIN_WITHIN - within) * 10000;
  return { cross, within, penalty };
}

const pools = Object.fromEntries(
  Object.entries(DARK_SLOTS).map(([id, slot]) => [id, candidates(slot)]),
);
const ids = Object.keys(DARK_SLOTS);
let best = null;
for (let restart = 0; restart < 40; restart += 1) {
  const set = {};
  for (const id of ids) set[id] = pools[id][Math.floor(Math.random() * pools[id].length)];
  for (let pass = 0; pass < 5; pass += 1) {
    for (const id of ids) {
      const original = set[id];
      let slotBest = original;
      let slotBestScore = -Infinity;
      for (const candidate of pools[id]) {
        if (candidate === original) continue;
        set[id] = candidate;
        const { cross, within, penalty } = evaluate(set, 'dark');
        const score = Math.min(cross, CROSS_BAR) * 1000 + within - penalty;
        set[id] = original;
        if (score > slotBestScore) {
          slotBestScore = score;
          slotBest = candidate;
        }
      }
      set[id] = slotBest;
    }
  }
  const { cross, within, penalty } = evaluate(set, 'dark');
  const score = Math.min(cross, CROSS_BAR) * 1000 + within - penalty;
  if (!best || score > best.score) best = { set: { ...set }, cross, within, penalty, score };
}

console.log('\ndark set:', best.set);
console.log('  cross', best.cross.toFixed(1), ' within', best.within.toFixed(1), ' penalty', best.penalty.toFixed(1));
for (const [id, hex] of Object.entries(best.set)) {
  const nearestCat = CATEGORICAL.dark.map((c) => [c, dE(hex, c)]).sort((a, b) => a[1] - b[1])[0];
  const nearestStatus = Object.entries(best.set)
    .filter(([k]) => k !== id)
    .map(([k, v]) => [k, dE(hex, v)])
    .sort((a, b) => a[1] - b[1])[0];
  console.log(
    `  ${id.padEnd(11)} ${hex}  contrast ${contrast(hex, CARD.dark).toFixed(2)}  dE(cat) ${nearestCat[1].toFixed(1)}  dE(status) ${nearestStatus[1].toFixed(1)}`,
  );
}

writeFileSync(
  new URL('../evidence/dashboard-r2/color-confirmed.json', import.meta.url),
  `${JSON.stringify(
    { lightConfirmed, dark: best, minWithin: MIN_WITHIN, crossBar: CROSS_BAR },
    null,
    2,
  )}\n`,
);
