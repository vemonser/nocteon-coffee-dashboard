# Reviews & Contact Messages — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Reviews and Contact Messages pages as the same console the Orders page already is — the same shared table, dialog, date helper, status tokens and glossary — and fix every defect the screenshot review found.

**Architecture:** Two pages rebuilt on the shared vocabulary, plus four shared additions the pages need: an initials avatar, one relative-time helper, three new column types in the shared table (its cell switch is CLOSED — a page cannot add a column), and an `approved` status kind. The Reviews page becomes a moderation console (tabs with counts, a statistics strip, a table by default, a grid by choice, bulk approve, a side-panel drawer). The Contact Messages page becomes a read-and-reply console (tabs with counts, a preview line per row, a clickable row, a dialog with the reply box and the recorded email state).

**Tech Stack:** Angular 22 (standalone components, signals), Tailwind CSS 4, Spartan NG headless (`@spartan-ng/helm/*`), TanStack Angular Table, Transloco, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-reviews-contact-messages-design.md` (read §3 and §5 before starting).

**Companion plan:** `docs/superpowers/plans/2026-10-20-reviews-contact-messages-backend.md` (in the `nocteon-backend` repository). **The backend plan runs FIRST** — this plan consumes endpoints that plan produces. The exact API shapes are listed in the Global Constraints.

---

## Global Constraints

- **Repository:** `/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard`. Branch: `feature/reviews-messages-console` (already created; the spec is committed on it).
- **The backend plan must have landed first.** This plan needs:
  - `GET /api/dashboard/reviews?productSlug=&search=&isApproved=&isVerified=&minRating=&createdFrom=&createdTo=&page=&size=&sort=&direction=` → `ApiResponse<PageResponse<ReviewResponse>>`
  - `GET /api/dashboard/reviews/stats` → `ApiResponse<{ total, pending, approved, averageRating, distribution: Record<'1'|'2'|'3'|'4'|'5', number> }>`
  - `PATCH /api/dashboard/reviews/approval` body `{ ids: number[], approved: boolean }` → `ApiResponse<{ updated: number }>`
  - `ReviewResponse` gains `orderId: string | null` and `orderNumber: string | null`
  - `ContactResponse` gains `emailStatus: 'NONE' | 'PENDING' | 'SENT' | 'FAILED' | 'DEAD'`
  - `POST /api/dashboard/contact-messages/{id}/resend-email` → `ApiResponse<ContactResponse>`
  - The `reply` endpoint keeps its path and body; its response now carries `emailStatus`.
- **All components are standalone.** No NgModule. `inject()` over constructor injection. Signals over RxJS for component state.
- **The shared table's cell switch is CLOSED.** `data-table.component.html` renders a cell through a `@switch (cell.column.id)` with no content projection and no renderer registry. **A page CANNOT add a new column type.** A new column id must be added to the shared switch (Task 3) — that is what the Orders page did with `items`, `customer` and `paymentMethod`.
- **Column headers are translated through `DataTableComponent.HEADER_KEYS`, keyed by the RAW header string.** A header with no entry stays English inside an Arabic page. Every new header needs an entry (Task 3).
- **`table-fixed` ignores content width.** Every column needs a budget, and **exactly ONE column per table is left unsized** so it absorbs the remainder. The unsized one must be the primary identifier.
- **Text cells are start-aligned, numbers end-aligned** (`meta: { align: 'end' }`), and headers are **sentence case** — never `uppercase`.
- **Dates go through `<app-localized-date>`**, never Angular's `| date`. The Angular `| date:'short'` is what produced `10/20/26`.
- **A date is never stringified.** `app-localized-date` lays the parts out as DOM-ordered spans with `dir="ltr"`; a single flattened string gets reordered by the bidi algorithm.
- **Mixed-direction content is wrapped in `<bdi>`.** A Latin review comment inside an Arabic page must not have its punctuation moved to the front — that is the `.Not my favorite roast level` defect.
- **RTL is first class:** logical properties only (`ms-*`, `ps-*`, `text-start`, `inset-inline-end`). No `left`/`right`/`text-left`.
- **The `hasPermission` directive** gates actions: `*hasPermission="'review:moderate'"` and `*hasPermission="'review:delete'"`.
- **Status colours come from the shared tokens** — `bg-success-soft text-success`, `bg-warning-soft text-warning`, `bg-destructive-soft text-destructive-text`, `bg-muted text-muted-foreground`. Never a raw hex, never a one-off Tailwind colour.
- **One primary-filled button per view.** Row actions are secondary/ghost.
- **Every list has designed loading, empty and error states.** The table keeps its skeleton rows mounted while loading.
- **Transloco only.** No literal user-facing string in a template. `public/assets/i18n/en.json` and `ar.json` must define the same key set — the `i18n-keys.spec.ts` test fails otherwise.
- **The glossary is law:** one concept, one term, in both languages, everywhere. Rows 10–22 of `docs/glossary.md` are new and must be pinned in `i18n-keys.spec.ts`.
- **Unit tests:** `npm run test:unit` (Vitest, via `ng test`). **E2E:** `npm test` (Playwright) — needs the dev server on `:4200`, the backend on `:8080` and `.env.local` credentials. Both servers are already running in this environment.
- **Never commit a secret.** `.env.local` is gitignored.

---

## Review Focus

The five failure modes most likely to bite a person using these two pages, most likely first. Each is pinned by a test in the task that owns the code.

1. **An English review comment inside the Arabic page loses its punctuation to the front** (`.Not my favorite roast level`). The comment cell must be direction-isolated, not merely left-aligned.
2. **A pending review is invisible among the settled ones.** The default tab is Pending, the count is live, and the Approve action is a labelled button on the row — never an unlabelled icon.
3. **"Send reply" implies the customer was emailed when it was not.** The success toast appears ONLY when the recorded email status is `SENT`; every other status says what actually happened and offers "Send again".
4. **A date renders as `10/20/26` and is misread.** Dates go through the shared helper, in day-month-year order, with the absolute value in the tooltip.
5. **A sidebar item keeps a focus ring after a click.** The ring is `focus-visible:ring-2` on a link that keeps DOM focus after an SPA navigation. The focus must move to the page heading on every navigation, and stay visible for keyboard users.

---

## File Structure

| File | Responsibility |
|---|---|
| `shared/ui/user-avatar/user-avatar.component.ts` | **new** — the avatar: the picture when there is one, the initial when there is not. |
| `shared/ui/side-panel/side-panel.component.ts` | **new** — the inline-end side panel: backdrop, focus trap, Escape, focus restore. |
| `core/i18n/relative-time.ts` | **new** — the ONE relative-time implementation. |
| `shared/components/data-table/data-table.component.{ts,html}` | Gains the `reviewer`, `rating` and `comment` cells, the header keys and the column widths. |
| `shared/components/data-table/main-cell/main-cell.component.ts` | Gains `showSlug` — a cell that shows only a name. |
| `shared/ui/status-badge/status-badge.component.ts` | Gains the `approved` kind. |
| `features/layout/layout.component.{ts,html}` | Moves the focus to the page heading on every navigation. |
| `features/reviews/models/review.model.ts` | The response shape, with the order fields. |
| `features/reviews/services/review.service.ts` | The list, the statistics and the bulk approval. |
| `features/reviews/components/review-list.component.{ts,html}` | **new** — the moderation console. Replaces `review.component.{ts,html}`. |
| `features/contact-messages/models/contact-message.model.ts` | The response shape, with `emailStatus`. |
| `features/contact-messages/services/contact-message.service.ts` | The list, the reply and the resend. |
| `features/contact-messages/components/contact-messages-list.component.{ts,html}` | The read-and-reply console. |
| `public/assets/i18n/{en,ar}.json` | Every new string, in both languages. |
| `docs/glossary.md` | Rows 10–22. |
| `core/i18n/i18n-keys.spec.ts` | The new glossary pins. |

---

### Task 1: The shared initials avatar

**Files:**
- Create: `src/app/shared/ui/user-avatar/user-avatar.component.ts`
- Test: `src/app/shared/ui/user-avatar/user-avatar.component.spec.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `app-user-avatar` with `src = input<string | null>(null)`, `name = input.required<string>()`, `size = input<'sm' | 'md'>('md')`.
  - `md` → a 32 px circle; `sm` → a 24 px circle.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/ui/user-avatar/user-avatar.component.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { UserAvatarComponent } from './user-avatar.component';

/**
 * The avatar falls back to the initial.
 *
 * The review seed gives every user an EMPTY avatar URL, so the old markup
 * rendered a picture icon that read as a broken image. An initial is never
 * broken.
 */
