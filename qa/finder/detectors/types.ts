/**
 * The finder's detector contract.
 *
 * A detector is a PURE function of the current document plus a small context
 * object. It returns issues; it never mutates the page, never fetches, and
 * never throws. That is what makes the same code runnable in the live page
 * (bundled into the browser) and in a jsdom unit test (fixtures).
 *
 * In the unit tests, geometry comes from `data-finder-box="x,y,w,h"` on the
 * fixture element (`rectOf` prefers it over `getBoundingClientRect`), so a
 * layout check is deterministic without a browser.
 */

export type Severity = 'high' | 'medium' | 'low';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectorContext {
  /** The route being inspected, e.g. `/dashboard/products`. */
  route: string;
  /** The state path inside the route, e.g. `tab:Payment method`. */
  state: string;
  /** `en` | `ar` (from `<html lang>`). */
  lang: string;
  /** `light` | `dark`. */
  theme: string;
  /** The viewport the page is rendered in. */
  viewport: { w: number; h: number };
  /** Test prefixes from qa/test-prefixes.json (data hygiene). */
  testPrefixes: string[];
  /** The element that opened the current overlay, when there is one. */
  trigger?: { selector: string; box: Box } | null;
  /** Native alert/confirm/prompt calls recorded by the init script. */
  nativeDialogs?: Array<{ kind: string; message: string }>;
  /** Set while the page is in a mocked loading/error/empty state. */
  mocked?: 'loading' | 'error' | 'empty' | null;
}

export interface Issue {
  /** The detector group, e.g. `i18n`. */
  detector: string;
  /** The rule inside the group, e.g. `i18n.raw-key`. */
  id: string;
  severity: Severity;
  /** A stable selector for the offending element. */
  selector: string;
  /** One sentence a human can act on. */
  message: string;
  /** The observed value/text and, when relevant, the expected one. */
  evidence: string;
  /** The element's box, used to pick the screenshot region and to map vision bboxes. */
  bbox?: Box;
}

/** A page-side detector. */
export type Detector = (doc: Document, ctx: DetectorContext) => Issue[];
