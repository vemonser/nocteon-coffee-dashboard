#!/usr/bin/env python3
"""Compose the BEFORE / AFTER contact sheet for every evidence cell.

    python3 scripts/contact-sheet.py

The "before" images are the Phase 0 baseline (the dashboard as it was
before any of this work); the "after" images are the Phase 6 matrix. Each
contact sheet puts the two side by side with a label, so a reviewer can see
the change without opening 40 files.

Pillow is used for the compositing. It is already available in the
environment; nothing new is installed.
"""

import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEFORE = os.path.join(ROOT, "evidence", "phase0-before")
AFTER = os.path.join(ROOT, "evidence", "phase6")
OUT = os.path.join(AFTER, "contact-sheet")

LANGS = ["en", "ar"]
THEMES = ["light", "dark"]
WIDTHS = [375, 768, 1024, 1440, 1920]

LABEL_H = 34
GAP = 16
BG = (24, 20, 16)
FG = (245, 239, 232)


def label_strip(width, text):
    strip = Image.new("RGB", (width, LABEL_H), BG)
    draw = ImageDraw.Draw(strip)
    draw.text((10, 10), text, fill=FG)
    return strip


def sheet(before_path, after_path, out_path):
    before = Image.open(before_path).convert("RGB")
    after = Image.open(after_path).convert("RGB")

    # Scale both to the same height so the comparison is fair.
    height = max(before.height, after.height)
    before = before.resize((max(1, int(before.width * height / before.height)), height))
    after = after.resize((max(1, int(after.width * height / after.height)), height))

    width = before.width + after.width + GAP
    canvas = Image.new("RGB", (width, height + LABEL_H * 2 + GAP), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 10), "BEFORE  (phase 0 baseline)", fill=FG)
    draw.text((10, LABEL_H + 10), "AFTER  (phase 6)", fill=FG)

    y = LABEL_H * 2 + GAP
    canvas.paste(before, (0, y))
    canvas.paste(after, (before.width + GAP, y))
    canvas.save(out_path)
    return canvas.size


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []
    missing = []
    for lang in LANGS:
        for theme in THEMES:
            for width in WIDTHS:
                b = os.path.join(BEFORE, f"{lang}-{theme}", f"dashboard-{width}.png")
                a = os.path.join(AFTER, f"{lang}-{theme}", f"dashboard-{width}.png")
                if not (os.path.exists(b) and os.path.exists(a)):
                    missing.append(f"{lang}-{theme}-{width}")
                    continue
                out = os.path.join(OUT, f"{lang}-{theme}-{width}.png")
                size = sheet(b, a, out)
                made.append((f"{lang}-{theme}-{width}", size))
    for name, size in made:
        print(f"  {name:24} {size[0]}x{size[1]}")
    print(f"contact sheets: {len(made)} -> evidence/phase6/contact-sheet/")
    if missing:
        print("MISSING:", ", ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
