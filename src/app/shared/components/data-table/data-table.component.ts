import { Component, effect, EventEmitter, input, output, signal } from '@angular/core';
import {
  ColumnDef,
  getCoreRowModel,
  createAngularTable,
  SortingState,
  getSortedRowModel,
} from '@tanstack/angular-table';

import { ActionsCellComponent } from '../../ui/actions-cell/actions-cell.component';
import { StatusCellComponent } from '../../ui/status-cell/status-cell.component';
import { ImageCellComponent } from '../../ui/image-cell/image-cell.component';
import { ColorCellComponent } from '../color-cell/color-cell.component';
import { DatePipe } from '@angular/common';

export interface TableSortEvent {
  column: string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-data-table',
  imports: [ImageCellComponent, ActionsCellComponent, StatusCellComponent, ColorCellComponent,DatePipe],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent {
  data = input<any[]>([]);
  columns = input<ColumnDef<any, any>[]>([]);
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

  /** Column id whose cell renders as a clickable navigation button (emits rowClick). */
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
   * `columnHelper.accessor(x, { meta: { width: '...' } })`; columns without a
   * width share whatever is left over.
   */
  readonly columnWidths: Record<string, string> = {
    id: '72px',
    image: '64px',
    primaryImageUrl: '64px',
    avatar: '64px',
    color: '72px',
    status: '112px',
    isActive: '112px',
    active: '112px',
    slug: '160px',
    createdAt: '132px',
    updatedAt: '132px',
    deletedAt: '132px',
  };

  /** Resolves the width for a column id: explicit meta wins over the defaults. */
  widthFor(columnId: string, columnDef?: ColumnDef<any, any>): string | null {
    const metaWidth = (columnDef?.meta as { width?: string } | undefined)?.width;
    return metaWidth ?? this.columnWidths[columnId] ?? null;
  }

  table = createAngularTable<any>(() => ({
    data: this.data(),
    columns: this.columns(),
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