describe('UserAvatarComponent', () => {
  it('exposes the first letter of the name as the initial', () => {
    const component = new UserAvatarComponent();

    expect(component.initial('Ahmed Hassan')).toBe('A');
    expect(component.initial('sara')).toBe('S');
  });

  it('falls back to a neutral letter when the name is empty', () => {
    const component = new UserAvatarComponent();

    expect(component.initial('')).toBe('?');
    expect(component.initial(null)).toBe('?');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --include='**/user-avatar.component.spec.ts'`

Expected: FAIL — the component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/shared/ui/user-avatar/user-avatar.component.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The avatar: the picture when there is one, the initial when there is not.
 *
 * The seed gives every user an EMPTY avatar URL, and the old markup rendered
 * a picture icon for it — which reads as a broken image rather than as a
 * person. An initial is never broken, and it matches how the dashboard
 * renders the recent-orders avatars.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (src()) {
      <img
        [src]="src()"
        [alt]="name()"
        [class]="sizeClass() + ' rounded-full object-cover'"
      />
    } @else {
      <span
        [class]="sizeClass() + ' flex items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'"
        [attr.aria-label]="name()"
        >{{ initial(name()) }}</span
      >
    }
  `,
})
export class UserAvatarComponent {
  readonly src = input<string | null>(null);
  readonly name = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly sizeClass = computed(() =>
    this.size() === 'sm' ? 'size-6' : 'size-8',
  );

  /** The first letter, uppercased. Never empty — a blank name is a '?'. */
  initial(name: string | null | undefined): string {
    const first = (name ?? '').trim().charAt(0);
    return first ? first.toUpperCase() : '?';
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --include='**/user-avatar.component.spec.ts'`

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/user-avatar
git commit -m "feat(ui): the avatar falls back to an initial

The seed gives every user an empty avatar URL, and the old markup rendered
a picture icon for it — which reads as a broken image rather than as a
person."
```

---

### Task 2: One relative-time helper

**Files:**
- Create: `src/app/core/i18n/relative-time.ts`
- Modify: `src/app/shared/components/data-table/data-table.component.ts`
- Test: `src/app/core/i18n/relative-time.spec.ts` (new)

**Interfaces:**
- Consumes: `Language` from `src/app/core/i18n/language.ts`.
- Produces: `formatRelativeTime(value: unknown, lang: Language): string` — "Just now" / "الآن" under 60 seconds, then `Intl.RelativeTimeFormat` with units year → minute. `DataTableComponent.relativeTime(value)` delegates to it, so there is ONE implementation.

- [ ] **Step 1: Write the failing test**

Create `src/app/core/i18n/relative-time.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './relative-time';

/**
 * The relative time is what a reader scans, so it must be short and in the
 * right language. The absolute value lives in the tooltip, not here.
 */
describe('formatRelativeTime', () => {
  it('says "Just now" for anything inside a minute', () => {
    const now = new Date().toISOString();

    expect(formatRelativeTime(now, 'en')).toBe('Just now');
    expect(formatRelativeTime(now, 'ar')).toBe('الآن');
  });

  it('counts the hours in English', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    expect(formatRelativeTime(twoHoursAgo, 'en')).toContain('2');
  });

  it('returns an empty string for a missing value', () => {
    expect(formatRelativeTime(null, 'en')).toBe('');
    expect(formatRelativeTime('not a date', 'en')).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --include='**/relative-time.spec.ts'`

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/app/core/i18n/relative-time.ts`:

```ts
import type { Language } from './language';
import { appLocale } from '../../shared/utils/locale-format';

/**
 * The relative time — "2 hours ago", "منذ ساعتين".
 *
 * <p>There is ONE implementation of this in the app. The shared table had
 * one and the recent-orders widget had another, and they drifted; the
 * table's version read the language off `document.documentElement.lang`,
 * which is the DOM's state rather than the app's.
 *
 * <p>Under a minute it is "Just now" / "الآن" — the number of seconds is
 * noise, and the absolute value is in the tooltip anyway.
 */
export function formatRelativeTime(value: unknown, lang: Language): string {
  if (value === null || value === undefined || value === '') return '';
  const then = new Date(value as string).getTime();
  if (Number.isNaN(then)) return '';

  const diff = then - Date.now();
  const absDiff = Math.abs(diff);
  if (absDiff < 60_000) return lang === 'ar' ? 'الآن' : 'Just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 3600e3],
    ['month', 30 * 24 * 3600e3],
    ['week', 7 * 24 * 3600e3],
    ['day', 24 * 3600e3],
    ['hour', 3600e3],
    ['minute', 60e3],
  ];

  const rtf = new Intl.RelativeTimeFormat(appLocale(lang), { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (absDiff >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return lang === 'ar' ? 'الآن' : 'Just now';
}
```

- [ ] **Step 4: Make the shared table delegate to it**

In `data-table.component.ts`, replace the body of `relativeTime(value)` with:

```ts
  relativeTime(value: unknown): string {
    return formatRelativeTime(value, this.language.language());
  }
```

Add the import `import { formatRelativeTime } from '../../../core/i18n/relative-time';`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- --include='**/relative-time.spec.ts'`

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/i18n/relative-time.ts src/app/core/i18n/relative-time.spec.ts src/app/shared/components/data-table/data-table.component.ts
git commit -m "refactor(i18n): one relative-time implementation

The shared table and the recent-orders widget each had one, and they
drifted: the table's read the language off document.documentElement, which
is the DOM's state rather than the app's."
```

---

### Task 3: The shared table learns three columns

**Files:**
- Modify: `src/app/shared/components/data-table/data-table.component.ts`
- Modify: `src/app/shared/components/data-table/data-table.component.html`
- Modify: `src/app/shared/components/data-table/main-cell/main-cell.component.ts`
- Modify: `src/app/shared/components/data-table/main-cell/main-cell.component.html`
- Test: `src/app/shared/components/data-table/data-table.component.spec.ts` (new)

**Interfaces:**
- Consumes: `app-user-avatar` (Task 1).
- Produces:
  - Three new cell ids in the shared table's switch:
    - `reviewer` — the value is `{ name: string; avatarUrl: string | null; verified: boolean; orderId: string | null; orderNumber: string | null }`. It renders the avatar, the name, and — only when `verified` is true — a small check icon; when `orderId` is set the check links to `/dashboard/orders/{orderId}`.
    - `rating` — the value is a number 1–5. It renders five stars (filled `text-warning`, empty `text-muted-foreground/30`) and the number `4/5`.
    - `comment` — the value is the text. It renders it start-aligned, clamped to two lines.
  - `HEADER_KEYS` gains: `Product` → `reviews.columns.product`, `Reviewer` → `reviews.columns.reviewer`, `Rating` → `reviews.columns.rating`, `Comment` → `reviews.columns.comment`.
  - `columnWidths` gains: `reviewer: '180px'`, `rating: '120px'`, `comment: '320px'`, `status: '110px'`.
  - `app-main-cell` gains `showSlug = input(true)` — when false the slug line is not rendered.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/components/data-table/data-table.component.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { DataTableComponent } from './data-table.component';

/**
 * The shared table's cell switch is CLOSED — a page cannot add a column type
 * on its own. These three ids are the ones the reviews page needs, and this
 * test fails the moment one of them is renamed or dropped, instead of the
 * page silently rendering a plain text cell.
 */
describe('DataTableComponent headers', () => {
  it('translates the review column headers', () => {
    expect(DataTableComponent.HEADER_KEYS['Product']).toBe('reviews.columns.product');
    expect(DataTableComponent.HEADER_KEYS['Reviewer']).toBe('reviews.columns.reviewer');
    expect(DataTableComponent.HEADER_KEYS['Rating']).toBe('reviews.columns.rating');
    expect(DataTableComponent.HEADER_KEYS['Comment']).toBe('reviews.columns.comment');
  });

  it('budgets the review columns', () => {
    expect(DataTableComponent.COLUMN_WIDTHS['reviewer']).toBe('180px');
    expect(DataTableComponent.COLUMN_WIDTHS['rating']).toBe('120px');
    expect(DataTableComponent.COLUMN_WIDTHS['comment']).toBe('320px');
  });
});
```

`HEADER_KEYS` and `columnWidths` are made `static readonly` in this change, so the test can read them without constructing the component (it injects `LanguageService` and `LocalizedNameService`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --include='**/data-table.component.spec.ts'`

Expected: FAIL — the header keys and widths are not there.

- [ ] **Step 3: Add the header keys and the widths**

In `data-table.component.ts`, make the two maps `static readonly` (`HEADER_KEYS` is already `private static readonly` — widen it to `static readonly`; `columnWidths` becomes `static readonly` too), and add to `HEADER_KEYS`:

```ts
    // The reviews console (a moderation table, not an order table).
    Product: 'reviews.columns.product',
    Reviewer: 'reviews.columns.reviewer',
    Rating: 'reviews.columns.rating',
    Comment: 'reviews.columns.comment',
```

And to `columnWidths`:

```ts
    // The reviews console. `main_en`/`main_ar` (the product cell) stays
    // UNSIZED — it is the table's one flex column and takes the remainder,
    // so the comment and the dates stay compact.
    reviewer: '180px',
    rating: '120px',
    comment: '320px',
    status: '110px',
```

- [ ] **Step 4: Add the three cells to the switch**

In `data-table.component.html`, inside the `@switch (cell.column.id)`, add these three cases BEFORE the `@default`:

```html
                @case ('reviewer') {
                  <!--
                    The reviewer: an avatar that falls back to an initial, the
                    name, and — only when the purchase is CONFIRMED — a small
                    check that links to the order. Nothing is shown for an
                    unverified review: a "not verified" chip would be noise,
                    and the absence of the check IS the message.
                  -->
                  @if (cell.getValue(); as reviewer) {
                    <div class="flex items-center gap-2 min-w-0">
                      <app-user-avatar
                        [src]="reviewer.avatarUrl"
                        [name]="reviewer.name"
                        size="sm"
                        class="shrink-0"
                      />
                      <span class="truncate text-start">
                        <bdi>{{ reviewer.name }}</bdi>
                      </span>
                      @if (reviewer.verified) {
                        @if (reviewer.orderId) {
                          <a
                            [routerLink]="['/dashboard/orders', reviewer.orderId]"
                            class="inline-flex shrink-0 items-center text-success hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            [attr.title]="'reviews.columns.verifiedPurchase' | transloco"
                            [attr.aria-label]="'reviews.columns.verifiedPurchase' | transloco"
                          >
                            <ng-icon name="lucideBadgeCheck" class="size-4" aria-hidden="true" />
                          </a>
                        } @else {
                          <ng-icon
                            name="lucideBadgeCheck"
                            class="size-4 shrink-0 text-success"
                            [attr.title]="'reviews.columns.verifiedPurchase' | transloco"
                          />
                        }
                      }
                    </div>
                  }
                }
                @case ('rating') {
                  <!--
                    Filled stars in the warning token, the empty ones muted,
                    and the number beside them: "4/5" is what a reader can
                    quote, and the stars alone cannot be counted at a glance.
                  -->
                  @if (cell.getValue() !== null && cell.getValue() !== undefined) {
                    <div class="flex items-center gap-1.5 text-start">
                      <span class="inline-flex" aria-hidden="true">
                        @for (star of ratingStars; track star) {
                          @if (star < $any(cell.getValue())) {
                            <ng-icon name="heroStarSolid" class="size-4 text-warning" />
                          } @else {
                            <ng-icon name="heroStar" class="size-4 text-muted-foreground/30" />
                          }
                        }
                      </span>
                      <span class="text-xs tabular-nums text-muted-foreground"
                        >{{ $any(cell.getValue()) }}/5</span
                      >
                    </div>
                  }
                }
                @case ('statusReview') {
                  <!--
                    The review's moderation state. The shared badge carries the
                    COLOUR and the icon; the LABEL is the page's, because
                    "Pending" means "قيد المراجعة" for a review and
                    "قيد الانتظار" for an order.
                  -->
                  @if (cell.getValue(); as reviewStatus) {
                    <app-status-badge
                      [status]="reviewStatus.approved ? 'approved' : 'pending'"
                      [customLabel]="reviewStatus.label"
                    />
                  }
                }
                @case ('comment') {
                  <!--
                    The review text. Clamped to two lines: a long comment in a
                    table cell pushes the row to five lines and the page stops
                    being scannable. The full text opens in the drawer.
                    <bdi> keeps a Latin comment from having its punctuation
                    moved to the front inside an Arabic page.
                  -->
                  <span
                    class="block max-w-full text-start text-sm leading-relaxed line-clamp-2"
                    [attr.title]="$any(cell.getValue())"
                  >
                    <bdi>{{ $any(cell.getValue()) }}</bdi>
                  </span>
                }
```

And in `data-table.component.ts`, add:

```ts
  /** The five stars of a rating cell. */
  protected readonly ratingStars = [0, 1, 2, 3, 4];
```

Add `UserAvatarComponent` to the component's `imports` array, and register the icons in the component's `provideIcons`:

```ts
      lucideBadgeCheck,
      heroStarSolid,
      heroStar,
```

with the imports `import { heroStarSolid } from '@ng-icons/heroicons/solid';`, `import { heroStar } from '@ng-icons/heroicons/outline';` and `lucideBadgeCheck` from `@ng-icons/lucide`.

- [ ] **Step 5: Address every cell from a test**

In `data-table.component.html`, add ` [attr.data-column]="cell.column.id"` to the `<td>` inside the `@for (cell of row.getVisibleCells(); …)` loop. A cell that cannot be addressed cannot be asserted on, and the reviews E2E needs to find the comment cell.

- [ ] **Step 6: Let the main cell show a name without a slug**
In `main-cell.component.ts`, add:

```ts
  /**
   * Whether the slug line is rendered under the name.
   *
   * The reviews console shows the PRODUCT, and the slug is a technical
   * handle there — it is what the old column showed, and it is what the
   * report called out as unreadable.
   */
  readonly showSlug = input(true);
```

In `main-cell.component.html`, wrap the slug span:

```html
    @if (showSlug()) {
      <span class="block truncate text-xs text-muted-foreground" data-testid="slug-text">
        <bdi>{{ data().slug }}</bdi>
      </span>
    }
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test:unit -- --include='**/data-table.component.spec.ts'`

Expected: PASS — 2 tests.

- [ ] **Step 8: Commit**

```bash
git add src/app/shared/components/data-table
git commit -m "feat(table): the review columns — reviewer, rating, comment and the review status

The cell switch is closed, so a page cannot add a column on its own; the
Orders page did the same with items, customer and paymentMethod.

The comment cell is clamped to two lines and wrapped in <bdi>: a long
comment must not push the row to five lines, and a Latin comment inside
an Arabic page must not have its punctuation moved to the front."
```

---

### Task 4: The `approved` status kind

**Files:**
- Modify: `src/app/shared/ui/status-badge/status-badge.component.ts`
- Test: `src/app/shared/ui/status-badge/status-badge.component.spec.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `StatusKind` gains `'approved'`. Its class is `bg-success-soft text-success` and its icon is `lucideCheckCircle`. Its default label key is `common.statuses.approved`; the reviews page overrides the label with `customLabel` so the review's own term is used.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/ui/status-badge/status-badge.component.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  it('renders the approved kind as a success', () => {
    const component = new StatusBadgeComponent();

    expect(component.badgeClass('approved')).toContain('bg-success-soft');
    expect(component.icon('approved')).toBe('lucideCheckCircle');
    expect(component.label('approved')).toBe('common.statuses.approved');
  });
});
```

> If `badgeClass`, `icon` and `label` are `protected`, make them `public` in this change — they are the component's contract, and a test that cannot read them cannot pin them.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --include='**/status-badge.component.spec.ts'`

Expected: FAIL — `approved` is not a `StatusKind`.

- [ ] **Step 3: Add the kind**

In `status-badge.component.ts`:

- add `'approved'` to the `StatusKind` union;
- add to the `labels` map: `approved: 'common.statuses.approved',`
- add to the `icons` map: `approved: 'lucideCheckCircle',`
- add to the `badgeClass` map: `approved: 'bg-success-soft text-success',`

Make `label`, `icon` and `badgeClass` public if they are protected.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --include='**/status-badge.component.spec.ts'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/status-badge
git commit -m "feat(ui): the approved status kind

Same success tokens as the paid and delivered kinds — a settled review
reads as settled, a pending one reads as waiting."
```

---

### Task 5: The sidebar stops keeping a ring

**Files:**
- Modify: `src/app/features/layout/layout.component.ts`
- Modify: `src/app/features/layout/layout.component.html`
- Test: `e2e/verify-sidebar.spec.ts` (existing file — add a test to it)

**Interfaces:**
- Consumes: nothing.
- Produces: after every route change, the focus moves to the page's `<h1>` inside `<main>`. The heading is given `tabindex="-1"` at runtime so it can receive focus without being in the tab order.

- [ ] **Step 1: Write the failing E2E test**

Add to `e2e/verify-sidebar.spec.ts`:

```ts
/**
 * A sidebar item must not keep a focus ring after a click.
 *
 * The nav item carries `focus-visible:ring-2`, and a link keeps DOM focus
 * after an SPA navigation — so the ring stayed painted on the item the
 * admin had just left. The focus now moves to the page heading, which is
 * also where a screen-reader user expects to be after a navigation.
 */
test('a clicked sidebar item keeps no ring after the navigation', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard');
  await page.locator('a[href="/dashboard/orders"]').first().click();
  await page.waitForURL('**/dashboard/orders');

  const ring = await page
    .locator('a[href="/dashboard/orders"]')
    .first()
    .evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring === 'none' || ring === '').toBe(true);
});
```

Use the same helpers every other spec uses — `gotoLogin`, `fillLoginForm` and `submitLogin` from `./helpers/auth` — copied from `e2e/orders.spec.ts`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- e2e/verify-sidebar.spec.ts`

Expected: FAIL — the ring is still painted.

- [ ] **Step 3: Move the focus on every navigation**

In `layout.component.ts`, add:

```ts
  /**
   * The focus moves to the page heading after every navigation.
   *
   * A nav item keeps DOM focus after an SPA navigation, so its
   * `focus-visible:ring-2` stayed painted on the item the admin had just
   * left. Moving the focus to the heading fixes the ring and gives a
   * screen-reader user the place they expect to land.
   */
  private focusPageHeading(): void {
    const heading = this.main()?.nativeElement?.querySelector('h1');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
```

with a `viewChild<ElementRef<HTMLElement>>('main')` for the `<main>` element, and a `NavigationEnd` subscription in the constructor:

```ts
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.focusPageHeading()));
```

The `setTimeout` lets the new page render before the focus moves.

In `layout.component.html`, add the template reference to the `<main>`:

```html
  <main #main hlmSidebarInset class="main-container">
```

Add the imports `ElementRef`, `viewChild` from `@angular/core`, and `NavigationEnd`, `Router` from `@angular/router', and `filter` from `rxjs`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- e2e/verify-sidebar.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/layout e2e/verify-sidebar.spec.ts
git commit -m "fix(layout): the focus moves to the page heading after a navigation

A nav item keeps DOM focus after an SPA navigation, so its focus-visible
ring stayed painted on the item the admin had just left. Moving the focus
to the heading fixes the ring and gives a screen-reader user the place
they expect to land."
```

---

### Task 6: The reviews console — the service, the model, the state

**Files:**
- Modify: `src/app/features/reviews/models/review.model.ts`
- Modify: `src/app/features/reviews/services/review.service.ts`
- Create: `src/app/features/reviews/components/review-list.component.ts`
- Create: `src/app/features/reviews/components/review-list.component.html`
- Delete: `src/app/features/reviews/components/review.component.ts`
- Delete: `src/app/features/reviews/components/review.component.html`
- Modify: `src/app/app.routes.ts` (the route points at the new component)
- Test: `src/app/features/reviews/services/review.service.spec.ts` (new)

**Interfaces:**
- Consumes: the backend endpoints listed in the Global Constraints.
- Produces:
  - `ReviewResponse` gains `orderId: string | null` and `orderNumber: string | null`.
  - `ReviewStats` — `{ total: number; pending: number; approved: number; averageRating: number | null; distribution: Record<string, number> }`.
  - `ReviewService.getAll(params: ReviewListParams)`, `ReviewService.getStats()`, `ReviewService.setApproval(ids: string[], approved: boolean)`.
  - `ReviewListComponent` — the page. Its state is URL-backed: `?status=&product=&range=&from=&to=&rating=&verification=&q=&sort=&direction=&page=`.

- [ ] **Step 1: Write the failing service test**

Create `src/app/features/reviews/services/review.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { ReviewService } from './review.service';

/**
 * The review list carries the filters as query parameters.
 *
 * The product slug and the free text are SEPARATE parameters: the endpoint
 * used to overload the slug with a LIKE search, so a product dropdown and
 * a search box could never coexist.
 */
describe('ReviewService', () => {
  it('sends the product filter, the search and the date range separately', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReviewService],
    });
    const service = TestBed.inject(ReviewService);
    const http = TestBed.inject(HttpTestingController);

    service
      .getAll({
        productSlug: 'brazil-mogiana',
        search: 'excellent',
        isApproved: false,
        createdFrom: '2026-10-01T00:00:00Z',
        createdTo: '2026-10-20T00:00:00Z',
      })
      .subscribe();

    const request = http.expectOne((r) => r.url.includes('/api/dashboard/reviews'));
    const params = request.request.params;
    expect(params.get('productSlug')).toBe('brazil-mogiana');
    expect(params.get('search')).toBe('excellent');
    expect(params.get('isApproved')).toBe('false');
    expect(params.get('createdFrom')).toBe('2026-10-01T00:00:00Z');
    expect(params.get('createdTo')).toBe('2026-10-20T00:00:00Z');
    request.flush({ success: true, data: { content: [] } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --include='**/review.service.spec.ts'`

Expected: FAIL — the parameters are not sent.

- [ ] **Step 3: The model and the service**

Replace `src/app/features/reviews/models/review.model.ts` with:

```ts
export interface ReviewResponse {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
  verified: boolean;
  approved: boolean;
  productName: string | null;
  productSlug: string;
  primaryImageUrl: string | null;
  createdAt: string;
  /** The order behind a confirmed purchase, when there is one. */
  orderId: string | null;
  orderNumber: string | null;
}

export interface ReviewRequest {
  approved: boolean;
}

/** The moderation statistics — the counts the tabs and the strip show. */
export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  averageRating: number | null;
  /** Keys "1" … "5". Every key is present, even when it is zero. */
  distribution: Record<string, number>;
}

export interface ReviewListParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  productSlug?: string;
  search?: string;
  isApproved?: boolean;
  isVerified?: boolean;
  minRating?: number;
  createdFrom?: string;
  createdTo?: string;
}
```

Replace `src/app/features/reviews/services/review.service.ts` with:

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { ReviewListParams, ReviewResponse, ReviewStats } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private basePath = '/api/dashboard/reviews';

  getAll(params: ReviewListParams = {}): Observable<ApiResponse<PageResponse<ReviewResponse>>> {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 20)
      .set('sort', params.sort ?? 'createdAt')
      .set('direction', params.direction ?? 'desc');
    if (params.productSlug) httpParams = httpParams.set('productSlug', params.productSlug);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.isApproved !== undefined) httpParams = httpParams.set('isApproved', params.isApproved);
    if (params.isVerified !== undefined) httpParams = httpParams.set('isVerified', params.isVerified);
    if (params.minRating !== undefined) httpParams = httpParams.set('minRating', params.minRating);
    if (params.createdFrom) httpParams = httpParams.set('createdFrom', params.createdFrom);
    if (params.createdTo) httpParams = httpParams.set('createdTo', params.createdTo);

    return this.http.get<ApiResponse<PageResponse<ReviewResponse>>>(`${environment.apiUrl}${this.basePath}`, {
      params: httpParams,
    });
  }

  getStats(): Observable<ApiResponse<ReviewStats>> {
    return this.http.get<ApiResponse<ReviewStats>>(`${environment.apiUrl}${this.basePath}/stats`);
  }

  setApproval(ids: string[], approved: boolean): Observable<ApiResponse<{ updated: number }>> {
    return this.http.patch<ApiResponse<{ updated: number }>>(
      `${environment.apiUrl}${this.basePath}/approval`,
      { ids, approved },
    );
  }

  setSingleApproval(id: string, approved: boolean): Observable<ApiResponse<ReviewResponse>> {
    return this.http.patch<ApiResponse<ReviewResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/approval`,
      null,
      { params: new HttpParams().set('approved', approved) },
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${this.basePath}/${id}`);
  }
}
```

- [ ] **Step 4: The page component — the state**

Create `src/app/features/reviews/components/review-list.component.ts`. Its state, exactly:

- `status` — `'pending' | 'approved' | 'all'`, **defaulting to `'pending'`**. The URL parameter `status` selects it; `status=pending` (the dashboard drill-down) and the default agree.
- `productSlug`, `search`, `rating`, `verification` — the filters; `rating` is `'all' | '1' … '5'`, `verification` is `'all' | 'verified' | 'unverified'`.
- `range` — `'all' | 'today' | '7d' | '30d' | 'custom'`, with `from` and `to` for `custom`.
- `page`, `size`, `sort`, `direction` — the paging, as on the Orders page.
- `stats` — a signal fed by `getStats()`.
- `items` — the loaded page.
- `viewMode` — `'table' | 'grid'`, **persisted in `localStorage` under `nocteon-reviews-view-mode`** (Task 8).

Every one of those is written to the URL with `router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true })`, and read back on construction — the Orders page's pattern, copied from `src/app/features/orders/orders-list/orders-list.component.ts`.

The header block, verbatim from the spec:

```html
      <h1 class="text-2xl font-medium tracking-tight">{{ 'reviews.title' | transloco }}</h1>
      <p class="text-sm text-muted-foreground" data-testid="reviews-count">
        {{ stats().total | plural: 'reviews.countReviews' }} ·
        {{ stats().approved | plural: 'reviews.countApproved' }} ·
        {{ stats().pending | plural: 'reviews.countPending' }}
      </p>
