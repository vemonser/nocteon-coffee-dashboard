import { spawnSync } from 'node:child_process';

/**
 * The idempotent fixture step.
 *
 * The store's seed data is the fixture: the finder must NOT wipe it. What it
 * does reset is everything a previous automated run could have left behind —
 * the QA-prefixed records (`Auditcov`, `QA `, `e2e-`). The purge script
 * refuses any non-localhost API and any production-looking profile, so this
 * cannot touch the real store.
 *
 * It runs before the crawl (so a dirty DB cannot be mistaken for the app's
 * own data) and again afterwards (so a journey that half-finished leaves
 * nothing behind).
 */
export function purgeTestData(quiet = true): { ok: boolean; output: string } {
  if (process.env['FINDER_SKIP_PURGE'] === '1') {
    return { ok: true, output: 'skipped (FINDER_SKIP_PURGE=1)' };
  }
  const result = spawnSync('node', ['scripts/purge-test-data.mjs', '--yes', '--quiet'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 180_000,
    env: process.env,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return { ok: result.status === 0, output: quiet ? output.slice(0, 2000) : output };
}
