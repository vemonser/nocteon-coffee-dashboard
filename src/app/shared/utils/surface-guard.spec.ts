import { describe, expect, it } from 'vitest';

/**
 * ONE card shape, enforced.
 *
 * The dashboard was rebuilt to one card anatomy (icon → label → value →
 * curve) and one surface: a 16px radius, a hairline ring, 24px of padding.
 * The next commit can undo that in a single line — `class="rounded-xl border
 * bg-card p-4"` is the shape everyone reaches for — so the rule lives here
 * instead of in a review checklist.
 *
 * Everything card-like must go through a surface class:
 *
 *   .card-surface    a panel that is not an <hlm-card>
 *   .dialog-surface  a modal (the card's radius, stronger elevation)
 *   .menu-surface    a dropdown attached to a control
 *
 * And a card's own padding comes from --card-pad: a content or header
 * override re-introduces the doubled padding this test exists to prevent.
 */

const templates = import.meta.glob('/src/app/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface ClassAttr {
  file: string;
  line: number;
  cls: string;
}

/** Every class attribute in every template, with its line number. */
function classAttributes(): ClassAttr[] {
  const out: ClassAttr[] = [];
  for (const [file, text] of Object.entries(templates)) {
    const re = /class="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      out.push({ file, line: text.slice(0, m.index).split('\n').length, cls: m[1] });
    }
  }
  return out;
}

const SURFACE = /\b(card-surface|dialog-surface|menu-surface)\b/;
const BG_CARD = /(?:^|\s)bg-card(?:\s|$)/;

describe('one card shape', () => {
  it('no template paints a card surface by hand', () => {
    const offenders: string[] = [];
    for (const { file, line, cls } of classAttributes()) {
      if (SURFACE.test(cls) || !BG_CARD.test(cls)) continue;
      // A large radius without a surface class is a hand-painted card: it will
      // have a different edge and a different elevation from every real card.
      if (/\brounded-(?:xl|2xl)\b/.test(cls)) {
        offenders.push(`${file}:${line}: ${cls}`);
      }
      // A padded panel is a card too, even at the small radius.
      if (/\brounded-(?:md|lg)\b/.test(cls) && /\bp-[456]\b/.test(cls)) {
        offenders.push(`${file}:${line}: ${cls}`);
      }
    }
    expect(
      offenders,
      `card surface painted by hand — use .card-surface / .dialog-surface:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no dialog carries its own elevation', () => {
    const offenders: string[] = [];
    for (const { file, line, cls } of classAttributes()) {
      if (/shadow-2xl/.test(cls) && !SURFACE.test(cls)) {
        offenders.push(`${file}:${line}: ${cls}`);
      }
    }
    expect(
      offenders,
      `dialog elevation by hand — .dialog-surface owns it:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('card content does not override the card padding', () => {
    const offenders: string[] = [];
    const re = /hlmCardContent[^>]*class="([^"]*)"/g;
    for (const [file, text] of Object.entries(templates)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        // --card-pad / --card-pad-sm are the only vertical padding a card
        // body may have: a `p-6` here stacks on top of the card's own py and
        // doubles the distance to the edge.
        if (/(?:^|\s)(?:p|px|py|pt|pb|ps|pe)-[0-9]/.test(m[1])) {
          const line = text.slice(0, m.index).split('\n').length;
          offenders.push(`${file}:${line}: ${m[1]}`);
        }
      }
    }
    expect(
      offenders,
      `card content overrides --card-pad (double padding):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('card headers do not override the header padding', () => {
    const offenders: string[] = [];
    const re = /hlmCardHeader[^>]*class="([^"]*)"/g;
    for (const [file, text] of Object.entries(templates)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (/(?:^|\s)(?:p|px|py|pt|pb|ps|pe)-[0-9]/.test(m[1])) {
          const line = text.slice(0, m.index).split('\n').length;
          offenders.push(`${file}:${line}: ${m[1]}`);
        }
      }
    }
    expect(
      offenders,
      `card header overrides --card-pad:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * ONE date shape, enforced.
 *
 * `<app-data-table>` renders a cell by column id, not by value type: an id it
 * does not recognise falls through to the raw renderer and the ISO string
 * (`2026-10-22T20:27:48.958605Z`) lands in the table. That is how the carts
 * page shipped a machine timestamp where every other date read "22 Oct 2026".
 *
 * So: every column whose accessor reads a date must have a `@case` for its id.
 */

const sources = import.meta.glob('/src/app/features/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const DATA_TABLE = '/src/app/shared/components/data-table/data-table.component.html';

/** The column ids the shared table knows how to draw as a date. */
function dateCases(): Set<string> {
  const html = templates[DATA_TABLE] ?? '';
  return new Set([...html.matchAll(/@case \('([^']+)'\)/g)].map((m) => m[1]));
}

/** The `{ ... }` options object that follows `columnHelper.accessor(`. */
function optionsAt(text: string, from: number): string {
  const open = text.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return text.slice(open);
}

/** `createdAt`, `lastActivityAt`, `expiresOn`, … — a value that is a time. */
const DATE_VALUE = /\b[A-Za-z]+At\b|\bDate\b|\bvalidUntil\b|\bexpires?\w*/;

describe('date columns render as dates', () => {
  it('every date-valued column id has a data-table case', () => {
    const known = dateCases();
    const offenders: string[] = [];

    for (const [file, text] of Object.entries(sources)) {
      const re = /columnHelper\.accessor\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const options = optionsAt(text, m.index + m[0].length);
        // The accessor argument is everything before the options object.
        const arg = text.slice(m.index + m[0].length, text.indexOf(options));
        if (!DATE_VALUE.test(arg)) continue;

        // No explicit id means TanStack uses the accessor key itself.
        const id = options.match(/\bid:\s*'([^']+)'/)?.[1] ?? arg.match(/^\s*'([^']+)'/)?.[1];
        if (!id || known.has(id)) continue;

        const line = text.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line}: column '${id}' has no @case in data-table.component.html`);
      }
    }

    expect(
      offenders,
      `date column painted by the raw renderer (ISO string leaks):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
