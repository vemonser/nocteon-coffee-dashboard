import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Last line of defence: after every E2E run, purge anything created under this
 * run's unique prefix (registered by the specs, or missed because a test
 * failed before its afterAll).
 *
 * Playwright passes the config's env to teardown, so QA_RUN_PREFIX is the same
 * value e2e/helpers/test-data.ts used inside the workers.
 */
export default async function globalTeardown(): Promise<void> {
  const prefix = process.env['QA_RUN_PREFIX'];
  if (!prefix) return;

  const script = join(process.cwd(), 'scripts', 'purge-test-data.mjs');

  const purge = spawnSync(process.execPath, [script, '--yes', '--prefix', prefix, '--quiet'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (purge.status !== 0) {
    throw new Error(`global teardown: purge for prefix "${prefix}" failed (exit ${purge.status})`);
  }

  const verify = spawnSync(process.execPath, [script, '--json', '--prefix', prefix], {
    encoding: 'utf8',
    env: process.env,
  });
  if (verify.status !== 0) {
    throw new Error(
      `global teardown: verification scan failed (exit ${verify.status})\n${verify.stderr}`,
    );
  }

  const payload = verify.stdout.slice(verify.stdout.indexOf('{'));
  const report = JSON.parse(payload) as { totals?: { total?: number } };
  const remaining = report.totals?.total ?? 0;
  if (remaining !== 0) {
    throw new Error(
      `global teardown: ${remaining} record(s) with prefix "${prefix}" still exist after cleanup`,
    );
  }
}
