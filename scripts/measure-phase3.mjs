// Phase 3 measurements — the chart system: contrast, donut geometry, legend
// position, diameters.
//
//   node scripts/measure-phase3.mjs
//
// Writes evidence/phase3/measurements.json. The evidence harness merges it
// into evidence/phase3/results.json.

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = resolve(process.cwd(), 'evidence/phase3');

const { chromium } = await import('playwright');

// ── colour maths ────────────────────────────────────────────────────────────
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// ── the palette, as the browser resolves it ────────────────────────────────
const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext();
await context.route('**/__seed', (r) =>
  r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }),
);
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
await page.waitForTimeout(2500);

/** Read a CSS custom property, resolved to a hex value. */
async function token(name, dark) {
  return page.evaluate(
    ([n, d]) => {
      const el = document.createElement('div');
      el.style.color = `var(${n})`;
      document.body.appendChild(el);
      const v = getComputedStyle(el).color;
      el.remove();
      return v;
    },
    [name, dark],
  );
}

/** Convert a computed `rgb()` to hex. */
function toHex(rgb) {
  const m = rgb.match(/(\d+(?:\.\d+)?)/g);
  if (!m) return rgb;
  const [r, g, b] = m.map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const THEMES = ['light', 'dark'];
const contrastTable = [];
const resolved = {};

for (const theme of THEMES) {
  await page.evaluate((t) => localStorage.setItem('nocteon-theme', t), theme);
  await page.reload();
  await page.waitForTimeout(2000);

  const card = toHex(await token('--card', theme === 'dark'));
  const foreground = toHex(await token('--foreground', theme === 'dark'));
  const names = [
    '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6',
    '--roast-1', '--roast-2', '--roast-3', '--roast-4',
    '--chart-other', '--success', '--info', '--warning', '--destructive-text', '--muted-foreground',
  ];
  const swatches = {};
  for (const n of names) {
    const hex = toHex(await token(n, theme === 'dark'));
    swatches[n] = hex;
    const ratio = contrast(hex, card);
    contrastTable.push({
      theme,
      token: n,
      hex,
      cardBackground: card,
      contrastVsCard: ratio,
      // 3:1 is the WCAG target for a GRAPHIC (a chart swatch), not text.
      pass: ratio >= 3,
      // The lightest roast step is allowed to be lower, and gets a 2 px
      // card-coloured gap and a visible value label instead.
      exempt: n === '--roast-1' && theme === 'light',
    });
  }
  resolved[theme] = { card, foreground, swatches };
}

// ── donut geometry, legend position, diameters ─────────────────────────────
async function measureCharts(theme) {
  await page.evaluate((t) => localStorage.setItem('nocteon-theme', t), theme);
  await page.reload();
  await page.waitForTimeout(2200);

  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('app-chart-card')];
    const out = [];

    for (const card of cards) {
      const svg = card.querySelector('svg');
      if (!svg) continue;
      const svgRect = svg.getBoundingClientRect();
      const paths = [...svg.querySelectorAll('path')];

      // The hole: nothing may be PAINTED in the middle of the ring, so the
      // card shows through it. The centre text sits on top of the hole, so
      // the check looks at every element stacked there and asks whether any
      // of them is a filled shape.
      const centreX = svgRect.left + svgRect.width / 2;
      const centreY = svgRect.top + svgRect.height / 2;
      const stack = document.elementsFromPoint(centreX, centreY);
      const holeIsTransparent = !stack.some((el) => {
        if (el.tagName.toLowerCase() !== 'path') return false;
        const fill = (el.getAttribute('fill') || '').toLowerCase();
        return fill !== 'none' && fill !== 'transparent';
      });
      // A filled wedge would also show up as a path with a fill.
      const anyFilledWedge = paths.some((p) => {
        const fill = (p.getAttribute('fill') || '').toLowerCase();
        return fill !== 'none' && fill !== 'transparent';
      });

      // The centre text: the VALUE (the one with tabular figures), not the
      // label above it.
      const centreTexts = [...svg.querySelectorAll('text')];
      const valueText = centreTexts.find((t) =>
        (t.getAttribute('class') || '').includes('tabular-nums'),
      );
      const centreFill = valueText?.getAttribute('fill') ?? null;
      const centreRect = valueText?.getBoundingClientRect();

      // The centre text must stay inside the ring.
      const ringOuter = svgRect.width / 2;
      const holeRadius = ringOuter * 0.62;
      let centreOverflows = false;
      if (centreRect) {
        const halfW = centreRect.width / 2;
        const halfH = centreRect.height / 2;
        const cx = centreRect.left + halfW - centreX;
        const cy = centreRect.top + halfH - centreY;
        centreOverflows = Math.hypot(cx, cy) + Math.max(halfW, halfH) > holeRadius;
      }

      // The legend must be BELOW the chart, never beside it.
      const legend = card.querySelector('ul.mt-3');
      const legendRect = legend?.getBoundingClientRect();
      const legendBelowChart = legendRect
        ? legendRect.top >= svgRect.bottom - 2
        : false;

      // The legend must carry the colour, the name, the value AND the percent.
      const legendRows = [...(legend?.querySelectorAll('li') ?? [])].map((li) => ({
        text: (li.textContent || '').trim(),
        hasSwatch: !!li.querySelector('span[style*="background"]'),
        hasPercent: /%/.test(li.textContent || ''),
      }));

      out.push({
        card: card.getAttribute('aria-label') || '(no label)',
        diameterPx: Math.round(svgRect.width),
        sliceCount: paths.length,
        holeIsTransparent,
        anyFilledWedge,
        centreFill,
        centreText: valueText?.textContent?.trim() ?? null,
        centreOverflowsRing: centreOverflows,
        legendBelowChart,
        legendRowCount: legendRows.length,
        everyLegendRowHasSwatch: legendRows.every((r) => r.hasSwatch),
        everyLegendRowHasPercent: legendRows.every((r) => r.hasPercent),
        legendRows,
      });
    }

    // All donuts on the page share ONE diameter.
    const diameters = [...document.querySelectorAll('app-chart-card svg')].map(
      (s) => Math.round(s.getBoundingClientRect().width),
    );
    return {
      charts: out,
      diameters,
      oneDiameter: new Set(diameters).size === 1,
    };
  });
}

