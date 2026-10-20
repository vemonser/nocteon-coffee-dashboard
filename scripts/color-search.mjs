// The maximin search for the status swatches.
//
//   node scripts/color-search.mjs
//
// The status colours have to be far enough from the CATEGORICAL colours
// they sit next to on the page (the origin donut is beside the status
// donut), and far enough from each other, while staying muted and
// readable on the card.
//
// The search is over OKLCH: a hue range per status, a lightness range and
// a chroma cap. The objective is to MAXIMISE the smallest distance —
// a maximin problem, solved with random restarts and a coordinate
// descent.

import { writeFileSync } from 'node:fs';

// ── OKLab / OKLCH ───────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const v = hex.replace('#', '').trim();
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function linear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
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
  return (hi + 0.05) / (lo + 0.05);
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
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
}

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
  const rgb = raw.map((v) => {
    const clipped = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, clipped)) * 255);
  });
  if (raw.some((v) => v < -0.001 || v > 1.001)) return null;
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ── the problem ─────────────────────────────────────────────────────────────

const CATEGORICAL = {
  light: ['#8a4b22', '#b07d2b', '#5f7a1f', '#3b7f86', '#55688f', '#8a5370'],
  dark: ['#d9955b', '#e0b45a', '#a9bf6a', '#6fb6bb', '#93a7d1', '#c58da8'],
};
const CARD = { light: '#ffffff', dark: '#1e1813' };

/**
 * The status slots.
 *
 * `hue` is the band the status may use. The bands are chosen so that no
 * status lands on a hue the categorical palette already uses, and
 * `chroma` is capped so the result stays MUTED — the neon green and the
 * bright cyan of the old dark palette were the problem.
 */
const SLOTS = {
  delivered: { hue: [140, 195], chroma: [0.045, 0.115], lightness: [0.42, 0.60] },
  processing: { hue: [212, 258], chroma: [0.045, 0.115], lightness: [0.42, 0.58] },
  shipped: { hue: [278, 335], chroma: [0.045, 0.115], lightness: [0.48, 0.66] },
  pending: { hue: [55, 85], chroma: [0.045, 0.115], lightness: [0.54, 0.70] },
  cancelled: { hue: [5, 35], chroma: [0.05, 0.125], lightness: [0.40, 0.50] },
  refunded: { hue: [30, 80], chroma: [0.0, 0.02], lightness: [0.45, 0.70] },
  // CONFIRMED is its own status: a paid order that is confirmed but not
  // yet delivered. It shares the delivered GREEN in meaning, so it lives
  // in the same band but is pushed away by its lightness.
  confirmed: { hue: [150, 190], chroma: [0.04, 0.10], lightness: [0.62, 0.80] },
};

function* candidates(slot) {
  for (let h = slot.hue[0]; h <= slot.hue[1]; h += 1) {
    for (let L = slot.lightness[0]; L <= slot.lightness[1]; L += 0.03) {
      for (let C = slot.chroma[0]; C <= slot.chroma[1]; C += 0.01) {
        const hex = oklchToHex(L, C, h);
        if (hex) yield hex;
      }
    }
  }
}

/**
 * The score of a full set: the smallest distance that matters.
 *
 * The categorical distance is weighted higher than the within-status
 * distance, because the two palettes are read against each other.
 */
function score(set, mode, minContrast) {
  const categorical = CATEGORICAL[mode];
  const card = CARD[mode];
  const values = Object.entries(set);
  // The contrast is a PENALTY, not a veto: a veto gives the search no
  // gradient to follow while the set is still invalid.
  let penalty = 0;
  for (const [id, hex] of values) {
    const ratio = contrast(hex, card);
    if (ratio < minContrast) penalty += (minContrast - ratio) * 10000;
  }
  let cross = Infinity;
  let within = Infinity;
  for (const [id, hex] of values) {
    for (const other of categorical) cross = Math.min(cross, deltaE(hex, other));
  }
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      within = Math.min(within, deltaE(values[i][1], values[j][1]));
    }
  }
  // The cross-set distance is what the reader has to make out against the
  // neighbouring chart, so it is pushed to the target FIRST; once it is
  // there, the remaining freedom goes to the distance INSIDE the status
  // set (the slices of one ring).
  const CROSS_TARGET = 15;
  return Math.min(cross, CROSS_TARGET) * 1000 + within - penalty;
}