```

> The count line **names the entity** — "15 reviews · 13 approved · 2 pending" / "15 تقييمات · 13 معتمد · 2 قيد المراجعة". A bare "15 · 13 · 2" is not a count line.

- [ ] **Step 5: The statistics strip**

The strip answers the question a moderator has before they start: how good are these reviews, and how many are waiting. It is three facts, not a dashboard:

```html
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-[var(--radius-card)] border bg-card p-4" data-testid="reviews-stat-average">
          <p class="text-sm text-muted-foreground">{{ 'reviews.stats.averageRating' | transloco }}</p>
          <p class="mt-1 text-2xl font-bold tabular-nums">
            {{ stats().averageRating === null ? '—' : (stats().averageRating | number: '1.1-1') }}
          </p>
        </div>

        <div class="rounded-[var(--radius-card)] border bg-card p-4" data-testid="reviews-stat-distribution">
          <p class="text-sm text-muted-foreground">{{ 'reviews.stats.distribution' | transloco }}</p>
          <div class="mt-2 flex items-end gap-1" aria-hidden="true">
            @for (star of [5, 4, 3, 2, 1]; track star) {
              <div class="w-4 rounded-sm bg-warning/70" [style.height.px]="barHeight(star)"></div>
            }
          </div>
          <p class="sr-only">{{ distributionText() }}</p>
        </div>

        <div class="rounded-[var(--radius-card)] border bg-card p-4" data-testid="reviews-stat-pending">
          <p class="text-sm text-muted-foreground">{{ 'reviews.stats.pending' | transloco }}</p>
          <p class="mt-1 text-2xl font-bold tabular-nums">{{ stats().pending }}</p>
        </div>

        <div class="rounded-[var(--radius-card)] border bg-card p-4" data-testid="reviews-stat-total">
          <p class="text-sm text-muted-foreground">{{ 'reviews.stats.total' | transloco }}</p>
          <p class="mt-1 text-2xl font-bold tabular-nums">{{ stats().total }}</p>
        </div>
      </div>