const geometry = { light: await measureCharts('light'), dark: await measureCharts('dark') };

// ── no transparent or white segments ────────────────────────────────────────
const segmentCheck = await page.evaluate(() => {
  const offenders = [];
  for (const path of document.querySelectorAll('app-chart-card svg path')) {
    const fill = path.getAttribute('fill');
    const stroke = path.getAttribute('stroke');
    const f = (fill || '').toLowerCase();
    const s = (stroke || '').toLowerCase();
    if (f === 'none' && s === 'none') continue; // the label guide
    if (f === 'transparent' || f === 'rgba(0,0,0,0)' || f === '#fff' || f === '#ffffff' || f === 'white') {
      offenders.push({ fill, stroke });
    }
    if (s === 'transparent' || s === 'rgba(0,0,0,0)') {
      offenders.push({ fill, stroke });
    }
  }
  return offenders;
});

await browser.close();

const measurements = {
  observedAt: new Date().toISOString(),
  palette: {
    rule:
      'Six categorical hues (copper, ochre, olive, teal, slate, plum) and a four-step sequential ramp for the ORDERED roast dimension. A single-series chart uses chart-1. The "Other" bucket uses a muted neutral. An order status uses a SEMANTIC colour, never a categorical one.',
    removed: 'The cyan (#0e7490 / #3db8d4), periwinkle (#4f6ba0 / #8fa8e0) and lime (#5f7a1f / #a3c45a) that were chart-2/3/4.',
    tokens: resolved,
  },
  contrastTable,
  contrastSummary: {
    target: '>= 3:1 against the card (a graphic, not text)',
    total: contrastTable.length,
    passing: contrastTable.filter((c) => c.pass).length,
    failing: contrastTable.filter((c) => !c.pass && !c.exempt).map((c) => `${c.theme}:${c.token}`),
    exempt: contrastTable.filter((c) => c.exempt).map((c) => `${c.theme}:${c.token}`),
  },
  geometry,
  segmentCheck: {
    transparentOrWhiteSegments: segmentCheck.length,
    offenders: segmentCheck,
    pass: segmentCheck.length === 0,
  },
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
console.log('measurements -> evidence/phase3/measurements.json');
console.log(
  `contrast: ${measurements.contrastSummary.passing}/${measurements.contrastSummary.total} pass; failing: ${JSON.stringify(measurements.contrastSummary.failing)}; exempt: ${JSON.stringify(measurements.contrastSummary.exempt)}`,
);
console.log(
  `donut diameters: ${JSON.stringify(geometry.light.diameters)} — one diameter: ${geometry.light.oneDiameter}`,
);
console.log(
  `legend below chart: light=${geometry.light.charts.every((c) => c.legendBelowChart)} dark=${geometry.dark.charts.every((c) => c.legendBelowChart)}`,
);
console.log(`transparent/white segments: ${segmentCheck.length}`);
