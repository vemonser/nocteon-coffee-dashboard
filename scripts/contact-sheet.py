#!/usr/bin/env python3
"""Compose the BEFORE / AFTER contact sheet for every evidence cell.

    python3 scripts/contact-sheet.py [--before evidence/orders-before]
                                     [--after  evidence/orders]
                                     [--out    evidence/orders/contact-sheet]

The "before" images are the baseline capture (the pages as they were before
the work); the "after" images are the final matrix. Each contact sheet puts
the two side by side with a label, so a reviewer can see the change without
opening 120 files.

Every target that exists in BOTH captures gets a sheet. A target that only
exists in the "after" capture (a screen the work added) gets a sheet with
the "before" panel marked as "did not exist".

Pillow is used for the compositing. It is already available in the
environment; nothing new is installed.
"""

import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def arg(name, default):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


BEFORE = os.path.join(ROOT, arg("--before", "evidence/orders-before"))
AFTER = os.path.join(ROOT, arg("--after", "evidence/orders"))
OUT = os.path.join(AFTER, arg("--out", "contact-sheet"))

LANGS = ["en", "ar"]
THEMES = ["light", "dark"]
WIDTHS = [375, 768, 1024, 1440, 1920]

LABEL_H = 34
GAP = 16
BG = (24, 20, 16)
FG = (245, 239, 232)
MISSING = (60, 50, 44)


def label_strip(width, text):
    strip = Image.new("RGB", (width, LABEL_H), BG)
    draw = ImageDraw.Draw(strip)
    draw.text((10, 10), text, fill=FG)
    return strip


def panel(path, width, title):
    """One panel: the screenshot (or a "did not exist" card) with a label."""
    if path and os.path.exists(path):
        image = Image.open(path).convert("RGB")
    else:
        image = Image.new("RGB", (width, 400), MISSING)
        draw = ImageDraw.Draw(image)
        draw.text((20, 180), "did not exist", fill=FG)
    label = label_strip(image.width, title)
    sheet = Image.new("RGB", (image.width, image.height + LABEL_H), BG)
    sheet.paste(label, (0, 0))
    sheet.paste(image, (0, LABEL_H))
    return sheet


def compose(before_path, after_path, out_path, title):
    left = panel(before_path, 800, "BEFORE")
    right = panel(after_path, 800, "AFTER")
    height = max(left.height, right.height)
    sheet = Image.new("RGB", (left.width + right.width + GAP, height), BG)
    sheet.paste(left, (0, 0))
    sheet.paste(right, (left.width + GAP, 0))
    draw = ImageDraw.Draw(sheet)
    draw.text((10, height - 24), title, fill=FG)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    sheet.save(out_path)
    return out_path


def targets_of(directory):
    """The target ids in a capture directory (the file name minus the width)."""
    found = set()
    for lang in LANGS:
        for theme in THEMES:
            cell = os.path.join(directory, f"{lang}-{theme}")
            if not os.path.isdir(cell):
                continue
            for name in os.listdir(cell):
                if not name.endswith(".png"):
                    continue
                stem = name.rsplit("-", 1)[0]
                found.add(stem)
    return found


def main():
    if not os.path.isdir(BEFORE):
        print(f"no before capture at {BEFORE}")
        return
    os.makedirs(OUT, exist_ok=True)

    targets = sorted(targets_of(AFTER) | targets_of(BEFORE))
    sheets = 0
    for lang in LANGS:
        for theme in THEMES:
            for target in targets:
                for width in WIDTHS:
                    before_path = os.path.join(BEFORE, f"{lang}-{theme}", f"{target}-{width}.png")
                    after_path = os.path.join(AFTER, f"{lang}-{theme}", f"{target}-{width}.png")
                    if not (os.path.exists(before_path) or os.path.exists(after_path)):
                        continue
                    out_path = os.path.join(OUT, f"{target}-{lang}-{theme}-{width}.png")
                    compose(before_path, after_path, out_path, f"{target} — {lang}-{theme} @ {width}px")
                    sheets += 1
    print(f"contact sheets: {sheets} -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
