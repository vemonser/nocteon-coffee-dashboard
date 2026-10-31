import { beforeEach, describe, expect, it } from 'vitest';
import type { DetectorContext, Issue } from '../detectors/types.ts';
import { setCssResolver } from '../detectors/util.ts';
import { detectCamelLabels, detectI18n } from '../detectors/i18n.ts';
import {
  detectDateText,
  detectGluedScripts,
  detectTitleCase,
  detectWordHygiene,
} from '../detectors/text.ts';
import {
  detectButtonSpacing,
  detectDuplicateActions,
  detectMultiplePrimary,
  detectStepAndFooterDuplicates,
} from '../detectors/actions.ts';
import {
  detectEmptyColumns,
  detectMisalignedHeaders,
  detectNumericAlignment,
  detectRowHeights,
  detectTruncationWithoutTooltip,
} from '../detectors/tables.ts';
import {
  detectCappedBadges,
  detectChipSums,
  detectPaginationRange,
  detectTotalCounts,
} from '../detectors/counts.ts';
import {
  detectEnabledSave,
  detectInputAttributes,
  detectPlaceholderTypos,
  detectPristineErrors,
  detectRequiredMarkers,
  detectTwoSaves,
} from '../detectors/forms.ts';
import { detectIndicatorOutside } from '../detectors/indicators.ts';
import { detectOverlays } from '../detectors/overlays.ts';
import {
  detectCreateSaveChanges,
  detectFooterOrder,
  detectNativeDialogs,
  detectUnnamedIconButtons,
  detectVisibleDestructiveIcons,
} from '../detectors/consistency.ts';
import {
  detectLargeGaps,
  detectOrphanGridCells,
  detectSmallTargets,
  detectTextSizeAndContrast,
} from '../detectors/layout.ts';
import { detectFutureDates, detectMixedDateFormats, detectTestRecords } from '../detectors/hygiene.ts';

/**
 * Every test mounts a deliberately broken fixture. The fixture carries
 * `data-finder-box="x,y,w,h"` on layout-sensitive elements, so `rectOf` is
 * deterministic in jsdom (no real layout engine).
 */

function ctx(overrides: Partial<DetectorContext> = {}): DetectorContext {
  return {
    route: '/fixture',
    state: 'default',
    lang: 'en',
    theme: 'light',
    viewport: { w: 1440, h: 900 },
    testPrefixes: ['Auditcov', 'QA ', 'e2e-'],
    nativeDialogs: [],
    mocked: null,
    ...overrides,
  };
}

function mount(html: string): void {
  document.body.innerHTML = html;
  // jsdom always reports 0 for scroll metrics; the truncation detector uses
  // them, so fixtures opt in with a data attribute.
  for (const el of Array.from(document.querySelectorAll('[data-finder-scroll]'))) {
    const [scroll, client] = (el.getAttribute('data-finder-scroll') ?? '0,0').split(',').map(Number);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scroll });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: client });
  }
}

function ids(issues: Issue[]): string[] {
  return issues.map((issue) => issue.id);
}

function expectId(issues: Issue[], id: string): void {
  expect(ids(issues), `expected ${id} in ${JSON.stringify(ids(issues))}`).toContain(id);
}

beforeEach(() => {
  // jsdom's getComputedStyle crashes on some rules; the fixtures use their
  // own inline styles as the computed style, which is deterministic.
  setCssResolver((el) => (el as HTMLElement).style);
  document.body.innerHTML = '';
  document.documentElement.setAttribute('lang', 'en');
});

describe('i18n detectors', () => {
  it('reports a raw key, an unresolved placeholder and a missing value', () => {
    mount(`
      <p>orders.statuses.DELIVERED</p>
      <p>Hello {name}</p>
      <p>Total: undefined</p>
    `);
    const issues = detectI18n(document, ctx());
    expectId(issues, 'i18n.raw-key');
    expectId(issues, 'i18n.unresolved-placeholder');
    expectId(issues, 'i18n.invalid-value');
  });

  it('reports developer text and a camelCase route label in a breadcrumb', () => {
    mount(`
      <p>Needs backend for this card</p>
      <app-breadcrumb><a href="/x">newProduct</a></app-breadcrumb>
    `);
    expectId(detectI18n(document, ctx()), 'i18n.developer-text');
    expectId(detectCamelLabels(document, ctx()), 'i18n.camel-label');
  });
});

