import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';

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
  imports: [CommonModule, HlmButtonImports, HlmInputImports],
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
  readonly addLabel = input<string>('Add');
  readonly removeLabel = input<string>('Remove {{name}}');
  readonly counterLabel = input<string>('{{count}} of {{max}}');

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

  readonly counterText = computed(() => {
    const m = this.max();
    if (m === undefined) return '';
    return this.counterLabel()
      .replace(/\{\{\s*count\s*\}\}/g, String(this.selected().length))
      .replace(/\{\{\s*max\s*\}\}/g, String(m));
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

  removeAriaLabel(name: string): string {
    return this.removeLabel()
      .replace(/\{\{\s*name\s*\}\}/g, name)
      .replace(/\{name\}/g, name);
  }
}