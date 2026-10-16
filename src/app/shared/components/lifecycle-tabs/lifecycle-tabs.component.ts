import { Component, ElementRef, computed, inject, input, output, viewChildren } from '@angular/core';

/**
 * Lifecycle tabs (Active / Trash) for any soft-deletable list.
 *
 * Rendered above the table by each page — the capability lives in BaseListComponent,
 * this is only the control. Uses the WAI-ARIA tabs pattern: one tab stops in the tab
 * list at a time, Left/Right (and Home/End) move between them, and the selected tab
 * carries `aria-selected` + `aria-controls` so the table below can be associated.
 *
 * In RTL the arrow keys are mirrored: ArrowRight moves to the previous tab.
 */
@Component({
  selector: 'app-lifecycle-tabs',
  standalone: true,
  templateUrl: './lifecycle-tabs.component.html',
})
export class LifecycleTabsComponent {
  readonly activeLabel = input.required<string>();
  readonly trashLabel = input.required<string>();
  readonly activeCount = input<number | null>(null);
  readonly trashCount = input<number | null>(null);
  /** 'active' | 'trash' — the selected lifecycle. */
  readonly selected = input.required<'active' | 'trash'>();
  readonly trashCountLabel = input<string>('');
  readonly activeCountLabel = input<string>('');
  readonly tablistLabel = input<string>('Entity view');

  readonly viewChange = output<'active' | 'trash'>();

  private readonly triggers = viewChildren<ElementRef<HTMLButtonElement>>('trigger');
  private readonly _rtl = computed(() =>
    typeof document !== 'undefined' ? document.documentElement.dir === 'rtl' : false,
  );

  onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.triggers().length;
    if (count === 0) return;

    // Logical direction: "next" means next tab in reading order.
    const forward = this._rtl() ? 'ArrowLeft' : 'ArrowRight';
    const backward = this._rtl() ? 'ArrowRight' : 'ArrowLeft';

    let target: number | null = null;
    switch (event.key) {
      case forward:
        target = (index + 1) % count;
        break;
      case backward:
        target = (index - 1 + count) % count;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = this.triggers()[target];
    next?.nativeElement.focus();
    this.viewChange.emit(this.selected() === 'active' ? 'trash' : 'active');
  }

  select(view: 'active' | 'trash'): void {
    if (this.selected() === view) return;
    this.viewChange.emit(view);
  }
}