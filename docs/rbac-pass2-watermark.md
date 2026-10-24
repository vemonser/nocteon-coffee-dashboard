# A4 — Background watermark: file, commit, intent

**Verdict: there is no visible background watermark in the app.** F5's finding
("no watermark asset / CSS found") is confirmed. The only watermark in the
repository is an **invisible, machine-readable** one embedded in a PNG.

## Where it is

| | |
|---|---|
| File | `public/assets/images/authentication_image.png` (1024×1024, 2.3 MB) |
| Used by | `src/app/features/auth/login/login.component.html` — the login page's left photo panel only (`<img aria-hidden="true">`) |
| Commit that added it | `01fd6cd6` — *chore: checkpoint before design-system consistency pass* (2026-10-14) |

## What the watermark actually is

The PNG carries an IPTC / XMP payload, readable with `strings`:

```
Applied imperceptible SynthID watermark
http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia
```

That is a **SynthID** watermark: an imperceptible pixel-domain signature added
by a generative image model, plus the IPTC `trainedAlgorithmicMedia` source
type. It is metadata, not artwork — nothing in the pixels or in the rendered
page says "watermark", and no CSS/asset in `src/` or `public/` paints one.

```
$ grep -rniE "watermark" src public        # no matches in text sources
$ git log --oneline -S "watermark" --all   # 01fd6cd6 only
$ git grep -il watermark 01fd6cd6          # public/assets/images/authentication_image.png
```

## Intentional?

- **As app design: no.** No watermark element exists in any template, stylesheet,
  or SVG. The dashboard background is `bg-background` + theme tokens only.
- **As image provenance: yes, but inherited.** The mark comes from the tool that
  generated the photo; it was not added by this project. Removing it would mean
  replacing the image, not deleting code.

## Recommendation

Nothing to remove for the UI. If provenance matters for launch (the image is
third-party AI-generated media), track it as an asset-licensing question rather
than a styling bug. The image is decorative and `aria-hidden="true"`, so it
carries no semantic content for assistive technology.
