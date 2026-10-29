import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { ChipMultiselectComponent, ChipMultiselectItem } from './chip-multiselect.component';

const ITEMS: ChipMultiselectItem[] = [
  { slug: 'a', name: 'Alpha' },
  { slug: 'b', name: 'Beta' },
  { slug: 'c', name: 'Cherry' },
];

/**
 * The two labels that carry a value are translated with their parameters.
 * A stub is enough: the shape of the sentence is the locale files' job
 * (i18n-keys.spec guards those).
 */
const transloco = {
  translate: (key: string, params?: Record<string, unknown>) => {
    if (key === 'common.chipMultiselect.remove') return `Remove ${String(params?.['name'])}`;
    if (key === 'common.chipMultiselect.counter') {
      return `${String(params?.['count'])} of ${String(params?.['max'])}`;
    }
    return key;
  },
};

describe('ChipMultiselectComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslocoService, useValue: transloco }],
    });
  });

  it('toggles selection and emits the new list', () => {
    const fixture = TestBed.createComponent(ChipMultiselectComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('selected', []);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    const emitted: string[][] = [];
    cmp.selectionChange.subscribe((v) => emitted.push(v));

    cmp.toggle('a');
    expect(emitted[0]).toEqual(['a']);

    // simulate parent updating selected input
    fixture.componentRef.setInput('selected', ['a']);
    fixture.detectChanges();
    cmp.toggle('a');
    expect(emitted[1]).toEqual([]);
  });

  it('enforces max when adding', () => {
    const fixture = TestBed.createComponent(ChipMultiselectComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('selected', ['a']);
    fixture.componentRef.setInput('max', 1);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    const emitted: string[][] = [];
    cmp.selectionChange.subscribe((v) => emitted.push(v));

    cmp.toggle('b'); // would exceed max
    expect(emitted).toHaveLength(0);
    expect(cmp.canAdd()).toBe(false);

    // removing still works
    cmp.toggle('a');
    expect(emitted[0]).toEqual([]);
  });

  it('gives every chip its own remove label and interpolates the counter', () => {
    const fixture = TestBed.createComponent(ChipMultiselectComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('selected', ['a', 'b']);
    fixture.componentRef.setInput('max', 3);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    // The chip's accessible name carries the item, so a screen reader does not
    // hear five identical "Remove" buttons.
    expect(cmp.removeAriaLabel('Alpha')).toBe('Remove Alpha');
    expect(cmp.removeAriaLabel('Beta')).toBe('Remove Beta');
    expect(cmp.counterText()).toBe('2 of 3');
    expect(fixture.nativeElement.querySelector('button[aria-label="Remove Alpha"]')).toBeTruthy();
  });

  it('filters items by search term after debounce', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ChipMultiselectComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('selected', []);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;

    cmp.onSearchInput('al');
    // not yet applied
    expect(cmp.filteredItems().map((i) => i.slug)).toEqual(['a', 'b', 'c']);

    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(cmp.filteredItems().map((i) => i.slug)).toEqual(['a']);

    cmp.onSearchInput('zzz');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(cmp.filteredItems()).toHaveLength(0);

    vi.useRealTimers();
  });
});
