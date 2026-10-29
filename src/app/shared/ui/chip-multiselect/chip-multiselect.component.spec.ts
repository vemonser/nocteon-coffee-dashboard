import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChipMultiselectComponent, ChipMultiselectItem } from './chip-multiselect.component';

const ITEMS: ChipMultiselectItem[] = [
  { slug: 'a', name: 'Alpha' },
  { slug: 'b', name: 'Beta' },
  { slug: 'c', name: 'Cherry' },
];

describe('ChipMultiselectComponent', () => {
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