# A4 — Background "watermark": file, commit, intent — corrected

**Verdict (re-verified at runtime): there is no visible background
illustration/watermark on any dashboard page, in light or dark mode, with or
without a dialog open.** The earlier report's SynthID finding is correct about
the PNG metadata, but it is not the whole story: the report left open the
possibility of a *painted* illustration. This pass checked the rendered page
directly and found none.

## What was checked (not inferred)

A logged-in browser session at 1440×900 evaluated, for every element on the
page (`*`) plus its `::before` and `::after`:

- `getComputedStyle(el).backgroundImage`
- `getComputedStyle(el, '::before' | '::after').backgroundImage` and `.content`

Pages scanned: `/dashboard`, `/dashboard/product-tags` (the page the report
named), `/dashboard/pairings`, `/dashboard/products`,
`/dashboard/product-options`, `/dashboard/store-settings`,
`/dashboard/categories/coffee`, `/dashboard/origins`, `/dashboard/farms`,
`/dashboard/roast-levels` — and the create/edit dialog on the Tags page.

Result:

| Target | Result |
|---|---|
| `html`, `body`, `app-root`, `main`, `app-layout`, `.page-shell` | `background-image: none` on all six, and `none` on their pseudo-elements |
| Every other element on the page | exactly one hit: `.sidebar-scroll-fade` (the 10 px new-sidebar fade under "Dashboard"), a `linear-gradient` — no image, no URL |
| Large low-opacity `img`/`svg` (opacity < 0.3, area > 10% of the viewport) | none |
| Dialog open (Tags create dialog) | the same single gradient; the panel is `bg-card`, no pseudo-element image |
| Dark mode (`nocteon-theme=dark`) | same result |

The grep evidence from the first report still holds: no `url(` image reference
exists in `src/` or `src/styles/`, and the only image asset in `public/` used by
the app is `authentication_image.png` on the LOGIN page (and `logo.svg` in the
sidebar).

## What the earlier report got right, and what it missed

- Right: the 2.3 MB `public/assets/images/authentication_image.png` carries an
  IPTC/XMP **SynthID** payload:
  `Applied imperceptible SynthID watermark` +
  `trainedAlgorithmicMedia`. That is provenance metadata inside the file, not
  something the dashboard paints.
- Missed: a visual "faint illustration behind Tags/dialogs" cannot come from
  that metadata. The runtime scan above rules out a painted one as well, so the
  observation was not reproducible against this branch (commit
  `4fb2cbb8`): most likely a stale screenshot from another worktree/build or a
  browser extension overlay.

## Where the image is, and its intent

| | |
|---|---|
| File | `public/assets/images/authentication_image.png` (1024×1024) |
| Used by | `src/app/features/auth/login/login.component.html` — the login page's left photo panel (`<img aria-hidden="true">`) |
| Commit that added it | `01fd6cd6` — *chore: checkpoint before design-system consistency pass* (2026-10-14) |
| Intent as app design | decorative login photography only; no watermark element, no `::before`/`::after` art, no mascot |

## Action taken

- **Nothing removed**, because nothing is painted. Deleting the login image
  would remove the login page's only artwork, not a watermark.
- The rule "no background illustration on table/form pages" is now **pinned by
  evidence**: `e2e/pages-evidence-pass1.spec.ts` records
  `backgroundImage: none` for `html`/`body`/`app-root`/`main`/layout wrappers on
  the data pages, plus zero faint large images.
- If provenance is a launch concern (third-party AI-generated media), track it
  as an asset-licensing question, not a styling bug. The image is decorative
  and `aria-hidden="true"`, so it carries no semantics for assistive tech.
