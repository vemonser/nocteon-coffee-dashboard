// The verification summary — the e2e suite's result, recorded next to the
// evidence so results.json answers "what was tested?" in one place.
//
//   node scripts/verify-orders.mjs
//
// Runs the two orders suites with Playwright's JSON reporter, then writes
// evidence/orders/verification.json: every test with its status, and the
// exit code of the run.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const OUT = resolve(process.cwd(), 'evidence/orders');
const REPORT = resolve(process.cwd(), 'evidence/orders/playwright-report.json');

const suites = ['e2e/orders.spec.ts', 'e2e/orders-states.spec.ts'];

let exitCode = 0;
let raw = '';
try {
  raw = execFileSync(
    'npx',
    ['playwright', 'test', ...suites, '--reporter=json', '--output=evidence/orders/playwright-artifacts'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        E2E_NO_WEBSERVER: '1',
        // The artifacts live with the evidence, so a run never cleans the
        // traces of another run in the same repository.
        PW_OUTPUT_DIR: 'evidence/orders/playwright-artifacts',
      },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  exitCode = 0;
} catch (err) {
  raw = err.stdout ?? '';
  exitCode = typeof err.status === 'number' ? err.status : 1;
  if (!raw) {
    console.error(String(err.stderr ?? err));
    throw err;
  }
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  // The JSON reporter writes to stdout, but a warning can precede it.
  const start = raw.indexOf('{');
  report = JSON.parse(raw.slice(start));
}

const tests = [];
for (const suite of report.suites ?? []) {
  walk(suite, tests);
}

function walk(suite, out) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      const last = results[results.length - 1];
      out.push({
        file: spec.file ?? spec.title,
        title: spec.title,
        status: last?.status ?? 'unknown',
        durationMs: last?.duration ?? null,
        ok: (last?.status ?? 'unknown') === 'passed',
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child, out);
}

const summary = {
  generatedAt: new Date().toISOString(),
  command: 'npx playwright test e2e/orders.spec.ts e2e/orders-states.spec.ts',
  exitCode,
  total: tests.length,
  passed: tests.filter((t) => t.ok).length,
  failed: tests.filter((t) => !t.ok).length,
  tests,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/verification.json`, JSON.stringify(summary, null, 2));

// Merge it into results.json when that file exists.
const resultsFile = `${OUT}/results.json`;
if (existsSync(resultsFile)) {
  const results = JSON.parse(readFileSync(resultsFile, 'utf8'));
  results.verification = summary;
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`merged into ${resultsFile}`);
}

console.log(`orders e2e: ${summary.passed}/${summary.total} passed (exit ${exitCode})`);
process.exit(exitCode);
