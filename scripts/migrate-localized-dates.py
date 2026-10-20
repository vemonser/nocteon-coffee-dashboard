#!/usr/bin/env python3
"""Replace the built-in `| date` pipe with the shared localized date.

The built-in pipe renders the date in the LOCALE'S OWN order with no
direction handling, so an Arabic page showed "10/20/2026" while the rest of
the app showed "20 Oct 2026" / "20 أكتوبر 2026". One date, one helper.

    python3 scripts/migrate-localized-dates.py [--dry]
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
DRY = "--dry" in sys.argv

# ── the replacements, per file ────────────────────────────────────────────────
# Each entry: (relative html path, [(old, new), ...])
REPLACEMENTS = [
    (
        "features/broadcasts/components/broadcast-list.component.html",
        [(
            "<span>{{ item.createdAt | date:'short' }}</span>",
            '<span><app-localized-date [value]="item.createdAt" /></span>',
        )],
    ),
    (
        "features/carts/components/carts-list.component.html",
        [
            (
                '<p class="text-sm">{{ viewing()!.createdAt | date:\'medium\' }}</p>',
                '<p class="text-sm"><app-localized-date [value]="viewing()!.createdAt" variant="long" /></p>',
            ),
            (
                '<p class="text-sm">{{ viewing()!.updatedAt | date:\'medium\' }}</p>',
                '<p class="text-sm"><app-localized-date [value]="viewing()!.updatedAt" variant="long" /></p>',
            ),
        ],
    ),
    (
        "features/carts/cart-detail/cart-detail.component.html",
        [
            (
                "<span>{{ cart()!.createdAt | date:'medium' }}</span>",
                '<span><app-localized-date [value]="cart()!.createdAt" variant="long" /></span>',
            ),
            (
                "<div class=\"text-sm text-muted-foreground\">{{ cart()!.updatedAt | date:'medium' }}</div>",
                '<div class="text-sm text-muted-foreground"><app-localized-date [value]="cart()!.updatedAt" variant="long" /></div>',
            ),
        ],
    ),
    (
        "features/journal/components/journal-list.component.html",
        [(
            "{{ item.publishedAt ? (item.publishedAt | date:'short') : ('journal.draft' | transloco) }}",
            "@if (item.publishedAt) {\n                  <app-localized-date [value]=\"item.publishedAt\" />\n                } @else {\n                  {{ 'journal.draft' | transloco }}\n                }",
        )],
    ),
    (
        "features/notifications-list/components/notification-list.component.html",
        [
            (
                "<p class=\"text-xs text-muted-foreground mt-1\">{{ n.createdAt | date: 'short' }}</p>",
                '<p class="text-xs text-muted-foreground mt-1"><app-localized-date [value]="n.createdAt" /></p>',
            ),
            (
                "<p class=\"text-xs text-gray-500\">{{ viewing()!.createdAt | date: 'medium' }}</p>",
                '<p class="text-xs text-gray-500"><app-localized-date [value]="viewing()!.createdAt" variant="long" /></p>',
            ),
        ],
    ),
    (
        "features/processing-method/processing-method-detail/components/processing-method-detail.component.html",
        [(
            "{{ method()!.createdAt ? (method()!.createdAt | date:'mediumDate') : '' }}",
            "@if (method()!.createdAt) {\n                <app-localized-date [value]=\"method()!.createdAt\" variant=\"long\" />\n              }",
        )],
    ),
    (
        "features/promo-codes/promo-code-detail/components/promo-code-detail.component.html",
        [
            (
                "{{ promoCode()!.validFrom | date: 'medium' }}",
                '<app-localized-date [value]="promoCode()!.validFrom" variant="long" />',
            ),
            (
                "{{ promoCode()!.validUntil | date: 'medium' }}",
                '<app-localized-date [value]="promoCode()!.validUntil" variant="long" />',
            ),
        ],
    ),
    (
        "features/roast-level/roast-level-detail/components/roast-level-detail.component.html",
        [
            (
                "{{ level()!.createdAt ? (level()!.createdAt | date:'mediumDate') : '' }}",
                "@if (level()!.createdAt) {\n                <app-localized-date [value]=\"level()!.createdAt\" variant=\"long\" />\n              }",
            ),
            (
                "{{ 'roastLevels.detail.lastUpdated' | transloco }} {{ level()!.updatedAt | date:'medium' }}",
                "{{ 'roastLevels.detail.lastUpdated' | transloco }}\n              <app-localized-date [value]=\"level()!.updatedAt\" variant=\"long\" />",
            ),
        ],
    ),
    (
        "features/shipping-zone/shipping-zone-detail/components/shipping-zone-detail.component.html",
        [
            (
                "{{ zone()!.createdAt ? (zone()!.createdAt | date:'mediumDate') : '' }}",
                "@if (zone()!.createdAt) {\n                <app-localized-date [value]=\"zone()!.createdAt\" variant=\"long\" />\n              }",
            ),
            (
                "{{ 'shippingZones.detail.lastUpdated' | transloco }} {{ zone()!.updatedAt | date:'medium' }}",
                "{{ 'shippingZones.detail.lastUpdated' | transloco }}\n              <app-localized-date [value]=\"zone()!.updatedAt\" variant=\"long\" />",
            ),
        ],
    ),
    (
        "features/tasting-note/tasting-note-detail/components/tasting-note-detail.component.html",
        [(
            "{{ note()!.createdAt ? (note()!.createdAt | date:'mediumDate') : '' }}",
            "@if (note()!.createdAt) {\n                <app-localized-date [value]=\"note()!.createdAt\" variant=\"long\" />\n              }",
        )],
    ),
    (
        "features/users/user-detail/components/user-detail.component.html",
        [
            (
                "{{ user()!.createdAt | date: 'medium' }}",
                '<app-localized-date [value]="user()!.createdAt" variant="long" />',
            ),
            (
                "{{ user()!.lastActiveAt ? (user()!.lastActiveAt | date: 'medium') : '—' }}",
                "@if (user()!.lastActiveAt) {\n                  <app-localized-date [value]=\"user()!.lastActiveAt\" variant=\"long\" />\n                } @else {\n                  —\n                }",
            ),
        ],
    ),
]


def component_ts(html_path: Path) -> Path:
    """The component's TypeScript file, next to the template."""
    # ".../broadcast-list.component.html" -> ".../broadcast-list.component.ts"
    stem = html_path.name[: -len(".html")]
    return html_path.with_name(stem + ".ts")