```

with the helpers:

```ts
  /** The bar height for a star bucket, against the tallest bucket. */
  protected barHeight(star: number): number {
    const counts = this.stats().distribution ?? {};
    const max = Math.max(1, ...Object.values(counts).map((n) => Number(n) || 0));
    return Math.round((Number(counts[String(star)]) || 0) * 24 / max) + 4;
  }

  /** The distribution in words, for the screen reader. */
  protected distributionText(): string {
    const counts = this.stats().distribution ?? {};
    return [5, 4, 3, 2, 1]
      .map((star) => `${star}: ${counts[String(star)] ?? 0}`)
      .join(', ');
  }
```

The locale keys: `reviews.stats.averageRating` ("Average rating" / "متوسط التقييم"), `reviews.stats.distribution` ("Star distribution" / "توزيع النجوم"), `reviews.stats.pending` ("Pending" / "قيد المراجعة"), `reviews.stats.total` ("Total" / "الإجمالي").

- [ ] **Step 6: The tab strip**

```html
      <div role="tablist" class="flex flex-wrap items-center gap-2" [attr.aria-label]="'reviews.tabs.label' | transloco">
        @for (tab of tabs; track tab.id) {
          <button
            role="tab"
            hlmBtn
            size="sm"
            [attr.aria-selected]="status() === tab.id"
            [variant]="status() === tab.id ? 'default' : 'outline'"
            (click)="setStatus(tab.id)"
          >
            {{ tab.label | transloco }}
            <span class="ms-1 tabular-nums opacity-80">{{ tab.count() }}</span>
          </button>
        }
      </div>
```

with `tabs` built from the stats: Pending (pending), Approved (approved), All (total). **Pending is first and selected by default.**

- [ ] **Step 7: The route**

In `src/app/app.routes.ts`, point the reviews route at `ReviewListComponent`:

```ts
        {
          path: 'reviews',
          canActivate: [permissionGuard('review:moderate')],
          children: [
            { path: '', component: ReviewListComponent },
            { path: ':id', component: ReviewListComponent },
          ],
        },
```

Update the import. The old `review.component.*` files are deleted (Step 7).

- [ ] **Step 8: Run the service test to verify it passes**

Run: `npm run test:unit -- --include='**/review.service.spec.ts'`

Expected: PASS.

- [ ] **Step 9: Delete the old component and commit**

```bash
git rm src/app/features/reviews/components/review.component.ts src/app/features/reviews/components/review.component.html
git add src/app/features/reviews src/app/app.routes.ts
git commit -m "feat(reviews): the moderation console, one step at a time

