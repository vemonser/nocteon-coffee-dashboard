import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { PluralPipe } from '../../pipes/plural.pipe';

export interface ChipMultiselectItem {
  slug: string;
  name: string;
  imageUrl?: string | null;
}

/**
 * Shared chip-multiselect used by product wizard steps (tasting notes, pairings).
 *
 * Controlled component: the parent owns the selection (`selected`) and reacts to
 * `selectionChange` by updating its own state (e.g. a FormArray). The component
 * itself only renders and emits the next selection.
 */
@Component({
  selector: 'app-chip-multiselect',
  standalone: true,
  imports: [CommonModule, HlmInputImports, HlmButtonImports, PluralPipe],
  templateUrl: './chip-multiselect.component.html',
})
export class ChipMultiselectComponent {
  readonly items = input<ChipMultiselectItem[]>([]);
  readonly selected = input<string[]>([]);
  readonly max = input<number | undefined>(undefined);
  readonly searchable = input<boolean>(false);
  readonly emptyLabel = input<string>('');
  readonly noMatchesLabel = input<string>('');
  readonly searchPlaceholder = input<string>('');

  /**
   * The two labels that carry a value. They are translated HERE, with their
   * parameters, because a placeholder passed through a pipe without parameters
   * is stripped: "Remove {{name}}" arrived as "Remove" and every chip's remove
   * button shared one accessible name.
   */
  private readonly transloco = inject(TranslocoService);

  readonly selectionChange = output<string[]>();

  protected readonly query = signal('');
  private readonly searchTerm = signal('');
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly showSearch = computed(() => this.searchable() || this.items().length > 12);

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this.items();
    if (!term) return items;
    return items.filter((item) => item.name.toLowerCase().includes(term));
  });

  readonly selectedItems = computed(() => {
    const items = this.items();
    return this.selected().map((slug) => items.find((i) => i.slug === slug) ?? { slug, name: slug });
  });

  readonly canAdd = computed(() => {
    const m = this.max();
    return m === undefined || this.selected().length < m;
  });

  /** "3 of 5" — only when the parent set a cap. */
  readonly counterText = computed(() => {
    const m = this.max();
    if (m === undefined) return '';
    return this.transloco.translate('common.chipMultiselect.counter', {
      count: this.selected().length,
      max: m,
    });
  });

  isSelected(slug: string): boolean {
    return this.selected().includes(slug);
  }

  onSearchInput(value: string): void {
    this.query.set(value);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.searchTerm.set(this.query()), 300);
  }

  toggle(slug: string): void {
    const next = [...this.selected()];
    const idx = next.indexOf(slug);
    if (idx >= 0) {
      next.splice(idx, 1);
      this.selectionChange.emit(next);
      return;
    }
    if (!this.canAdd()) return;
    next.push(slug);
    this.selectionChange.emit(next);
  }

  remove(slug: string): void {
    const next = this.selected().filter((s) => s !== slug);
    this.selectionChange.emit(next);
  }

  /** "Remove Chocolate" — each chip needs its own accessible name. */
  removeAriaLabel(name: string): string {
    return this.transloco.translate('common.chipMultiselect.remove', { name });
  }
}