#!/usr/bin/env node
/**
 * Purge automated-test data from the DEV/QA database.
 *
 *   npm run purge:test-data                 # dry run: table + totals
 *   npm run purge:test-data -- --yes        # trash, then permanently delete
 *   npm run purge:test-data -- --prefix=Auditcov --yes
 *
 * A record matches only when its English/Arabic name, its slug/code, or a
 * translation value STARTS WITH one of the prefixes in qa/test-prefixes.json.
 * A prefix in the middle of a name never matches.
 *
 * Safety: refuses anything that is not a localhost API, and refuses when the
 * profile/NODE_ENV looks like production. This script never talks to prod.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(process.cwd(), '.env.local'), quiet: true });

const CONFIGURED_PREFIXES = JSON.parse(
  readFileSync(resolve(process.cwd(), 'qa', 'test-prefixes.json'), 'utf8'),
).prefixes;

/**
 * Every dashboard list endpoint that can hold test data, with the way the
 * backend soft-deletes and permanently deletes it. Shared with the Playwright
 * cleanup helper so both sides agree on paths.
 *
 * `softDelete: 'slug' | 'id' | null`
 *   - slug: DELETE /<path>/{slug}          (catalogue entities)
 *   - id:   DELETE /<path>/{id}            (zones, promo codes, tags)
 *   - null: the entity has no trash view and is hard-deleted directly
 */
const ENTITIES = JSON.parse(
  readFileSync(resolve(process.cwd(), 'qa', 'test-data-entities.json'), 'utf8'),
);

// ── arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const yes = argv.includes('--yes');
const quiet = argv.includes('--quiet');
const json = argv.includes('--json');
const requestedPrefixes = [];
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--prefix' || arg.startsWith('--prefix=')) {
    const value = arg === '--prefix' ? argv[++i] : arg.slice('--prefix='.length);
    if (!value) fail('--prefix needs a value');
    requestedPrefixes.push(...value.split(',').map((s) => s.trim()).filter(Boolean));
  }
}
const prefixes = requestedPrefixes.length ? requestedPrefixes : CONFIGURED_PREFIXES;

for (const prefix of prefixes) {
  const allowed = CONFIGURED_PREFIXES.some((p) => prefix.toLowerCase().startsWith(p.toLowerCase()));
  if (!allowed) {
    fail(
      `refusing prefix "${prefix}": it does not start with a configured test prefix ` +
        `(${CONFIGURED_PREFIXES.map((p) => JSON.stringify(p)).join(', ')})`,
    );
  }
}

// ── safety guards ────────────────────────────────────────────────────────────
const API_BASE = (
  process.env['PURGE_API_BASE_URL'] ??
  process.env['API_BASE_URL'] ??
  'http://localhost:8080'
).replace(/\/+$/, '');

let apiUrl;
try {
  apiUrl = new URL(API_BASE);
} catch {
  fail(`invalid API base URL: ${API_BASE}`);
}
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
if (!LOCAL_HOSTS.has(apiUrl.hostname)) {
  fail(`refusing non-localhost API: ${API_BASE}. This script only runs against DEV/QA.`);
}

const profile = [
  process.env['NODE_ENV'],
  process.env['SPRING_PROFILES_ACTIVE'],
  process.env['APP_ENV'],
  process.env['ENVIRONMENT'],
  process.env['PROFILE'],
]
  .filter(Boolean)
  .join(',');
if (/(^|[,:\s])prod(uction)?($|[,:\s])/i.test(profile) || /prod/i.test(process.env['NODE_ENV'] ?? '')) {
  fail(`refusing to run with a production profile/NODE_ENV: ${profile}`);
}

const ADMIN_EMAIL =
  process.env['PURGE_ADMIN_EMAIL'] ??
  process.env['E2E_ADMIN_EMAIL'] ??
  'admin@aurum.local';
const ADMIN_PASSWORD =
  process.env['PURGE_ADMIN_PASSWORD'] ??
  process.env['E2E_ADMIN_PASSWORD'] ??
  'Admin@123';

// ── http ─────────────────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} → ${status}${body ? `: ${String(body).slice(0, 300)}` : ''}`);
    this.status = status;
  }
}

let token = null;