The state lives in the URL, as on the Orders page, and Pending is the
default tab: pending is the work queue. The count line names the entity,
because '15 · 13 · 2' is not a count line."
```

---

### Task 7: The reviews table

**Files:**
- Modify: `src/app/features/reviews/components/review-list.component.ts`
- Modify: `src/app/features/reviews/components/review-list.component.html`

**Interfaces:**
- Consumes: `app-data-table` with the `reviewer` / `rating` / `comment` cells (Task 3), `app-status-badge` with the `approved` kind (Task 4).
- Produces: the table with the columns `Product` (the `main_*` cell, the flex column), `Reviewer`, `Rating`, `Comment`, `Status`, `Created at`, `Actions`.

- [ ] **Step 1: Build the columns**

In the component, build the column definitions in a method, because the product cell's direction follows the UI language and the language can change at runtime:

```ts
  private buildColumns(): ColumnDef<ReviewResponse, any>[] {
    const lang = this.language.language();
    const langDir = lang === 'ar' ? 'rtl' : 'ltr';

    return [
      this.columnHelper.accessor(
        (row) => ({
          name: row.productName ?? row.productSlug,
          slug: row.productSlug,
          imageUrl: row.primaryImageUrl,
          otherName: '',
        }),
        {
          id: `main_${lang}`,
          header: 'Product',
          enableSorting: false,
        },
      ),
      this.columnHelper.accessor(
        (row) => ({
          name: row.username,
          avatarUrl: row.avatarUrl,
          verified: row.verified,
          orderId: row.orderId,
          orderNumber: row.orderNumber,
        }),
        { id: 'reviewer', header: 'Reviewer', enableSorting: false },
      ),
      this.columnHelper.accessor((row) => row.rating, {
        id: 'rating',
        header: 'Rating',
        enableSorting: false,
      }),
      this.columnHelper.accessor((row) => row.comment, {
        id: 'comment',
        header: 'Comment',
        enableSorting: false,
      }),
      this.columnHelper.accessor((row) => row.approved, {
        id: 'status',
        header: 'Status',
        enableSorting: false,
      }),
      this.columnHelper.accessor((row) => row.createdAt, {
        id: 'createdAtTime',
        header: 'Created at',
        enableSorting: true,
      }),
      this.columnHelper.display({ id: 'actions', header: 'Actions' }),
    ];
  }
```

Rebuild the columns when the language changes:

```ts
    effect(() => {
      this.language.language();
      this.columns.set(this.buildColumns());
    });
```

`columns` is a `signal<ColumnDef<ReviewResponse, any>[]>([])`.

- [ ] **Step 2: The status cell**

The shared table's `status` cell renders a raw pill with a fixed shape. The reviews page needs the **shared badge** with its **own label**, so it gets its own cell id — `statusReview` — added to the shared switch in Task 3:

```ts
      this.columnHelper.accessor(
        (row) => ({
          approved: row.approved,
          label: row.approved ? 'reviews.status.approved' : 'reviews.status.pending',
        }),
        { id: 'statusReview', header: 'Status', enableSorting: false },
      ),
```

`Status` already maps to `common.status` in `HEADER_KEYS`, so the header stays translated.

- [ ] **Step 3: The table in the template**

```html
      <div class="rounded-[var(--radius-card)] border bg-card">
        <app-data-table
          [data]="items()"
          [columns]="columns()"
          [loading]="loading()"
          [emptyMessage]="emptyMessage()"
          [showEdit]="false"
          [showDelete]="false"
          [showView]="false"
          [selectable]="true"
          [selectedIds]="selectedIds()"
          [rowId]="rowId"
          [menuActions]="menuActions"
          [minWidth]="'1080px'"
          (sortChange)="onSortChange($event)"
          (selectionChange)="onSelectionChange($event)"
          (toggleAllChange)="onToggleAll($event)"
          (menuAction)="onMenuAction($event)"
        />
      </div>
```

- [ ] **Step 4: The row actions**

The `⋮` menu holds the secondary actions, and the **Approve** button is the visible one:

```ts
  protected readonly menuActions: RowMenuAction[] = [
    { id: 'view', label: 'reviews.view', icon: 'lucideEye' },
    { id: 'withdraw', label: 'reviews.withdrawApproval', icon: 'lucideX' },
    { id: 'delete', label: 'common.delete', icon: 'lucideTrash2', danger: true },
  ];
```

The Approve button lives in the grid card and in the drawer; in the table it is the `view` action of the actions cell — so extend the shared `actions` case with a page-supplied primary action. The `app-actions-cell` already has a `view` action with a `viewLabel`; use it:

```html
                @case ('actions') {
                  <app-actions-cell
                    [item]="row.original"
                    [showEdit]="false"
                    [showDelete]="false"
                    [showView]="false"
                    [menuActions]="menuActions()"
                    (menuAction)="menuAction.emit({ id: $event.id, item: $event.item })"
                  />
                }
```

> **If the shared `actions` case cannot render a labelled primary action, add one:** a new input `primaryAction = input<{ id: string; label: string } | null>(null)` on `app-actions-cell`, rendered as a text button BEFORE the ⋮ menu. That is the smallest change that satisfies "Approve is a labelled button, the rest are in the menu" without a bespoke cell.

- [ ] **Step 5: The empty message**

Distinguish "no reviews at all" from "the filters excluded everything" — the Orders page's pattern:

```ts
  protected readonly emptyMessage = computed(() => {
    if (this.stats().total === 0) return this.t('reviews.emptyState.noReviews', 'No reviews yet');
    if (this.hasActiveFilters() || this.status() !== 'all')
      return this.t('reviews.emptyState.noResults', 'No reviews match these filters');
    return this.t('reviews.noData', 'No reviews found');
  });
```

- [ ] **Step 6: Build and check**

Run: `npm run build -- --configuration development`

Expected: the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/reviews
git commit -m "feat(reviews): the moderation table

The product leads with a thumbnail and its translated name, the reviewer
carries the initials avatar and the verified-purchase check, the comment
is clamped to two lines, and the status is one column."
```

---

### Task 8: The grid, and the view that is remembered

**Files:**
- Modify: `src/app/features/reviews/components/review-list.component.ts`
- Modify: `src/app/features/reviews/components/review-list.component.html`

**Interfaces:**
- Consumes: the same data as Task 7.
- Produces: a `viewMode` signal persisted in `localStorage` under `nocteon-reviews-view-mode`; the grid is optional and the table is the default.

- [ ] **Step 1: Read and persist the view mode**

```ts
  private readonly VIEW_KEY = 'nocteon-reviews-view-mode';

  // ViewMode is the app's own type — import it from core/crud/base-list.component.

  readonly viewMode = signal<ViewMode>(this.readViewMode());

  private readViewMode(): ViewMode {
    const stored = localStorage.getItem(this.VIEW_KEY);
    return stored === 'grid' ? 'grid' : 'table';
  }

  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
    localStorage.setItem(this.VIEW_KEY, mode);
  }
```

- [ ] **Step 2: The grid**

A compact card — a **small** thumbnail beside the text, not a full-bleed image:

```html
      <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (item of items(); track item.id) {
          <hlm-card class="overflow-hidden py-0">
            <div hlmCardContent class="flex gap-3 p-4">
              @if (item.primaryImageUrl) {
                <img
                  [src]="item.primaryImageUrl"
                  [alt]="item.productName ?? item.productSlug"
                  class="size-14 shrink-0 rounded-[var(--radius-control)] object-cover"
                />
              }
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  <bdi>{{ item.productName ?? item.productSlug }}</bdi>
                </p>
                <p class="text-xs text-muted-foreground">
                  <app-localized-date [value]="item.createdAt" />
                </p>
                <!-- the rating, the comment and the status, as in the table -->
              </div>
            </div>
            <div hlmCardFooter class="flex items-center gap-2 border-t px-4 py-3">
              <button hlmBtn size="sm" class="flex-1" (click)="approve(item)">Approve</button>
              <app-actions-cell [item]="item" [showEdit]="false" [showDelete]="false" [showView]="false" [menuActions]="menuActions" (menuAction)="onMenuAction($event)" />
            </div>
          </hlm-card>
        }
      </div>
```

**The three buttons on a card share one height** — that is what made the old grid look broken. The Approve button and the ⋮ menu sit in one flex row with the same `h-` and the same padding; the delete button is INSIDE the ⋮ menu, never on the card face.

- [ ] **Step 3: The view toggle**

```html
        <div class="flex items-center rounded-md border bg-card p-1">
          <button hlmBtn [variant]="viewMode() === 'table' ? 'secondary' : 'ghost'" size="icon" (click)="toggleView('table')" [attr.aria-label]="'common.listView' | transloco">
            <ng-icon name="lucideList" class="size-4" />
          </button>
          <button hlmBtn [variant]="viewMode() === 'grid' ? 'secondary' : 'ghost'" size="icon" (click)="toggleView('grid')" [attr.aria-label]="'common.gridView' | transloco">
            <ng-icon name="lucideGrid3x3" class="size-4" />
          </button>
        </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/reviews
git commit -m "feat(reviews): the grid is optional, and the choice is remembered

The table is the default: fifteen reviews in cards is a whole page for
nothing. The grid keeps a small thumbnail beside the text, so a card is
useful for reviewing rather than for looking at."
```

---

### Task 9: Bulk approve

**Files:**
- Modify: `src/app/features/reviews/components/review-list.component.ts`
- Modify: `src/app/features/reviews/components/review-list.component.html`

**Interfaces:**
- Consumes: `ReviewService.setApproval(ids, approved)` (Task 6), the table's `selectionChange` / `toggleAllChange` outputs.
- Produces: `selectedIds` (a `signal<ReadonlySet<string>>`), a bulk bar, and `bulkApprove()`.

- [ ] **Step 1: The selection**

```ts
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly rowId = (row: ReviewResponse): string | null => row?.id ?? null;

  protected onSelectionChange(event: { id: number; checked: boolean }): void {
    const next = new Set(this.selectedIds());
    const id = String(event.id);
    event.checked ? next.add(id) : next.delete(id);
    this.selectedIds.set(next);
  }

  protected onToggleAll(checked: boolean): void {
    if (!checked) {
      this.selectedIds.set(new Set());
      return;
    }
    this.selectedIds.set(new Set(this.items().map((r) => r.id)));
  }
```

- [ ] **Step 2: The bulk bar**

```html
      @if (selectedCount() > 0) {
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border bg-card px-4 py-3" role="region" [attr.aria-label]="'reviews.bulk.selected' | transloco: { count: selectedCount() }">
          <p class="text-sm">{{ 'reviews.bulk.selected' | transloco: { count: selectedCount() } }}</p>
          <div class="flex items-center gap-2">
            <button hlmBtn size="sm" (click)="bulkApprove()" [disabled]="bulkSubmitting()">
              {{ 'reviews.bulk.approve' | transloco }}
            </button>
            <button hlmBtn variant="ghost" size="sm" (click)="clearSelection()">
              {{ 'reviews.bulk.clear' | transloco }}
            </button>
          </div>
        </div>
      }
```

