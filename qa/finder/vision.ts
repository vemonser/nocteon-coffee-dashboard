import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from 'playwright';

export interface Crop {
  page: string;
  route: string;
  state: string;
  name: string;
  file: string;
  box: { x: number; y: number; w: number; h: number };
  text: string;
}

export interface VisionAnswer {
  question: string;
  answer: 'yes' | 'no' | 'unknown';
  reason: string;
  bbox: { x: number; y: number; w: number; h: number } | null;
}

export interface VisionIssue {
  crop: Crop;
  answers: VisionAnswer[];
  selector?: string;
}

/**
 * The crop regions F6 inspects. FULL PAGES ARE NEVER USED: a full capture of
 * a 2400px dashboard is mostly empty space and the model cannot say which
 * band broke.
 */
const REGIONS: Array<{ name: string; selector: string }> = [
  { name: 'page-title', selector: 'main h1, h1' },
  { name: 'filter-row', selector: 'main [class*="filter"], main form, main [role="search"]' },
  { name: 'table-header', selector: 'table thead' },
  { name: 'table-rows', selector: 'table tbody' },
  { name: 'dialog', selector: '[role="dialog"], [role="alertdialog"]' },
  { name: 'form-card', selector: 'main form, main [class*="card-surface"]' },
  { name: 'footer-bar', selector: 'main footer, [data-testid*="footer"], [class*="sticky"][class*="bottom"]' },
];

export const VISION_QUESTIONS = [
  'Is any content clipped or overlapping?',
  'Are the elements misaligned?',
  'Does it differ from the golden crop in size, spacing or style?',
  'Is developer text visible?',
  'Is a label confusing or missing?',
];

/** Crop only the named regions of the current state. */
export async function captureCrops(
  page: Page,
  outDir: string,
  route: string,
  state: string,
  pageId: string,
): Promise<Crop[]> {
  const crops: Crop[] = [];
  for (const region of REGIONS) {
    const el = page.locator(region.selector).first();
    if (!(await el.count().catch(() => 0))) continue;
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (!box || box.width < 40 || box.height < 20) continue;
    const dir = resolve(outDir, 'crops', pageId, state.replace(/[^a-z0-9]+/gi, '-'));
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `${region.name}.png`);
    await el.screenshot({ path: file, animations: 'disabled' }).catch(() => null);
    if (!existsSync(file)) continue;
    crops.push({
      page: pageId,
      route,
      state,
      name: region.name,
      file,
      box: { x: box.x, y: box.y, w: box.width, h: box.height },
      text: ((await el.innerText().catch(() => '')) ?? '').slice(0, 400),
    });
  }
  return crops;
}

/**
 * Ask the vision model about each crop, always beside the golden crop of the
 * same type. The model is an external command so the finder stays usable with
 * any provider; without one, vision is SKIPPED and the prompts are written
 * for a human/agent to run.
 */
export function runVision(
  crops: Crop[],
  outDir: string,
  goldenDir: string,
): { issued: number; skipped: string | null; issues: VisionIssue[] } {
  const prompts = crops.map((crop) => ({
    crop: crop.file,
    golden: resolve(goldenDir, `${crop.name}.png`),
    page: crop.page,
    route: crop.route,
    state: crop.state,
    questions: VISION_QUESTIONS,
    text: crop.text,
  }));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'vision-prompts.json'), JSON.stringify(prompts, null, 1));

  const command = process.env['FINDER_VISION_CMD'];
  if (!command) {
    return { issued: 0, skipped: 'FINDER_VISION_CMD is not set (no vision model attached)', issues: [] };
  }

  const issues: VisionIssue[] = [];
  for (const prompt of prompts) {
    if (!existsSync(prompt.golden)) continue;
    try {
      const stdout = execFileSync(command, [], {
        input: JSON.stringify(prompt),
        encoding: 'utf8',
        timeout: 60_000,
      });
      const parsed = JSON.parse(stdout) as VisionAnswer[];
      const bad = parsed.filter((a) => a.answer === 'yes');
      if (bad.length) issues.push({ crop: crops.find((c) => c.file === prompt.crop)!, answers: parsed });
    } catch {
      // One crop the model could not read must not fail the run.
    }
  }
  return { issued: issues.length, skipped: null, issues };
}

/** Map a vision bbox (page coordinates) back to the element under it. */
export async function mapBboxToElement(
  page: Page,
  box: { x: number; y: number; w: number; h: number },
): Promise<string | null> {
  return page
    .evaluate((b) => {
      const el = document.elementFromPoint(b.x + b.w / 2, b.y + b.h / 2);
      if (!el) return null;
      const testid = el.getAttribute('data-testid');
      if (testid) return `[data-testid="${testid}"]`;
      if (el.id) return `#${el.id}`;
      return el.tagName.toLowerCase();
    }, box)
    .catch(() => null);
}
