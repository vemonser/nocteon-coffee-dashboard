import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';

const require = createRequire(resolve(process.cwd(), 'package.json'));
require('dotenv').config({ path: '.env.local', quiet: true });

interface Report {
  roots: Array<{ key: string; id: string; pages: string[]; evidence: string[]; severity: string }>;
  findings: Array<{ id: string; page: string; evidence: string }>;
}

interface Outliers {
  clusters: Array<{ role: string; signature: string; pages: string[] }>;
  offScale: Array<{ kind: string; role: string; value: string; pages: string[] }>;
}

interface Defect {
  id: string;
  title: string;
  file: string;
  find: string;
  replace: string;
  routes: string;
  /** Something that only exists after the defect is live (text or selector). */
  marker: { text?: string; selector?: string };
  /** The rule the finder is expected to fire. */
  expect: string;
  match: (report: Report, outliers: Outliers) => boolean;
}

const has = (report: Report, id: string, page?: string) =>
  report.roots.some((root) => root.id === id && (!page || root.pages.includes(page)));

const evidenceHas = (report: Report, id: string, needle: string) =>
  report.roots.some(
    (root) => root.id === id && root.evidence.some((line) => line.toLowerCase().includes(needle.toLowerCase())),
  );

const EN = 'public/assets/i18n/en.json';
const EXPORT = '    "exportReport": "Export report",';
const TITLE = '    "title": "Dashboard",';
const SUBTITLE = '    "subtitle": "Here\'s what\'s happening with your coffee business today.",';

