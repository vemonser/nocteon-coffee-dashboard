// Measure a candidate set of status swatches.
//
//   node scripts/color-measure.mjs '#aabbcc,#ddeeff,...' <mode>
//
// Prints the contrast of every swatch on the card and the distances, so a
// hand-picked set can be checked before it is written into the theme.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CATEGORICAL = {
  light: ['#8a4b22', '#b07d2b', '#5f7a1f', '#3b7f86', '#55688f', '#8a5370'],
  dark: ['#d9955b', '#e0b45a', '#a9bf6a', '#6fb6bb', '#93a7d1', '#c58da8'],
};
const CARD = { light: '#ffffff', dark: '#1e1813' };
const NAMES = ['delivered', 'processing', 'shipped', 'pending', 'cancelled', 'refunded'];

const hexToRgb = (hex) => {
  const v = hex.replace('#', '').trim();
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const linear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
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
const deltaE = (a, b) => {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
};

const mode = process.argv[3] ?? 'dark';
const set = (process.argv[2] ?? '').split(',').filter(Boolean);
const card = CARD[mode];

console.log(`mode ${mode}, card ${card}`);
let worstCross = Infinity;
let worstWithin = Infinity;
set.forEach((hex, i) => {
  const nearest = CATEGORICAL[mode]
    .map((c) => [c, deltaE(hex, c)])
    .sort((a, b) => a[1] - b[1])[0];
  const others = set
    .map((h, j) => (i === j ? null : [NAMES[j], deltaE(hex, h)]))
    .filter(Boolean)
    .sort((a, b) => a[1] - b[1])[0];
  worstCross = Math.min(worstCross, nearest[1]);
  if (others) worstWithin = Math.min(worstWithin, others[1]);
  console.log(
    `  ${(NAMES[i] ?? hex).padEnd(11)} ${hex}  contrast ${contrast(hex, card).toFixed(2)}:1  nearest categorical ${nearest[0]} dE ${nearest[1].toFixed(1)}  nearest status ${others ? others[0] : '-'} dE ${others ? others[1].toFixed(1) : '-'}`,
  );
});
console.log(
  `  worst cross ${worstCross.toFixed(1)}   worst within ${worstWithin === Infinity ? '-' : worstWithin.toFixed(1)}`,
);
