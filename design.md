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

  /* --border is decorative (soft). --input is border-only and must reach 3:1;
     one token, one role: it never fills a surface. Control fills are
     transparent (light and dark alike); disabled fills use --muted. */
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

  /* Chart series. A coffee-warm ramp first (copper, ochre), then olive,
     teal, slate and plum. No cyan, no periwinkle, no lime: they read as
     "system default" next to a coffee palette. Contrast against the light
     card (#fcfaf7) is >= 3:1 for every one of them (see section 5). */
  --chart-1: #8a4b22; /* copper */
  --chart-2: #b07d2b; /* ochre */
  --chart-3: #5f7a1f; /* olive */
  --chart-4: #3b7f86; /* teal  */
  --chart-5: #55688f; /* slate */
  --chart-6: #8a5370; /* plum  */

  /* Roast level is ORDERED, so it gets a sequential ramp, not the
     categorical set. The lightest step is 2.03:1 on the light card: it is
     the one exempt value, and it always carries a 2 px card-coloured gap
     and a visible value label. */
  --roast-1: #d9ae82;
  --roast-2: #b9824f;
  --roast-3: #8a4b22;
  --roast-4: #4f2a12;

  /* The "Other" bucket: deliberately neutral, so it never reads as a
     category of its own. */
  --chart-other: #8a8178;

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

  /* The same six hues, lifted for the dark card (#1e1813). */
  --chart-1: #d9955b;
  --chart-2: #e0b45a;
  --chart-3: #a9bf6a;
  --chart-4: #6fb6bb;
  --chart-5: #93a7d1;
  --chart-6: #c58da8;

  --roast-1: #ebcba3;
  --roast-2: #d9955b;
  --roast-3: #b8723f;
  --roast-4: #9a5a2f;

  --chart-other: #8f857b;
}
```

## 2b. The chart system

One component (`shared/components/chart/chart-card.component.ts`) draws every
breakdown on the dashboard, so two charts can never disagree. The rules live
in `chart-rules.ts` and are unit-tested.

### Chart type

| Slices | Chart |
|--------|-------|
| 0 or 1 | a **stat** (a number) — a single-slice donut is not a chart |
| 2 | **bars** |
| 3–5, and the card is at least 160 px wide | **donut** |
| 6+ | **bars** |

Below three slices the ring is mostly hole; above five the slices are too
thin to read or to label.

### Bars

Sorted by value, descending. Each row carries the name, a bar, the value and
the percentage — the colour is never the only signal. A single-series chart
uses `--chart-1`: a rainbow for one number is noise.

### Donut

- The **hole is the card colour** — the slices are stroked arcs, not filled
  wedges, so the card genuinely shows through the middle. (A filled wedge
  paints over the hole, which is why the hole used to be darker than the
  card.)
- The **centre** uses `--foreground`, is the **compact** form of the number
  when it is long, and never leaves the ring.
- Every donut on the page has the **same diameter** (220 px).
- A direct label goes inside a slice only when the slice is big enough to
  hold it (>= 12 % of the ring): two overlapping percentages are worse than
  none.

### Legend

The legend is **always below the chart**, never beside it, and it lists the
**colour, the name, the value and the percentage** for every slice. A legend
that carries only a colour is a legend that relies on colour alone.

### Colour by meaning

| Meaning | Token |
|---------|-------|
| An unordered breakdown (origin, category) | the categorical set, in order |
| An **ordered** dimension (roast level) | the sequential `--roast-*` ramp, following the ROAST and not the revenue |
| One series | `--chart-1` |
| The "Other" bucket | `--chart-other` (neutral) |
| Delivered / confirmed | `--success` |
| Processing | `--info` |
| Shipped | `--chart-5` (slate) |
| Pending | `--warning` |
| Cancelled / failed | `--destructive-text` |
| Refunded | `--muted-foreground` |

A status is not a category: it has a meaning, so it never uses the
categorical palette.

### Contrast

Every swatch is at least **3:1** against the card in both modes — the
graphics target, not the text one. The one exception is `--roast-1` on the
light card (2.03:1), the lightest step of the ramp; it always carries a
2 px card-coloured gap and a visible value label. Measured in
`evidence/phase3/measurements.json`.

### No transparent or white segments

A slice is never transparent and never white. The hole is the card colour,
and a segment's colour always comes from a token.

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
| `--input` | Input/select/textarea/checkbox borders only — never a fill | Any `bg-input/*` fill, hover fills, disabled fills (use transparent / `--muted`) |

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
| "Deleted" column (Trash) | **One** column, labeled "Deleted": the relative time ("3 days ago") as plain text, with no badge. It carries `<time datetime="…">` and exposes the full local date and time as an accessible tooltip. It sorts by the real `deletedAt` timestamp, never by the rendered text. There is no separate absolute-date column — the tooltip is the absolute date |
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
| Placeholder on card (text) | 6.34 | 6.41 |

Charts on the card surface, measured (Phase 3, `evidence/phase3/measurements.json`):

| Swatch | Light | Dark |
| --- | --- | --- |
| `--chart-1` copper | 6.75 | 7.03 |
| `--chart-2` ochre | 3.61 | 9.07 |
| `--chart-3` olive | 4.89 | 8.66 |
| `--chart-4` teal | 4.60 | 7.60 |
| `--chart-5` slate | 5.58 | 7.27 |
| `--chart-6` plum | 5.91 | 6.48 |
| `--roast-1` | 2.03 (exempt) | 11.38 |
| `--roast-2` | 3.30 | 7.03 |
| `--roast-3` | 6.75 | 4.62 |
| `--roast-4` | 12.56 | 3.24 |
| `--chart-other` | 3.82 | 4.86 |
| `--success` | 5.95 | 10.08 |
| `--info` | 5.36 | 9.72 |
| `--warning` | 6.58 | 10.52 |
| `--destructive-text` | 5.93 | 7.35 |
| `--muted-foreground` | 6.34 | 6.41 |

Every one passes the 3:1 graphics threshold except `--roast-1` on the light
card (2.03:1) — the lightest step of the ramp, which always carries a 2 px
card-coloured gap and a visible value label.

Known tension: in light mode, copper and the warning color are close in lightness (perceptual distance about 5 on an OKLab x100 scale; primary vs destructive is about 10). That is why warning is only used as a soft badge or banner with an icon and a label, and primary is only used as a filled block or indicator. If you ever fill a warning button, re-check this.

## 6. Typography

- **Latin:** one neutral sans (Inter, Geist, or similar). Serif is for the storefront, not the admin.
- **Arabic:** one neutral Arabic sans with similar x-height to the Latin choice (IBM Plex Sans Arabic or Noto Sans Arabic). Test mixed-direction rows (English slug next to Arabic name) before committing.
- **Scale:** 12 / 13 / 14 (body) / 16 / 20 / 24. Two weights only: 400 and 500.
- **Form controls:** 14px control text at and above the `md` breakpoint (768px), and 16px below it. The 16px is not decoration: iOS Safari auto-zooms the whole page when a focused control's text is under 16px, so shrinking mobile control text costs the reader the zoom lock. The paired line height (20px at 14px, 24px at 16px) travels with the size.
- **Headings** are sentence case. Table headers are 12px, `--muted-foreground`, not uppercase in Arabic.
- Numbers in tables: tabular figures.

## 7. Spacing, radius, elevation, motion

- **Spacing:** 4px base, steps of 4 and 8. Page header to toolbar: 16. Toolbar to table: 12. (Tabs share the toolbar row, so there is no separate tabs-to-toolbar step.)
- **Radius:** `--radius` 8px for controls, 12px for cards, full for badges. Documented exceptions, because these are switch geometry rather than control-scale cases: the checkbox and radio keep a 4px radius (8px on a 16px box is a circle, which is a different control entirely), and the switch keeps its own pill radius and its own 32x18 track. None of the three takes `--control-height`.
- **Elevation:** flat. Borders instead of shadows. A shadow only for popovers and dialogs.
- **Motion:** `transition-colors` 150ms and a small press scale on buttons. No decorative animation.
- **The one functional transition:** Active ↔ Trash is a toggle *inside* one page, not a navigation, so the swap crosses over instead of cutting — the view region and the controls that come and go with it fade across (140ms out / 180ms in, 6px vertical). The page title, the tabs and the search stay anchored. Driven by `BaseListComponent.viewPhase()` painted as `data-view-phase` on the panel root, with `.view-fade` on the parts that change; the phase advances on `animationend`, so the durations live only in `styles/index.css`. `prefers-reduced-motion` gets the instant swap.
- **The sliding pill (the "layoutId" element):** the selected state on the lifecycle tabs is one pill that travels between Active and Trash and resizes to fit each label, so the selection reads as a single persistent element moving rather than two backgrounds cross-fading. It is the same shared-element idea as Framer Motion's `layoutId`, implemented for a same-page toggle: the pill is positioned by JS with `getBoundingClientRect` (so it is RTL-safe) and animated with a CSS transition on `left`/`top`/`width`/`height`. A `ResizeObserver` keeps it aligned when the count badges grow, the fonts load, or the viewport resizes.

## 8. Layout rules

- No horizontal scroll on wide screens. Set column widths, hide secondary columns (Created At) on narrow screens, keep the Actions column sticky at the inline end.
- Hide pagination when there is one page.
- Header holds global search and notifications. Theme and language live in the avatar menu.
- The avatar looks identical in sidebar and header.
- Sidebar groups are labeled (Operations, Content, Catalog, Settings) and collapsible. Each section is its own list, so the group labels and their links are real list items.
- The group micro-label is the one place Latin text is uppercased. Arabic is not: `ltr:uppercase ltr:tracking-wider` only, because letter-spacing pulls apart Arabic letterforms that are meant to join. The collapse chevron follows the layout direction (`ltr:`/`rtl:` variants), not the active language, and inner links indent with `ps-6` — the inline start — so both land correctly in Arabic.

## 9. Switching to the neutral-espresso option

If copper feels too loud, replace only these tokens. Nothing else changes.

```css
:root      { --primary: #2b1d16; --primary-foreground: #faf8f5; --ring: #2b1d16; --sidebar-primary: #2b1d16; }
:root.dark { --primary: #f1e9df; --primary-foreground: #16110f; --ring: #f1e9df; --sidebar-primary: #f1e9df; }
```

In that variant, give the active tab underline and the sidebar active marker a small caramel accent (for example `#b8742a` in light, `#d9964a` in dark) so the brand still shows somewhere.

## 10. Page patterns

### List page (DataTable)

- Header: title and one primary button on the inline end. No subtitle that repeats the tab counts.
- Tabs share the toolbar row — they are not a separate row. `Active (n) | Trash (n)` sits at the inline start, the controls at the inline end. Counts update immediately after every action.
- Toolbar order at the inline end: status filter (Active tab only), local search ("Search in categories"), view toggle (neutral, only on lists that actually have a working grid view), Columns menu. The filter comes before the search deliberately: the group is right-aligned, so putting the filter first means the search and the Columns menu do not shift when the filter disappears on the Trash tab. There is no refresh button — lists refetch on window focus and after every mutation. The global search placeholder stays "Search everything".
- Trash tab: a single `Deleted` column of relative time replaces `Created At` (see section 4); actions are Restore and Delete permanently, with no Edit; warning banner; empty state "Trash is empty" with one line of explanation.
- Tab, search, filter, and page live in the URL (`?view=trash`). Switching tabs resets the page and the selection and keeps the search text. If the current tab has no results but the other tab does, show "No results in Active. 1 result in Trash." with a link that switches tab.
- Bulk actions are per tab: Move to trash in Active; Restore and Delete permanently in Trash. Selection never mixes tabs.
- Secondary columns (Created At) are hidden on narrow screens and available from a Columns menu.
- Arabic name column: `dir="rtl"`, `text-align: start`, and the header uses the same alignment as the cells.
- **Both name columns get real width.** The other language's name is an entity name, not a slug: at a slug-sized box (132px) a real Arabic name was cut to ~17 characters while the same-language name column absorbed hundreds of px of empty space. `name_ar` is 28% in the shared `columnWidths` map (nine lists build a `name_${lang}` column); `name_en` stays unsized so it keeps absorbing the leftover. `createdAt`/`updatedAt`/`deletedAt` are 120px, not 104px — at 104px the header label plus its sort arrow did not fit the padding and rendered clipped.
- Slug is plain text with an underline on hover. It is not link-colored.
- Row actions: one visible action, plus a kebab menu when there are more than two.

### Detail page

- Header: back link (`← Categories`), an h1 with the name, the status badge, and the actions. Slug, ID, and created/updated dates go in a small side panel.
- Image panel: about one third of the width, with an upload button in the empty state. Not a half-page empty box.
- Fields are always editable, and a save bar appears when the form is dirty ("Unsaved changes", Save, Discard), instead of an Edit toggle.
- English and Arabic sit side by side on wide screens and stack on narrow ones. Arabic fields use `dir="rtl"` and a translated label.
- Delete is a neutral "Move to trash". The dialog states the impact: "This category has N products." What happens to them (hidden, reassigned, or blocked) is a backend decision and must be written explicitly in the UI.
- A deleted category opened directly shows the warning banner and a Restore button, with read-only fields.
- Products section: header with the count, a "View all" link to Products filtered by this category, and an optional "Add product". The products render as the shared DataTable — the same table the catalog lists use, with the same pagination footer (range line plus a per-page select of 10/20/50, default 20) — never as a card grid, and there is no grid/list view toggle. The row's name is its single control and links to the product editor (`/dashboard/products/{slug}/edit`, the products list's own Edit target) — this app has no product detail page, so any other target is a dead link. A failed fetch states the failure and offers Retry; it never renders the empty-category copy.
- Badges appear only for the exception (for example "Inactive" when most products are active). Icons such as the star have a tooltip or label. Discount percentages use neutral or success styling, never destructive red.
- If every product in a category shows "Inactive", verify the data mapping before trusting the UI.

### Dashboard home

The dashboard is the page a store owner opens first, so it answers "how is
the business doing?" in one screen and one scroll.

**The order, and why**

1. **Title and subtitle** — above everything, not sticky.
2. **One toolbar, sticky**: the range (a segmented control), the range in
   effect, the range it is compared against ("vs ..."), and the export. The
   range is a `radiogroup` and the selection is announced through an
   `aria-live` region, so a change is heard and not only drawn.
3. **Four KPI cards** — total revenue, orders, new customers, average order
   value. Eight equal cards would say that nothing matters. The value is
   tabular figures at 30 px; the delta is a chip (arrow + percent + word,
   never colour alone); a sparkline is drawn only when the API has the real
   daily series.
4. **A compact strip** — repeat rate, refund rate, coffee sold, online
   users. Online users is a LIVE indicator (a pulsing dot), not a period
   KPI.
5. **The attention strip** — one line (48 px) when everything is clear; a
   row per actionable item with a count and a link when it is not.
6. **The revenue chart, full width** — the page's one chart that earns the
   space. Bars, not a line: daily revenue is a set of discrete values, and a
   line draws a slope between them, so one spike reads as a trend that never
   happened.
7. **Three two-column rows** — Revenue by | Orders, Top products | Recent
   orders, Low stock | Devices. Cards in a row share one height, and a row is
   never more than 1.5x the content it holds.

**Rules that apply to every widget**

- The header is the same everywhere: title (sentence case) + range scope
  ("Last 30 days" or "All time") + an optional action. The scope never
  wraps: the title truncates, the scope is `shrink-0`.
- Three states, owned by one component: a **skeleton** with the shape of the
  content, an **error** with a retry, and an **empty** state. A widget is
  never blank and never silently missing.
- Money is formatted in exactly one place (`| money`), fed by the store
  currency setting. A range is a property of the data, so it is stated, not
  implied.
- A count is rendered by its plural category, in the language of the
  reader. Arabic counts a noun by the number in front of it — 30 takes the
  singular ("يومًا") and 8 takes the plural ("مبيعات").
- A KPI card and a list widget are REAL LINKS to the list behind them,
  pre-filtered. A card is not a div with a click handler.
- The range lives in the URL (`?days=N`): it survives a refresh, a shared
  link and the browser's back button.

**Target**: 1700 px at 1440. It was 2390 px before this work.

## 11. Accessibility and states

- Tabs use `role="tablist"` with arrow-key navigation. Icon-only buttons have an `aria-label`. Tooltips never cover other controls.
- Focus management: after "Move to trash", focus moves to the next row; after "Restore", the same; if the list becomes empty, focus moves to the tab.
- Toasts use `role="status"`, and Undo is reachable by keyboard.
- Every list has designed loading (skeleton rows), empty, and error states. Keep the table mounted while loading, with skeleton rows inside it, so sort and filter state survive.
- A missing translation key must fail loudly in development (console error or a test). Raw keys like `categories.detail.back` must never reach the screen.
- Form fields: every control is associated with its own label (`for`/`id`), and its validation message is linked to it with `aria-describedby` plus `role="alert"`. A red border alone tells a screen-reader user nothing.
- A field set that appears on more than one surface is defined once. The bilingual name/description fields are the first case: the list's create/edit dialog and the detail page render the same `app-category-form`, so labels, `dir` switching and error handling cannot drift apart again.
- Respect `prefers-reduced-motion`. The skeleton shimmer and the "online now"
  dot both stop under the media query.
- The **focus ring must be visible in dark mode too**. Prove it with a
  keyboard Tab walk, not with a class name: `:focus-visible` does not match a
  programmatic `.focus()`, so a programmatic check reports false failures.
  Measured in `evidence/phase5/measurements.json`: 0 of 69 focusable
  controls without a ring, in light and in dark.
- A **chart carries a text summary** (`role="img"` + `aria-label`), and a
  **legend never relies on colour alone**: every row carries the name, the
  value and the percentage.
- The page must work at 200 % zoom (a 720 px viewport): no horizontal
  scroll and no clipped text.

## 12. Implementation checklist

- [ ] Tokens live in one file. No raw hex in components.
- [ ] Remove every use of the old green from non-primary contexts (view toggle, slug links, status dots).
- [ ] Success badges use text labels, not just a dot.
- [ ] Focus ring visible on the primary button in both modes.
- [ ] Check every table in light, dark, LTR, and RTL.
- [ ] Re-run the contrast table if any token changes.
- [ ] No raw i18n keys on screen in either language.
- [ ] Tab, search, filter, and page survive a refresh (URL state).
- [ ] Arabic fields and columns are `dir="rtl"` and aligned consistently.
- [ ] Detail page: save bar, delete-impact message, and a Trash-state banner exist.
- [ ] Every form control has a `for`/`id` label link and an `aria-describedby` error link.
- [ ] Repeated field sets are one component, not two copies.
- [ ] Loading, empty, and error states exist for every list.

## 13. The order pages

The orders list and the order detail page are the two pages where the
numbers are the product. The rules below are what the pages are built on.

### 13.1 One status system

The status model lives in ONE place
(`features/orders/models/order-status.model.ts`): the enums, the allowed
transitions and the badge kind of every status. The list, the detail page,
the status dialog, the progress tracker and the export all read from it, so
a status can never mean two things in two places.

| Order status | Badge | Chart slice |
|---|---|---|
| `PENDING` | warning | `--warning` |
| `CONFIRMED` | info, the **pale** tint | `--chart-4` |
| `PROCESSING` | info, the **full** tint | `--info` |
| `SHIPPED` | `--chart-5` on a tint of itself | `--chart-5` |
| `DELIVERED` | success | `--success` |
| `CANCELLED` | destructive-text | `--destructive-text` |

| Payment status | Badge |
|---|---|
| `PAID` | success |
| `PENDING` | warning |
| `FAILED` | destructive-text |
| `REFUNDED` | muted |

Two rules that came out of the work:

- **Confirmed and Processing share the info hue on purpose** — they are
  adjacent stages of the same funnel — so they are told apart by the
  STRENGTH of the tint, not by a second hue. Both carry their text.
- **A chart needs six distinguishable slices and a badge does not.** The
  chart gives Confirmed `--chart-4` (the nearest distinguishable neighbour
  of the same hue family) because `--info` already belongs to Processing.
  The badge keeps the ticket's mapping exactly.

**One word per concept.** A status used to have two words: the list read
`orders.statuses.*` and the badge read `common.statuses.*`, so a cancelled
order said one thing in the list and another on the badge of the same row.
The vocabulary is pinned by a unit test (`i18n-keys.spec.ts`, "orders
glossary").

**"Refunded" is a payment flag, not a status.** A refunded order keeps the
fulfilment status it reached, and the net paid is *unknown* (not zero)
until the backend records the refund amount.

### 13.2 The progress tracker

`Placed → Confirmed → Processing → Shipped → Delivered`, drawn from the
order's CURRENT status alone:

- the steps before it are done (a tick on a success fill);
- the current step is the one the order is at (the brand fill);
- the steps after it are **muted** — a future step is never drawn as if it
  had happened;
- a **cancelled** order leaves the chain: the chain is replaced by the
  destructive branch, with the reason when the store recorded one.

It needs no history endpoint, so it works today; the activity history
below it is what the backend contract adds.

### 13.3 The order list

- The columns are `select · Order # · Customer · Items · Order status ·
  Payment status · Method · Total · Created at · Actions`, and the raw id
  column is not one of them — the order number is the identifier a customer
  quotes.
- The order number is a **real anchor** to the order's page, and the whole
  row is clickable (the click is ignored on anything interactive inside the
  row).
- The **Total** is the one end-aligned column: it opts in with
  `meta: { align: 'end' }`, and the header switches with the cell so the
  sort label still sits over its values.
- The **Method** column is budgeted for the longest label in both
  languages ("Cash on delivery" / "الدفع عند الاستلام") and is never
  truncated.
- The **Created at** cell shows the date and the time, the time on its own
  line so the column stays narrow, with the relative time in the tooltip
  and the absolute value in the `datetime` attribute.
- **The cards count the whole set, never the page.** Each card says what
  it counts: "All orders" (every order in the store), "Matching filters"
  (the orders the active filters select), and the status cards within the
  matching set.
- **The state lives in the URL**: the status tab, the filters, the search,
  the sort, the page and the page size. A shared link, a refresh and the
  back button all work.
- The **sort is the backend's** — the table uses `manualSorting` and the
  page maps the display column to the `Order` entity's own property before
  it asks.

### 13.4 The order detail page

Two columns over the full page width: the order on the left, the facts
about it on the right.

- **The header** carries the back arrow, the order number, both badges and
  the created date and time. The actions are at the opposite end: *Update
  status* (the one primary), *Print invoice*, *Resend email* and the
  overflow menu with *Cancel* and *Refund*.
- **The main column**: Items, Totals, the Timeline card and Internal notes.
- **The sidebar**: Customer, Shipping address, Payment, Shipment and Tags.
- **The totals card** shows Subtotal, Shipping, Discount, Total and Net
  paid, and it says so when the recorded total does not match the items —
  a store whose recorded total disagrees with its own items has a data
  problem, and hiding it would hide the problem.
- **No card is taller than 1.5× its content**, the cards in a row share
  their height, and nothing is clipped at any width.

### 13.5 The status dialog

- It offers **only** the transitions the backend's state machine allows: a
  delivered or a cancelled order offers nothing, a stage is never skipped
  and a status never moves backwards.
- Cancelling has its own dialog, with a **required reason** and the
  consequence stated.
- A control the backend cannot honour is **disabled with the reason on
  it** (the e-mail resend, the refund). A button that silently does nothing
  is worse than a button that says it cannot.

### 13.6 A pinned first column

A table that is wider than the screen scrolls, and a reader who has
scrolled to the price must still see which order the price belongs to. The
first data column (and the select checkbox before it) is **pinned to the
inline start** — the right in Arabic — so it stays where the eye expects
it.
