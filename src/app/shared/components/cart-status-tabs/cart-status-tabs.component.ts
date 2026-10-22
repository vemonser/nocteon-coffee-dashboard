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
 * Cart status tabs: All / Active / Abandoned / Converted.
 * Reuses the sliding pill pattern from LifecycleTabsComponent.
 */
@Component({
  selector: 'app-cart-status-tabs',
  standalone: true,
  templateUrl: './cart-status-tabs.component.html',
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
export class CartStatusTabsComponent {
  readonly allLabel = input.required<string>();
  readonly activeLabel = input.required<string>();
  readonly abandonedLabel = input.required<string>();
  readonly convertedLabel = input.required<string>();
  readonly allCount = input<number | null>(null);
  readonly activeCount = input<number | null>(null);
  readonly abandonedCount = input<number | null>(null);
  readonly convertedCount = input<number | null>(null);
  /** 'all' | 'active' | 'abandoned' | 'converted' */
  readonly selected = input.required<'all' | 'active' | 'abandoned' | 'converted'>();
  readonly tablistLabel = input<string>('Cart status');

  readonly viewChange = output<'all' | 'active' | 'abandoned' | 'converted'>();

  private readonly tablist = viewChild<ElementRef<HTMLElement>>('tablist');
  private readonly pill = viewChild<ElementRef<HTMLElement>>('pill');
  private readonly triggers = viewChildren<ElementRef<HTMLButtonElement>>('trigger');
  private readonly _rtl = computed(() =>
    typeof document !== 'undefined' ? document.documentElement.dir === 'rtl' : false,
  );

  private resizeObserver?: ResizeObserver;
  private pillReady = false;

  constructor() {
    effect(() => {
      this.selected();
      this.positionPillTo(this.selected(), this.pillReady);
      this.pillReady = true;
    });
  }

  ngAfterViewInit(): void {
    this.positionPillTo(this.selected(), false);
    this.pillReady = true;

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
    this.selectByIndex(target);
  }

  select(view: 'all' | 'active' | 'abandoned' | 'converted'): void {
    if (this.selected() === view) return;
    this.positionPillTo(view, true);
    this.viewChange.emit(view);
  }

  private selectByIndex(index: number): void {
    const views: Array<'all' | 'active' | 'abandoned' | 'converted'> = ['all', 'active', 'abandoned', 'converted'];
    this.select(views[index]);
  }

  private positionPillTo(view: 'all' | 'active' | 'abandoned' | 'converted', animate: boolean): void {
    const pill = this.pill()?.nativeElement;
    const list = this.tablist()?.nativeElement;
    const buttons = this.triggers();
    if (!pill || !list || buttons.length === 0) return;

    const viewIndex: Record<'all' | 'active' | 'abandoned' | 'converted', number> = {
      all: 0,
      active: 1,
      abandoned: 2,
      converted: 3,
    };
    const index = viewIndex[view];
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
      requestAnimationFrame(() => (pill.style.transition = ''));
    }
  }
}