/** 25 defects copied from real past bugs, each reversible. */
const DEFECTS: Defect[] = [
  {
    id: 'R01', title: 'Title Case label', file: EN, find: EXPORT, replace: '    "exportReport": "Export Report",',
    routes: '/dashboard', marker: { text: 'Export Report' }, expect: 'text.title-case',
    match: (r) => has(r, 'text.title-case', 'dashboard') && evidenceHas(r, 'text.title-case', 'Export Report'),
  },
  {
    id: 'R02', title: 'Unresolved placeholder', file: EN, find: EXPORT, replace: '    "exportReport": "Save {count}",',
    routes: '/dashboard', marker: { text: 'Save {count}' }, expect: 'i18n.unresolved-placeholder',
    match: (r) => has(r, 'i18n.unresolved-placeholder', 'dashboard'),
  },
  {
    id: 'R03', title: 'Developer text', file: EN, find: EXPORT, replace: '    "exportReport": "Needs backend",',
    routes: '/dashboard', marker: { text: 'Needs backend' }, expect: 'i18n.developer-text',
    match: (r) => has(r, 'i18n.developer-text', 'dashboard'),
  },
  {
    id: 'R04', title: 'undefined printed', file: EN, find: EXPORT, replace: '    "exportReport": "undefined",',
    routes: '/dashboard', marker: { text: 'undefined' }, expect: 'i18n.invalid-value',
    match: (r) => has(r, 'i18n.invalid-value', 'dashboard'),
  },
  {
    id: 'R05', title: 'Wrong unit case', file: EN, find: EXPORT, replace: '    "exportReport": "10 mB",',
    routes: '/dashboard', marker: { text: '10 mB' }, expect: 'text.unit-case',
    match: (r) => has(r, 'text.unit-case', 'dashboard'),
  },
  {
    id: 'R06', title: '"1 files" plural', file: EN, find: '    "countSold_one": "{{count}} sold",',
    replace: '    "countSold_one": "{{count}} files",',
    routes: '/dashboard', marker: { text: '1 files' }, expect: 'text.plural-one',
    match: (r) => has(r, 'text.plural-one', 'dashboard'),
  },
  {
    id: 'R07', title: '"0 item" singular', file: EN, find: '    "kg": "kg",', replace: '    "kg": "0 item",',
    routes: '/dashboard', marker: { text: '0 item' }, expect: 'text.singular-zero',
    match: (r) => has(r, 'text.singular-zero', 'dashboard'),
  },
  {
    id: 'R08', title: 'Seeded QA record visible', file: EN, find: EXPORT, replace: '    "exportReport": "Auditcov report",',
    routes: '/dashboard', marker: { text: 'Auditcov report' }, expect: 'hygiene.test-record',
    match: (r) => has(r, 'hygiene.test-record', 'dashboard'),
  },
  {
    id: 'R09', title: 'A future date', file: EN, find: EXPORT, replace: '    "exportReport": "January 1, 2099",',
    routes: '/dashboard', marker: { text: 'January 1, 2099' }, expect: 'hygiene.future-date',
    match: (r) => has(r, 'hygiene.future-date', 'dashboard'),
  },
  {
    id: 'R10', title: 'Long month + space before comma', file: EN, find: EXPORT,
    replace: '    "exportReport": "27 October 2026 , 10:00",',
    routes: '/dashboard', marker: { text: '27 October 2026' }, expect: 'text.long-month',
    match: (r) => has(r, 'text.long-month', 'dashboard') || has(r, 'text.space-before-comma', 'dashboard'),
  },
  {
    id: 'R11', title: 'Two date formats on one page', file: EN, find: EXPORT,
    replace: '    "exportReport": "October 27, 2026 · 27 Oct 2026",',
    routes: '/dashboard', marker: { text: 'October 27, 2026' }, expect: 'hygiene.mixed-date-formats',
    match: (r) => has(r, 'hygiene.mixed-date-formats', 'dashboard'),
  },
  {
    id: 'R12', title: 'Double space', file: EN, find: EXPORT, replace: '    "exportReport": "Export  report",',
    routes: '/dashboard', marker: { text: 'Export  report' }, expect: 'text.double-space',
    match: (r) => has(r, 'text.double-space', 'dashboard'),
  },
  {
    id: 'R13', title: 'Latin glued to Arabic', file: EN, find: EXPORT, replace: '    "exportReport": "قهوةEthiopia",',
    routes: '/dashboard', marker: { text: 'قهوةEthiopia' }, expect: 'text.glued-scripts',
    match: (r) => has(r, 'text.glued-scripts', 'dashboard'),
  },
  {
    id: 'R14', title: 'camelCase route label in the title', file: EN, find: TITLE, replace: '    "title": "newProduct",',
    routes: '/dashboard', marker: { text: 'newProduct' }, expect: 'i18n.camel-label',
    match: (r) => has(r, 'i18n.camel-label', 'dashboard'),
  },
  {
    id: 'R15', title: 'Title Case page title', file: EN, find: TITLE, replace: '    "title": "Dashboard  Overview",',
    routes: '/dashboard', marker: { text: 'Dashboard  Overview' }, expect: 'text.title-case',
    match: (r) => has(r, 'text.title-case', 'dashboard'),
  },
  {
    id: 'R16', title: 'Raw translation key in the title', file: EN, find: TITLE,
    replace: '    "title": "orders.statuses.DELIVERED",',
    routes: '/dashboard', marker: { text: 'orders.statuses.DELIVERED' }, expect: 'i18n.raw-key',
    match: (r) => has(r, 'i18n.raw-key', 'dashboard'),
  },
  {
    id: 'R17', title: 'Placeholder in the title', file: EN, find: TITLE, replace: '    "title": "New product {id}",',
    routes: '/dashboard', marker: { text: 'New product {id}' }, expect: 'i18n.unresolved-placeholder',
    match: (r) => has(r, 'i18n.unresolved-placeholder', 'dashboard'),
  },
  {
    id: 'R18', title: 'QA record in the subtitle', file: EN, find: SUBTITLE,
    replace: '    "subtitle": "Auditcov dashboard",',
    routes: '/dashboard', marker: { text: 'Auditcov dashboard' }, expect: 'hygiene.test-record',
    match: (r) => has(r, 'hygiene.test-record', 'dashboard'),
  },
  {
    id: 'R19', title: '"1 files" in the subtitle', file: EN, find: SUBTITLE, replace: '    "subtitle": "1 files",',
    routes: '/dashboard', marker: { text: '1 files' }, expect: 'text.plural-one',
    match: (r) => has(r, 'text.plural-one', 'dashboard'),
  },
  {
    id: 'R20', title: '"0 item" in the subtitle', file: EN, find: SUBTITLE, replace: '    "subtitle": "0 item",',
    routes: '/dashboard', marker: { text: '0 item' }, expect: 'text.singular-zero',
    match: (r) => has(r, 'text.singular-zero', 'dashboard'),
  },
  {
    id: 'R21', title: 'Title Case twice (second page)', file: EN,
    find: '    "today": "Today",\n    "updated": "Updated",',
    replace: '    "today": "Today  Overview",\n    "updated": "Updated",',
    routes: '/dashboard', marker: { text: 'Today  Overview' }, expect: 'text.title-case',
    match: (r) => has(r, 'text.title-case', 'dashboard'),
  },
  {
    id: 'R22', title: 'Icon-only button without a name', file: 'src/app/core/theme/theme-toggle.component.html',
    find: '  [attr.aria-label]="nextThemeLabel() | transloco"\n',
    replace: '  data-recall="R22"\n',
    routes: '/dashboard', marker: { selector: '[data-recall="R22"]' }, expect: 'consistency.icon-button-no-name',
    match: (r) => has(r, 'consistency.icon-button-no-name', 'dashboard'),
  },
  {
    id: 'R23', title: 'Always-visible red delete in a row', file: 'src/app/shared/components/dashboard/recent-orders/recent-orders.component.html',
    find: '          </a>\n        </li>',
    replace:
      '          </a>\n          <button class="text-destructive" aria-label="Delete order" data-recall="R23">Delete</button>\n        </li>',
    routes: '/dashboard', marker: { selector: '[data-recall="R23"]' }, expect: 'consistency.visible-destructive',
    match: (r) => has(r, 'consistency.visible-destructive', 'dashboard'),
  },
  {
    id: 'R24', title: 'Refresh icon without a name', file: 'src/app/shared/components/dashboard/dashboard-toolbar/dashboard-toolbar.component.html',
    find: "          [title]=\"'dashboard.refresh' | transloco\"\n          [attr.aria-label]=\"'dashboard.refresh' | transloco\"\n",
    replace: '          data-recall="R24"\n',
    routes: '/dashboard', marker: { selector: '[data-recall="R24"]' }, expect: 'consistency.icon-button-no-name',
    match: (r) => has(r, 'consistency.icon-button-no-name', 'dashboard'),
  },
  {
    id: 'R25', title: 'Indicator outside its container', file: 'src/app/features/dashboard/dashboard.component.html',
    find: '  <header class="flex flex-col gap-1.5">',
    replace:
      '  <div class="relative" data-recall="R25" style="position:relative;width:200px;height:20px"><span class="dot" style="position:absolute;top:-30px;left:0;width:8px;height:8px;background:red"></span></div>\n  <header class="flex flex-col gap-1.5">',
    routes: '/dashboard', marker: { selector: '[data-recall="R25"]' }, expect: 'indicators.outside-container',
    match: (r) => has(r, 'indicators.outside-container', 'dashboard'),
  },
];

