import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { crawl, writeCrawl } from './crawler.ts';
import { mineOutliers } from './outliers.ts';
import { runOracles } from './invariants.ts';
import { makeApiClient } from './api.ts';
import { JOURNEYS, runJourney } from './journeys.ts';
import { runVision } from './vision.ts';
import { purgeTestData } from './fixtures.ts';
import { groupFindings, renderReport, type Baseline } from './triage.ts';
import type { Finding } from './types.ts';

const require = createRequire(resolve(process.cwd(), 'package.json'));
require('dotenv').config({ path: '.env.local', quiet: true });

interface Args {
  fast: boolean;
  fix: boolean;
  vision: boolean;
  updateBaseline: boolean;
  reportOnly: boolean;
  headed: boolean;
  noPurge: boolean;
  noOracles: boolean;
  noInteractions: boolean;
  journeysRerun: boolean;
  from?: string;
  maxRoutes?: number;
  routes?: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    fast: argv.includes('--fast'),
    fix: argv.includes('--fix'),
    vision: argv.includes('--vision'),
    updateBaseline: argv.includes('--update-baseline'),
    reportOnly: argv.includes('--report-only'),
    headed: argv.includes('--headed'),
    noPurge: argv.includes('--no-purge'),
    noOracles: argv.includes('--no-oracles'),
    noInteractions: argv.includes('--no-interactions'),
    journeysRerun: argv.includes('--journeys'),
  };
  const max = argv.find((a) => a.startsWith('--max-routes='));
  if (max) args.maxRoutes = Number(max.split('=')[1]);
  const from = argv.find((a) => a.startsWith('--from='));
  if (from) args.from = from.split('=')[1];
  const routes = argv.find((a) => a.startsWith('--routes='));
  if (routes) args.routes = routes.split('=')[1].split(',').map((r) => r.trim()).filter(Boolean);
  return args;
}

function readBaseline(): { baseline: Baseline | null; exists: boolean } {
  const file = resolve(process.cwd(), 'qa', 'baseline.json');
  if (!existsSync(file)) return { baseline: null, exists: false };
  try {
    return { baseline: JSON.parse(readFileSync(file, 'utf8')) as Baseline, exists: true };
  } catch {
    return { baseline: null, exists: false };
  }
}

