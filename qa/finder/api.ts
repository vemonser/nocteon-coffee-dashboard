import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ApiClient } from './invariants.ts';

/** The API origin the SPA talks to, read from the environment file. */
export function apiBase(): string {
  if (process.env['FINDER_API_URL']) return process.env['FINDER_API_URL'].replace(/\/$/, '');
  try {
    const source = readFileSync(resolve(process.cwd(), 'src', 'environments', 'environment.ts'), 'utf8');
    const match = source.match(/apiUrl:\s*'([^']+)'/);
    if (match) return match[1].replace(/\/$/, '');
  } catch {
    /* fall through */
  }
  return 'http://localhost:8080';
}

/** A tiny authenticated client over the dashboard API. */
export function makeApiClient(token: string | null): ApiClient {
  return {
    async get(path: string) {
      if (!token) return { status: 401, data: null, message: 'no token' };
      try {
        const response = await fetch(apiBase() + path, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const body = await response.json().catch(() => null);
        if (response.status >= 400) {
          return { status: response.status, data: null, message: body?.message ?? response.statusText };
        }
        return { status: response.status, data: body?.data ?? body };
      } catch (error) {
        return { status: 0, data: null, message: String(error) };
      }
    },
  };
}
