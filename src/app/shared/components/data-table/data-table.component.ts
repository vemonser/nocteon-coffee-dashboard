import { Component, computed, effect, input, output, signal } from '@angular/core';
import {
  ColumnDef,
  getCoreRowModel,
  createAngularTable,
  SortingState,
  getSortedRowModel,
} from '@tanstack/angular-table';

import { ActionsCellComponent } from '../../ui/actions-cell/actions-cell.component';
import { StatusCellComponent } from '../../ui/status-cell/status-cell.component';
import { DeletedBadgeComponent } from '../../ui/deleted-badge/deleted-badge.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalizedDateComponent } from '../../ui/localized-date/localized-date.component';
import { ImageCellComponent } from '../../ui/image-cell/image-cell.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideStar } from '@ng-icons/lucide';
import { ColorCellComponent } from '../color-cell/color-cell.component';
import { MainCellComponent } from './main-cell/main-cell.component';

export interface TableSortEvent {
  column: string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-data-table',
  imports: [ImageCellComponent, ActionsCellComponent, StatusCellComponent, DeletedBadgeComponent, LocalizedDateComponent, ColorCellComponent, MainCellComponent, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideStar })],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent {
  /**
   * Column headers are hardcoded English across every list. This dictionary
   * translates the shared vocabulary through Transloco (reactive on language
   * change); anything unmapped passes through untouched.
   */
  private static readonly HEADER_KEYS: Record<string, string> = {
    ID: 'common.id',
    Image: 'common.image',
    Slug: 'common.slug',
    Status: 'common.status',
    'Created At': 'common.createdAt',
    'created at': 'common.createdAt',
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
   * direction ('' = inherit), so it sits on the UI edge in each language.
   * The template binds the same value to th and td so the header and its
   * cells share one edge.
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
  loading = input<boolean>(false);
  emptyMessage = input<string>('No data found');
  sortChange = output<TableSortEvent | null>();
  edit = output<any>();
  delete = output<any>();
  restore = output<any>();
  permanentDelete = output<any>();
  rowClick = output<any>();
  hasView = output<boolean>();
  initialSort = input<TableSortEvent | null>(null);

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
   *  - A real column id (e.g. `slug` on the 8 catalog lists) renders that cell's
   *    value as the control.
   *  - `main_en` / `main_ar` render through `app-main-cell`, which has no single
   *    value to wrap, so any non-empty value makes the slug line inside the cell
   *    the control instead — this is how `categories` links out, its slug having
   *    no column of its own.
   *
   * Empty (the default) leaves every cell inert. Pages that cannot reach a
   * detail view for a row (the trash tab) pass `''` so nothing looks clickable
   * and then does nothing.
   */
  navigableColumn = input<string>('');

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
   */
  relativeTime(value: unknown): string {
    if (!value) return '';
    const then = new Date(value as string).getTime();
    if (Number.isNaN(then)) return '';
    const locale = document.documentElement.lang || 'en';
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['year', 365 * 24 * 3600e3],
      ['month', 30 * 24 * 3600e3],
      ['week', 7 * 24 * 3600e3],
      ['day', 24 * 3600e3],
      ['hour', 3600e3],
      ['minute', 60e3],
    ];
    const diff = then - Date.now();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (const [unit, ms] of units) {
      if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
    }
    return rtf.format(0, 'second');
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
  readonly columnWidths: Record<string, string> = {
    id: '48px',
    image: '56px',
    primaryImageUrl: '56px',
    avatar: '56px',
    color: '56px',
    status: '96px',
    isActive: '96px',
    active: '96px',
    featured: '96px',
    slug: '132px',
    // The other language's name is an entity name, not a slug: at a slug-sized
    // box (132px) a real Arabic name was cut to ~17 characters while the
    // same-language name column absorbed hundreds of px of empty space. Nine
    // lists build a `name_${lang}` column; `name_en` stays unsized so it keeps
    // absorbing the leftover, `name_ar` gets a share of the row instead.
    name_ar: '28%',
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
    originSlug: '130px',
    role: '110px',
    email: '180px',
    userEmail: '180px',
    fullName: '150px',
    cities: '170px',
    shippingCost: '120px',
    freeShippingThreshold: '120px',
    totalAmount: '110px',
    total: '100px',
    itemCount: '80px',
    paymentStatus: '120px',
    paymentMethod: '130px',
    scopeType: '110px',
    discountType: '110px',
    discountValue: '100px',
    priceRange: '130px',
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
    return this.columnWidths[columnId] ?? null;
  }

  /** Columns whose values are numbers — end-aligned with tabular figures. */
  private static readonly NUMERIC_COLUMNS = new Set([
    'id',
    'price',
    'quantity',
    'stock',
    'amount',
    'total',
    'priceRange',
    'quantitySold',
  ]);

  isNumericColumn(columnId: string): boolean {
    return DataTableComponent.NUMERIC_COLUMNS.has(columnId);
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
