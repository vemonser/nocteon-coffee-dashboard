# Nocteon Dashboard: design.md

Design-system spec for the admin dashboard. Warm-neutral surfaces, one copper-brown primary, and semantic colors that are never the brand color.

## 1. Principles

1. **The dashboard is a tool, not a brand page.** Calm warm neutrals, one primary color, and nothing decorative. Brand personality belongs to the storefront.
2. **One hue for the brand, in both modes.** Light and dark use the same copper hue (OKLCH hue about 50 to 60). Only lightness changes. The brand never switches color between modes.
3. **Brand and meaning never share a color.** Copper is only for "the main action here" and "where you are". Success, danger, warning, and info have their own tokens.
4. **Color never carries meaning alone.** Every status has a text label. Warning always has an icon.
5. **Tokens are semantic.** Components read `--primary`, `--destructive`, and so on, never a hex value or a color name like `--brown-500`.
6. **RTL is a first-class mode.** Use logical properties (`ms-*`, `ps-*`, `text-start`). Arabic content fields get `dir="rtl"`.

## 2. Color tokens

Same variable names as the shadcn/spartan convention, so existing components keep working.

```css
:root {
  color-scheme: light;

  --background: #faf8f5;
  --foreground: #231a14;

  --card: #ffffff;
  --card-foreground: #231a14;
  --popover: #ffffff;
  --popover-foreground: #231a14;

  /* Brand: roasted copper. White text: 6.75:1 */
  --primary: #8a4b22;
  --primary-foreground: #ffffff;

  --secondary: #f1ece5;
  --secondary-foreground: #231a14;
  --muted: #f6f2ed;
  --muted-foreground: #6b5d52;
  --accent: #f1ece5;
  --accent-foreground: #231a14;

  /* Semantic states: never the brand color */
  --destructive: #b83232;
  --destructive-foreground: #ffffff;
  --destructive-soft: #fceae8;
  --destructive-text: #b83232;

  --success: #137333;
  --success-soft: #e7f5ec;
  --success-foreground: #ffffff;
  --warning: #7a5700;
  --warning-soft: #fef3c7;
  --info: #0e7490;
  --info-soft: #e0f4f8;

  /* --border is decorative (soft). --input must reach 3:1 (form controls). */
  --border: #e7dfd5;
  --input: #978878;
  --ring: #8a4b22;

  --sidebar: #fcfaf7;
  --sidebar-foreground: #231a14;
  --sidebar-primary: #8a4b22;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f1ece5;
  --sidebar-accent-foreground: #231a14;
  --sidebar-border: #e7dfd5;
  --sidebar-ring: #8a4b22;

  --chart-1: #8a4b22;
  --chart-2: #0e7490;
  --chart-3: #4f6ba0;
  --chart-4: #5f7a1f;
  --chart-5: #8b4a7b;

  --radius: 0.5rem;
}

:root.dark {
  color-scheme: dark;

  --background: #14100d;
  --foreground: #f5efe8;

  --card: #1e1813;
  --card-foreground: #f5efe8;
  --popover: #1e1813;
  --popover-foreground: #f5efe8;

  /* Same copper hue, lifted in lightness. Dark text on it: 7.44:1 */
  --primary: #d9955b;
  --primary-foreground: #1a110a;

  --secondary: #2a221c;
  --secondary-foreground: #f5efe8;
  --muted: #191410;
  --muted-foreground: #a89a8c;
  --accent: #2a221c;
  --accent-foreground: #f5efe8;

  /* --destructive is a fill (white text). --destructive-text is for text/icons on dark surfaces. */
  --destructive: #c94242;
  --destructive-foreground: #ffffff;
  --destructive-soft: #3a1a18;
  --destructive-text: #f28b82;

  --success: #4ade80;
  --success-soft: #14291c;
  --success-foreground: #06240f;
  --warning: #fbbf24;
  --warning-soft: #33280a;
  --info: #22d3ee;
  --info-soft: #0d2b31;

  --border: #3a2f27;
  --input: #7d6f62;
  --ring: #d9955b;

  --sidebar: #181310;
  --sidebar-foreground: #f5efe8;
  --sidebar-primary: #d9955b;
  --sidebar-primary-foreground: #1a110a;
  --sidebar-accent: #231c16;
  --sidebar-accent-foreground: #f5efe8;
  --sidebar-border: #3a2f27;
  --sidebar-ring: #d9955b;

  --chart-1: #d9955b;
  --chart-2: #3db8d4;
  --chart-3: #8fa8e0;
  --chart-4: #a3c45a;
  --chart-5: #d08bc0;
}
```

## 3. Where each token is allowed

| Token | Allowed | Never |
| --- | --- | --- |
| `--primary` | The one filled primary button per view, active tab underline, active sidebar item marker, focus ring, links | Status badges, success or warning meaning, toggle-selected states of secondary controls |
| `--secondary` / `--accent` | Secondary buttons, hover rows, selected view-toggle | Anything that must stand out |
| `--destructive` | **Permanent** delete only, validation errors | Soft delete ("Move to trash"), discounts, decoration |
| `--success` | "Enabled/Active" status badge, success toast | Buttons, "Restore" |
| `--warning` | "Deleted/Trash" banner and badge (always with an icon) | Primary actions |
| `--info` | Neutral notices, help text | Actions |
| `--border` | Dividers, card edges | Input edges (use `--input`) |

