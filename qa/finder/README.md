# `npm run find` — the issue finder

Finds UI, UX and data problems in the live dashboard without an outside reviewer.
Deterministic code does the finding; the LLM only triages, de-duplicates and fixes.

## Run

```bash
npm run find                     # full crawl + detectors + outliers + oracles + journeys + report
npm run find -- --fast           # a subset of routes, no journeys/vision (used by the pre-push hook)
npm run find -- --routes=/dashboard/products,/dashboard/orders
npm run find -- --update-baseline
npm run find -- --fix            # fix queue from the top of FINDINGS.md (never "Needs a human")
npm run find:test                # the detector unit tests (jsdom fixtures)
npm run find:recall              # inject 25 known defects and score recall
```

Requires the dev app (`npm start`, :4200) and the DEV/QA API (:8080) with the seed admin
in `.env.local` (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`).

## What runs

| Step | File | Notes |
|---|---|---|
| Crawl | `qa/finder/crawler.ts` | Routes from the curated router list, the live sidebar and the parameterised routes; default, tabs, disclosures, overlays, row hover/focus, mocked empty/loading/error; light/dark × en/ar × 1440 + 390. |
| Detectors | `qa/finder/detectors/*.ts` | 10 groups; each has a deliberately broken jsdom fixture test. |
| Outliers | `qa/finder/outliers.ts` | Role fingerprints across the app; minority (<15%) styles and off-scale spacing/font/colour. |
| Oracles | `qa/finder/invariants.ts` | Declarative `{name, route, ui, apiCall, transform}` UI-vs-API checks. |
| Journeys | `qa/finder/journeys.ts` + `TASKS.md` | The top task per area; writes are opt-in via `FINDER_ALLOW_MUTATIONS=1`. |
| Vision | `qa/finder/vision.ts` | Element crops only, paired with `qa/finder/golden/<region>.png`; skipped unless `FINDER_VISION_CMD` is set. |
| Triage | `qa/finder/triage.ts` | One root cause per detector + selector; severity × pages; new/known/fixed vs `qa/baseline.json`. |

Artifacts: `qa/.run/find/<timestamp>/` (screenshots, `crawl.json`, `outliers.json`,
`journeys.json`, `findings.json`, `crops/`). `FINDINGS.md` is written at the repo root.

## Safety

- **DEV/QA only.** The purge fixture refuses any non-localhost API and any production
  profile; it deletes only QA-prefixed records (`Auditcov`, `QA `, `e2e-`).
- The crawler never clicks anything whose accessible name matches
  delete/remove/permanently/block/send/publish/approve/reject/refund/logout/empty trash/
  create product.
- Journeys do not save/send unless `FINDER_ALLOW_MUTATIONS=1`; cleanup is a purge of the
  QA prefixes before and after the run.

## Bounds (deliberate)

- The full run visits ~30 routes; interaction states (tabs, overlays, rows) run in the
  first environment only (light/en/1440), because a tab's shape does not change with the
  theme or locale. Dark, Arabic and 390px get the default state.
- Mocked empty/error/loading states run on the core list pages.
- `--fast` uses 7 routes (~90s) and skips journeys/vision. The pre-push hook runs it with
  `--report-only`, so it fails only on NEW high/medium findings.
