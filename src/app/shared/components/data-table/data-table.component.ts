import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  ColumnDef,
  getCoreRowModel,
  createAngularTable,
  SortingState,
  getSortedRowModel,
} from '@tanstack/angular-table';

import { ActionsCellComponent, type RowMenuAction } from '../../ui/actions-cell/actions-cell.component';
import { StatusCellComponent } from '../../ui/status-cell/status-cell.component';
import { DeletedBadgeComponent } from '../../ui/deleted-badge/deleted-badge.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../pipes/money.pipe';
import { PluralPipe } from '../../pipes/plural.pipe';
import { LocalizedDateComponent } from '../../ui/localized-date/localized-date.component';
import { ImageCellComponent } from '../../ui/image-cell/image-cell.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideStar, lucideCreditCard, lucideBanknote, lucideBadgeCheck, lucideTriangleAlert } from '@ng-icons/lucide';
import { heroStarSolid } from '@ng-icons/heroicons/solid';
import { heroStar } from '@ng-icons/heroicons/outline';
import { ColorCellComponent } from '../color-cell/color-cell.component';
import { MainCellComponent } from './main-cell/main-cell.component';
import { UserAvatarComponent } from '../../ui/user-avatar/user-avatar.component';
import { StatusBadgeComponent } from '../../ui/status-badge/status-badge.component';
import { RatingStarsComponent } from '../../ui/rating-stars/rating-stars.component';
import { VerifiedBadgeComponent } from '../../ui/verified-badge/verified-badge.component';
import { LocalizedNameService } from '../../../core/i18n/localized-name.service';
import { LocalizedDateService } from '../../../core/i18n/localized-date.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { formatRelativeTime } from '../../../core/i18n/relative-time';