- [ ] **Step 3: The action**

```ts
  protected bulkApprove(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkSubmitting.set(true);
    this.reviewService.setApproval(ids, true).subscribe({
      next: (res) => {
        this.bulkSubmitting.set(false);
        this.clearSelection();
        this.notify.success('reviews.bulk.approved', `${res.data?.updated ?? ids.length} reviews approved`);
        this.loadPage();
        this.loadStats();
      },
      error: (err) => {
        this.bulkSubmitting.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not approve the reviews');
      },
    });
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/reviews
git commit -m "feat(reviews): approve a set of reviews in one action

The response says how many actually changed — a review deleted in between
is skipped, not counted."
```

---

### Task 10: The review drawer

**Files:**
- Create: `src/app/shared/ui/side-panel/side-panel.component.ts`
- Modify: `src/app/features/reviews/components/review-list.component.ts`
- Modify: `src/app/features/reviews/components/review-list.component.html`

**Interfaces:**
- Consumes: `app-status-badge`, `app-localized-date`, `app-user-avatar`.
- Produces:
  - `app-side-panel` — `open = input(false)`, `title = input.required<string>()`, `closed = output<void>()`. It renders an overlay at the **inline end** (`inset-inline-end: 0`), traps the focus, closes on Escape, restores the focus to the trigger, and does NOT close on a click inside the panel.
  - `ReviewListComponent.viewing` — the review open in the drawer, or null.

- [ ] **Step 1: The side panel**

Create `src/app/shared/ui/side-panel/side-panel.component.ts`. Copy the focus-trap, the Escape handling and the focus-restore logic from `src/app/features/orders/components/order-dialog/order-dialog.component.ts` — the three functions `focusables()`, `focusFirst()` and `onKeydown()` — and render the panel at the inline end:

```ts
@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" (click)="onBackdrop($event)" (keydown)="onKeydown($event)">
        <aside
          #panel
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          class="flex h-full w-full max-w-md flex-col border-s bg-card shadow-2xl outline-none"
        >
          <header class="flex items-start justify-between gap-4 border-b p-6">
            <h2 class="text-lg font-medium">{{ title() }}</h2>
            <button type="button" hlmBtn variant="ghost" size="icon" (click)="closed.emit()" [attr.aria-label]="'common.close' | transloco">
              <ng-icon name="lucideX" class="size-4" />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto p-6">
            <ng-content />
          </div>
        </aside>
      </div>
    }
  `,
})
```

`border-s` is the logical border (start side), so the panel sits on the inline end in BOTH languages — a physical `right` would be wrong in Arabic.

- [ ] **Step 2: The drawer content**

The drawer shows the product, the order, the rating, the **full** comment, the date and the status, plus the actions:

```html
      <app-side-panel [open]="viewing() !== null" [title]="'reviews.details' | transloco" (closed)="closeView()">
        @if (viewing(); as review) {
          <div class="space-y-5">
            <div class="flex items-center gap-3">
              <app-user-avatar [src]="review.avatarUrl" [name]="review.username" />
              <div>
                <p class="font-medium"><bdi>{{ review.username }}</bdi></p>
                <p class="text-xs text-muted-foreground">
                  <app-localized-date [value]="review.createdAt" [showTime]="true" />
                </p>
              </div>
            </div>

            <div class="rounded-[var(--radius-control)] border p-4">
              <p class="mb-1 text-sm font-medium">{{ 'reviews.product' | transloco }}</p>
              <p class="text-sm"><bdi>{{ review.productName ?? review.productSlug }}</bdi></p>
              @if (review.orderNumber) {
                <a class="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline" [routerLink]="['/dashboard/orders', review.orderId]">
                  <ng-icon name="lucideBadgeCheck" class="size-4" />
                  {{ 'reviews.columns.verifiedPurchase' | transloco }} · {{ review.orderNumber }}
                </a>
              }
            </div>

            <div class="rounded-[var(--radius-control)] border p-4">
              <p class="mb-1 text-sm font-medium">{{ 'reviews.rating' | transloco }}</p>
              <p class="text-sm">{{ review.rating }} / 5</p>
            </div>

            <div class="rounded-[var(--radius-control)] border p-4">
              <p class="mb-1 text-sm font-medium">{{ 'reviews.comment' | transloco }}</p>
              <p class="whitespace-pre-wrap text-sm"><bdi>{{ review.comment }}</bdi></p>
            </div>
          </div>
        }
      </app-side-panel>
```

- [ ] **Step 3: Open and close**

```ts
  readonly viewing = signal<ReviewResponse | null>(null);

  protected openView(review: ReviewResponse): void {
    this.viewing.set(review);
  }

  protected closeView(): void {
    this.viewing.set(null);
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/ui/side-panel src/app/features/reviews
git commit -m "feat(reviews): the full review opens in a side panel

The panel sits on the inline end, so it is on the left in Arabic and on
the right in English — a physical side would be wrong in one of them."
```

---

### Task 11: The contact messages list

**Files:**
- Modify: `src/app/features/contact-messages/models/contact-message.model.ts`
- Modify: `src/app/features/contact-messages/services/contact-message.service.ts`
- Modify: `src/app/features/contact-messages/components/contact-messages-list.component.ts`
- Modify: `src/app/features/contact-messages/components/contact-messages-list.component.html`
- Test: `src/app/features/contact-messages/services/contact-message.service.spec.ts` (new)

**Interfaces:**
- Consumes: `GET /api/dashboard/contact-messages`, `GET /api/dashboard/contact-messages/unread`, `GET /api/dashboard/stats/unread-contact-count`.
- Produces:
  - `ContactResponse` gains `emailStatus: 'NONE' | 'PENDING' | 'SENT' | 'FAILED' | 'DEAD'`.
  - `ContactMessageService.getAll`, `.getAllUnread`, `.markAsRead`, `.reply`, `.resendEmail`, `.delete`, `.getUnreadCount`.
  - `ContactMessagesListComponent` — the tabs `All | Unread | Replied`, the unread count from the stats endpoint, the preview line, the relative date, the clickable row.

- [ ] **Step 1: Write the failing service test**

Create `src/app/features/contact-messages/services/contact-message.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ContactMessageService } from './contact-message.service';

