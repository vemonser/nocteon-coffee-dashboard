import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { routes, paramRoutes } from './routes';
import { dirtyPages, skippedDirtyPages } from './dirty-pages';

const QA_USER = process.env['QA_USER'] || process.env['E2E_ADMIN_EMAIL'] || 'admin@aurum.local';
const QA_PASS = process.env['QA_PASS'] || process.env['E2E_ADMIN_PASSWORD'] || 'Admin@123';

function parseFlag(name: string): string[] | null {
  const env = process.env[name.toUpperCase()];
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean);
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
  return null;
}
const pageFilter = parseFlag('pages');
const themeFilter = parseFlag('themes');
const localeFilter = parseFlag('locales');
const fast = process.argv.includes('--fast') || process.env['FAST'] === '1';

const themes = themeFilter || ['light', 'dark'];
const locales = localeFilter || ['en', 'ar'];
const mobile = !fast;

type Issue = {
  id: string;
  check: string;
  severity: 'P0' | 'P1' | 'P2';
  page: string;
  theme: string;
  locale: string;
  viewport?: string;
  selector?: string;
  message: string;
  screenshot?: string;
};

const issues: Issue[] = [];
let issueCounter: Record<string, number> = {};
function issueId(check: string, page: string) {
  const key = `${check}-${page}`;
  issueCounter[key] = (issueCounter[key] || 0) + 1;
  return `QA-${check}-${page}-${issueCounter[key]}`;
}

function slug(s: string) { return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }

