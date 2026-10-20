import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight,
  lucideShoppingCart,
  lucidePackage,
  lucideX,
} from '@ng-icons/lucide';
import { PageResponse } from '../../../core/models/api-response.model';
import { CartItemResponse, CartResponse } from '../models/cart.model';
import { StatusKind } from '../../../shared/ui/status-badge/status-badge.component';
import { CartService } from '../services/cart.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { ViewMode } from '../../../core/crud/base-list.component';
import { NotifyService } from '../../../core/notify/notify.service';

import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { CustomerCellComponent } from '../../../shared/ui/customer-cell/customer-cell.component';
import { ItemsThumbsComponent } from '../../../shared/ui/items-thumbs/items-thumbs.component';
const IMG = {
  ethiopia: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800',
  colombia: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800',
  kenya: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
  brazil: 'https://images.unsplash.com/photo-1521302080334-4bebac2763a6?w=800',
  hario: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800',
  chemex: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
};

const MOCK_CARTS: CartResponse[] = [
  {
    id: 1,
    userId: 1,
    userFullName: 'Sara Khaled',
    userEmail: 'sara@example.com',
    items: [
      { id: 1, variantId: 1, sku: 'SKU-001', productSlug: 'ethiopia-yirgacheffe', productName: 'Ethiopia Yirgacheffe', primaryImageUrl: IMG.ethiopia, price: 12.5, compareAtPrice: null, discountPercentage: 10, optionValues: [{ optionSlug: 'size', optionName: 'Size', valueSlug: '250g', value: '250g' }], quantity: 2, stockQuantity: 10, subtotal: 22.5 },
      { id: 2, variantId: 2, sku: 'SKU-002', productSlug: 'colombia-huila', productName: 'Colombia Huila', primaryImageUrl: IMG.colombia, price: 14.0, compareAtPrice: null, discountPercentage: 0, optionValues: [], quantity: 1, stockQuantity: 5, subtotal: 14.0 },
      { id: 3, variantId: 3, sku: 'SKU-003', productSlug: 'brazil-mogiana', productName: 'Brazil Mogiana', primaryImageUrl: IMG.brazil, price: 11.0, compareAtPrice: null, discountPercentage: 0, optionValues: [], quantity: 3, stockQuantity: 8, subtotal: 33.0 },
    ],
    total: 69.5,
    itemCount: 3,
    createdAt: '2026-10-20T05:49:47.936218Z',
    updatedAt: '2026-10-20T05:49:47.936218Z',
  },
  {
    id: 2,
    userId: 2,
    userFullName: 'Ahmed Ali',
    userEmail: 'ahmed@example.com',
    items: [
      { id: 4, variantId: 4, sku: 'SKU-004', productSlug: 'kenya-nyeri', productName: 'Kenya Nyeri', primaryImageUrl: IMG.kenya, price: 13.5, compareAtPrice: null, discountPercentage: 5, optionValues: [], quantity: 1, stockQuantity: 4, subtotal: 12.83 },
      { id: 5, variantId: 5, sku: 'SKU-005', productSlug: 'hario-v60', productName: 'Hario V60 Dripper', primaryImageUrl: IMG.hario, price: 15.0, compareAtPrice: null, discountPercentage: 0, optionValues: [], quantity: 2, stockQuantity: 6, subtotal: 30.0 },
    ],
    total: 42.83,
    itemCount: 2,
    createdAt: '2026-10-19T10:00:00.000000Z',
    updatedAt: '2026-10-19T12:00:00.000000Z',
  },
  {
    id: 3,
    userId: 3,
    userFullName: 'Mohamed Hassan',
    userEmail: 'mohamed@example.com',
    items: [
      { id: 6, variantId: 6, sku: 'SKU-006', productSlug: 'chemex-6-cup', productName: 'Chemex 6 Cup', primaryImageUrl: IMG.chemex, price: 16.0, compareAtPrice: null, discountPercentage: 0, optionValues: [], quantity: 4, stockQuantity: 12, subtotal: 64.0 },
    ],
    total: 64.0,
    itemCount: 1,
    createdAt: '2026-10-18T08:30:00.000000Z',
    updatedAt: '2026-10-18T09:00:00.000000Z',
  },
];

@Component({
  selector: 'app-carts-list',
  standalone: true,
  imports: [
    LocalizedDateComponent,
    PagerComponent,
    CommonModule,
    FormsModule,
    DataTableComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmTableImports,
    HlmSkeletonImports,
    NgIcon,
    TranslocoPipe,
    MoneyPipe,
    StatusBadgeComponent,
    CustomerCellComponent,
    ItemsThumbsComponent,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight,
      lucideShoppingCart,
      lucidePackage,
      lucideX,
    }),
  ],
  templateUrl: './carts-list.component.html',
})

export class CartsListComponent {
  private notify = inject(NotifyService);
  private cartService = inject(CartService);
  protected readonly language = inject(LanguageService);

  protected readonly Math = Math;

  items = signal<CartResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<CartResponse> | null>(null);
  currentPage = signal(0);
  pageSize = signal(20);
  readonly pageSizeOptions = [10, 20, 50] as const;
  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  searchQuery = '';
  private searchTimeout: any;

  viewing = signal<CartResponse | null>(null);
  viewMode = signal<ViewMode>('list');

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);

  private columnHelper = createColumnHelper<CartResponse>();
  columns: ColumnDef<CartResponse, any>[] = [
    this.columnHelper.accessor((row) => ({
      name: row.userFullName,
      email: row.userEmail,
      avatar: row.userAvatarUrl ?? row.avatarUrl ?? row.avatar ?? null,
    }), { id: 'userFullName', header: 'Customer', enableSorting: true }),
    this.columnHelper.accessor('items', { id: 'items', header: 'Items', enableSorting: false }),
    this.columnHelper.accessor('itemCount', { header: 'Count', enableSorting: false }),
    this.columnHelper.accessor('total', { header: 'Total', enableSorting: true, meta: { width: '140px' } }),
    this.columnHelper.accessor('createdAt', { header: 'Created', enableSorting: true }),
    this.columnHelper.accessor('updatedAt', { header: 'Updated At', enableSorting: true }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
  ];

  constructor() {
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.cartService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
        // Only carts that actually contain items are useful to review.
        hasItems: true,
      })
      .subscribe({
        next: (res) => {
          // Dev-only: when the backend has no populated carts, fall back to
          // dummy data so the page layout can be tuned.
          if ((res.data?.content?.length ?? 0) === 0) {
            const size = this.pageSize();
            this.pageData.set({
              content: MOCK_CARTS,
              page: 0,
              size: size,
              totalElements: MOCK_CARTS.length,
              totalPages: Math.max(1, Math.ceil(MOCK_CARTS.length / size)),
              first: true,
              last: true,
            } as PageResponse<CartResponse>);
            this.items.set(MOCK_CARTS);
          } else {
            this.pageData.set(res.data);
            this.items.set(res.data.content);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load carts');
        },
      });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
      this.loadPage();
    }, 400);
  }

  onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.loadPage();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  openView(cart: CartResponse): void {
    this.viewing.set(cart);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  onSortChange(event: { column: string; direction: 'asc' | 'desc' } | null): void {
    this.currentSort = event?.column ?? 'createdAt';
    this.currentDirection = event?.direction ?? 'desc';
    this.currentPage.set(0);
    this.loadPage();
  }
}