describe('text detectors', () => {
  it('reports Arabic and Latin letters glued inside one word', () => {
    mount('<p data-finder-box="0,0,100,20">قهوةEthiopia</p>');
    expectId(detectGluedScripts(document, ctx()), 'text.glued-scripts');
  });

  it('reports Title Case labels but not sentence case or proper nouns', () => {
    mount(`
      <button data-finder-box="0,0,120,32">Save Changes Now</button>
      <button data-finder-box="0,40,120,32">Save changes</button>
      <button data-finder-box="0,80,120,32">Nocteon Coffee</button>
    `);
    const issues = detectTitleCase(document, ctx());
    expect(issues.length).toBe(1);
    expect(issues[0].evidence).toContain('Save Changes Now');
  });

  it('reports a long month, a space before the comma, double spaces, wrong unit case and a plural after 1', () => {
    mount(`
      <p data-finder-box="0,0,200,20">October 12, 2026</p>
      <p data-finder-box="0,20,200,20">12 Oct , 2026</p>
      <p data-finder-box="0,40,200,20">Two  spaces</p>
      <p data-finder-box="0,60,200,20">10 mB</p>
      <p data-finder-box="0,80,200,20">1 files</p>
    `);
    const dates = detectDateText(document, ctx());
    expectId(dates, 'text.long-month');
    expectId(dates, 'text.space-before-comma');
    const words = detectWordHygiene(document, ctx());
    expectId(words, 'text.double-space');
    expectId(words, 'text.unit-case');
    expectId(words, 'text.plural-one');
  });
});

describe('action detectors', () => {
  it('reports adjacent buttons with no gap and concatenated labels', () => {
    mount(`
      <div>
        <button data-finder-box="0,0,80,32">Back</button><button data-finder-box="80,0,100,32">Save changes</button>
      </div>
    `);
    const issues = detectButtonSpacing(document, ctx());
    expectId(issues, 'actions.no-gap');
    expectId(issues, 'actions.glued-labels');
  });

  it('reports a duplicated Save and two primary buttons in a dialog footer', () => {
    mount(`
      <div role="dialog" aria-label="Edit" data-finder-box="0,0,400,300">
        <footer>
          <button data-finder-box="0,260,80,32">Save</button>
          <button data-finder-box="90,260,80,32">Save</button>
          <button data-finder-box="180,260,100,32" class="bg-primary" data-finder-box="180,260,100,32">Save</button>
          <button data-finder-box="290,260,100,32" class="bg-primary">Save</button>
        </footer>
      </div>
    `);
    const issues = [...detectDuplicateActions(document, ctx()), ...detectMultiplePrimary(document, ctx())];
    expectId(issues, 'actions.duplicate-label');
    expectId(issues, 'actions.multiple-primary');
  });

  it('reports the same actions inside a step and in the footer', () => {
    mount(`
      <div role="dialog" aria-label="Wizard" data-finder-box="0,0,400,400">
        <div role="tabpanel" data-finder-box="0,0,400,300">
          <button data-finder-box="0,0,80,32">Save</button>
        </div>
        <footer data-finder-box="0,340,400,60">
          <button data-finder-box="0,350,80,32">Save</button>
        </footer>
      </div>
    `);
    expectId(detectStepAndFooterDuplicates(document, ctx()), 'actions.step-and-footer');
  });
});