function optimise(mode, minContrast, fixed = {}) {
  const ids = Object.keys(SLOTS).filter((id) => !(id in fixed));
  const pools = {};
  for (const id of ids) {
    pools[id] = [...new Set(candidates(SLOTS[id]))];
  }
  let best = null;
  let bestScore = -Infinity;

  // Random restarts.
  for (let restart = 0; restart < 60; restart += 1) {
    let set = { ...fixed };
    for (const id of ids) {
      const pool = pools[id];
      set[id] = pool[Math.floor(Math.random() * pool.length)];
    }
    // Coordinate descent: improve one slot at a time.
    for (let pass = 0; pass < 4; pass += 1) {
      let improved = false;
      for (const id of ids) {
        let slotBest = set[id];
        let slotBestScore = score(set, mode, minContrast);
        const pool = pools[id];
        // A random sample of the pool: the full pool is large.
        const original = set[id];
        for (let t = 0; t < 400; t += 1) {
          const candidate = pool[Math.floor(Math.random() * pool.length)];
          if (candidate === original) continue;
          set[id] = candidate;
          const value = score(set, mode, minContrast);
          set[id] = original;
          if (value > slotBestScore) {
            slotBestScore = value;
            slotBest = candidate;
          }
        }
        set[id] = slotBest;
        if (slotBestScore > -1) improved = true;
      }
      if (!improved) break;
    }
    const value = score(set, mode, minContrast);
    if (value > bestScore) {
      bestScore = value;
      best = { ...set };
    }
  }
  return best;
}

/**
 * The LIGHT mode keeps the status colours it has today — the brief says
 * the light mode is acceptable — with ONE exception: SHIPPED was
 * `--chart-5`, a CATEGORICAL token, so the shipped slice and a possible
 * origin slice were literally the same colour. It gets its own value,
 * chosen to be as far as possible from the categorical palette.
 */
const LIGHT_FIXED = process.env.COLOR_SEARCH_LIGHT === 'all' ? {} : {
  delivered: '#137333',
  processing: '#0e7490',
  pending: '#7a5700',
  cancelled: '#b83232',
  refunded: '#6b5d52',
};

const report = {};
for (const mode of ['light', 'dark']) {
  const set = optimise(
    mode,
    mode === 'dark' ? 3.1 : 3.0,
    mode === 'light' ? LIGHT_FIXED : {},
  );
  const categorical = CATEGORICAL[mode];
  console.log(`\n=== ${mode} (card ${CARD[mode]}) ===`);
  const rows = [];
  for (const [id, hex] of Object.entries(set)) {
    const nearest = categorical
      .map((c) => [c, deltaE(hex, c)])
      .sort((a, b) => a[1] - b[1])[0];
    const others = Object.entries(set)
      .filter(([k]) => k !== id)
      .map(([k, v]) => [k, deltaE(hex, v)])
      .sort((a, b) => a[1] - b[1])[0];
    rows.push({
      id,
      hex,
      contrast: Math.round(contrast(hex, CARD[mode]) * 100) / 100,
      nearestCategorical: nearest[0],
      deltaEToCategorical: Math.round(nearest[1] * 10) / 10,
      nearestStatus: others[0],
      deltaEToStatus: Math.round(others[1] * 10) / 10,
    });
    console.log(
      `  ${id.padEnd(11)} ${hex}  contrast ${rows[rows.length - 1].contrast.toFixed(2)}:1  nearest categorical ${nearest[0]} dE ${nearest[1].toFixed(1)}  nearest status ${others[0]} dE ${others[1].toFixed(1)}`,
    );
  }
  report[mode] = rows;
}
writeFileSync(
  new URL('../evidence/dashboard-r2/color-search.json', import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log('\n-> evidence/dashboard-r2/color-search.json');