describe('ContactMessageService', () => {
  it('asks the unread endpoint for the unread tab', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ContactMessageService],
    });
    const service = TestBed.inject(ContactMessageService);
    const http = TestBed.inject(HttpTestingController);

    service.getAllUnread({ page: 0, size: 100 }).subscribe();

    const request = http.expectOne((r) => r.url.includes('/api/dashboard/contact-messages/unread'));
    expect(request.request.params.get('size')).toBe('100');
    request.flush({ success: true, data: { content: [] } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --include='**/contact-message.service.spec.ts'`

Expected: FAIL — the service does not take a size, or does not exist in that shape.

- [ ] **Step 3: The model and the service**

Add to `ContactResponse`:

```ts
  /** NONE / PENDING / SENT / FAILED / DEAD — the recorded state of the reply email. */
  emailStatus: 'NONE' | 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';
```

Add to the service:

```ts
  /** The TRUE unread count — server-side, so the tab badge is not a guess. */
  getUnreadCount(): Observable<ApiResponse<{ count: number }>> {
    return this.http.get<ApiResponse<{ count: number }>>(
      `${environment.apiUrl}/api/dashboard/stats/unread-contact-count`,
    );
  }

  resendEmail(id: number): Observable<ApiResponse<ContactResponse>> {
    return this.http.post<ApiResponse<ContactResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/resend-email`,
      null,
    );
  }
```

- [ ] **Step 4: The tabs and the counts**

The component keeps `tab` — `'all' | 'unread' | 'replied'` — and loads from the unread endpoint for the unread tab and the main endpoint otherwise. The **Replied** tab filters the loaded set by `isReplied` — the endpoint has no status filter, so this is a client-side filter over the loaded set, and the page loads with `size: 100` (the API's maximum) so the filter sees as much as it can.

The unread count comes from `getUnreadCount()` — the server's number, not the loaded set's.

The header:

```html
      <h1 class="text-2xl font-medium tracking-tight">{{ 'contactMessages.title' | transloco }}</h1>
      <p class="text-sm text-muted-foreground" data-testid="contact-messages-count">
        {{ totalCount() | plural: 'contactMessages.countMessages' }} ·
        {{ unreadCount() | plural: 'contactMessages.countUnread' }}
      </p>
```

`contactMessages.title` is **"Contact messages"** in English — sentence case, not "Contact Messages".

- [ ] **Step 5: The row**

```html
        <button
          type="button"
          class="flex w-full items-start gap-3 border-b px-4 py-3 text-start transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          (click)="openMessage(message)"
        >
          @if (!message.isRead) {
            <span class="mt-2 size-2 shrink-0 rounded-full bg-primary" [attr.aria-label]="'contactMessages.unread' | transloco"></span>
          } @else {
            <span class="mt-2 size-2 shrink-0"></span>
          }
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm" [class.font-semibold]="!message.isRead">{{ message.subject }}</span>
              @if (message.isReplied) {
                <span class="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{{ 'contactMessages.replied' | transloco }}</span>
              }
            </span>
            <!-- the preview: the admin must not have to open every message -->
            <span class="mt-1 block truncate text-xs text-muted-foreground">
              <bdi>{{ message.message }}</bdi>
            </span>
            <span class="mt-1 block text-xs text-muted-foreground">
              {{ message.name }} · {{ message.email }}
            </span>
          </span>
          <span class="shrink-0 text-xs text-muted-foreground" [attr.title]="absoluteTime(message.createdAt)">
            {{ relativeTime(message.createdAt) }}
          </span>
        </button>
```

- [ ] **Step 6: The relative and the absolute time**

Two helpers, one source of truth — `formatRelativeTime` from Task 2 for the relative value, and `formatDateAndTime` from `shared/utils/locale-format` for the tooltip:

```ts
  protected relativeTime(value: string): string {
    return formatRelativeTime(value, this.language.language());
  }

  protected absoluteTime(value: string): string {
    return formatDateAndTime(value, this.language.language());
  }
```

Add the imports `import { formatRelativeTime } from '../../../core/i18n/relative-time';` and `import { formatDateAndTime } from '../../../shared/utils/locale-format';`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test:unit -- --include='**/contact-message.service.spec.ts'`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/features/contact-messages
git commit -m "feat(contact): a list you can read without opening everything

An unread message carries a dot and a bold subject, every row shows the
first line of the message, and the date is relative with the absolute
value in the tooltip. The unread count comes from the server, so the tab
badge is never a guess."
```

---

### Task 12: The message dialog, the reply and the email state

**Files:**
- Modify: `src/app/features/contact-messages/components/contact-messages-list.component.ts`
- Modify: `src/app/features/contact-messages/components/contact-messages-list.component.html`

**Interfaces:**
- Consumes: `app-order-dialog` (the shared dialog shell — focus trap, Escape, focus restore), `ContactMessageService.reply` and `.resendEmail`.
- Produces: the dialog with the subject, the dimmed date, the sender, the original message, the stored reply, the email-state chip, the reply box and the "Send again" action.

- [ ] **Step 1: Add the warning toast**

`NotifyService` has `success` and `apiError` but no warning. Add one — a reply that was saved but NOT emailed is neither a success nor an error:

```ts
  /**
   * A warning: the work happened, but not the way the reader expected.
   * A reply that was saved but not emailed is exactly this.
   */
  warning(messageKey: string, fallback: string): void {
    toast.warning(this.t(messageKey, fallback));
  }
```

Add `toast.warning` to the sonner import if it is not already imported.

- [ ] **Step 2: The dialog**

Use `app-order-dialog` — the shared shell that traps the focus, closes on Escape, restores the focus and never closes on a click inside the panel. **Do not** build a bespoke modal: the old one had no focus trap and no Escape.

```html
      <app-order-dialog
        [open]="selected() !== null"
        [title]="selected()?.subject ?? ''"
        (closed)="closeMessage()"
      >
        @if (selected(); as message) {
          <div class="space-y-4">
            <!-- the date: dimmed text under the subject, no seconds, no pill -->
            <p class="text-xs text-muted-foreground">
              <app-localized-date [value]="message.createdAt" />
            </p>

            <div class="flex items-center justify-between gap-2">
              <p class="text-sm text-muted-foreground">{{ message.name }} · {{ message.email }}</p>
              <button hlmBtn variant="ghost" size="sm" (click)="copyEmail(message.email)">
                {{ 'contactMessages.copyEmail' | transloco }}
              </button>
            </div>

            <div class="rounded-[var(--radius-control)] border p-4">
              <p class="whitespace-pre-wrap text-sm"><bdi>{{ message.message }}</bdi></p>
            </div>

            @if (message.replyContent) {
              <div class="rounded-[var(--radius-control)] border bg-muted/40 p-4">
                <p class="mb-1 text-xs font-medium text-muted-foreground">{{ 'contactMessages.yourReply' | transloco }}</p>
                <p class="whitespace-pre-wrap text-sm"><bdi>{{ message.replyContent }}</bdi></p>
              </div>
            }

            <!-- the email state, as RECORDED -->
            @if (message.emailStatus && message.emailStatus !== 'NONE') {
              <div class="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-xs">
                <span [class.text-success]="message.emailStatus === 'SENT'"
                      [class.text-warning]="message.emailStatus === 'PENDING'"
                      [class.text-destructive-text]="message.emailStatus === 'FAILED' || message.emailStatus === 'DEAD'">
                  {{ emailStatusLabel(message.emailStatus) | transloco }}
                </span>
                @if (message.emailStatus !== 'SENT') {
                  <button hlmBtn variant="ghost" size="sm" (click)="resend(message)">
                    {{ 'contactMessages.sendAgain' | transloco }}
                  </button>
                }
              </div>
            }

            <!-- the reply box -->
            <div class="space-y-2">
              <textarea
                #replyBox
                hlmTextarea
                rows="5"
                class="w-full"
                [placeholder]="'contactMessages.replyPlaceholder' | transloco: { email: message.email }"
                [ngModel]="replyText()"
                (ngModelChange)="replyText.set($event)"
              ></textarea>              <p class="text-xs text-muted-foreground">{{ 'contactMessages.replyNotice' | transloco: { email: message.email } }}</p>
            </div>
          </div>
        }
      </app-order-dialog>
```

`hlmTextarea` — if Spartan has no textarea component in this project, use a plain `<textarea class="w-full rounded-[var(--radius-control)] border bg-background p-3 text-sm">` with the same classes the inputs use. Check `libs/ui/textarea` first.

- [ ] **Step 2: The actions**

The dialog needs its own footer buttons, because `app-order-dialog` has a fixed confirm/cancel pair. Use its `confirmed` output for **Send reply** and `closed` for cancel:

```ts
  protected sendReply(): void {
    const item = this.selected();
    const text = this.replyText().trim();
    if (!item || !text) return;

    this.replying.set(true);
    this.service.reply(item.id, text).subscribe({
      next: (res) => {
        this.replying.set(false);
        if (res?.data) {
          this.selected.set(res.data);
          this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          this.replyText.set('');
          // "Reply sent" ONLY when the email really went out.
          if (res.data.emailStatus === 'SENT') {
            this.notify.success('contactMessages.replySent', 'Reply sent');
          } else {
            this.notify.warning('contactMessages.replySavedNotSent', 'Reply saved, but the email could not be sent');
          }
        }
      },
      error: (err) => {
        this.replying.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not send the reply');
      },
    });
  }
```

**The typed text stays in the box on failure** — the admin's words must not be lost. The `error` branch does not clear `replyText`.

- [ ] **Step 3: The honesty line**

`contactMessages.replyNotice` is, in English: *"The reply is emailed to {email} and saved here."* and in Arabic: *"الرد بيتبعت إيميل على {email} وبيتحفظ هنا."*

**The success toast appears only when `emailStatus === 'SENT'`.** Every other status gets the warning toast and the "Send again" action. This is AC-C12 and it is not negotiable.

- [ ] **Step 4: Opening a message marks it read**

```ts
  protected openMessage(item: ContactResponse): void {
    this.selected.set(item);
    this.replyText.set('');
    if (!item.isRead) {
      this.service.markAsRead(item.id).subscribe({
        next: (res) => {
          if (res?.data) {
            this.selected.set(res.data);
            this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          }
        },
      });
    }
    setTimeout(() => this.replyBox()?.nativeElement.focus());
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/contact-messages
git commit -m "feat(contact): the reply, and the truth about the email

The button says Send reply, and it sends. The success toast appears only
when the recorded email status is SENT; every other status says what
happened and offers Send again. The typed text stays in the box when the
send fails — the admin's words are never lost."
```

---

### Task 13: The terms — the glossary and the two locale files

**Files:**
- Modify: `public/assets/i18n/en.json`
- Modify: `public/assets/i18n/ar.json`
- Modify: `docs/glossary.md`
- Modify: `src/app/core/i18n/i18n-keys.spec.ts`
- Test: `src/app/core/i18n/i18n-keys.spec.ts` (the existing file — extend it)

**Interfaces:**
- Consumes: every key the two pages use.
- Produces: the glossary rows 10–22 pinned in both directions, and the same key set in both locale files.

- [ ] **Step 1: Write the failing glossary test**

Add to `src/app/core/i18n/i18n-keys.spec.ts`:

```ts
/**
 * The reviews and messages vocabulary.
 *
 * One concept, one term, in both languages, in every surface. The AR
 * review status is "قيد المراجعة" and NOT the order status "قيد الانتظار":
 * two different concepts, two different words, and the same word for two
 * concepts is the drift this test exists to catch.
 */
const REVIEWS_MESSAGES_GLOSSARY = [
  {
    concept: 'Review approved',
    keys: ['reviews.status.approved'],
    en: 'Approved',
    ar: 'معتمد',
    forbiddenAr: [/موافق عليه/],
    forbiddenEn: [/\bapproved by\b/i],
  },
  {
    concept: 'Review pending',
    keys: ['reviews.status.pending'],
    en: 'Pending',
    ar: 'قيد المراجعة',
    forbiddenAr: [/غير معتمدة/, /مُفعّل/, /معطّل/],
    forbiddenEn: [/unapproved/i],
  },
  {
    concept: 'Message unread',
    keys: ['contactMessages.unread'],
    en: 'Unread',
    ar: 'غير مقروءة',
    forbiddenAr: [/غير مقروء\b(?!\w)/],
    forbiddenEn: [/^not read$/i],
  },
  {
    concept: 'Message replied',
    keys: ['contactMessages.replied'],
    en: 'Replied',
    ar: 'تم الرد عليها',
    forbiddenAr: [/\bرد\b/],
    forbiddenEn: [/^replied to$/i],
  },
] as const;
```

and a `describe('reviews and messages glossary', ...)` block that, for each entry, asserts the key resolves to the approved word in both locales, and that the forbidden words appear NOWHERE in the `ar` namespace of the entry.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --include='**/i18n-keys.spec.ts'`

Expected: FAIL — the keys do not exist yet.

- [ ] **Step 3: Write the locale files**

Add to `en.json`, under `reviews`. **The plural keys are FLAT** — `base_<category>`, not a nested object (the plural pipe looks up `reviews.countReviews_one`):

```json
  "countReviews_one": "{{count}} review",
  "countReviews_other": "{{count}} reviews",
  "countApproved_one": "{{count}} approved",
  "countApproved_other": "{{count}} approved",
  "countPending_one": "{{count}} pending",
  "countPending_other": "{{count}} pending",
  "tabs": { "label": "Review status", "pending": "Pending", "approved": "Approved", "all": "All" },
  "status": { "approved": "Approved", "pending": "Pending" },
  "withdrawApproval": "Withdraw approval",
  "emptyState": { "noReviews": "No reviews yet", "noResults": "No reviews match these filters" },
  "bulk": { "selected": "{{count}} selected", "approve": "Approve selected", "clear": "Clear selection", "approved": "Reviews approved" },
  "columns": {
    "product": "Product",
    "reviewer": "Reviewer",
    "rating": "Rating",
    "comment": "Comment",
    "verifiedPurchase": "Verified purchase"
  },
  "filters": { "status": "Status", "statusAll": "Status: All", "product": "Product", "dateRange": "Date range", "rating": "Minimum rating", "verification": "Verification", "clear": "Clear filters" }
```

and under `contactMessages`:

```json
  "countMessages_one": "{{count}} message",
  "countMessages_other": "{{count}} messages",
  "countUnread_one": "{{count}} unread",
  "countUnread_other": "{{count}} unread",
  "unread": "Unread",
  "read": "Read",
  "replied": "Replied",
  "archived": "Archived",
  "yourReply": "Your reply",
  "copyEmail": "Copy email",
  "emailSent": "Email sent",
  "emailNotSent": "Email not sent",
  "emailQueued": "Queued for retry",
  "sendAgain": "Send again",
  "replyPlaceholder": "Reply to {{email}}",
  "replyNotice": "The reply is emailed to {{email}} and saved here.",
  "replySent": "Reply sent",
  "replySavedNotSent": "Reply saved, but the email could not be sent",
  "tabs": { "label": "Message state", "all": "All", "unread": "Unread", "replied": "Replied" }
```

Add the Arabic counterparts in `ar.json` — with the **pinned** terms. The Arabic plural families must be COMPLETE: the `i18n-keys.spec.ts` test checks every family against `Intl.PluralRules` for `ar-EG`, and the six reachable categories are zero, one, two, few, many, other:

```json
  "countReviews_zero": "{{count}} تقييم",
  "countReviews_one": "تقييم واحد",
  "countReviews_two": "تقييمان",
  "countReviews_few": "{{count}} تقييمات",
  "countReviews_many": "{{count}} تقييمًا",
  "countReviews_other": "{{count}} تقييم",
  "countApproved_zero": "لا معتمد",
  "countApproved_one": "معتمد واحد",
  "countApproved_two": "معتمدان",
  "countApproved_few": "{{count}} معتمد",
  "countApproved_many": "{{count}} معتمدًا",
  "countApproved_other": "{{count}} معتمد",
  "countPending_zero": "لا قيد للمراجعة",
  "countPending_one": "قيد المراجعة واحد",
  "countPending_two": "قيد المراجعة اثنان",
  "countPending_few": "{{count}} قيد المراجعة",
  "countPending_many": "{{count}} قيد المراجعة",
  "countPending_other": "{{count}} قيد المراجعة",
  "countMessages_zero": "لا رسالة",
  "countMessages_one": "رسالة واحدة",
  "countMessages_two": "رسالتان",
  "countMessages_few": "{{count}} رسائل",
  "countMessages_many": "{{count}} رسالة",
  "countMessages_other": "{{count}} رسالة",
  "countUnread_zero": "لا غير مقروءة",
  "countUnread_one": "غير مقروءة واحدة",
  "countUnread_two": "غير مقروءتان",
  "countUnread_few": "{{count}} غير مقروءة",
  "countUnread_many": "{{count}} غير مقروءة",
  "countUnread_other": "{{count}} غير مقروءة",
  "status": { "approved": "معتمد", "pending": "قيد المراجعة" },
  "tabs": { "label": "حالة الرسالة", "all": "الكل", "unread": "غير مقروءة", "replied": "تم الرد عليها" },
  "unread": "غير مقروءة",
  "read": "مقروءة",
  "replied": "تم الرد عليها",
  "yourReply": "ردّك",
  "copyEmail": "نسخ البريد الإلكتروني",
  "emailSent": "تم إرسال الإيميل",
  "emailNotSent": "لم يتم إرسال الإيميل",
  "emailQueued": "في الانتظار",
  "sendAgain": "إعادة الإرسال",
  "replyPlaceholder": "رد على {{email}}",
  "replyNotice": "الرد بيتبعت إيميل على {{email}} وبيتحفظ هنا.",
  "replySent": "تم إرسال الرد",
  "replySavedNotSent": "تم حفظ الرد، بس الإيميل ما اتبعتش"
```

The English `contactMessages.title` stays **"Contact messages"** — sentence case. The Arabic is "رسائل التواصل".

- [ ] **Step 4: Write the glossary rows**

Append to `docs/glossary.md`, following the table format already in the file:

| # | Concept | English | Arabic |
|---|---|---|---|
| 10 | Review moderation state — settled | Approved | معتمد |
| 11 | Review moderation state — awaiting a decision | Pending | قيد المراجعة |
| 12 | Review — the purchase behind it is confirmed | Verified purchase | شراء موثق |
| 13 | Message state — not yet opened | Unread | غير مقروءة |
| 14 | Message state — opened, no answer yet | Read | مقروءة |
| 15 | Message state — answered | Replied | تم الرد عليها |
| 16 | Action — approve a review | Approve | اعتماد |
| 17 | Action — take the approval back | Withdraw approval | سحب الاعتماد |
| 18 | Page title — the reviews list | Reviews | التقييمات |
| 19 | Page title — the messages list | Contact messages | رسائل التواصل |
| 20 | Count line — the counted reviews | reviews | تقييمات |
| 21 | Count line — the counted messages | messages | رسائل |
| 22 | The stored answer on a message | Your reply | ردّك |

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- --include='**/i18n-keys.spec.ts'`

Expected: PASS.

- [ ] **Step 6: Run the whole unit suite**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/assets/i18n/en.json public/assets/i18n/ar.json docs/glossary.md src/app/core/i18n/i18n-keys.spec.ts
git commit -m "feat(i18n): one term per concept for the reviews and the messages

The review status is 'Approved'/'معتمد' and 'Pending'/'قيد المراجعة' — and
NOT the order status 'قيد الانتظار': two concepts, two words. The same
word for two concepts is the drift the glossary test exists to catch."
```

---

### Task 14: The E2E, the four cells, the evidence

**Files:**
- Create: `e2e/reviews.spec.ts`
- Create: `e2e/contact-messages.spec.ts`
- Modify: `e2e/verify-tables.spec.ts` (add the reviews route)

**Interfaces:**
- Consumes: both pages, as built.
- Produces: the E2E coverage of the acceptance criteria, and the four-cell screenshots.

- [ ] **Step 1: Add the reviews route to the table contract test**

In `e2e/verify-tables.spec.ts`, add to `ROUTES`:

```ts
  { path: '/dashboard/reviews', label: 'reviews', maxActions: 130, hasThumbnail: true, thumbnailShape: 'square', minDominance: 2 },
```

The reviews table has ONE unsized column — the product cell — so it dominates the actions column by a wide margin.

- [ ] **Step 2: Write the reviews E2E**

Create `e2e/reviews.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.goto('/dashboard/reviews');
});

test('the pending tab is the default and the count line names the entity', async ({ page }) => {
  await expect(page.getByTestId('reviews-count')).toContainText('review');
  await expect(page.getByRole('tab', { name: /Pending/i })).toHaveAttribute('aria-selected', 'true');
});

test('a comment keeps its punctuation at the end of the sentence', async ({ page }) => {
  const comment = page.locator('td[data-column="comment"] bdi').first();
  const text = (await comment.textContent())?.trim() ?? '';
  expect(text.startsWith('.') || text.startsWith('!')).toBe(false);
});
```

> The `data-column` attribute is not in the shared table. Add ` [attr.data-column]="cell.column.id"` to the `<td>` in `data-table.component.html` — it is a small, useful addition and it makes the cells addressable from a test.

- [ ] **Step 3: Write the contact messages E2E**

Create `e2e/contact-messages.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.goto('/dashboard/contact-messages');
});

