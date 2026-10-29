import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import {
  hasMoreAfter,
  metricsOf,
  nextScrollDelta,
  overflows,
  type ScrollMetrics,
} from './scroll-affordance';

/** One tab. */
export interface TabItem {
  /** The tab's id. */
  id: string;
  /** The tab's label, already translated. */
  label: string;
}

/**
 * THE tab group.
 *
 * One component, one look. The dashboard had TWO tab styles: a pill-style
 * segmented control for the range in the toolbar, and a boxed, underlined
 * tab row inside the cards — and the boxed one rendered a visible frame
 * around the active tab, so the same page showed two different products.
 *
 * The style is the PILL: a rounded group, and the active item is a filled
 * `--secondary` surface. The brand colour is NOT used for a selected
 * secondary control (design.md §3), and the active item is never signalled
 * by colour alone — it is a different surface AND a different text colour.
 *
 * The group plays one of two ROLES, and only the role differs:
 *
 *  - `tab` — a `tablist`: switching between VIEWS of the same data
 *    (Revenue by origin / roast level / category).
 *  - `radio` — a `radiogroup`: choosing ONE option from a set
 *    (Last 7 / 30 / 90 / 365 days).
 *
 * Both are keyboard operable: the arrow keys move between the items and
 * the selection is announced (design.md §11).
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, HlmButtonImports, TranslocoPipe, NgIcon],
  providers: [provideIcons({ lucideChevronRight })],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.css',
})
export class TabsComponent {
  /** The tabs, in order. */
  readonly items = input.required<TabItem[]>();
  /** The active tab's id. */
  readonly active = input.required<string>();
  /** The group's role: a tablist, or a radiogroup. */
  readonly role = input<'tab' | 'radio'>('tab');
  /** The group's accessible name. */
  readonly label = input<string>('');
  /**
   * Keep the group on ONE line and let it scroll horizontally.
   *
   * The dashboard toolbar sits at the top of a 390px phone: four range
   * labels wrapped to two rows and pushed the page down. A scrollable
   * group keeps one row, and the selected item is scrolled into view on
   * focus because the browser follows a focused button by itself.
   */
  readonly scrollable = input<boolean>(false);
  /** The tab that is selected, when the reader picks one. */
  readonly activeChange = output<string>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private resizeObserver: ResizeObserver | null = null;

  /** The role of the group element. */
  readonly groupRole = computed(() => (this.role() === 'radio' ? 'radiogroup' : 'tablist'));

  /** The role of each item. */
  readonly itemRole = computed(() => (this.role() === 'radio' ? 'radio' : 'tab'));

  /**
   * Does the group hold options past its inline end?
   *
   * The value is measured, never assumed: `scrollWidth` is 0 until layout
   * exists, so a phone shows the affordance and a wide screen — where all
   * four ranges fit — shows none.
   */
  readonly hasMore = signal(false);

  private readonly metrics = signal<ScrollMetrics>({
    scrollLeft: 0,
    clientWidth: 0,
    scrollWidth: 0,
    rtl: false,
  });

  /**
   * The ONE item in the tab order.
   *
   * A tablist is a single tab stop: Tab enters on the selected tab, and the
   * arrows move from there. If the active id is not in the list (a URL with
   * an unknown range), the first item is the stop so the group is never a
   * keyboard dead end.
   */
  readonly focusableId = computed(() => {
    const items = this.items();
    return items.some((item) => item.id === this.active())
      ? this.active()
      : (items[0]?.id ?? '');
  });

  /** True in a right-to-left paragraph. */
  readonly rtl = computed(
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('dir') === 'rtl',
  );

  constructor() {
    // Measure after the first paint (there is no layout before it) and after
    // every re-render that can change the width of the items (a language
    // switch rewrites every label).
    afterNextRender(() => {
      this.observe();
      this.applyRovingTabindex();
    });

    effect(() => {
      this.items();
      this.active();
      // The labels of the new language are in the DOM by the next frame.
      setTimeout(() => {
        this.measure();
        this.applyRovingTabindex();
      });
    });

    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
  }

  /**
   * Start watching the scroller.
   *
   * A `ResizeObserver` covers the two cases a scroll listener cannot: the
   * container is resized by a media query, and the font/labels change width
   * after a language switch. It is optional — without it the affordance is
   * simply measured on every scroll and on first render.
   */
  private observe(): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    this.measure();
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(element);
  }

  /** Re-read the scroll geometry. Cheap: three numbers, one signal write. */
  measure(): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    const metrics = metricsOf(element, this.rtl());
    this.metrics.set(metrics);
    this.hasMore.set(hasMoreAfter(metrics));
  }

  /**
   * Reveal the next screenful of options.
   *
   * The step is one visible width, so a group of five options takes two
   * presses at most; the direction is mirrored in RTL (see
   * `nextScrollDelta`). When the last option is in view the button is no
   * longer rendered, so focus is moved to the group itself rather than being
   * dropped on `<body>` — losing the keyboard position is worse than the
   * button disappearing.
   */
  scrollForward(): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    const reduceMotion =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({
      left: nextScrollDelta(this.metrics(), element.clientWidth),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    // `scrollBy({behavior: 'smooth'})` is asynchronous; a frame later the new
    // geometry is readable and the "nothing more" case can be handled.
    setTimeout(() => {
      this.measure();
      if (!this.hasMore() && overflows(this.metrics())) element.focus();
    }, reduceMotion ? 0 : 320);
  }

  /**
   * Move the selection with the arrow keys.
   *
   * A tablist is a single tab stop: the reader presses the arrow keys to
   * move between the tabs (design.md §11).
   *
   * The keys are MIRRORED in RTL, exactly like the app's own lifecycle
   * tabs: "next" means next in the READING order, so in Arabic the left
   * arrow moves forward.
   */
  onKeydown(event: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const items = this.items();
    if (!items.length) return;
    const current = items.findIndex((item) => item.id === this.active());
    let next = current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else {
      const forward = this.rtl() ? 'ArrowLeft' : 'ArrowRight';
      const backward = this.rtl() ? 'ArrowRight' : 'ArrowLeft';
      if (event.key === forward || event.key === 'ArrowDown') {
        next = (current + 1 + items.length) % items.length;
      } else {
        next = (current - 1 + items.length) % items.length;
      }
    }
    event.preventDefault();
    this.select(items[next].id);
    this.focusItem(items[next].id);
    // The browser scrolls a focused button into view; the affordance follows.
    setTimeout(() => this.measure());
  }

  /** Select a tab. */
  select(id: string): void {
    if (id === this.active()) return;
    this.activeChange.emit(id);
  }

  /**
   * The roving tabindex is applied to the DOM, NOT bound in the template.
   *
   * `hlmBtn` carries `BrnButton` as a host directive, and that directive binds
   * `[attr.tabindex]` on the same element (it writes `-1` while disabled and
   * REMOVES the attribute otherwise). A template binding therefore loses to
   * it and every tab ends up in the tab order — the group was four stops
   * instead of one. Writing the property after each render wins, because
   * Angular only re-writes a host binding whose value CHANGED.
   */
  private applyRovingTabindex(): void {
    const element = this.host.nativeElement as HTMLElement;
    const focusable = this.focusableId();
    element
      .querySelectorAll<HTMLButtonElement>('[data-tab-id]')
      .forEach((button) => {
        button.tabIndex = button.dataset['tabId'] === focusable ? 0 : -1;
      });
  }

  /** Move the focus to a tab, so the keyboard reader follows the selection. */
  private focusItem(id: string): void {
    const element = this.host.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>(
      `[data-tab-id="${id}"]`,
    );
    button?.focus();
  }
}
