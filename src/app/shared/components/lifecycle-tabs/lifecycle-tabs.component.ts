import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';

/**
 * Lifecycle tabs (Active / Trash) for any soft-deletable list.
 *
 * Rendered above the table by each page — the capability lives in BaseListComponent,
 * this is only the control. Uses the WAI-ARIA tabs pattern: one tab stops in the tab
 * list at a time, Left/Right (and Home/End) move between them, and the selected tab
 * carries `aria-selected` + `aria-controls` so the table below can be associated.
 *
 * In RTL the arrow keys are mirrored: ArrowRight moves to the previous tab.
 *
 * The selected state is a single sliding pill (the "layoutId" element): it travels
 * between the two tabs and resizes to fit each label, so switching reads as one
 * persistent element moving rather than two backgrounds cross-fading. Positioned by
 * JS with getBoundingClientRect (RTL-safe) and animated with a CSS transition.
 */
@Component({
  selector: 'app-lifecycle-tabs',
  standalone: true,
  templateUrl: './lifecycle-tabs.component.html',
  styles: [
    `
      .tab-pill {
        position: absolute;
        z-index: 0;
        border-radius: var(--radius-control);
        background: var(--background);
        pointer-events: none;
        transition:
          left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
    `,
  ],
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

  private readonly tablist = viewChild<ElementRef<HTMLElement>>('tablist');
  private readonly pill = viewChild<ElementRef<HTMLElement>>('pill');
  private readonly triggers = viewChildren<ElementRef<HTMLButtonElement>>('trigger');
  private readonly _rtl = computed(() =>
    typeof document !== 'undefined' ? document.documentElement.dir === 'rtl' : false,
  );

  private resizeObserver?: ResizeObserver;
  /** False until the pill has been placed once, so the first paint does not animate. */
  private pillReady = false;

  constructor() {
    // React to selection changes. The first run places the pill without animating.
    effect(() => {
      this.selected();
      this.positionPillTo(this.selected(), this.pillReady);
      this.pillReady = true;
    });
  }

  ngAfterViewInit(): void {
    // Covers the case where the effect ran before the view children resolved.
    this.positionPillTo(this.selected(), false);
    this.pillReady = true;

    // Keep the pill aligned when the labels, counts, fonts or the viewport change —
    // a count badge growing ("9" → "10") or an RTL flip both move the target.
    this.resizeObserver = new ResizeObserver(() => this.positionPillTo(this.selected(), true));
    const list = this.tablist()?.nativeElement;
    if (list) this.resizeObserver.observe(list);
    for (const btn of this.triggers()) this.resizeObserver.observe(btn.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

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
    this.select(this.selected() === 'active' ? 'trash' : 'active');
  }

  select(view: 'active' | 'trash'): void {
    if (this.selected() === view) return;
    // Move the pill immediately on click — the shared element travels as you
    // click, not after the content fade lands. The effect below re-asserts the
    // same position once the `selected` input catches up.
    this.positionPillTo(view, true);
    this.viewChange.emit(view);
  }

  /**
   * The badge number. The exact count is shown up to 99; above that the badge
   * caps at "99+" so it stays one short token — a 15-item trash used to print
   * "9+" because the cap was 9, which under-reported every count above nine.
   */
  displayCount(value: number | null): string {
    return formatCountBadge(value);
  }

  /** Move the pill under the given tab. `animate` toggles the CSS transition. */
  private positionPillTo(view: 'active' | 'trash', animate: boolean): void {
    const pill = this.pill()?.nativeElement;
    const list = this.tablist()?.nativeElement;
    const buttons = this.triggers();
    if (!pill || !list || buttons.length === 0) return;

    const index = view === 'active' ? 0 : 1;
    const btn = buttons[index]?.nativeElement;
    if (!btn) return;

    if (!animate) pill.style.transition = 'none';

    const listRect = list.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    pill.style.left = `${btnRect.left - listRect.left}px`;
    pill.style.top = `${btnRect.top - listRect.top}px`;
    pill.style.width = `${btnRect.width}px`;
    pill.style.height = `${btnRect.height}px`;

    if (!animate) {
      // Restore the transition on the next frame so later moves animate.
      requestAnimationFrame(() => (pill.style.transition = ''));
    }
  }
}

/** Pure form so the rule can be asserted without a browser. */
export function formatCountBadge(value: number | null): string {
  if (value === null || value === undefined) return '\u2014';
  return value > 99 ? '99+' : String(value);
}