async function loginAndToken(baseUrl: string): Promise<{ page: import('playwright').Page; token: string | null; close: () => Promise<void> }> {
  const email = process.env['FINDER_EMAIL'] ?? process.env['E2E_ADMIN_EMAIL'];
  const password = process.env['FINDER_PASSWORD'] ?? process.env['E2E_ADMIN_PASSWORD'];
  if (!email || !password) throw new Error('finder: set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in .env.local');
  const browser = await chromium.launch({ channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let token: string | null = null;
  page.on('request', (request) => {
    const header = request.headers()['authorization'];
    if (header?.startsWith('Bearer ')) token = header.slice(7);
  });
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1500);
  return { page, token, close: () => browser.close() };
}

function journeyFindings(journeys: Awaited<ReturnType<typeof runJourney>>[]): Finding[] {
  const out: Finding[] = [];
  for (const journey of journeys) {
    for (const step of journey.steps.filter((s) => !s.done)) {
      out.push({
        detector: 'journeys',
        id: `journeys.${journey.id}.${step.id}`,
        severity: journey.status === 'blocked' && step.id === 'open' ? 'high' : 'medium',
        selector: `journey:${journey.id}`,
        message: `Task journey "${journey.title}" could not reach a step.`,
        evidence: `${step.title} — pass condition: ${journey.pass}`,
        page: `journey:${journey.id}`,
        route: journey.area,
        state: step.id,
        env: 'light/en/1440',
        screenshot: '',
      });
    }
    for (const workaround of journey.workarounds) {
      if (!workaround.startsWith('write:')) continue;
      out.push({
        detector: 'journeys',
        id: `journeys.${journey.id}.write-disabled`,
        severity: 'low',
        selector: `journey:${journey.id}`,
        message: 'A write step of the task journey was skipped (writes are opt-in).',
        evidence: workaround,
        page: `journey:${journey.id}`,
        route: journey.area,
        state: 'write',
        env: 'light/en/1440',
        screenshot: '',
      });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = resolve(process.cwd(), 'qa', '.run', 'find', stamp);
  mkdirSync(outDir, { recursive: true });
  const baseUrl = process.env['FINDER_BASE_URL'] ?? 'http://localhost:4200';
  const started = Date.now();

  console.log(`finder: run ${stamp} (${args.fast ? 'fast' : 'full'})`);

  // Re-triage an existing crawl without visiting the app again. The raw
  // evidence (states, fingerprints, screenshots) is unchanged; only the
  // grouping/report is rebuilt. `--journeys` replays the task journeys.
  if (args.from) {
    const dir = resolve(process.cwd(), args.from);
    const savedCrawl = JSON.parse(readFileSync(resolve(dir, 'crawl.json'), 'utf8'));
    const saved = JSON.parse(readFileSync(resolve(dir, 'findings.json'), 'utf8'));
    // Recent-order links in the page body were once mistaken for sidebar
    // routes; those page ids are not routes and are dropped on re-triage.
    const bogus = /^sidebar:dashboard-(orders|carts)-\d+/;
    const savedFindings: Finding[] = (saved.findings ?? []).filter(
      (f: Finding) => f.detector !== 'journeys' && !bogus.test(f.page),
    );
    const findings: Finding[] = [...savedFindings];
    let journeys: Awaited<ReturnType<typeof runJourney>>[] = [];
    const journeysFile = resolve(dir, 'journeys.json');
    if (existsSync(journeysFile)) journeys = JSON.parse(readFileSync(journeysFile, 'utf8'));
    if (args.journeysRerun) {
      const session = await loginAndToken(baseUrl);
      try {
        for (const journey of JOURNEYS) {
          await session.page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await session.page.waitForTimeout(600);
          const result = await runJourney(journey, baseUrl, session.page);
          journeys = journeys.filter((j) => j.id !== result.id);
          journeys.push(result);
          console.log(`finder: journey ${journey.id} → ${result.status} (${result.clicks} clicks, ${result.keys ?? result.keystrokes} keys)`);
        }
        findings.push(...journeyFindings(journeys));
        writeFileSync(resolve(dir, 'journeys.json'), JSON.stringify(journeys, null, 1));
      } finally {
        await session.close();
      }
    }
    const outliers = mineOutliers(savedCrawl);
    const { baseline, exists } = readBaseline();
    const { roots, fixed } = groupFindings(findings, baseline);
    writeFileSync(resolve(process.cwd(), 'FINDINGS.md'), renderReport({
      roots, fixed, states: savedCrawl.states, outliers, journeys,
      routeGaps: savedCrawl.routeGaps ?? [], vision: { issued: 0, skipped: 'not re-run' },
      startedAt: savedCrawl.startedAt, finishedAt: savedCrawl.finishedAt, fast: false, baselineExists: exists,
    }));
    writeFileSync(resolve(dir, 'findings.json'), JSON.stringify({ roots, findings, fixed }, null, 1));
    if (args.updateBaseline) {
      const next: Baseline = { findings: { ...(baseline?.findings ?? {}) } };
      for (const root of roots) {
        next.findings[root.key] = { status: 'known', firstSeen: next.findings[root.key]?.firstSeen ?? new Date().toISOString(), lastSeen: new Date().toISOString() };
      }
      writeFileSync(resolve(process.cwd(), 'qa', 'baseline.json'), JSON.stringify(next, null, 1));
      console.log(`finder: baseline updated (${roots.length} known)`);
    }
    console.log(`finder: re-triaged ${dir.replace(process.cwd() + '/', '')} → ${roots.length} root findings`);
    return;
  }

  if (!args.noPurge) {
    const purge = purgeTestData();
    console.log(`finder: pre-crawl purge ${purge.ok ? 'ok' : 'FAILED'} ${purge.output ? `— ${purge.output.split('\n')[0]}` : ''}`);
  }

  // ── F1/F2/F3: crawl + detectors + fingerprints ────────────────────────────
  let crawlResult = await crawl({
    baseUrl,
    outDir,
    fast: args.fast,
    maxRoutes: args.maxRoutes,
    headed: args.headed,
    routes: args.routes,
    noInteractions: args.noInteractions,
  });
  if (args.routes?.length) {
    // The CLI filter is applied here so the crawler stays unaware of it.
    const wanted = new Set(args.routes.map((r) => r.replace(/\/$/, '')));
    const states = crawlResult.states.filter((s) => wanted.has(s.route));
    const findings = crawlResult.findings.filter((f) => wanted.has(f.route));
    crawlResult = { ...crawlResult, states, findings };
  }
  const crawlFile = writeCrawl(crawlResult, outDir);
  console.log(`finder: crawled ${crawlResult.states.length} states, ${crawlResult.findings.length} raw issues`);

  // ── F3: the outlier miner ─────────────────────────────────────────────────
  const outliers = mineOutliers(crawlResult);
  writeFileSync(resolve(outDir, 'outliers.json'), JSON.stringify(outliers, null, 1));
  console.log(`finder: ${outliers.clusters.length} minority clusters, ${outliers.offScale.length} off-scale values`);

  // ── F4/F5: oracles and journeys (one authenticated page) ──────────────────
  const findings: Finding[] = [...crawlResult.findings];
  let journeys: Awaited<ReturnType<typeof runJourney>>[] = [];
  const session = args.noOracles
    ? null
    : await loginAndToken(baseUrl).catch((error) => {
    console.log(`finder: could not open an authenticated page for oracles/journeys — ${String(error)}`);
    return null;
  });
  if (session) {
    try {
      const api = makeApiClient(crawlResult.apiToken ?? session.token);
      const oracleFindings = await runOracles(session.page, baseUrl, api);
      findings.push(...oracleFindings);
      console.log(`finder: oracles ${oracleFindings.length} mismatch(es)`);

      if (!args.fast) {
        for (const journey of JOURNEYS) {
          await session.page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await session.page.waitForTimeout(600);
          const result = await runJourney(journey, baseUrl, session.page);
          journeys.push(result);
          console.log(`finder: journey ${journey.id} → ${result.status} (${result.clicks} clicks, ${Math.round(result.ms / 1000)}s)`);
        }
        findings.push(...journeyFindings(journeys));
      }
    } finally {
      await session.close();
    }
  }
  writeFileSync(resolve(outDir, 'journeys.json'), JSON.stringify(journeys, null, 1));

  // ── F6: vision on crops only ──────────────────────────────────────────────
  const vision = args.fast || !args.vision
    ? { issued: 0, skipped: args.fast ? 'skipped by --fast' : 'pass --vision to run (FINDER_VISION_CMD required)', issues: [] }
    : runVision(crawlResult.crops, outDir, resolve(process.cwd(), 'qa', 'finder', 'golden'));
  for (const issue of vision.issues) {
    const first = issue.answers.find((a) => a.answer === 'yes');
    findings.push({
      detector: 'vision',
      id: 'vision.crop-question',
      severity: 'medium',
      selector: issue.selector ?? 'crop',
      message: first?.question ?? 'The vision model answered yes to a crop question.',
      evidence: first?.reason ?? '',
      page: issue.crop.page,
      route: issue.crop.route,
      state: issue.crop.state,
      env: 'light/en/1440',
      screenshot: issue.crop.file,
    });
  }

  // ── F8: triage, baseline, report ──────────────────────────────────────────
  const { baseline, exists } = readBaseline();
  const { roots, fixed } = groupFindings(findings, baseline);
  const report = renderReport({
    roots,
    fixed,
    states: crawlResult.states,
    outliers,
    journeys,
    routeGaps: crawlResult.routeGaps,
    vision,
    startedAt: crawlResult.startedAt,
    finishedAt: crawlResult.finishedAt,
    fast: args.fast,
    baselineExists: exists,
  });
  writeFileSync(resolve(process.cwd(), 'FINDINGS.md'), report);
  writeFileSync(resolve(outDir, 'findings.json'), JSON.stringify({ roots, findings, fixed }, null, 1));

  if (args.updateBaseline) {
    const next: Baseline = { findings: { ...(baseline?.findings ?? {}) } };
    for (const root of roots) {
      next.findings[root.key] = {
        status: 'known',
        firstSeen: next.findings[root.key]?.firstSeen ?? new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
    }
    writeFileSync(resolve(process.cwd(), 'qa', 'baseline.json'), JSON.stringify(next, null, 1));
    console.log(`finder: baseline updated (${roots.length} known, ${fixed.length} fixed)`);
  }

  // ── F9 pre-push gate ──────────────────────────────────────────────────────
  const blocking = roots.filter(
    (root) => root.status === 'new' && !root.needsHuman && root.severity !== 'low',
  );
  if (args.reportOnly) {
    if (blocking.length) {
      console.log(`finder: ${blocking.length} NEW finding(s) since the baseline:`);
      for (const root of blocking.slice(0, 10)) console.log(`  - [${root.severity}] ${root.title} (${root.pages.join(', ')})`);
      process.exitCode = 1;
    } else {
      console.log('finder: no new high/medium findings.');
    }
  }

  if (args.fix) {
    const candidates = roots.filter((root) => root.status === 'new' && !root.needsHuman).slice(0, 10);
    console.log(`finder: --fix — ${candidates.length} candidate(s) from the top of FINDINGS.md`);
    for (const root of candidates) {
      console.log(`  - ${root.id}: ${root.title} (${root.pages.join(', ')})`);
    }
    const command = process.env['FINDER_FIX_CMD'];
    if (command && candidates.length) {
      const { spawnSync } = await import('node:child_process');
      const result = spawnSync(command, [], {
        input: JSON.stringify({ findings: candidates }, null, 1),
        encoding: 'utf8',
        timeout: 900_000,
        cwd: process.cwd(),
      });
      console.log(result.stdout?.slice(0, 4000) ?? '');
      console.log(result.stderr?.slice(0, 2000) ?? '');
    } else if (candidates.length) {
      console.log('finder: attach FINDER_FIX_CMD to let a model apply the fixes, or fix them by hand and re-run.');
      console.log('finder: a finding is only "fixed" after a re-run with --update-baseline no longer fires it.');
    }
  }

  if (!args.noPurge) {
    const purge = purgeTestData();
    console.log(`finder: post-run purge ${purge.ok ? 'ok' : 'FAILED'}`);
  }

  console.log(`finder: report → FINDINGS.md (${roots.length} root findings)`);
  console.log(`finder: evidence → ${crawlFile.replace(process.cwd() + '/', '')}`);
  console.log(`finder: finished in ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((error) => {
  console.error('finder: failed —', error);
  process.exitCode = 2;
});