Rules:
- **One primary-filled button per view.** Everything else is secondary or ghost.
- Row actions use secondary/ghost styling. Primary-filled buttons never appear inside table rows.
- Hover and selected states come from `--accent`, never from a tinted primary.

## 4. Soft delete and status mapping

Two separate concepts. Do not merge them.

| Concept | Control | Values |
| --- | --- | --- |
| Lifecycle (`deletedAt`) | Tabs above the table: `Active (n)` / `Trash (n)` | active, deleted |
| Status (`isActive`) | Filter inside the Active tab only | All, Enabled, Disabled |

| Element | Style |
| --- | --- |
| "Enabled" badge | `--success-soft` background, `--success` text, text label |
| "Disabled" badge | `--muted` background, `--muted-foreground` text |
| "Deleted" badge | `--warning-soft` background, `--warning` text, warning icon, relative time ("3 days ago") |
| "Move to trash" | Ghost or secondary, neutral, no confirm dialog, Undo toast for about 6 seconds |
| "Restore" | Secondary (neutral). Not green, not primary |
| "Delete permanently" | Destructive outline, requires typing the slug to confirm |
| Trash banner | `--warning-soft`, one sentence: items are hidden from the store |

## 5. Contrast audit (computed, WCAG 2.x)

Text needs 4.5:1. UI components and focus indicators need 3:1.

| Pair | Light | Dark |
| --- | --- | --- |
| Foreground on background | 16.11 | 16.58 |
| Foreground on card | 17.08 | 15.39 |
| Muted text on background | 5.98 | 6.91 |
| Muted text on card | 6.34 | 6.41 |
| Primary-foreground on primary | 6.75 | 7.44 |
| Primary as link text on background | 6.37 | 7.57 |
| Destructive-foreground on destructive | 5.93 | 4.84 |
| Destructive text on soft background | 5.10 | 6.56 |
| Success on success-soft | 5.29 | 8.84 |
| Warning on warning-soft | 5.91 | 8.68 |
| Info on info-soft | 4.71 | 8.26 |
| Ring on background (UI) | 6.37 | 7.57 |
| Input border on card (UI) | 3.44 | 3.62 |

Charts on the card surface: light 4.89 to 6.75, dark 6.81 to 8.87. All pass the 3:1 graphics threshold.

Known tension: in light mode, copper and the warning color are close in lightness (perceptual distance about 5 on an OKLab x100 scale; primary vs destructive is about 10). That is why warning is only used as a soft badge or banner with an icon and a label, and primary is only used as a filled block or indicator. If you ever fill a warning button, re-check this.

## 6. Typography

- **Latin:** one neutral sans (Inter, Geist, or similar). Serif is for the storefront, not the admin.
- **Arabic:** one neutral Arabic sans with similar x-height to the Latin choice (IBM Plex Sans Arabic or Noto Sans Arabic). Test mixed-direction rows (English slug next to Arabic name) before committing.
- **Scale:** 12 / 13 / 14 (body) / 16 / 20 / 24. Two weights only: 400 and 500.
- **Headings** are sentence case. Table headers are 12px, `--muted-foreground`, not uppercase in Arabic.
- Numbers in tables: tabular figures.

## 7. Spacing, radius, elevation, motion

- **Spacing:** 4px base, steps of 4 and 8. Page header to tabs: 16. Tabs to toolbar: 16. Toolbar to table: 12.
- **Radius:** `--radius` 8px for controls, 12px for cards, full for badges.
- **Elevation:** flat. Borders instead of shadows. A shadow only for popovers and dialogs.
- **Motion:** `transition-colors` 150ms and a small press scale on buttons. No decorative animation.

## 8. Layout rules

- No horizontal scroll on wide screens. Set column widths, hide secondary columns (Created At) on narrow screens, keep the Actions column sticky at the inline end.
- Hide pagination when there is one page.
- Header holds global search and notifications. Theme and language live in the avatar menu.
- The avatar looks identical in sidebar and header.
- Sidebar groups are labeled (Operations, Content, Catalog, Settings) and collapsible.

## 9. Switching to the neutral-espresso option

If copper feels too loud, replace only these tokens. Nothing else changes.

```css
:root      { --primary: #2b1d16; --primary-foreground: #faf8f5; --ring: #2b1d16; --sidebar-primary: #2b1d16; }
:root.dark { --primary: #f1e9df; --primary-foreground: #16110f; --ring: #f1e9df; --sidebar-primary: #f1e9df; }
```

In that variant, give the active tab underline and the sidebar active marker a small caramel accent (for example `#b8742a` in light, `#d9964a` in dark) so the brand still shows somewhere.

## 10. Implementation checklist

- [ ] Tokens live in one file. No raw hex in components.
- [ ] Remove every use of the old green from non-primary contexts (view toggle, slug links, status dots).
- [ ] Success badges use text labels, not just a dot.
- [ ] Focus ring visible on the primary button in both modes.
- [ ] Check every table in light, dark, LTR, and RTL.
- [ ] Re-run the contrast table if any token changes.