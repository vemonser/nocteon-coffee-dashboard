// A local search around the chosen dark status set.
//
//   node scripts/color-tune.mjs
//
// The dark status set has to satisfy TWO bars at once:
//
//   - CROSS: every status swatch at least 15 OKLab dE from every
//     categorical swatch (the two rings are read against each other);
//   - WITHIN: every status swatch at least MIN_WITHIN from every OTHER
//     status swatch (the slices of ONE ring must be told apart).
//
// The two pull against each other — seven semantic colours and six
// categorical ones do not fit on one wheel with room to spare — so the
// search starts from the chosen set and nudges the two swatches that
// break the cross bar.

import { writeFileSync } from 'node:fs';

const CATEGORICAL = ['#d9955b', '#e0b45a', '#a9bf6a', '#6fb6bb', '#93a7d1', '#c58da8'];
const CARD = '#1e1813';
const CROSS_BAR = 15;
const MIN_WITHIN = 9.6;
const MIN_CONTRAST = 3.0;

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
function oklchOf(hex) {
  const [l, a, b] = oklab(hex);
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: l, C: c, h };
}

const BASE = {
  delivered: '#4c6f38',
  processing: '#028a9b',
  shipped: '#5a649d',
  pending: '#b1632f',
  cancelled: '#9c4b62',
  refunded: '#7d7672',
  confirmed: '#65955a',
};

function evaluate(set) {
  const values = Object.entries(set);
  let cross = Infinity;
  let within = Infinity;
  for (const [id, hex] of values) {
    if (contrast(hex, CARD) < MIN_CONTRAST) return { cross: 0, within: 0, ok: false };
    for (const c of CATEGORICAL) cross = Math.min(cross, dE(hex, c));
    for (const [otherId, otherHex] of values) {
      if (otherId === id) continue;
      within = Math.min(within, dE(hex, otherHex));
    }
  }
  return { cross, within, ok: within >= MIN_WITHIN };
}

// The two swatches that break the cross bar are nudged; the other five are
// held (they already satisfy both bars).
const TUNED = Object.keys(BASE);

function candidatesFor(id) {
  const { L, C, h } = oklchOf(BASE[id]);
  const out = [];
  const hueRange = id === 'pending' ? [40, 90] : [130, 200];
  for (let dh = -25; dh <= 25; dh += 2.5) {
    for (let dL = -0.12; dL <= 0.12; dL += 0.015) {
      for (let dC = -0.04; dC <= 0.04; dC += 0.01) {
        const hex = oklchToHex(
          Math.min(0.85, Math.max(0.3, L + dL)),
          Math.min(0.16, Math.max(0.0, C + dC)),
          Math.min(359, Math.max(0, h + dh)),
        );
        if (hex) out.push(hex);
      }
    }
  }
  return [...new Set(out)];
}

let best = { set: { ...BASE }, ...evaluate(BASE) };
for (const id of TUNED) {
  const pool = candidatesFor(id);
  let localBest = best;
  for (const candidate of pool) {
    const set = { ...best.set, [id]: candidate };
    const score = evaluate(set);
    if (!score.ok) continue;
    if (
      score.cross > localBest.cross ||
      (score.cross === localBest.cross && score.within > localBest.within)
    ) {
      localBest = { set, ...score };
    }
  }
  best = localBest;
}

console.log('tuned set:', best.set);
console.log(
  `  cross ${best.cross.toFixed(1)} (bar ${CROSS_BAR})   within ${best.within.toFixed(1)} (bar ${MIN_WITHIN})`,
);
for (const [id, hex] of Object.entries(best.set)) {
  const nearestCat = CATEGORICAL.map((c) => [c, dE(hex, c)]).sort((a, b) => a[1] - b[1])[0];
  const nearestStatus = Object.entries(best.set)
    .filter(([k]) => k !== id)
    .map(([k, v]) => [k, dE(hex, v)])
    .sort((a, b) => a[1] - b[1])[0];
  console.log(
    `  ${id.padEnd(11)} ${hex}  contrast ${contrast(hex, CARD).toFixed(2)}  dE(cat) ${nearestCat[1].toFixed(1)} (${nearestCat[0]})  dE(status) ${nearestStatus[1].toFixed(1)} (${nearestStatus[0]})`,
  );
}

writeFileSync(
  new URL('../evidence/dashboard-r2/color-tune.json', import.meta.url),
  `${JSON.stringify(best, null, 2)}\n`,
);
