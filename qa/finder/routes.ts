import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface FinderRoute {
  page: string;
  path: string;
  /** True when the path was resolved from a parameterised router entry. */
  param?: boolean;
}

/**
 * The crawler's route list, built from three sources so nothing is missed:
 *
 *  1. `qa/routes.ts` — the curated list the QA harness uses (it mirrors the
 *     router and names every page).
 *  2. `src/app/app.routes.ts` — read as text, to REPORT any `path:` token that
 *     the curated list does not cover. A silent gap is how a page is never
 *     crawled.
 *  3. The live sidebar, after login (the crawler adds those hrefs).
 */
export function curatedRoutes(): FinderRoute[] {
  const file = resolve(process.cwd(), 'qa', 'routes.ts');
  const source = readFileSync(file, 'utf8');
  const routes: FinderRoute[] = [];
  const block = source.split('export const paramRoutes')[0];
  const re = /\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)',\s*title:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    routes.push({ page: m[1], path: m[2] });
  }
  return routes;
}

export function paramRoutes(): FinderRoute[] {
  const source = readFileSync(resolve(process.cwd(), 'qa', 'routes.ts'), 'utf8');
  const block = source.split('export const paramRoutes')[1] ?? '';
  const routes: FinderRoute[] = [];
  const re = /\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)',\s*title:\s*'([^']+)',\s*listPath:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    routes.push({ page: m[1], path: m[2] });
  }
  return routes;
}

/** Route tokens in the router source that the curated list does not name. */
export function routeGaps(curated: FinderRoute[]): string[] {
  const source = readFileSync(resolve(process.cwd(), 'src', 'app', 'app.routes.ts'), 'utf8');
  const tokens = new Set<string>();
  for (const m of source.matchAll(/path:\s*'([^']*)'/g)) {
    if (m[1]) tokens.add(m[1]);
  }
  const known = new Set(
    curated.map((r) => r.path.split('/').filter(Boolean).pop() ?? '').concat(['']),
  );
  // A gap is a concrete segment the curated list never walks; parameter
  // segments (`:id`) are resolved by the param resolver instead.
  return [...tokens].filter(
    (token) =>
      !token.startsWith(':') &&
      !known.has(token) &&
      !['login', 'forgot-password', 'reset-password', 'oauth2', 'callback', 'notifications'].includes(token),
  );
}

/** The subset used by `--fast`: one page per area, plus two detail pages. */
export function fastRoutes(all: FinderRoute[]): FinderRoute[] {
  const wanted = new Set([
    'dashboard',
    'products',
    'orders',
    'users',
    'reviews',
    'product-edit',
    'order-detail',
  ]);
  return all.filter((r) => wanted.has(r.page));
}