test('qa audit', async ({ page, context }) => {
  // login
  await page.goto('/login');
  await page.fill('input[formControlName="identifier"]', QA_USER);
  await page.fill('input[formControlName="password"]', QA_PASS);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL(/dashboard/, { timeout: 30000 });

  const reportDir = path.join(process.cwd(), 'qa', 'report', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(reportDir, { recursive: true });
  const shotDir = path.join(reportDir, 'screenshots');
  fs.mkdirSync(shotDir, { recursive: true });

  async function shot(name: string) {
    const p = path.join(shotDir, name + '.png');
    await page.screenshot({ path: p, fullPage: false });
    return path.relative(reportDir, p);
  }

  async function setup(theme: string, locale: string, width = 1440) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.evaluate(({ theme, locale }) => {
      localStorage.setItem('nocteon-theme', theme);
      localStorage.setItem('language', locale);
    }, { theme, locale });
  }

  async function runChecks(routeId: string, routePath: string, theme: string, locale: string, width = 1440) {
    const viewport = width === 390 ? 'mobile' : 'desktop';
    const rtl = locale === 'ar';
    for (const c of checkNames.filter(x => x !== 'unsaved')) { coveragePages[c].add(routeId); coverageScenarios[c]++; }
    const consoleErrors: string[] = [];
    const slowRequests: string[] = [];
    const failedRequests: string[] = [];
    const consoleHandler = (msg: any) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 120)); };
    const responseHandler = async (resp: any) => {
      try {
        if (resp.status() >= 400 && resp.status() !== 401 && resp.status() !== 403) failedRequests.push(`${resp.status()} ${resp.url().slice(0, 80)}`);
        const timing = resp.request().timing();
        if (timing && timing.responseEnd - timing.requestStart > 2000) slowRequests.push(resp.url().slice(0, 80));
      } catch {}
    };
    page.on('console', consoleHandler);
    page.on('response', responseHandler);
    await setup(theme, locale, width);
    await page.goto(routePath, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);

    // console/network capture via listeners already? We'll capture now via evaluate for DOM checks.
    const pageName = routeId;

    // 1 Placeholders
    const placeholders = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = (n.textContent || '').trim();
        if (!t) continue;
        if (/\{[A-Za-z0-9_.]+\}/.test(t) || /\{\{/.test(t)) out.push(t.slice(0, 80));
      }
      return [...new Set(out)].slice(0, 20);
    });
    for (const p of placeholders) {
      issues.push({ id: issueId('placeholder', pageName), check: 'placeholder', severity: 'P0', page: pageName, theme, locale, viewport, message: `placeholder text: "${p}"`, screenshot: await shot(`${pageName}-${theme}-${locale}-placeholder`) });
    }

    // 2 Raw keys: visible text equal to flattened en key or namespace.key with no spaces
    // (static-ish; do runtime check for text nodes matching dotted keys)
    const rawKeys = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = (n.textContent || '').trim();
        if (!t || t.includes(' ')) continue;
        if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(t)) out.push(t);
      }
      return [...new Set(out)].slice(0, 20);
    });
    for (const k of rawKeys) {
      issues.push({ id: issueId('rawkey', pageName), check: 'rawkey', severity: 'P0', page: pageName, theme, locale, viewport, message: `raw i18n key: "${k}"` });
    }

    // 5 Date formats
    const badDates = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = (n.textContent || '').trim();
        if (!t) continue;
        if (/\s,/.test(t) || /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(t)) out.push(t.slice(0, 60));
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(t)) out.push(t.slice(0, 60));
        if (/\d{4}-\d{2}-\d{2}/.test(t)) out.push(t.slice(0, 60));
      }
      return [...new Set(out)].slice(0, 20);
    });
    for (const d of badDates) {
      issues.push({ id: issueId('datefmt', pageName), check: 'datefmt', severity: 'P1', page: pageName, theme, locale, viewport, message: `date format: "${d}"` });
    }

    // 7 Overflow
    const overflow = await page.evaluate(() => {
      return {
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      };
    });
    if (overflow.docOverflow) {
      issues.push({ id: issueId('overflow', pageName), check: 'overflow', severity: 'P0', page: pageName, theme, locale, viewport, message: `document scrollWidth ${overflow.scrollW} > clientWidth ${overflow.clientW}` });
    }

    // 9 Images and labels
    const imgIssues = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('img').forEach(img => {
        if ((img as HTMLImageElement).naturalWidth === 0 && (img as HTMLImageElement).src) out.push('broken: ' + (img as HTMLImageElement).src.slice(0, 60));
        const alt = (img as HTMLImageElement).getAttribute('alt');
        if (alt === null) out.push('missing alt');
      });
      // icon-only buttons
      document.querySelectorAll('button').forEach(b => {
        const text = (b.textContent || '').trim();
        if (!text) {
          const hasAria = b.getAttribute('aria-label') || b.getAttribute('title');
          if (!hasAria) out.push('icon button no aria-label');
        }
      });
      return [...new Set(out)].slice(0, 20);
    });
    for (const m of imgIssues) {
      issues.push({ id: issueId('imglabel', pageName), check: 'imglabel', severity: 'P1', page: pageName, theme, locale, viewport, message: m });
    }

    // 10 a11y: basic checks already (labels/buttons). axe-core not installed.

    // 13 Page structure
    const h1s = await page.locator('h1').count();
    if (h1s !== 1) {
      issues.push({ id: issueId('structure', pageName), check: 'structure', severity: 'P1', page: pageName, theme, locale, viewport, message: `h1 count = ${h1s}` });
    } else {
      const isParamRoute = paramRoutes.some((pr) => pr.id === pageName);
      if (!isParamRoute) {
        const h1Text = (await page.locator('h1').first().innerText()).trim().toLowerCase();
        const routeTitle = ([...routes, ...paramRoutes].find((r) => r.id === pageName)?.title || '').toLowerCase();
        if (routeTitle && h1Text !== routeTitle) {
          issues.push({ id: issueId('structure', pageName), check: 'structure', severity: 'P1', page: pageName, theme, locale, viewport, message: `h1 "${h1Text}" != nav label "${routeTitle}"` });
        }
      }
    }

    let heightDiff = 0;
    heightDiff = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="search"], input[type="text"]')).filter((e:any) => {
        const r = (e as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      // filter row: inputs/selects with filter-control-height? check all visible inputs/selects in first toolbar
      const controls = Array.from(document.querySelectorAll('input, select, [role="combobox"]')).map((e:any) => (e as HTMLElement).getBoundingClientRect().height).filter(h=>h>0);
      if (controls.length < 2) return 0;
      const max = Math.max(...controls), min = Math.min(...controls);
      return max - min;
    });
    if (heightDiff > 1) {
      issues.push({ id: issueId('ctrlheight', pageName), check: 'ctrlheight', severity: 'P1', page: pageName, theme, locale, viewport, message: `filter control height diff ${heightDiff.toFixed(1)}px` });
    }

    // H2-8 Console & network
    page.off('console', consoleHandler);
    page.off('response', responseHandler);
    for (const e of consoleErrors) {
      issues.push({ id: issueId('console', pageName), check: 'console', severity: 'P0', page: pageName, theme, locale, viewport, message: `console.error: ${e}` });
    }
    for (const r of failedRequests.slice(0, 10)) {
      issues.push({ id: issueId('network', pageName), check: 'network', severity: 'P0', page: pageName, theme, locale, viewport, message: `failed request: ${r}` });
    }
    for (const r of slowRequests.slice(0, 10)) {
      issues.push({ id: issueId('slow', pageName), check: 'slow', severity: 'P2', page: pageName, theme, locale, viewport, message: `slow request: ${r}` });
    }

    // H2-12 Dialogs: accessible name check (any open dialogs)
    const dialogIssues = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach((d) => {
        if (!d.getAttribute('aria-label') && !d.getAttribute('aria-labelledby')) out.push('dialog without accessible name');
      });
      return out;
    });
    for (const m of dialogIssues) {
      issues.push({ id: issueId('dialog', pageName), check: 'dialog', severity: 'P1', page: pageName, theme, locale, viewport, message: m });
    }

    // screenshot for evidence (viewport)
    await shot(`${pageName}-${theme}-${locale}`);
  }

  const checkNames = ['placeholder','rawkey','datefmt','overflow','imglabel','structure','ctrlheight','console','network','slow','dialog','unsaved'];
  const coveragePages: Record<string, Set<string>> = Object.fromEntries(checkNames.map(c => [c, new Set<string>()]));
  const coverageScenarios: Record<string, number> = Object.fromEntries(checkNames.map(c => [c, 0]));
  const allRoutes = [...routes];
  const skippedRoutes: { id: string; path: string; reason: string }[] = [];
  for (const pr of paramRoutes) {
    if (pageFilter && !pageFilter.includes(pr.id)) { skippedRoutes.push({ id: pr.id, path: pr.path, reason: 'filtered by --pages' }); continue; }
    try {
      await setup('light', 'en');
      await page.goto(pr.listPath!, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const firstLink = page.locator('table tbody tr:first-child a, table tbody tr:first-child button').first();
      if (!(await firstLink.count())) { skippedRoutes.push({ id: pr.id, path: pr.path, reason: 'no first row in list' }); continue; }
      await firstLink.click().catch(() => {});
      await page.waitForTimeout(1500);
      const url = page.url();
      if (url && url !== (process.env['E2E_BASE_URL'] || 'http://localhost:4200') + pr.listPath) {
        allRoutes.push({ ...pr, path: new URL(url).pathname });
      } else {
        skippedRoutes.push({ id: pr.id, path: pr.path, reason: 'navigation did not change URL' });
      }
    } catch (e) {
      skippedRoutes.push({ id: pr.id, path: pr.path, reason: `error: ${e?.message || 'unknown'}` });
    }
  }

  if (pageFilter) {
    for (const r of routes) if (!pageFilter.includes(r.id)) skippedRoutes.push({ id: r.id, path: r.path, reason: 'filtered by --pages' });
  }
  const filteredRoutes = pageFilter ? allRoutes.filter(r => pageFilter.includes(r.id)) : allRoutes;

  for (const r of filteredRoutes) {
    if (mobile) {
      try { await runChecks(r.id, r.path, 'light', 'en', 390); } catch (e) { console.log('mobile error', r.id, e?.message); }
    }
    for (const theme of (fast ? ['light'] : themes)) {
      for (const locale of (fast ? ['en'] : locales)) {
        try { await runChecks(r.id, r.path, theme, locale); } catch (e) { console.log('runChecks error', r.id, e?.message); }
      }
    }
  }

  // Dirty pages check (unsaved changes modal)
  for (const dp of dirtyPages) {
    coveragePages['unsaved'].add(dp.path);
    coverageScenarios['unsaved']++;
    try {
      await setup('light', 'en');
      await page.goto(dp.path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const field = page.locator(dp.fieldSelector).first();
      if (await field.count()) {
        await field.fill(dp.value).catch(() => {});
        await page.waitForTimeout(500);
        await page.click('a[href="/dashboard"]').catch(() => {});
        await page.waitForTimeout(1000);
        const modal = await page.locator('text=Unsaved changes').count();
        if (!modal) {
          issues.push({ id: issueId('unsaved', dp.path), check: 'unsaved', severity: 'P0', page: dp.path, theme: 'light', locale: 'en', viewport: 'desktop', message: 'no "Unsaved changes" modal on navigation' });
        }
      }
    } catch {}
  }

  // Dedupe: unique issue key = check + page + selector/text
  const uniqueMap = new Map();
  for (const it of issues) {
    const key = `${it.check}|${it.page}|${it.selector || it.message}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, { rep: it, combos: new Set() });
    uniqueMap.get(key).combos.add(`${it.theme}/${it.locale}/${it.viewport || 'desktop'}`);
  }

  // Write report
  fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify(issues, null, 2));
  fs.writeFileSync(path.join(reportDir, 'unique-issues.json'), JSON.stringify([...uniqueMap.entries()].map(([k, v]) => ({
    key: k,
    check: v.rep.check,
    severity: v.rep.severity,
    page: v.rep.page,
    message: v.rep.message,
    occurrences: v.combos.size,
    combos: [...v.combos],
  })), null, 2));

  // report.md
  let md = `# QA Report ${path.basename(reportDir)}\n\n`;
  md += `Total occurrences: ${issues.length}\n`;
  md += `Total unique issues: ${uniqueMap.size}\n\n`;

  const uniqueBySeverity = { P0: 0, P1: 0, P2: 0 };
  for (const v of uniqueMap.values()) uniqueBySeverity[v.rep.severity]++;
  md += `## Unique issues by severity\n\n`;
  md += `| Severity | Count |\n|---|---|\n`;
  for (const sev of ['P0','P1','P2']) md += `| ${sev} | ${uniqueBySeverity[sev]} |\n`;
  md += `\n`;

  md += `## Summary by check x severity (occurrences)\n\n`;
  const summary = {};
  for (const it of issues) {
    summary[it.check] = summary[it.check] || { P0: 0, P1: 0, P2: 0 };
    summary[it.check][it.severity]++;
  }
  md += `| Check | P0 | P1 | P2 |\n|---|---|---|---|\n`;
  for (const [c, v] of Object.entries(summary)) {
    md += `| ${c} | ${v.P0} | ${v.P1} | ${v.P2} |\n`;
  }
  md += `\n## Coverage matrix\n\n`;
  md += `| Check | Pages | Scenarios | Unique issues |\n|---|---|---|---|\n`;
  for (const c of checkNames) {
    const uniq = [...uniqueMap.values()].filter(v => v.rep.check === c).length;
    md += `| ${c} | ${coveragePages[c].size} | ${coverageScenarios[c]} | ${uniq} |\n`;
  }
  md += `\n`;
  const zeroPageChecks = checkNames.filter(c => coveragePages[c].size === 0);
  if (zeroPageChecks.length) {
    md += `**HARNESS BUG: checks with 0 pages: ${zeroPageChecks.join(', ')}**\n\n`;
  }

  md += `## Unvisited routes\n\n`;
  if (skippedRoutes.length === 0) {
    md += `_none_\n\n`;
  } else {
    for (const s of skippedRoutes) md += `- ${s.id} (${s.path}): ${s.reason}\n`;
    md += `\n`;
  }

  md += `## Skipped dirty pages\n\n`;
  for (const s of skippedDirtyPages) md += `- ${s.path}: ${s.reason}\n`;
  md += `\n`;

  md += `## Unique issues (grouped)\n\n`;
  for (const [key, v] of uniqueMap) {
    md += `- [${v.rep.severity}] ${v.rep.check} | ${v.rep.page}: ${v.rep.message} — combos: ${[...v.combos].join(', ')} (${v.combos.size})\n`;
  }
  md += `\n`;

  md += `## Issues by page\n\n`;
  const byPage = {};
  for (const it of issues) { (byPage[it.page] = byPage[it.page] || []).push(it); }
  for (const [p, list] of Object.entries(byPage)) {
    md += `### ${p} (${list.length})\n\n`;
    for (const it of list) {
      md += `- ${it.id} [${it.severity}] ${it.check}: ${it.message} (${it.theme}/${it.locale})\n`;
    }
    md += `\n`;
  }
  fs.writeFileSync(path.join(reportDir, 'report.md'), md);

  if (zeroPageChecks.length) process.exitCode = 1;

  // Compare with previous run
  const reportRoot = path.join(process.cwd(), 'qa', 'report');
  const runs = fs.readdirSync(reportRoot).filter(d => d !== path.basename(reportDir)).sort();
  const prev = runs.length ? path.join(reportRoot, runs[runs.length - 1], 'results.json') : null;
  let newCount = issues.length, still = 0, fixed = 0;
  if (prev && fs.existsSync(prev)) {
    const prevIssues = JSON.parse(fs.readFileSync(prev, 'utf8')) as Issue[];
    const prevKeys = new Set(prevIssues.map(i => i.check + '|' + i.page + '|' + i.message));
    const curKeys = new Set(issues.map(i => i.check + '|' + i.page + '|' + i.message));
    newCount = issues.filter(i => !prevKeys.has(i.check + '|' + i.page + '|' + i.message)).length;
    still = issues.filter(i => prevKeys.has(i.check + '|' + i.page + '|' + i.message)).length;
    fixed = prevIssues.filter(i => !curKeys.has(i.check + '|' + i.page + '|' + i.message)).length;
  }
  const uniqueBySev = { P0: 0, P1: 0, P2: 0 };
  for (const v of uniqueMap.values()) uniqueBySev[v.rep.severity]++;
  console.log(`QA unique issues: P0=${uniqueBySev.P0} P1=${uniqueBySev.P1} P2=${uniqueBySev.P2} (occurrences=${issues.length})`);
  console.log(`QA: new=${newCount} still_open=${still} fixed=${fixed} total=${issues.length}`);
  console.log(`Report: ${reportDir}`);

  if (issues.some(i => i.severity === 'P0')) {
    // exit code 1
    process.exitCode = 1;
  }
});