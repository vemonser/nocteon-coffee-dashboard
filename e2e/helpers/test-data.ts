import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from '@playwright/test';

/**
 * Test-data hygiene helpers.
 *
 * Every data-creating spec names its records with the run prefix (a unique
 * prefix under `qa/test-prefixes.json`, e.g. `e2e-2026-10-30T...-`), registers
 * the id the API returned, and calls `cleanupCreated()` in afterAll. The run
 * prefix is also handed to the global teardown, which purges anything a failed
 * or interrupted test did not clean up.
 */

const TEST_PREFIXES = JSON.parse(
  readFileSync(join(process.cwd(), 'qa', 'test-prefixes.json'), 'utf8'),
).prefixes as string[];

const ENTITIES = JSON.parse(
  readFileSync(join(process.cwd(), 'qa', 'test-data-entities.json'), 'utf8'),
) as Array<{
  key: string;
  label: string;
  path: string;
  trashPath: string | null;
  softDelete: 'slug' | 'id' | null;
}>;

const BASE_PREFIX = TEST_PREFIXES.includes('e2e-') ? 'e2e-' : TEST_PREFIXES[0];

export const RUN_ID = process.env['QA_RUN_ID'] ?? 'manual';
export const RUN_PREFIX = process.env['QA_RUN_PREFIX'] ?? `${BASE_PREFIX}${RUN_ID}-`;

const RUN_DIR = join(process.cwd(), 'qa', '.run');
const REGISTRY = join(RUN_DIR, `${RUN_ID}.json`);

export interface CreatedRecord {
  entity: string;
  id: number;
  slug?: string | null;
  name: string;
}

/** A name that starts with the run's test prefix. */
export function testName(label: string): string {
  return `${RUN_PREFIX}${label}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function readRegistry(): CreatedRecord[] {
  if (!existsSync(REGISTRY)) return [];
  try {
    return JSON.parse(readFileSync(REGISTRY, 'utf8')) as CreatedRecord[];
  } catch {
    return [];
  }
}

function writeRegistry(records: CreatedRecord[]): void {
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(REGISTRY, `${JSON.stringify(records, null, 2)}\n`);
}

/** Record the id the API returned, so cleanup can delete exactly this row. */
export function recordCreated(record: CreatedRecord): void {
  const records = readRegistry();
  if (records.some((r) => r.entity === record.entity && r.id === record.id)) return;
  records.push(record);
  writeRegistry(records);
}

/** Drop a row the test already deleted through the UI. */
export function forgetCreated(entity: string, id: number): void {
  const records = readRegistry().filter((r) => !(r.entity === entity && r.id === id));
  writeRegistry(records);
}

/** Record the `data` object of a create response (id + slug). */
export async function recordResponse(
  response: Response,
  entity: string,
  name: string,
): Promise<CreatedRecord | null> {
  const body = await response.json().catch(() => null);
  const data = body?.data;
  if (!data || typeof data.id !== 'number') return null;
  const record: CreatedRecord = {
    entity,
    id: data.id,
    slug: data.slug ?? null,
    name,
  };
  recordCreated(record);
  return record;
}

function apiBase(): string {
  return (
    process.env['PURGE_API_BASE_URL'] ??
    process.env['API_BASE_URL'] ??
    'http://localhost:8080'
  ).replace(/\/+$/, '');
}

let cachedToken: string | null = null;

async function apiToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const identifier =
    process.env['PURGE_ADMIN_EMAIL'] ??
    process.env['E2E_ADMIN_EMAIL'] ??
    'admin@aurum.local';
  const password =
    process.env['PURGE_ADMIN_PASSWORD'] ??
    process.env['E2E_ADMIN_PASSWORD'] ??
    'Admin@123';
  const response = await fetch(`${apiBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!response.ok) {
    throw new Error(`cleanup login failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { data?: { accessToken?: string } };
  if (!body.data?.accessToken) throw new Error('cleanup login returned no access token');
  cachedToken = body.data.accessToken;
  return cachedToken;
}

async function call(method: string, path: string): Promise<number> {
  const token = await apiToken();
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.status;
}

/**
 * Trash + permanently delete everything this run registered.
 *
 * Safe to call more than once: an id that is already gone answers 404 and is
 * treated as cleaned. A 409 (still referenced) is reported, not hidden.
 */
export async function cleanupCreated(): Promise<void> {
  const records = readRegistry();
  if (records.length === 0) return;

  const failures: string[] = [];
  for (const record of records) {
    const entity = ENTITIES.find((e) => e.key === record.entity);
    if (!entity) {
      failures.push(`${record.entity} #${record.id}: unknown entity`);
      continue;
    }

    try {
      if (entity.softDelete) {
        const key = entity.softDelete === 'slug' ? record.slug : record.id;
        if (key !== null && key !== undefined) {
          const status = await call('DELETE', `${entity.path}/${encodeURIComponent(String(key))}`);
          if (status !== 204 && status !== 200 && status !== 404) {
            failures.push(`${entity.label} #${record.id}: trash answered ${status}`);
            continue;
          }
        }
        const permanent = await call('DELETE', `${entity.path}/${record.id}/permanent`);
        if (permanent !== 204 && permanent !== 200 && permanent !== 404) {
          failures.push(`${entity.label} #${record.id}: permanent delete answered ${permanent}`);
        }
      } else {
        // Broadcasts have no trash: DELETE is already permanent. A row the test
        // deleted already can answer 500 (the recipient list is gone too), so
        // confirm it is really absent instead of assuming the worst.
        const status = await call('DELETE', `${entity.path}/${record.id}`);
        if (status !== 204 && status !== 200 && status !== 404) {
          const exists = await call('GET', `${entity.path}/${record.id}`);
          if (exists !== 404) {
            failures.push(`${entity.label} #${record.id}: delete answered ${status}`);
          }
        }
      }
    } catch (error) {
      failures.push(`${entity.label} #${record.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  rmSync(REGISTRY, { force: true });

  if (failures.length) {
    throw new Error(`test-data cleanup failed:\n- ${failures.join('\n- ')}`);
  }
}