// The API allows 200 general requests per minute per identity. A purge can
// need hundreds, so pace the calls and retry a 429 instead of dying halfway.
const REQUEST_INTERVAL_MS = Number(process.env['PURGE_REQUEST_INTERVAL_MS'] ?? 350);
const MAX_429_RETRIES = 6;
let nextRequestAt = 0;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function throttle() {
  const wait = nextRequestAt - Date.now();
  if (wait > 0) await sleep(wait);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
}

async function api(
  path,
  { method = 'GET', body, maxRateLimitRetries = MAX_429_RETRIES, rateLimitWaitMs = 5000 } = {},
) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  for (let attempt = 0; attempt <= maxRateLimitRetries; attempt += 1) {
    await throttle();
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 429 && attempt < maxRateLimitRetries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : rateLimitWaitMs;
      if (!quiet) console.error(`  rate limited; retrying in ${Math.round(wait / 1000)}s…`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(method, path, res.status, text);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  throw new ApiError(method, path, 429, 'rate limit retries exhausted');
}

async function login() {
  // Login has its own 5-per-minute bucket; a full QA/E2E run can exhaust it.
  // Wait a full refill window rather than failing the teardown after tests passed.
  const response = await api('/api/auth/login', {
    method: 'POST',
    body: { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    maxRateLimitRetries: 3,
    rateLimitWaitMs: 65_000,
  });
  token = response?.data?.accessToken;
  if (!token) fail('login did not return an access token');
  const role = response?.data?.user?.role;
  if (role && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    fail(`seed account is not an admin (role: ${role})`);
  }
}

// ── scanning ─────────────────────────────────────────────────────────────────
function rowsOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

async function listAll(path) {
  if (!path) return [];
  const rows = [];
  for (let page = 0; page < 1000; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await api(`${path}${separator}page=${page}&size=100`);
    const data = response?.data;
    const content = rowsOf(data);
    rows.push(...content);
    if (Array.isArray(data) || data?.last === true || content.length < 100) break;
  }
  return rows;
}

/** Every string that could carry a test prefix. */
function candidateValues(record) {
  const values = [];
  for (const key of ['name', 'title', 'code', 'subject', 'slug', 'value']) {
    if (typeof record?.[key] === 'string') values.push(record[key]);
  }
  for (const translation of record?.translations ?? []) {
    for (const key of ['name', 'title', 'value']) {
      if (typeof translation?.[key] === 'string') values.push(translation[key]);
    }
  }
  return values;
}

function matchedPrefix(record) {
  const values = candidateValues(record);
  for (const value of values) {
    const lower = value.toLowerCase();
    for (const prefix of prefixes) {
      if (lower.startsWith(prefix.toLowerCase())) return prefix;
    }
  }
  return null;
}

function displayName(record) {
  const translations = record?.translations ?? [];
  const english = translations.find((t) => t?.language === 'en');
  return (
    english?.name ??
    english?.title ??
    translations[0]?.name ??
    translations[0]?.title ??
    record?.name ??
    record?.title ??
    record?.subject ??
    record?.code ??
    record?.slug ??
    String(record?.id ?? '')
  );
}

function identify(record) {
  return {
    id: record?.id ?? null,
    slug: record?.slug ?? null,
    name: displayName(record),
  };
}

async function scan() {
  const matches = [];
  const counts = {};

  for (const entity of ENTITIES) {
    const active = await listAll(entity.path);
    const trashed = entity.trashPath ? await listAll(entity.trashPath) : [];
    let activeMatches = 0;
    let trashMatches = 0;

    for (const [inTrash, rows] of [
      [false, active],
      [true, trashed],
    ]) {
      for (const record of rows) {
        if (!matchedPrefix(record)) continue;
        const { id, slug, name } = identify(record);
        matches.push({
          entity: entity.key,
          label: entity.label,
          id,
          slug,
          name,
          inTrash,
        });
        if (inTrash) trashMatches += 1;
        else activeMatches += 1;
      }
    }

    counts[entity.key] = {
      label: entity.label,
      active: activeMatches,
      trash: trashMatches,
      total: activeMatches + trashMatches,
    };
  }

  const totals = Object.values(counts).reduce(
    (acc, c) => ({
      active: acc.active + c.active,
      trash: acc.trash + c.trash,
      total: acc.total + c.total,
    }),
    { active: 0, trash: 0, total: 0 },
  );

  return { counts, matches, totals };
}

// ── deletion ─────────────────────────────────────────────────────────────────
async function deleteOne(entity, match) {
  if (entity.softDelete && !match.inTrash) {
    const key = entity.softDelete === 'slug' ? match.slug : match.id;
    if (key === null || key === undefined) {
      throw new Error(`${entity.label} #${match.id} has no ${entity.softDelete} to trash by`);
    }
    try {
      await api(`${entity.path}/${encodeURIComponent(key)}`, { method: 'DELETE' });
    } catch (error) {
      // Already in the trash (404) is fine; a refusal (409, referenced) is not.
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
    }
  }

  if (entity.softDelete) {
    await api(`${entity.path}/${match.id}/permanent`, { method: 'DELETE' });
  } else {
    // Broadcasts: the only delete is already permanent.
    await api(`${entity.path}/${match.id}`, { method: 'DELETE' });
  }
}

async function purge(matches) {
  const byEntity = new Map(ENTITIES.map((e) => [e.key, e]));
  const failures = [];
  for (const match of matches) {
    const entity = byEntity.get(match.entity);
    try {
      await deleteOne(entity, match);
      if (!quiet) console.log(`  deleted  ${entity.label} #${match.id}  ${match.name}`);
    } catch (error) {
      failures.push({ match, error: error instanceof Error ? error.message : String(error) });
      console.error(`  FAILED   ${entity.label} #${match.id}  ${match.name}: ${error.message ?? error}`);
    }
  }
  return failures;
}

// ── output ───────────────────────────────────────────────────────────────────
function printTable(matches) {
  const headers = ['Entity', 'ID', 'Name', 'In trash'];
  const rows = matches.map((m) => [m.label, String(m.id ?? '—'), m.name, m.inTrash ? 'yes' : 'no']);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length)),
  );
  const line = (cells) =>
    cells
      .map((cell, i) => String(cell).padEnd(widths[i]))
      .join('  ')
      .trimEnd();

  console.log(line(headers));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const row of rows) console.log(line(row));
}

