import { buildSync } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

let cached: string | null = null;

/**
 * The detector bundle, as one IIFE string.
 *
 * The detectors are TypeScript modules (so they can be unit-tested with
 * jsdom), but the live page needs them as plain browser JS. esbuild is
 * already a dependency of the dev toolchain (Vite), so the finder reuses it:
 * one bundle, injected once per context, exposing `window.__finder`.
 */
export function detectorBundle(): string {
  if (cached) return cached;
  const result = buildSync({
    entryPoints: [resolve(HERE, 'detectors/index.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: '__finder',
    platform: 'browser',
    target: 'es2020',
    legalComments: 'none',
    logLevel: 'silent',
  });
  cached = result.outputFiles?.[0]?.text ?? '';
  if (!cached) throw new Error('finder: esbuild produced no detector bundle');
  return cached;
}

/** The init script that records native dialogs and exposes the detector hook. */
export function detectorInitScript(): string {
  return `${detectorBundle()}
;window.__finder = __finder;
;window.__finderTokens = __finder.tokens;
;(() => {
  window.__finderNativeDialogs = [];
  for (const kind of ['alert', 'confirm', 'prompt']) {
    const original = window[kind];
    window[kind] = function (...args) {
      window.__finderNativeDialogs.push({ kind, message: String(args[0] ?? '') });
      return kind === 'confirm' ? false : kind === 'prompt' ? null : undefined;
    };
    window[kind].__finderOriginal = original;
  }
})();`;
}
