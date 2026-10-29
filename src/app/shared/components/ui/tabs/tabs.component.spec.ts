import { describe, expect, it, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injectable } from '@angular/core';
import { provideTransloco, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';

import { TabsComponent } from './tabs.component';

/**
 * FE-25a — the scrollable range strip announces that it scrolls.
 *
 * The group keeps ONE tab stop and the arrow keys move the selection; what
 * was missing is the affordance for the content past the edge: a fade and a
 * real button with an accessible name. A keyboard reader could always reach
 * every option with the arrows, but nothing told them an option existed.
 */

const DICT: Record<string, string> = {
  'common.showMoreOptions': 'Show more options',
};

/** An empty dictionary: the wording comes from `DICT`, not the network. */
@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const RANGES = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: '365', label: 'Last 365 days' },
];

describe('TabsComponent scroll affordance', () => {
  let fixture: ComponentFixture<TabsComponent>;
  let element: HTMLElement;

  const render = async (scrollable: boolean): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [TabsComponent],
      providers: [
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();

    TestBed.inject(TranslocoService).setTranslation(DICT, 'en');

    fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('items', RANGES);
    fixture.componentRef.setInput('active', '30');
    fixture.componentRef.setInput('role', 'radio');
    fixture.componentRef.setInput('label', 'Range');
    fixture.componentRef.setInput('scrollable', scrollable);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  };

  /** Give the scroller a real geometry — jsdom has no layout. */
  const geometry = (clientWidth: number, scrollWidth: number, scrollLeft = 0): void => {
    const scroller = element.querySelector('[data-testid="tabs-scroll"]') as HTMLElement;
    Object.defineProperty(scroller, 'clientWidth', { value: clientWidth, configurable: true });
    Object.defineProperty(scroller, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(scroller, 'scrollLeft', { value: scrollLeft, configurable: true });
    fixture.componentInstance.measure();
    fixture.detectChanges();
  };

  const nextButton = (): HTMLButtonElement | null =>
    element.querySelector('[data-testid="tabs-scroll-next"]');

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders no affordance when every range fits', async () => {
    await render(true);
    geometry(600, 600);

    expect(nextButton()).toBeNull();
    expect(element.querySelector('.tabs-fade')).toBeNull();
  });

  it('renders a named, keyboard-reachable button when ranges are past the edge', async () => {
    await render(true);
    geometry(240, 600);

    const button = nextButton();
    expect(button).not.toBeNull();
    // Announced: an icon-only control carries its name, and a tooltip too.
    expect(button!.getAttribute('aria-label')).toBe('Show more options');
    expect(button!.getAttribute('title')).toBe('Show more options');
    // Reachable: it is a real <button> in the DOM after the group, so Tab
    // reaches it (no tabindex="-1", no aria-hidden).
    expect(button!.getAttribute('tabindex')).toBeNull();
    expect(button!.closest('[aria-hidden="true"]')).toBeNull();

    // Visual cue for the mouse reader as well.
    expect(element.querySelector('.tabs-fade')).not.toBeNull();
  });

  it('scrolls the group forward by one screenful and hides itself at the end', async () => {
    await render(true);
    geometry(240, 600, 0);

    const scroller = element.querySelector('[data-testid="tabs-scroll"]') as HTMLElement;
    let requested: ScrollToOptions | null = null;
    scroller.scrollBy = ((options?: ScrollToOptions | number, y?: number) => {
      requested =
        typeof options === 'number' ? { left: options, top: y ?? 0 } : (options ?? null);
    }) as typeof scroller.scrollBy;

    nextButton()!.click();
    expect(requested).not.toBeNull();
    expect(requested!.left).toBeGreaterThan(0);

    // At the end there is nothing more to reveal.
    geometry(240, 600, 360);
    expect(nextButton()).toBeNull();
  });

  it('keeps ONE tab stop in the group, whatever the overflow', async () => {
    await render(true);
    geometry(240, 600);

    const items = [...element.querySelectorAll('[data-tab-id]')];
    expect(items).toHaveLength(RANGES.length);
    expect(items.filter((item) => item.getAttribute('tabindex') === '0')).toHaveLength(1);
    // The one stop is the ACTIVE tab, not merely the first one.
    expect(
      items
        .filter((item) => item.getAttribute('tabindex') === '0')
        .map((item) => item.getAttribute('data-tab-id')),
    ).toEqual(['30']);

    // A second change-detection pass must not reopen the group: this is the
    // regression that made all four tabs tabbable (the button directive owns
    // [attr.tabindex] and removes it on every value change).
    fixture.detectChanges();
    expect(
      [...element.querySelectorAll('[data-tab-id]')].filter(
        (item) => item.getAttribute('tabindex') === '0',
      ),
    ).toHaveLength(1);
  });

  it('a wrapping group (not scrollable) never shows the affordance', async () => {
    await render(false);
    expect(element.querySelector('[data-testid="tabs-scroll-next"]')).toBeNull();
    expect(element.querySelector('.tabs-fade')).toBeNull();
  });
});
