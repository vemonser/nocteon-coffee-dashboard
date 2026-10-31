import type { Page } from 'playwright';

export interface JourneyContext {
  page: Page;
  baseUrl: string;
  clicks: () => number;
  keystrokes: () => number;
  countClick: () => void;
  countKeys: (n: number) => void;
  /** Record a step that needed a workaround (retry, scroll, fallback). */
  workaround: (step: string, note: string) => void;
}

export interface JourneyStep {
  id: string;
  /** Plain-language step, mirrored in TASKS.md. */
  title: string;
  /** Returns true when the step was performed. */
  run: (ctx: JourneyContext) => Promise<boolean>;
}

export interface JourneyResult {
  id: string;
  area: string;
  title: string;
  pass: string;
  status: 'pass' | 'partial' | 'blocked';
  steps: Array<{ id: string; title: string; done: boolean }>;
  clicks: number;
  keystrokes: number;
  ms: number;
  deadEnds: string[];
  workarounds: string[];
  consoleErrors: string[];
  notes: string[];
}

export interface Journey {
  id: string;
  area: string;
  title: string;
  /** The pass condition, verbatim from TASKS.md. */
  pass: string;
  /** True when the journey writes to the database. */
  mutates: boolean;
  steps: JourneyStep[];
}

/** A tolerant click: tries a role/name, then a text match, then a selector. */
export async function click(
  ctx: JourneyContext,
  names: string[],
): Promise<boolean> {
  const { page } = ctx;
  for (const name of names) {
    const pattern = new RegExp(name, 'i');
    for (const candidate of [
      page.getByRole('button', { name: pattern }),
      page.getByRole('link', { name: pattern }),
      page.getByRole('tab', { name: pattern }),
      page.getByRole('menuitem', { name: pattern }),
      page.locator(`text=${name}`),
    ]) {
      const first = candidate.first();
      if (await first.count().catch(() => 0)) {
        if (await first.isVisible().catch(() => false)) {
          await first.click({ timeout: 4000 }).catch(() => {});
          ctx.countClick();
          await page.waitForTimeout(250);
          return true;
        }
      }
    }
  }
  return false;
}

/** A tolerant fill: the first visible candidate accepts the value. */
export async function fill(
  ctx: JourneyContext,
  candidates: string[],
  value: string,
): Promise<boolean> {
  const { page } = ctx;
  for (const selector of candidates) {
    const field = page.locator(selector).first();
    if (await field.count().catch(() => 0)) {
      if (await field.isVisible().catch(() => false)) {
        await field.fill(value, { timeout: 4000 }).catch(() => {});
        ctx.countKeys(value.length);
        await page.waitForTimeout(80);
        return true;
      }
    }
  }
  return false;
}

/** Navigate, tolerating a slow app. */
export async function goto(ctx: JourneyContext, route: string): Promise<boolean> {
  await ctx.page.goto(ctx.baseUrl + route, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await ctx.page.locator('main, app-dashboard').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  await ctx.page.waitForTimeout(1200);
  return true;
}

/** A step that is a no-op when writes are disabled. */
export const writeOnly =
  (reason: string) =>
  async (ctx: JourneyContext): Promise<boolean> => {
    if (process.env['FINDER_ALLOW_MUTATIONS'] === '1') return true;
    ctx.workaround('write', `skipped write: ${reason}`);
    return false;
  };