def relative_import(from_file: Path) -> str:
    target = APP / "shared/ui/localized-date/localized-date.component"
    rel = os.path.relpath(target, from_file.parent)
    return rel if rel.startswith(".") else "./" + rel


def ensure_import(ts_path: Path) -> bool:
    """Add the component to the imports of the decorator."""
    text = ts_path.read_text(encoding="utf-8")
    if "LocalizedDateComponent" in text:
        return False

    imp = relative_import(ts_path)

    # 1. the import statement, after the last import.
    lines = text.split("\n")
    last_import = max(i for i, l in enumerate(lines) if l.startswith("import "))
    lines.insert(last_import + 1, f"import {{ LocalizedDateComponent }} from '{imp}';")
    text = "\n".join(lines)

    # 2. the decorator's imports array.
    match = re.search(r"(imports:\s*\[)([^\]]*)(\])", text, re.DOTALL)
    if not match:
        raise SystemExit(f"no imports array found in {ts_path}")
    body = match.group(2)
    if "LocalizedDateComponent" not in body:
        text = text[: match.start(2)] + "\n    LocalizedDateComponent," + body + text[match.end(2) :]

    ts_path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    changed_html = []
    changed_ts = []

    for rel, pairs in REPLACEMENTS:
        html_path = APP / rel
        text = html_path.read_text(encoding="utf-8")
        original = text
        for old, new in pairs:
            if old in text:
                text = text.replace(old, new, 1)
            elif new not in text:
                # The template was already migrated (the script is idempotent).
                raise SystemExit(f"NOT FOUND in {rel}:\n  {old}")

        if text != original:
            changed_html.append(rel)
            if not DRY:
                html_path.write_text(text, encoding="utf-8")

        # The component's import is checked every time: a template that was
        # migrated in an earlier run still needs its component imported.
        ts_path = component_ts(html_path)
        if ensure_import(ts_path) and not DRY:
            changed_ts.append(str(ts_path.relative_to(ROOT)))

    print(f"templates changed: {len(changed_html)}")
    for rel in changed_html:
        print(f"  {rel}")
    print(f"components changed: {len(changed_ts)}")
    for rel in changed_ts:
        print(f"  {rel}")

    # Anything left?
    left = []
    for path in APP.rglob("*.html"):
        if "| date:" in path.read_text(encoding="utf-8"):
            left.append(str(path.relative_to(ROOT)))
    print(f"remaining `| date` usages: {len(left)}")
    for rel in left:
        print(f"  {rel}")


if __name__ == "__main__":
    main()
