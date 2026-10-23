import { Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmButtonImports } from '@spartan-ng/helm/button';

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
  imports: [CommonModule, HlmButtonImports],
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

  /** The role of the group element. */
  readonly groupRole = computed(() => (this.role() === 'radio' ? 'radiogroup' : 'tablist'));

  /** The role of each item. */
  readonly itemRole = computed(() => (this.role() === 'radio' ? 'radio' : 'tab'));

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
  }

  /** True in a right-to-left paragraph. */
  readonly rtl = computed(
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('dir') === 'rtl',
  );

  /** Select a tab. */
  select(id: string): void {
    if (id === this.active()) return;
    this.activeChange.emit(id);
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
