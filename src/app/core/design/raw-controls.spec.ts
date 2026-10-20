import { describe, expect, it } from 'vitest';

/**
 * Phase 0.4 — control-scale guard (ratchet).
 *
 * A raw `<input>`, `<select>` or `<button>` in an app template opts out of the
 * helm components and therefore out of the control scale (40px default /
 * 32px compact, 8px radius, 14px/20px text) — see src/styles/themes/tokens.css.
 *
 * There is no ESLint in this repo, so the guard is a unit test. ~43 templates
 * still hold raw controls (the Phase 5 migration backlog); the committed
 * baseline freezes that set. This test FAILS when a raw control is ADDED, and
 * stays green while the migration removes them.
 *
 * TEMPORARY ALLOWANCE: `<input class="table-check">` is exempt from the count.
 * It is the app's canonical table checkbox, shared by the DataTable and the
 * Columns menu — one definition, no drift (src/styles/index.css). The agreed
 * plan is to standardize on `hlm-checkbox` and migrate the DataTable in Phase 5,
 * then delete `.table-check` itself. Until then the guard reports it instead of
 * failing, so the debt stays visible. When Phase 5 lands, delete the allowance
 * branch here, the file list test below, and the CSS.
 *
 * Regenerate the baseline after migrating a control:
 *     node scripts/raw-control-scan.mjs --write
 */

const templates = import.meta.glob('/src/app/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const baselineModules = import.meta.glob('/src/app/**/raw-controls.baseline.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

const BASELINE_PATH = '/src/app/core/design/raw-controls.baseline.json';
const baseline = (baselineModules[BASELINE_PATH] ?? {}) as Record<
  string,
  { input?: number; select?: number; button?: number }
>;

type Kinds = 'input' | 'select' | 'button';
const HELM_ATTR: Record<Kinds, string | null> = {
  input: 'hlmInput',
  select: null, // there is no raw-<select> directive; use <hlm-native-select>
  button: 'hlmBtn',
};

/**
 * Counts native controls that lack their helm directive.
 * Mirrors scripts/raw-control-scan.mjs (which regenerates the baseline) — keep
 * the two in step. Quoted attribute values are skipped so `(click)="a > b"`
 * does not truncate the tag.
 */
export function scanRawControls(source: string): Record<Kinds | 'tableCheck', number> {
  const counts: Record<Kinds | 'tableCheck', number> = {
    input: 0,
    select: 0,
    button: 0,
    tableCheck: 0,
  };
  // Comments are prose, not markup. Without this, documenting why a control was
  // migrated (`<!-- was a native <select> -->`) reads as a brand new violation.
  const markup = source.replace(/<!--[\s\S]*?-->/g, '');
  const open = /<(input|select|button)(?=[\s/>])/g;
  let match: RegExpExecArray | null;
  while ((match = open.exec(markup)) !== null) {
    const kind = match[1] as Kinds;
    let i = match.index + match[0].length;
    let quote: string | null = null;
    while (i < markup.length) {
      const ch = markup[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      i++;
    }
    const tag = markup.slice(match.index, i + 1);
    // A hidden field is form plumbing, not a visible control.
    if (kind === 'input' && /\stype\s*=\s*["']hidden["']/.test(tag)) continue;
    // TEMPORARY — see the header note. Reported, not counted, so Phase 5 stays
    // visible without blocking the current pass.
    if (kind === 'input' && /\sclass\s*=\s*["'][^"']*\btable-check\b/.test(tag)) {
      counts.tableCheck++;
      continue;
    }
    const attr = HELM_ATTR[kind];
    if (attr === null || !new RegExp(`\\s${attr}(?=[\\s/>=]|$)`).test(tag)) counts[kind]++;
  }
  return counts;
}

const KINDS: Kinds[] = ['input', 'select', 'button'];

const violations: Record<string, Record<Kinds, number>> = {};
const tableChecks: Record<string, number> = {};
for (const [absolute, source] of Object.entries(templates)) {
  const scanned = scanRawControls(source);
  const counts: Record<Kinds, number> = {
    input: scanned.input,
    select: scanned.select,
    button: scanned.button,
  };
  if (KINDS.some((k) => counts[k] > 0)) violations[absolute.replace(/^\//, '')] = counts;
  if (scanned.tableCheck > 0) tableChecks[absolute.replace(/^\//, '')] = scanned.tableCheck;
}

describe('control scale: raw controls in app templates (Phase 0.4 ratchet)', () => {
  it('the baseline is present and non-empty (a guard that loads nothing guards nothing)', () => {
    expect(Object.keys(baseline).filter((k) => !k.startsWith('_')).length).toBeGreaterThan(0);
  });

  it('no new raw <input>/<select>/<button> bypasses the helm controls', () => {
    const added: string[] = [];
    for (const [file, counts] of Object.entries(violations)) {
      const allowed = baseline[file] ?? { input: 0, select: 0, button: 0 };
      for (const kind of KINDS) {
        const extra = counts[kind] - (allowed[kind] ?? 0);
        if (extra > 0) {
          added.push(`${file}: +${extra} raw <${kind}> (baseline ${allowed[kind] ?? 0}, now ${counts[kind]})`);
        }
      }
    }
    expect(
      added,
      added.length
        ? `Use hlmInput / hlmSelect / hlmBtn (or <hlm-native-select>) so the control keeps the shared scale.\n` +
            `If the raw control is deliberate, regenerate the baseline:\n` +
            `    node scripts/raw-control-scan.mjs --write\n\n${added.join('\n')}`
        : '',
    ).toEqual([]);
  });

  it('the baseline has no entry for a file that no longer holds raw controls', () => {
    const obsolete = Object.keys(baseline)
      .filter((k) => !k.startsWith('_'))
      .filter((file) => !violations[file])
      .map((file) => `${file} (migrated — drop it: node scripts/raw-control-scan.mjs --write)`);
    expect(obsolete).toEqual([]);
  });

  it('reports the outstanding migration backlog', () => {
    const totals = KINDS.map((kind) => {
      const n = Object.values(violations).reduce((sum, c) => sum + c[kind], 0);
      return `${n} <${kind}>`;
    }).join(', ');
    console.log(`[control-scale] ${Object.keys(violations).length} templates still hold raw controls: ${totals}`);
    expect(Object.keys(violations).length).toBeGreaterThan(0);
  });

  it('`.table-check` is a TEMPORARY allowance — remove it in Phase 5', () => {
    const files = Object.keys(tableChecks).sort();
    const n = Object.values(tableChecks).reduce((sum, c) => sum + c, 0);
    if (n > 0) {
      console.log(
        `[control-scale] TEMPORARY: ${n} raw <input class="table-check"> in ${files.length} file(s) — ` +
          `${files.join(', ')}. Phase 5 migrates the DataTable to hlm-checkbox; then delete ` +
          `<input class="table-check">, src/styles/index.css .table-check, and this allowance.`,
      );
    }
    // Fails once the last one is gone, which is the reminder to delete the
    // allowance and the CSS rather than leaving a dead exemption behind.
    expect(
      n,
      n === 0
        ? 'No `.table-check` inputs remain: delete the allowance branch in scanRawControls() and this test, then regenerate the baseline.'
        : '',
    ).toBeGreaterThan(0);
  });
});