export interface TableSortEvent {
  column: string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-data-table',
  imports: [UserAvatarComponent, ImageCellComponent, ActionsCellComponent, StatusCellComponent, DeletedBadgeComponent, LocalizedDateComponent, ColorCellComponent, MainCellComponent, StatusBadgeComponent, RatingStarsComponent, VerifiedBadgeComponent, NgIcon, TranslocoPipe, RouterModule, MoneyPipe, PluralPipe],
  providers: [provideIcons({ lucideStar, lucideCreditCard, lucideBanknote, lucideBadgeCheck, lucideTriangleAlert, heroStarSolid, heroStar })],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent {
  /**
   * Column headers are hardcoded English across every list. This dictionary
   * translates the shared vocabulary through Transloco (reactive on language
   * change); anything unmapped passes through untouched.
   */
  static readonly HEADER_KEYS: Record<string, string> = {
    ID: 'common.id',
    Image: 'common.image',
    Slug: 'common.slug',
    Status: 'common.status',
    'Created At': 'common.createdAt',
    'created at': 'common.createdAt',
    // The orders list writes the header in sentence case ("Created at"), and
    // the map is keyed by the RAW header string — without this entry the
    // header stayed English in Arabic.
    'Created at': 'common.createdAt',
    Created: 'common.createdAt',
    'Updated At': 'common.updatedAt',
    'Deleted At': 'common.deletedAt',
    Deleted: 'common.deleted',
    Actions: 'common.actions',
    Name: 'common.name',
    Price: 'common.price',
    Type: 'common.type',
    Featured: 'common.featured',
    Discount: 'common.discount',
    Email: 'common.email',
    Username: 'common.username',
    Role: 'common.role',
    Active: 'common.active',
    Code: 'common.code',
    Cities: 'common.cities',
    Color: 'common.color',
    Customer: 'common.customer',
    Expires: 'common.expires',
    'Free Shipping Threshold': 'common.freeShippingThreshold',
    'Full Name': 'common.fullName',
    'Shipping Cost': 'common.shippingCost',
    Items: 'common.items',
    Origin: 'common.origin',
    'منشأ': 'common.origin',
    Farm: 'common.farm',
    'مزرعة': 'common.farm',
    Restore: 'common.restore',
    'استعادة': 'common.restore',
    'Delete permanently': 'common.deletePermanently',
    'حذف نهائي': 'common.deletePermanently',
    Method: 'common.paymentMethod',
    Payment: 'common.paymentStatus',
    'Price Range': 'common.priceRange',
    Value: 'common.value',
    // `common.total` is the count suffix ("12 total"), so the column needs its
    // own header key.
    Total: 'common.totalHeader',
    Scope: 'common.scope',
    Avatar: 'common.avatar',
    Joined: 'common.joined',
    // Categories list (main-cell + other-language name column headers).
    // Both UI languages' literals map to the same keys, so 'Category' /
    // 'فئة' and 'Arabic name' / 'الاسم بالعربية' resolve instead of leaking
    // raw strings into the transloco pipe ("Missing translation for ...").
    Category: 'common.categoryHeader',
    فئة: 'common.categoryHeader',
    // Converted soft-delete pages: entity column headers (singular).
    'Roast Level': 'common.roastLevel',
    'Processing Method': 'common.processingMethod',
    'Coffee Variety': 'common.coffeeVariety',
    'Tasting Note': 'common.tastingNote',
    // Trash tail column header (already mapped above).
    'الاسم بالعربية': 'common.nameArabic',
    'الاسم بالإنجليزية': 'common.nameEnglish',
    // The orders list has its own vocabulary: the order number, the order
    // status and the method are order concepts, not generic ones, and they
    // must read the same in the list, the detail page and the export.
    'Order #': 'orders.columns.orderNumber',
    'Order status': 'orders.columns.status',
    'Payment status': 'orders.columns.paymentStatus',
    // The reviews console (a moderation table, not an order table).
    Product: 'reviews.columns.product',
    Reviewer: 'reviews.columns.reviewer',
    Rating: 'reviews.columns.rating',
    Comment: 'reviews.columns.comment',
  };

  headerKey(raw: unknown): string {
    const text = String(raw ?? '').trim();
    return DataTableComponent.HEADER_KEYS[text] ?? text;
  }

  /**
   * Phase 1.1/1.6: bilingual name headers arrive as `Name (English)` /
   * `Name (عربي)`. Returns the parenthesized fragment so the template renders
   * `الاسم (English)` with the Latin part isolated in <bdi>.
   */
  headerNameLang(raw: unknown): string {
    const m = /^Name \((.+)\)$/.exec(String(raw ?? '').trim());
    return m ? m[1] : '';
  }

  /**
   * Content-language direction for a column. Latin-text columns (slug,
   * English name) are always ltr; the Arabic name column is always rtl — in
   * BOTH UI languages. Language-neutral content (numeric id) follows the page
   * direction (null = inherit).
   *
   * Correction C: this value is pinned on the <bdi> INSIDE the cell, never on
   * the th/td themselves — the cell keeps no dir of its own, so its
   * `text-align: start` resolves against the table dir (the UI direction) and
   * every column's text sits on one shared edge. A dir on the cell would make
   * `start` follow content language instead, pushing the other language's
   * name to the far edge of its column and leaving hundreds of px of dead
   * space for the reader to cross.
   */
  contentDir(columnId: string): string {
    if (columnId === 'name_ar') return 'rtl';
    if (columnId === 'name_en' || columnId === 'slug') return 'ltr';
    return '';
  }


  data = input<any[]>([]);
  columns = input<ColumnDef<any, any>[]>([]);

  /**
   * The technical `id` column is reference noise for a human reading a list, so
   * it is hidden by default. A page that genuinely wants it (Categories, via its
   * Columns menu) opts in rather than every other page opting out.
   */
  showId = input<boolean>(false);

  /** Columns actually handed to the table — drops `id` unless the page opted in. */
  private readonly renderedColumns = computed(() => {
    if (this.showId()) return this.columns();
    return this.columns().filter((column) => {
      // `accessor('id')` leaves `column.id` undefined — the resolved id comes from
      // `accessorKey` — so both forms must be checked.
      const id = column.id ?? (column as { accessorKey?: unknown }).accessorKey;
      return id !== 'id';
    });
  });

  /** Column count actually rendered — used for the empty-state `colspan`. */
  readonly renderedColumnCount = computed(() => this.renderedColumns().length);

  /**
   * Render-order column ids for the first-load skeleton: the stub rows must
   * mirror the real column layout (same td padding, same visual/narrow
   * collapses), so the shape the user sees is the shape that fills in.
   */
  readonly skeletonColumns = computed(() =>
    this.renderedColumns().map(
      (column) => (column.id ?? (column as { accessorKey?: unknown }).accessorKey) as string,
    ),
  );

  loading = input<boolean>(false);
  emptyMessage = input<string>('No data found');
  /** Optional action button shown in the empty state (e.g., "Clear filters"). */
  emptyAction = input<{ label: string; action: () => void } | null>(null);
  /**
   * The horizontal padding of the cells.
   *
   * <p>The default is the roomy `px-4`. A table with many columns can ask
   * for `px-3` and give every column eight more pixels for the content —
   * the difference between a truncated value and a whole one.
   */
  cellPadding = input<string>('px-4');
  /**
   * Optional fixed row height (for example `72px`). When empty the row keeps
   * its natural content height. The height acts as a minimum in CSS tables,
   * so the tallest cell still wins if it needs more room.
   */
  rowHeight = input<string>('');
  sortChange = output<TableSortEvent | null>();
  edit = output<any>();
  statusToggle = output<any>();
  featuredToggle = output<any>();
  delete = output<any>();
  restore = output<any>();
  permanentDelete = output<any>();
  rowClick = output<any>();
  hasView = output<boolean>();
  initialSort = input<TableSortEvent | null>(null);

  /**
   * The row's overflow menu (see `RowMenuAction`).
   *
   * A list with more than two row actions shows one and hides the rest in a
   * kebab menu, so the actions column stays narrow.
   */
  menuActions = input<RowMenuAction[]>([]);
  /** Per-row overflow menu. Wins over `menuActions` when supplied. */
  menuActionsFor = input<((row: any) => RowMenuAction[]) | null>(null);

  /**
   * The row's PRIMARY action — a LABELLED button, not an icon.
   *
   * <p>An unlabelled icon makes the reader guess what it does, and a review
   * approved by mistake reaches a customer.
   */
  primaryAction = input<{ id: string; label: string } | null>(null);
  primaryActionFor = input<((row: any) => { id: string; label: string } | null) | null>(null);
  reservePrimarySlot = input<boolean>(false);

  /**
   * Hides the slug under the name in the main cell.
   *
   * The slug is a technical handle. A table whose main column IS the
   * identifier — the reviews console shows the PRODUCT — does not want it.
   */
  hideSlug = input(false);
  /** The chosen menu entry, with the row it belongs to. */
  menuAction = output<{ id: string; item: any }>();

  // NEW: Generic action permissions & labels
  editPermission = input<string>('category:update');
  deletePermission = input<string>('category:delete');
  editLabel = input<string>('Edit');
  deleteLabel = input<string>('common.delete');
  destructiveDelete = input<boolean>(true);
  restoreLabel = input<string>('common.restore');
  restorePermission = input<string>('category:delete');
  permanentDeleteLabel = input<string>('common.deletePermanently');
  permanentDeletePermission = input<string>('category:delete');

  // Per-page action visibility toggles
  showEdit = input<boolean>(true);
  showView = input<boolean>(true);
  showDelete = input<boolean>(true);
  showRestore = input<boolean>(false);
  showPermanentDelete = input<boolean>(false);

  /**
   * Makes the row's own detail page reachable from the table: the cell is
   * rendered as a clickable control that emits `rowClick`, and the page routes.
   *
   * Two shapes, because the two kinds of column carry their value differently:
   *
   *  - `main_en` / `main_ar` render through `app-main-cell`: the NAME becomes
   *    the row's single clickable control (real anchor when the host supplies
   *    an href builder).
   *  - A real column id (e.g. `slug` on the catalog lists) is unaffected: the
   *    slug stays a plain handle. One clickable control per row — the name.
   *
   * Empty (the default) leaves every cell inert. Pages that cannot reach a
   * detail view for a row (the trash tab) pass `''` so nothing looks clickable
   * and then does nothing.
   */
  navigableColumn = input<string>('');

  private readonly language = inject(LanguageService);
  /** The shared localized-name helper — the method label is translated at render time. */
  protected readonly names = inject(LocalizedNameService);
  protected readonly dates = inject(LocalizedDateService);

  /**
   * The entity-identity name column of the CURRENT UI language (`name_en` /
   * `name_ar`, the 8 catalog lists). Only that cell is the row's single
   * clickable control; the other language's name stays plain text with its
   * tooltip, exactly like the categories main-cell pattern.
   */
  isNameCell(columnId: string): boolean {
    return this.navigableColumn() !== '' && columnId === `name_${this.language.language()}`;
  }

  /**
   * Returns the routerLink command for a row's detail page, when the table
   * should expose real anchors on the name (middle-click / open-in-new-tab
   * work). The Categories list supplies it; lists that navigate through a
   * click handler leave it unset — their name then renders inert, because a
   * plain span that does nothing would be worse than no control at all.
   */
  navigableHref = input<(row: any) => any[] | null>(() => null);

  /**
   * A router command for ONE cell of a row, by column id.
   *
   * The generic way for a list to make a cell a real link: the table knows
   * nothing about orders, products or carts — the page says which column is
   * a link and where it points. A cell with a command renders a real anchor
   * (middle-click and open-in-new-tab work).
   */
  cellHref = input<(columnId: string, row: any) => any[] | null>(() => null);

  /**
   * The whole row is clickable.
   *
   * The click is ignored when it lands on something interactive inside the
   * row (a link, a button, a checkbox), so the row's own link and its row
   * actions keep working.
   */
  clickableRows = input<boolean>(false);

  /**
   * The column that STICKS to the inline start when the table scrolls
   * sideways.
   *
   * A table that is wider than the screen has to scroll, and a reader who
   * has scrolled to the price must still be able to see WHICH order the
   * price belongs to. The column is pinned to the inline start (the right in
   * Arabic), so it stays where the eye expects it.
   */
  stickyStartColumn = input<string>('');

  /** True when this column is the pinned one. */
  isStickyStart(columnId: string): boolean {
    return this.stickyStartColumn() !== '' && columnId === this.stickyStartColumn();
  }

  /**
   * The offset of the pinned column, in px.
   *
   * The select checkbox sits BEFORE the pinned column, so it is pinned too
   * and the pinned column starts after it.
   */
  readonly stickyStartOffset = 40;

  /**
   * A click on a clickable row. Interactive elements inside the row are
   * left alone.
   */
  onRowClick(event: MouseEvent, row: any): void {
    if (!this.clickableRows()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button, input, select, textarea, label, [role="button"]')) return;
    this.rowClick.emit(row);
  }

  /**
   * Detail-page command for a row. Returns null when the table is not
   * navigable (e.g. the trash tab) or the list supplied no href builder — so
   * no dead-looking control is ever rendered.
   */
  hrefFor(row: any): any[] | null {
    if (!this.navigableColumn()) return null;
    return this.navigableHref()(row);
  }

  /**
   * Floor width for the table. Set it to the sum of the page's column widths so
   * `table-fixed` never has to squeeze columns below their budget.
   */
  minWidth = input<string>('760px');

  // ─── Selection (bulk actions) ─────────────────────────────────────────────────

  /** Shows the checkbox column. Off by default — only bulk-capable tables use it. */
  selectable = input<boolean>(false);
  selectAllLabel = input<string>('Select all rows');
  selectRowLabel = input<string>('Select row');

  /** Row ids currently selected. Pages own the set; the table only reflects it. */
  selectedIds = input<ReadonlySet<number>>(new Set());
  /** Row-id accessor — selection is keyed on the backend id, not the page key. */
  rowId = input<(row: any) => number | null>(() => null);
  readonly selectionChange = output<{ id: number; checked: boolean }>();
  readonly toggleAllChange = output<boolean>();

  allSelected(): boolean {
    const rows = this.data();
    if (rows.length === 0) return false;
    const ids = rows.map((r) => this.rowId()(r)).filter((id): id is number => id !== null);
    const selected = this.selectedIds();
    return ids.length > 0 && ids.every((id) => selected.has(id));
  }

  someSelected(): boolean {
    const selected = this.selectedIds();
    return this.data().some((r) => {
      const id = this.rowId()(r);
      return id !== null && selected.has(id);
    });
  }

  isSelected(row: any): boolean {
    const id = this.rowId()(row);
    return id !== null && this.selectedIds().has(id);
  }

  onToggleRow(row: any, checked: boolean): void {
    const id = this.rowId()(row);
    if (id === null) return;
    this.selectionChange.emit({ id, checked });
  }

  /**
   * "3 days ago" for the Deleted column. Uses Intl.RelativeTimeFormat with the
   * document language, so Arabic renders "قبل 3 أيام" without extra keys.
   * For very recent times (< 1 minute), returns "Just now" / "الآن" instead of "now".
   */
  relativeTime(value: unknown): string {
    return formatRelativeTime(value, this.language.language());
  }

  sorting = signal<SortingState>([]);
  constructor() {
    // كل مرة initialSort يتغيّر من الأب، زامن الحالة الداخلية
    effect(() => {
      const s = this.initialSort();
      this.sorting.set(s ? [{ id: s.column, desc: s.direction === 'desc' }] : []);
    });
  }

  /**
   * Column widths. `table-fixed` ignores content width, so every column needs an
   * explicit budget — otherwise one long value (a date, a name) stretches the
   * column and pushes Actions off-screen. Pages can override per column with
   * `columnHelper.accessor(x, { meta: { width: '...' } })`.
   *
   * Design rule: secondary/metadata columns get an explicit, tight budget and the
   * PRIMARY name/identifier column is deliberately left out of this map. In
   * `table-fixed` the unsized column absorbs all the leftover width, so the name
   * the reader actually scans gets the space while dates, statuses and actions
   * stay compact. (Previously *every* unnamed column split the remainder evenly
   * and `actions` — absent from the map — greedily took the largest share.)
   *
   * Deliberately left unsized (exactly ONE flex column per table, and it must be
   * the primary column — a name or identifier, never metadata): `main_en`/
   * `main_ar` (Categories), `name_en`, `name` (Products, Shipping Zones),
   * `username` (Users), `userFullName` (Carts).
   *
   * A table whose columns are ALL budgeted has no flex column, so the browser
   * spreads the leftover proportionally and every column (actions included)
   * grows a little — bounded and visually even (see promo-codes). That is the
   * preferred outcome for tables with no name column; sizing only *some*
   * metadata columns would make an arbitrary one absorb the remainder.
   *
   * Widths are validated by `e2e/verify-tables.spec.ts`.
   */
  static readonly COLUMN_WIDTHS: Record<string, string> = {
    id: '48px',
    image: '56px',
    primaryImageUrl: '56px',
    avatar: '56px',
    color: '56px',
    status: '96px',
    isActive: '96px',
    active: '96px',
    featured: '96px',
    slug: '200px',
    name: '220px',
    // The other language's name is an entity name, not a slug: at a slug-sized
    // box (132px) a real Arabic name was cut to ~17 characters while the
    // same-language name column absorbed hundreds of px of empty space. Nine
    // lists build a `name_${lang}` column; `name_en` stays unsized so it keeps
    // absorbing the leftover, `name_ar` gets a share of the row instead.
    name_ar: '28%',
    // The carts list scans the CUSTOMER, not the email. It had no width of
    // its own, so it shared the leftover with the other unsized columns and
    // ended up NARROWER than the actions column it is supposed to dominate.
    userFullName: '28%',
    // 120px, not 104px: "Created at" + its sort arrow needs ~82px inside
    // px-4 padding (32px), so at 104px the header rendered as "Created... ↓".
    // Everything that shares these three ids gets the same fix.
    createdAt: '120px',
    updatedAt: '120px',
    deletedAt: '120px',
    validUntil: '104px',
    joined: '104px',
    deleted: '132px',
    actions: '116px',
    // Secondary identifiers / metadata.
    code: '150px',
    origin: '130px',
    originSlug: '160px',
    role: '110px',
    email: '180px',
    userEmail: '180px',
    fullName: '150px',
    cities: '170px',
    shippingCost: '120px',
    freeShippingThreshold: '120px',
    totalAmount: '110px',
    total: '100px',
    itemCount: '90px',
    paymentStatus: '120px',
    paymentMethod: '130px',
    // The orders list needs a WIDER method column: "Cash on delivery" /
    // "الدفع عند الاستلام" must never be truncated, so the column is budgeted
    // for the longest label in both languages.
    orderNumber: '170px',
    customer: '24%',
    createdAtTime: '150px',
    scopeType: '110px',
    discountType: '110px',
    discountValue: '100px',
    priceRange: '130px',
    // The reviews console. `main_en`/`main_ar` (the product cell) stays
    // UNSIZED — it is the table's one flex column and takes the remainder,
    // so the comment and the dates stay compact.
    reviewer: '125px',
    rating: '150px',
    statusReview: '95px',
  };

  /** Resolves the width for a column id: explicit meta wins over the defaults. */
  widthFor(columnId: string, columnDef?: ColumnDef<any, any>): string | null {
    const metaWidth = (columnDef?.meta as { width?: string } | undefined)?.width;
    if (metaWidth) return metaWidth;
    if (
      columnId === 'actions' &&
      (this.showRestore() || this.showPermanentDelete())
    ) {
      // Trash rows use labeled TEXT buttons (Restore ≈73px + Delete
      // permanently ≈153px + gap + td px-4 = ~260px), not the 116px icon
      // pair — the icon budget overflowed and forced a horizontal table
      // scroll on every trash view.
      return '264px';
    }
    return DataTableComponent.COLUMN_WIDTHS[columnId] ?? null;
  }

  /** The five stars of a rating cell. */
  protected readonly ratingStars = [0, 1, 2, 3, 4];

  /** Columns whose values are numbers — end-aligned with tabular figures. */
  private static readonly NUMERIC_COLUMNS = new Set([
    'id',
    'price',
    'quantity',
    'stock',
    'amount',
    'total',
    'totalAmount',
    'priceRange',
    'quantitySold',
  ]);

  isNumericColumn(columnId: string): boolean {
    return DataTableComponent.NUMERIC_COLUMNS.has(columnId);
  }

  /**
   * Is this column end-aligned?
   *
   * The default is START alignment for every column, because the header must
   * sit exactly over its values (see the note in the stylesheet). A column
   * opts into end alignment with `meta: { align: 'end' }` — the orders list
   * does that for its Total column, where the numbers read better against a
   * shared edge.
   *
   * The header AND the cell are switched by the same flag; a mismatch is
   * what the earlier price column had.
   */
  isEndAligned(columnDef?: ColumnDef<any, any>): boolean {
    return (columnDef?.meta as { align?: string } | undefined)?.align === 'end';
  }

  /**
   * Columns whose value is a thumbnail/swatch — the picture says it, so the
   * header text is kept for screen readers only instead of being truncated to
   * "I…" in a 56px column.
   */
  private static readonly VISUAL_COLUMNS = new Set(['image', 'primaryImageUrl', 'avatar', 'color']);

  isVisualColumn(columnId: string): boolean {
    return DataTableComponent.VISUAL_COLUMNS.has(columnId);
  }

  table = createAngularTable<any>(() => ({
    data: this.data(),
    columns: this.renderedColumns(),
    state: { sorting: this.sorting() },
    manualSorting: true,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(this.sorting()) : updater;
      this.sorting.set(next);
      if (next.length > 0) {
        this.sortChange.emit({ column: next[0].id, direction: next[0].desc ? 'desc' : 'asc' });
      } else {
        this.sortChange.emit(null);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  }));
}
