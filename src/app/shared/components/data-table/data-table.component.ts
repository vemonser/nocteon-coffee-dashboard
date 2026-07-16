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
  rowClick = output<any>();
  hasView = output<boolean>();
  initialSort = input<TableSortEvent | null>(null);

  // NEW: Generic action permissions & labels
  editPermission = input<string>('category:update');
  deletePermission = input<string>('category:delete');
  editLabel = input<string>('Edit');
  deleteLabel = input<string>('Delete');

  // Per-page action visibility toggles
  showEdit = input<boolean>(true);
  showView = input<boolean>(true);
  showDelete = input<boolean>(true);

  sorting = signal<SortingState>([]);
  constructor() {
    // كل مرة initialSort يتغيّر من الأب، زامن الحالة الداخلية
    effect(() => {
      const s = this.initialSort();
      this.sorting.set(s ? [{ id: s.column, desc: s.direction === 'desc' }] : []);
    });
  }

  containsArabic(text: any): boolean {
    if (typeof text !== 'string') return false;
    return /[\u0600-\u06FF]/.test(text);
  }

  getDir(text: any): string {
    if (typeof text !== 'string') return 'ltr';
    return this.containsArabic(text) ? 'rtl' : 'ltr';
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
