import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * After the QA audit, no admin list (active or trash) may contain a record
 * whose English/Arabic name or slug starts with a QA prefix.
 *
 * The check reuses scripts/purge-test-data.mjs in dry-run/JSON mode, so the
 * matching rules live in exactly one place.
 */
test('no test data visible in admin lists', async () => {
  const report = execFileSync(
    process.execPath,
    [join(process.cwd(), 'scripts', 'purge-test-data.mjs'), '--json'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PURGE_API_BASE_URL:
          process.env['QA_API_BASE_URL'] ?? process.env['API_BASE_URL'] ?? 'http://localhost:8080',
        PURGE_ADMIN_EMAIL:
          process.env['QA_USER'] ?? process.env['E2E_ADMIN_EMAIL'] ?? 'admin@aurum.local',
        PURGE_ADMIN_PASSWORD:
          process.env['QA_PASS'] ?? process.env['E2E_ADMIN_PASSWORD'] ?? 'Admin@123',
      },
    },
  );

  const payload = report.slice(report.indexOf('{'));
  const result = JSON.parse(payload) as {
    totals: { total: number; active: number; trash: number };
    counts: Record<string, { label: string; total: number; active: number; trash: number }>;
    matches: Array<{ label: string; id: number; name: string; inTrash: boolean }>;
  };

  const offenders = result.matches
    .slice(0, 20)
    .map((m) => `${m.label} #${m.id} "${m.name}"${m.inTrash ? ' (trash)' : ''}`)
    .join('\n');

  expect(
    result.totals.total,
    `${result.totals.total} test record(s) are visible to admins ` +
      `(${result.totals.active} active, ${result.totals.trash} in trash):\n${offenders}`,
  ).toBe(0);
});