function printCounts(counts) {
  for (const count of Object.values(counts)) {
    console.log(
      `  ${count.label.padEnd(22)} active ${String(count.active).padStart(3)}   trash ${String(count.trash).padStart(3)}   total ${String(count.total).padStart(3)}`,
    );
  }
}

function publicReport(scanResult, extra = {}) {
  return {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    prefixes,
    dryRun: !yes,
    counts: scanResult.counts,
    totals: scanResult.totals,
    matches: scanResult.matches,
    ...extra,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!json && !quiet) {
    console.log(`Purge test data — ${yes ? 'DELETE' : 'DRY RUN'}`);
    console.log(`API: ${API_BASE}`);
    console.log(`Prefixes: ${prefixes.map((p) => JSON.stringify(p)).join(', ')}`);
    console.log('');
  }

  await login();
  const before = await scan();

  if (json) {
    if (!yes) {
      console.log(JSON.stringify(publicReport(before), null, 2));
      return;
    }
  }

  if (!quiet) {
    if (before.matches.length === 0) {
      console.log('No matching records.');
    } else {
      printTable(before.matches);
    }
    console.log('');
    console.log(`Before — matching records per entity:`);
    printCounts(before.counts);
    console.log(
      `Totals: ${before.totals.total} (${before.totals.active} active, ${before.totals.trash} in trash)`,
    );
  }

  if (!yes) {
    if (!quiet) {
      console.log('');
      console.log('Dry run only. Re-run with --yes to trash and permanently delete these records.');
    }
    return;
  }

  if (!quiet) console.log('\nDeleting…');
  const failures = await purge(before.matches);

  const after = await scan();
  if (!quiet) {
    console.log('');
    console.log('After — matching records per entity:');
    printCounts(after.counts);
    console.log(
      `Totals: ${after.totals.total} (${after.totals.active} active, ${after.totals.trash} in trash)`,
    );
    if (failures.length) console.log(`\n${failures.length} record(s) could not be deleted.`);
  }

  if (json) {
    console.log(JSON.stringify(publicReport(after, { deleted: before.totals, failures: failures.length }), null, 2));
  }

  if (after.totals.total > 0 || failures.length > 0) process.exitCode = 1;
}

function fail(message) {
  console.error(`purge-test-data: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`purge-test-data: ${error.stack ?? error.message ?? error}`);
  process.exit(1);
});