const OUT = resolve(process.cwd(), 'qa', '.run', 'recall');
mkdirSync(OUT, { recursive: true });

function newestRun(): string | null {
  const dir = resolve(process.cwd(), 'qa', '.run', 'find');
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).sort();
  return entries.length ? resolve(dir, entries[entries.length - 1]) : null;
}

async function login(): Promise<{ page: Page; close: () => Promise<void> }> {
  const email = process.env['E2E_ADMIN_EMAIL'];
  const password = process.env['E2E_ADMIN_PASSWORD'];
  if (!email || !password) throw new Error('recall: E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD missing');
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://localhost:4200/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  return { page, close: () => browser.close() };
}

async function waitForMarker(page: Page, defect: Defect, timeoutMs = 60_000): Promise<boolean> {
  const started = Date.now();
  const url = 'http://localhost:4200' + defect.routes.split(',')[0];
  while (Date.now() - started < timeoutMs) {
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(900);
    const found = await page
      .evaluate(
        ({ text, selector }) => {
          if (selector) return !!document.querySelector(selector);
          if (!text) return true;
          const body = document.body.innerText.replace(/\s+/g, ' ');
          return body.includes(text.replace(/\s+/g, ' '));
        },
        defect.marker,
      )
      .catch(() => false);
    if (found) return true;
    await page.waitForTimeout(1600);
  }
  return false;
}