describe('table detectors', () => {
  const table = `
    <table>
      <thead><tr>
        <th data-finder-box="0,0,100,30">Name</th>
        <th data-finder-box="100,0,100,30">Price</th>
        <th data-finder-box="200,0,100,30">Stock</th>
      </tr></thead>
      <tbody>
        <tr data-finder-box="0,30,300,40">
          <td data-finder-box="0,30,100,40">Coffee</td>
          <td data-finder-box="100,30,100,40">10.00</td>
          <td data-finder-box="200,50,100,40"></td>
        </tr>
        <tr data-finder-box="0,70,300,60">
          <td data-finder-box="0,70,100,60">Tea</td>
          <td data-finder-box="100,70,100,60">20.00</td>
          <td data-finder-box="200,90,100,60"></td>
        </tr>
      </tbody>
    </table>`;

  it('reports an all-empty column, unaligned numbers and unequal row heights', () => {
    mount(table);
    expectId(detectEmptyColumns(document, ctx()), 'tables.empty-column');
    expectId(detectNumericAlignment(document, ctx()), 'tables.numeric-not-end-aligned');
    expectId(detectRowHeights(document, ctx()), 'tables.row-height');
  });

  it('reports a header that does not sit over its column', () => {
    mount(`
      <table>
        <thead><tr><th data-finder-box="0,0,80,30">Name</th><th data-finder-box="120,0,80,30">Price</th></tr></thead>
        <tbody><tr><td data-finder-box="0,30,100,40">Coffee</td><td data-finder-box="120,30,80,40">10.00</td></tr></tbody>
      </table>
    `);
    expectId(detectMisalignedHeaders(document, ctx()), 'tables.header-misaligned');
  });

  it('reports a truncated value with no tooltip', () => {
    mount('<span class="truncate" style="overflow:hidden" data-finder-box="0,0,80,20" data-finder-scroll="200,80">A very long product name</span>');
    expectId(detectTruncationWithoutTooltip(document, ctx()), 'tables.truncated-no-tooltip');
  });
});

describe('count detectors', () => {
  it('reports chips that do not add up to All and a wrong cap', () => {
    mount(`
      <div role="tablist">
        <button role="tab" aria-selected="true">All 10</button>
        <button role="tab">Active 4</button>
        <button role="tab">Blocked 3</button>
      </div>
      <div role="tablist">
        <button role="tab" aria-selected="true">All 9+</button>
      </div>
      <main><table><tbody><tr><td>a</td></tr></tbody></table></main>
    `);
    expectId(detectChipSums(document, ctx()), 'counts.chip-sum');
    expectId(detectCappedBadges(document, ctx()), 'counts.capped-badge');
  });

  it('reports an impossible pagination range', () => {
    mount('<p data-finder-box="0,0,200,20">12 - 3 of 10</p>');
    expectId(detectPaginationRange(document, ctx()), 'counts.pagination-range');
  });
});

describe('form detectors', () => {
  it('reports an error shown on a pristine form and an unmarked required field', () => {
    mount(`
      <form>
        <label for="name">Name</label>
        <input id="name" required data-finder-box="0,20,200,32" />
        <p role="alert" data-finder-box="0,60,200,20">This field is required</p>
      </form>
    `);
    const issues = [...detectPristineErrors(document, ctx()), ...detectRequiredMarkers(document, ctx())];
    expectId(issues, 'forms.pristine-error');
    expectId(issues, 'forms.required-no-marker');
  });

  it('reports Save enabled while pristine and two Save buttons', () => {
    mount(`
      <form>
        <input name="title" data-finder-box="0,0,200,32" />
        <button data-finder-box="0,40,80,32">Save</button>
        <button data-finder-box="90,40,80,32">Save</button>
      </form>
    `);
    const issues = [...detectEnabledSave(document, ctx()), ...detectTwoSaves(document, ctx())];
    expectId(issues, 'forms.save-enabled-pristine');
    expectId(issues, 'forms.two-save-buttons');
  });

  it('reports a misspelled placeholder and a missing autocomplete hint', () => {
    mount(`
      <form>
        <input type="email" placeholder="E-mail adress" data-finder-box="0,0,200,32" />
      </form>
    `);
    const issues = [...detectPlaceholderTypos(document, ctx()), ...detectInputAttributes(document, ctx())];
    expectId(issues, 'forms.placeholder-typo');
    expectId(issues, 'forms.missing-autocomplete');
  });
});

describe('indicator detector', () => {
  it('reports a dot drawn outside its container', () => {
    mount(`
      <div data-finder-box="10,10,50,50">
        <span class="dot" data-finder-box="70,70,6,6"></span>
      </div>
    `);
    expectId(detectIndicatorOutside(document, ctx()), 'indicators.outside-container');
  });
});

describe('overlay detector', () => {
  it('reports an overlay off-screen, over its trigger, and a nameless dialog', () => {
    mount(`
      <div role="dialog" data-finder-box="1400,850,300,200"></div>
      <div role="menu" data-finder-box="0,0,200,100">Menu</div>
    `);
    const issues = detectOverlays(document, ctx({ trigger: { selector: 'button', box: { x: 10, y: 10, w: 100, h: 32 } } }));
    expectId(issues, 'overlays.outside-viewport');
    expectId(issues, 'overlays.overlaps-trigger');
    expectId(issues, 'overlays.dialog-no-name');
  });
});

