import type { Finding, StateRecord } from './types.ts';
import type { OutlierResult } from './outliers.ts';
import type { JourneyResult } from './journey-kit.ts';

export type Status = 'new' | 'known' | 'fixed';

export interface RootFinding {
  key: string;
  title: string;
  detector: string;
  id: string;
  severity: 'high' | 'medium' | 'low';
  pages: string[];
  states: string[];
  count: number;
  score: number;
  evidence: string[];
  screenshot: string;
  status: Status;
  needsHuman?: boolean;
}

export interface Baseline {
  findings: Record<string, { status: 'known' | 'fixed'; firstSeen: string; lastSeen?: string }>;
}

const WEIGHT = { high: 3, medium: 2, low: 1 } as const;

/** Rules whose per-element selectors are noise: one finding for the rule. */
const AGGREGATE_BY_ID = new Set([
  'layout.text-too-small',
  'text.title-case',
  'consistency.icon-button-no-tooltip',
  'forms.no-maxlength',
  'forms.missing-inputmode',
  'forms.missing-type',
  'forms.missing-autocomplete',
  'tables.row-height',
  'layout.contrast',
  'text.double-space',
  'actions.no-gap',
  'actions.glued-labels',
  'layout.small-touch-target',
  'tables.numeric-not-end-aligned',
  'tables.empty-column',
]);

/** Taste/product decisions: the finder reports, a human chooses. */
const NEEDS_HUMAN = new Set([
  'layout.text-too-small',
  'layout.large-gap',
  'layout.oversized-media',
  'tables.row-height',
  'text.long-month',
]);

const HUMAN_OPTIONS: Record<string, { optionA: string; optionB: string; recommendation: string }> = {
  'layout.text-too-small': {
    optionA: 'Raise every text below 12px to 12px and let the layout grow.',
    optionB: 'Keep the compact 10–11px labels where they are supporting metadata.',
    recommendation: 'A: 12px is the floor in AGENTS.md; keep compact labels at 12px and fix the spacing instead.',
  },
  'layout.large-gap': {
    optionA: 'Tighten the section spacing to the 4px grid.',
    optionB: 'Keep the airy spacing as a deliberate editorial rhythm.',
    recommendation: 'A for list pages, B for the dashboard home.',
  },
  'layout.oversized-media': {
    optionA: 'Constrain the media to 40% of the content column.',
    optionB: 'Keep the media full-width on its own row.',
    recommendation: 'B when the image is the content; A in a two-column card.',
  },
  'tables.row-height': {
    optionA: 'Fix every row to 72px as the list rule says.',
    optionB: 'Allow a taller row when a cell wraps to two lines.',
    recommendation: 'A for text-only lists; B for rows with an avatar and two lines.',
  },
  'text.long-month': {
    optionA: 'Use the shared short format (27 Oct 2026).',
    optionB: 'Keep the long month in prose contexts.',
    recommendation: 'A in tables and cards, B in narrative copy.',
  },
};

