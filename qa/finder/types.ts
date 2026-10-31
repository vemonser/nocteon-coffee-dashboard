import type { Issue } from './detectors/types.ts';

/** One detector issue, tied to the state that produced it. */
export interface Finding extends Issue {
  /** The route label, e.g. `products`. */
  page: string;
  /** The route path, e.g. `/dashboard/products`. */
  route: string;
  /** The state path, e.g. `tab:Payment method`. */
  state: string;
  /** The environment name, e.g. `light/en/1440`. */
  env: string;
  /** Viewport screenshot of the state (never a full-page capture). */
  screenshot: string;
}

/** The recorded facts of one visited state. */
export interface StateRecord {
  page: string;
  route: string;
  state: string;
  env: string;
  url: string;
  title: string;
  screenshot: string;
  aria: string;
  console: Array<{ type: string; text: string }>;
  network: Array<{ status: number; url: string }>;
  issues: Finding[];
  /** Interaction-level probes (Esc, focus return). */
  probes?: Record<string, boolean | string>;
}

export interface CrawlOptions {
  baseUrl: string;
  outDir: string;
  fast: boolean;
  maxRoutes?: number;
  headed?: boolean;
  /** Optional allow-list of route paths or page ids. */
  routes?: string[];
  /** Skip tabs/overlays/rows (default state only). */
  noInteractions?: boolean;
}

export interface CrawlResult {
  states: StateRecord[];
  findings: Finding[];
  fingerprints: Array<{
    page: string;
    route: string;
    role: string;
    key: string;
    values: Record<string, unknown>;
    selector: string;
    text: string;
  }>;
  tokens: { colors: string[]; fontSizes: number[] };
  crops: import('./vision.ts').Crop[];
  apiToken: string | null;
  routeGaps: string[];
  startedAt: string;
  finishedAt: string;
}
