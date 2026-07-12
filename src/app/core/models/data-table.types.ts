import { ColumnDef } from '@tanstack/angular-table';

export interface DataTableConfig<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
}