function restore(file: string, patchFile: string, original: string): void {
  const applied = spawnSync('git', ['apply', '-R', patchFile], { encoding: 'utf8' });
  if (applied.status !== 0) writeFileSync(file, original);
}

async function main(): Promise<void> {
  const only = process.argv.find((a) => a.startsWith('--only='));
  const wanted = only ? new Set(only.split('=')[1].split(',')) : null;
  const defects = DEFECTS.filter((d) => !wanted || wanted.has(d.id));
  const session = await login();
  const results: Array<{ id: string; title: string; expect: string; reported: boolean; reason: string }> = [];

  try {
    for (const defect of defects) {
      const file = resolve(process.cwd(), defect.file);
      if (!existsSync(file)) {
        results.push({ id: defect.id, title: defect.title, expect: defect.expect, reported: false, reason: 'source file missing' });
        continue;
      }
      const original = readFileSync(file, 'utf8');
      if (!original.includes(defect.find)) {
        results.push({ id: defect.id, title: defect.title, expect: defect.expect, reported: false, reason: 'source anchor did not match' });
        continue;
      }
      writeFileSync(file, original.replace(defect.find, defect.replace));
      const patchFile = resolve(OUT, `${defect.id}.patch`);
      const diff = spawnSync('git', ['diff', '--', defect.file], { encoding: 'utf8' }).stdout ?? '';
      writeFileSync(patchFile, diff);

      const live = await waitForMarker(session.page, defect);
      if (!live) {
        restore(file, patchFile, original);
        results.push({ id: defect.id, title: defect.title, expect: defect.expect, reported: false, reason: 'the defect never appeared in the app (build or marker timeout)' });
        continue;
      }

      console.log(`recall: ${defect.id} ${defect.title} → running the fast finder`);
      const before = newestRun();
      spawnSync(
        'npm',
        ['run', 'find', '--', '--fast', '--no-purge', '--no-oracles', '--no-interactions', `--routes=${defect.routes}`],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 240_000,
          env: { ...process.env, FINDER_SKIP_PURGE: '1' },
        },
      );
      const after = newestRun();
      let reported = false;
      let reason = 'not reported';
      if (after && after !== before) {
        try {
          const report = JSON.parse(readFileSync(resolve(after, 'findings.json'), 'utf8')) as Report;
          const outliers = JSON.parse(readFileSync(resolve(after, 'outliers.json'), 'utf8')) as Outliers;
          reported = defect.match(report, outliers);
          if (!reported) {
            const ids = [...new Set(report.roots.map((r) => r.id))].join(', ');
            reason = `reported rules were: ${ids || '(none)'}`;
          }
        } catch (error) {
          reason = `could not read the report: ${String(error).slice(0, 120)}`;
        }
      }
      restore(file, patchFile, original);
      results.push({ id: defect.id, title: defect.title, expect: defect.expect, reported, reason });
      writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(results, null, 1));
    }
  } finally {
    await session.close();
  }

  const reported = results.filter((r) => r.reported).length;
  const percentage = Math.round((reported / results.length) * 1000) / 10;
  const misses = results.filter((r) => !r.reported);
  console.log('');
  console.log(`recall: ${reported}/${results.length} = ${percentage}%`);
  console.log('recall: misses');
  for (const miss of misses) console.log(`  - ${miss.id} ${miss.title} (expected ${miss.expect}) — ${miss.reason}`);
  writeFileSync(resolve(OUT, 'summary.json'), JSON.stringify({ percentage, reported, total: results.length, misses }, null, 1));
  if (percentage < 90) process.exitCode = 1;
}

main().catch((error) => {
  console.error('recall: failed —', error);
  process.exitCode = 2;
});
