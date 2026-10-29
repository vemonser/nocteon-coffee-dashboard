import { describe, expect, it } from 'vitest';
import { PrintMode, REPORT_PRINT_CLASS, type PrintRoot } from './print-mode';

/**
 * A tiny stand-in for `<html>` — the rule under test is a class list, not a
 * layout, so this stays a unit test with no DOM.
 */
function fakeRoot(classes: string[] = []): PrintRoot & { has: (c: string) => boolean; classes: Set<string> } {
  const set = new Set(classes);
  return {
    classes: set,
    has: (c: string) => set.has(c),
    classList: {
      add: (c: string) => void set.add(c),
      remove: (c: string) => void set.delete(c),
      contains: (c: string) => set.has(c),
      toggle: (c: string, force?: boolean) => {
        const on = force ?? !set.has(c);
        if (on) set.add(c);
        else set.delete(c);
        return on;
      },
    } as PrintRoot['classList'],
  };
}

describe('print mode', () => {
  it('prints on the light stylesheet and marks the page', () => {
    const root = fakeRoot(['dark']);
    const mode = new PrintMode(REPORT_PRINT_CLASS, root);
    mode.enter();

    expect(root.has('dark'), 'a dark screen must not reach paper').toBe(false);
    expect(root.has(REPORT_PRINT_CLASS)).toBe(true);
  });

  it('is idempotent: the second enter() does not forget the real theme', () => {
    const root = fakeRoot(['dark']);
    const mode = new PrintMode(REPORT_PRINT_CLASS, root);

    // `window.print()` runs while the `beforeprint` listener is also entering
    // print mode. The pair must survive that.
    mode.enter();
    mode.enter();

    mode.exit();

    expect(root.has('dark'), 'the screen theme is restored exactly once').toBe(true);
    expect(root.has(REPORT_PRINT_CLASS)).toBe(false);
  });

  it('a light screen stays light after the print', () => {
    const root = fakeRoot();
    const mode = new PrintMode(REPORT_PRINT_CLASS, root);
    mode.enter();
    mode.exit();

    expect(root.has('dark')).toBe(false);
    expect(root.has(REPORT_PRINT_CLASS)).toBe(false);
  });

  it('exit() without enter() never touches the screen theme', () => {
    const root = fakeRoot(['dark']);
    const mode = new PrintMode(REPORT_PRINT_CLASS, root);

    mode.exit();

    expect(root.has('dark')).toBe(true);
    expect(mode.printing).toBe(false);
  });

  it('reports whether it is printing, and can print twice', () => {
    const root = fakeRoot(['dark']);
    const mode = new PrintMode(REPORT_PRINT_CLASS, root);

    expect(mode.printing).toBe(false);
    mode.enter();
    expect(mode.printing).toBe(true);
    mode.exit();
    expect(mode.printing).toBe(false);

    // A second print in the same page view starts from the true theme again.
    mode.enter();
    expect(root.has('dark')).toBe(false);
    mode.exit();
    expect(root.has('dark')).toBe(true);
  });

  it('the dashboard scopes its print sheet to one class', () => {
    expect(REPORT_PRINT_CLASS).toBe('dashboard-print');
  });
});