test('the title is sentence case and the count line names the entity', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact messages');
  await expect(page.getByTestId('contact-messages-count')).toContainText('message');
});

test('an unread message carries a dot and a bold subject', async ({ page }) => {
  const row = page.locator('[data-testid="message-row"]').first();
  await expect(row.locator('[data-testid="unread-dot"]')).toBeVisible();
});
```

Add `data-testid="message-row"` and `data-testid="unread-dot"` to the row markup in Task 11's step 5.

- [ ] **Step 4: The four-cell capture**

Copy the cell matrix from `e2e/verify-tables.spec.ts`:

```ts
const CELLS = [
  { name: 'EN light', lang: 'en', theme: 'light' },
  { name: 'EN dark', lang: 'en', theme: 'dark' },
  { name: 'AR light', lang: 'ar', theme: 'light' },
  { name: 'AR dark', lang: 'ar', theme: 'dark' },
] as const;
```

and the mechanism: set `localStorage.setItem('language', lang)` and `localStorage.setItem('nocteon-theme', theme)` before the navigation, then load the page. The language key is `language`; the theme key is `nocteon-theme`.

Capture a screenshot of BOTH pages in EVERY cell into `evidence/reviews-messages/<cell>/`. The evidence directory is gitignored — the artifacts are evidence, not source.

- [ ] **Step 5: Run the E2E suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add e2e/reviews.spec.ts e2e/contact-messages.spec.ts e2e/verify-tables.spec.ts src/app/shared/components/data-table/data-table.component.html
git commit -m "test(reviews): the moderation console and the message list

The four cells — light/dark × EN/AR — are captured for both pages, and the
shared table's contract test now covers the reviews route."
```

---

## Done means

- `npm run test:unit` is green, including the new glossary pins.
- `npm test` is green.
- The Reviews page opens on the **Pending** tab; the count line reads "15 reviews · 13 approved · 2 pending" / "15 تقييمات · 13 معتمد · 2 قيد المراجعة".
- The table is the default; the grid is optional and the choice survives a reload.
- A comment in the Arabic page keeps its punctuation at the end of the sentence.
- A date reads "13 Oct 2026" — never `10/20/26`.
- The Contact Messages page shows an unread dot, a bold subject and a one-line preview; the title is "Contact messages".
- "Send reply" only says "Reply sent" when the recorded email status is `SENT`; every other status says what happened and offers "Send again".
- A clicked sidebar item keeps no ring, and the focus lands on the page heading.
- Screenshots of both pages exist for all four cells.
- The Evidence Gate exits 0 with every acceptance criterion mapped to a real artifact.