export function groupFindings(
  findings: Finding[],
  baseline: Baseline | null,
  now = new Date().toISOString(),
): { roots: RootFinding[]; fixed: string[] } {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = AGGREGATE_BY_ID.has(finding.id)
      ? `${finding.detector}/${finding.id}`
      : `${finding.detector}/${finding.id}/${finding.selector}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(finding);
  }

  const roots: RootFinding[] = [];
  for (const [key, items] of groups) {
    const first = items[0];
    const pages = [...new Set(items.map((i) => i.page))];
    const states = [...new Set(items.map((i) => i.state))].slice(0, 12);
    const evidence = [...new Set(items.map((i) => i.evidence))].slice(0, 5);
    const base = baseline?.findings?.[key];
    roots.push({
      key,
      title: first.message,
      detector: first.detector,
      id: first.id,
      severity: first.severity,
      pages,
      states,
      count: items.length,
      score: WEIGHT[first.severity] * Math.max(1, pages.length),
      evidence,
      screenshot: items.find((i) => i.screenshot)?.screenshot ?? '',
      status: base ? 'known' : 'new',
      needsHuman: NEEDS_HUMAN.has(first.id),
    });
  }

  const fixed: string[] = [];
  for (const key of Object.keys(baseline?.findings ?? {})) {
    if (!groups.has(key)) fixed.push(key);
  }

  roots.sort((a, b) => b.score - a.score || b.count - a.count);
  void now;
  return { roots, fixed };
}

function rel(path: string): string {
  return path.replace(process.cwd() + '/', '');
}

export interface ReportInput {
  roots: RootFinding[];
  fixed: string[];
  states: StateRecord[];
  outliers: OutlierResult;
  journeys: JourneyResult[];
  routeGaps: string[];
  vision: { issued: number; skipped: string | null };
  startedAt: string;
  finishedAt: string;
  fast: boolean;
  baselineExists: boolean;
}

export function renderReport(input: ReportInput): string {
  const { roots, fixed, outliers, journeys } = input;
  const counts = {
    new: roots.filter((r) => r.status === 'new').length,
    known: roots.filter((r) => r.status === 'known').length,
    high: roots.filter((r) => r.severity === 'high').length,
  };
  const top = roots.slice(0, 15);
  const lines: string[] = [];

  lines.push('# FINDINGS.md — the issue finder');
  lines.push('');
  lines.push(
    `Generated by \`npm run find${input.fast ? ' -- --fast' : ''}\` on ${input.finishedAt}. ` +
      `${input.states.length} states crawled, ${roots.length} root findings ` +
      `(${counts.new} new, ${counts.known} known, ${counts.high} high).`,
  );
  lines.push('');
  lines.push('Severity × pages is the score. A finding is one ROOT CAUSE: the same detector rule at the same selector on every page counts once.');
  lines.push('');
  if (!input.baselineExists) {
    lines.push('> `qa/baseline.json` did not exist, so every finding is **new**. Run `npm run find -- --update-baseline` to ratchet this run in.');
    lines.push('');
  }

  lines.push('## Top 15');
  lines.push('');
  lines.push('| # | Score | Sev | Finding | Pages | Status |');
  lines.push('|---|---|---|---|---|---|');
  top.forEach((r, index) => {
    lines.push(
      `| ${index + 1} | ${r.score} | ${r.severity} | ${escapeCell(r.title)} \`${r.id}\` | ${r.pages.length} (${escapeCell(r.pages.slice(0, 4).join(', '))}) | ${r.status} |`,
    );
  });
  lines.push('');

  lines.push('## Root causes');
  lines.push('');
  for (const r of roots) {
    lines.push(`### ${r.severity.toUpperCase()} — ${r.title}`);
    lines.push('');
    lines.push(`- **Rule:** \`${r.id}\` (detector \`${r.detector}\`)`);
    lines.push(`- **Status:** ${r.status}`);
    lines.push(`- **Pages (${r.pages.length}):** ${r.pages.join(', ')}`);
    if (r.states.length) lines.push(`- **States:** ${r.states.join(', ')}`);
    lines.push(`- **Occurrences:** ${r.count}`);
    for (const evidence of r.evidence) lines.push(`- **Evidence:** ${evidence}`);
    if (r.screenshot) lines.push(`- **Screenshot:** \`${rel(r.screenshot)}\``);
    lines.push('');
  }

  if (fixed.length) {
    lines.push('## Fixed');
    lines.push('');
    for (const key of fixed) lines.push(`- \`${key}\``);
    lines.push('');
  }

  lines.push('## Needs a human');
  lines.push('');
  const human = roots.filter((r) => r.needsHuman);
  if (!human.length) lines.push('None.');
  for (const r of human) {
    const options = HUMAN_OPTIONS[r.id];
    lines.push(`### ${r.title} \`${r.id}\``);
    lines.push('');
    lines.push(`Pages: ${r.pages.slice(0, 6).join(', ')}`);
    if (options) {
      lines.push('');
      lines.push(`- **A:** ${options.optionA}`);
      lines.push(`- **B:** ${options.optionB}`);
      lines.push(`- **Recommendation:** ${options.recommendation}`);
    }
    lines.push('');
  }

  lines.push('## Outlier miner (F3)');
  lines.push('');
  lines.push('The ten most frequent minority style clusters. A cluster is a style variant used by fewer than 15% of the role\'s instances.');
  lines.push('');
  lines.push('| Role | Minority style | Pages | Dominant style |');
  lines.push('|---|---|---|---|');
  for (const c of outliers.top) {
    lines.push(
      `| ${c.role} | ${escapeCell(c.signature)} (${c.minority}/${c.total}, ${c.share}%) | ${escapeCell(c.pages.slice(0, 4).join(', '))} | ${escapeCell(c.dominant)} |`,
    );
  }
  lines.push('');
  if (outliers.offScale.length) {
    lines.push('### Off-scale values');
    lines.push('');
    lines.push('| Kind | Role | Value | Count | Pages |');
    lines.push('|---|---|---|---|---|');
    for (const o of outliers.offScale.slice(0, 25)) {
      lines.push(`| ${o.kind} | ${o.role} | ${escapeCell(o.value)} | ${o.count} | ${escapeCell(o.pages.slice(0, 4).join(', '))} |`);
    }
    lines.push('');
  }

  lines.push('## Journeys (F5)');
  lines.push('');
  lines.push('| Journey | Area | Status | Clicks | Keystrokes | Time | Workarounds |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const j of journeys) {
    lines.push(
      `| ${j.title} | ${j.area} | ${j.status} | ${j.clicks} | ${j.keystrokes} | ${Math.round(j.ms / 1000)}s | ${j.workarounds.length} |`,
    );
  }
  lines.push('');
  for (const j of journeys) {
    const missing = j.steps.filter((s) => !s.done);
    const friction: string[] = [];
    if (j.clicks > 6) friction.push(`more than 6 clicks (${j.clicks})`);
    if (missing.length) friction.push(`${missing.length} step(s) not reached: ${missing.map((s) => s.title).join('; ')}`);
    if (j.deadEnds.length) friction.push(`dead ends: ${j.deadEnds.join(', ')}`);
    if (j.consoleErrors.length) friction.push(`console errors: ${j.consoleErrors.length}`);
    lines.push(`- **${j.title}** — pass: ${j.pass}`);
    if (friction.length) lines.push(`  - Friction: ${friction.join('; ')}`);
    for (const w of j.workarounds) lines.push(`  - Workaround: ${w}`);
    for (const n of j.notes) lines.push(`  - Note: ${n}`);
  }
  lines.push('');
  lines.push(`Tasks and pass conditions: [TASKS.md](qa/finder/TASKS.md).`);

  lines.push('');
  lines.push('## Vision (F6)');
  lines.push('');
  lines.push(
    input.vision.skipped
      ? `Skipped: ${input.vision.skipped}. Clicks and crops were still saved; run with \`FINDER_VISION_CMD\` to attach a model.`
      : `${input.vision.issued} vision finding(s).`,
  );
  lines.push('');

  lines.push('## Route coverage');
  lines.push('');
  lines.push(`Crawled ${input.states.length} states in ${Math.round((Date.parse(input.finishedAt) - Date.parse(input.startedAt)) / 1000)}s.`);
  if (input.routeGaps.length) {
    lines.push('');
    lines.push(`**Router segments the curated route list does not name:** ${input.routeGaps.join(', ')}.`);
  }
  lines.push('');
  lines.push('## How this was produced');
  lines.push('');
  lines.push('- Crawler: `qa/finder/crawler.ts` (routes from the router list + the live sidebar; default, tabs, disclosures, overlays, rows, and mocked empty/loading/error states; light/dark × en/ar × 1440 + 390).');
  lines.push('- Detectors: `qa/finder/detectors/*.ts` (one unit test per group).');
  lines.push('- Outliers: `qa/finder/outliers.ts`. Oracles: `qa/finder/invariants.ts`. Journeys: `qa/finder/journeys.ts`.');
  lines.push('- Triage: `qa/finder/triage.ts` (same detector + selector across pages = one root cause).');
  lines.push('');
  return lines.join('\n');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 160);
}
