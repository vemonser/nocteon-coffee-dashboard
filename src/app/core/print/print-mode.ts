/**
 * Print mode — the one place that switches a page onto the LIGHT stylesheet
 * for paper.
 *
 * A dark-mode print puts a black background on paper and burns the ink; the
 * screen theme must not change what a report looks like when it is printed.
 * The rule is therefore: while printing, <html> carries no `.dark` and does
 * carry a page class (`dashboard-print`, `order-print`) that the global print
 * sheet uses to drop the shell chrome (sidebar, navigation bar, toasts) and
 * leave the page at full width. The order detail has done this by hand since
 * the invoice shipped; this is the same rule as a small object so two pages
 * cannot drift apart.
 *
 * Everything is scoped by the class, so Ctrl+P on any other screen keeps its
 * normal layout.
 *
 * Usage (the page owns it, not the toolbar that triggers the print):
 *
 *   private readonly printMode = new PrintMode();
 *   // window: beforeprint -> printMode.enter()
 *   //         afterprint  -> printMode.exit()
 *   // the Print button  -> printMode.enter(); window.print();
 *
 * `enter()`/`exit()` are IDEMPOTENT: `window.print()` is called while the
 * `beforeprint` listener is also running, and the second `enter()` must not
 * remember the already-light state as "was dark" — that is the bug that
 * leaves a dark screen light after printing.
 */

/** The class the dashboard's print sheet is scoped to (see styles/index.css). */
export const REPORT_PRINT_CLASS = 'dashboard-print';

/**
 * The bit of an element this module touches. Typed structurally so the rule
 * can be tested without a DOM.
 */
export interface PrintRoot {
  classList: Pick<DOMTokenList, 'add' | 'remove' | 'contains' | 'toggle'>;
}

export class PrintMode {
  private wasDark = false;
  private active = false;

  /**
   * @param className the page class the print sheet is scoped to
   * @param root the element that carries the theme — <html> in the browser
   */
  constructor(
    private readonly className: string = REPORT_PRINT_CLASS,
    private readonly root: PrintRoot = document.documentElement,
  ) {}

  /** True between `enter()` and `exit()`. */
  get printing(): boolean {
    return this.active;
  }

  /** Drop dark mode and mark the page as printing. Safe to call twice. */
  enter(): void {
    if (this.active) return;
    this.active = true;
    this.wasDark = this.root.classList.contains('dark');
    this.root.classList.remove('dark');
    this.root.classList.add(this.className);
  }

  /** Put the screen theme back exactly as it was. Safe to call twice. */
  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.root.classList.toggle('dark', this.wasDark);
    this.root.classList.remove(this.className);
    this.wasDark = false;
  }
}