describe('consistency detectors', () => {
  it('reports a visible trash icon and an unnamed icon button', () => {
    mount(`
      <table><tbody><tr>
        <td><button class="text-destructive" aria-label="Delete product" data-finder-box="0,0,32,32"><svg></svg></button></td>
        <td><button data-finder-box="40,0,32,32"><svg></svg></button></td>
      </tr></tbody></table>
    `);
    const issues = [...detectVisibleDestructiveIcons(document, ctx()), ...detectUnnamedIconButtons(document, ctx())];
    expectId(issues, 'consistency.visible-destructive');
    expectId(issues, 'consistency.icon-button-no-name');
  });

  it('reports a create dialog that says Save changes and a wrong footer order', () => {
    mount(`
      <div role="dialog" aria-label="New product" data-finder-box="0,0,400,300">
        <footer>
          <button data-finder-box="0,260,80,32" class="bg-primary">Save changes</button>
          <button data-finder-box="90,260,80,32" class="text-destructive">Delete</button>
        </footer>
      </div>
    `);
    const issues = [...detectCreateSaveChanges(document, ctx()), ...detectFooterOrder(document, ctx())];
    expectId(issues, 'consistency.create-save-changes');
    expectId(issues, 'consistency.footer-order');
  });

  it('reports a native dialog recorded by the init script', () => {
    const issues = detectNativeDialogs(document, ctx({ nativeDialogs: [{ kind: 'confirm', message: 'Delete?' }] }));
    expectId(issues, 'consistency.native-dialog');
  });
});

describe('layout detectors', () => {
  it('reports text below 12px and low contrast', () => {
    mount(`
      <p data-finder-box="0,0,200,20" style="font-size:10px;color:#999999;background-color:#ffffff">tiny</p>
      <p data-finder-box="0,30,200,20" style="font-size:14px;color:#eeeeee;background-color:#ffffff">faint</p>
    `);
    const issues = detectTextSizeAndContrast(document, ctx());
    expectId(issues, 'layout.text-too-small');
    expectId(issues, 'layout.contrast');
  });

  it('reports an orphan grid cell and a 120px gap', () => {
    mount(`
      <div data-finder-box="0,0,200,60" style="display:grid;grid-template-columns:100px 100px">
        <span data-finder-box="0,0,100,20">a</span>
        <span data-finder-box="100,0,100,20">b</span>
        <span data-finder-box="0,20,100,20">c</span>
      </div>
      <main><section data-finder-box="0,200,100,220">
        <div data-finder-box="0,200,100,40">one</div>
        <div data-finder-box="0,380,100,40">two</div>
      </section></main>
    `);
    const issues = [...detectOrphanGridCells(document, ctx()), ...detectLargeGaps(document, ctx())];
    expectId(issues, 'layout.orphan-grid-cell');
    expectId(issues, 'layout.large-gap');
  });

  it('reports a touch target under 32px on a phone viewport', () => {
    mount('<button data-finder-box="0,0,24,24">x</button>');
    expectId(detectSmallTargets(document, ctx({ viewport: { w: 390, h: 844 } })), 'layout.small-touch-target');
  });
});

describe('data hygiene detectors', () => {
  it('reports a QA-prefixed record and a future date', () => {
    mount(`
      <p data-finder-box="0,0,200,20">Auditcov product</p>
      <p data-finder-box="0,20,200,20">27 Oct 2099</p>
    `);
    const issues = [...detectTestRecords(document, ctx()), ...detectFutureDates(document, ctx())];
    expectId(issues, 'hygiene.test-record');
    expectId(issues, 'hygiene.future-date');
  });

  it('reports two date formats on one page', () => {
    mount(`
      <p data-finder-box="0,0,200,20">27 Oct 2026</p>
      <p data-finder-box="0,20,200,20">October 28, 2026</p>
      <p data-finder-box="0,40,200,20">2026-10-29</p>
    `);
    expectId(detectMixedDateFormats(document, ctx()), 'hygiene.mixed-date-formats');
  });
});
