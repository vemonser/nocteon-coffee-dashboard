import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight,
  lucideShoppingCart,
  lucidePackage,
  lucideX,
  lucideActivity,
  lucideDollarSign,
  lucideUsers,
  lucideTrendingUp,
  lucideRefreshCw,
  lucideCopy,
  lucideMail,
  lucideAlertCircle,
  lucideCheckCircle,
} from '@ng-icons/lucide';
import { PageResponse } from '../../../core/models/api-response.model';
import { CartItemResponse, CartResponse, CartStatsResponse, CartListParams } from '../models/cart.model';
import { StatusKind } from '../../../shared/ui/status-badge/status-badge.component';
import { CartService } from '../services/cart.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { NotifyService } from '../../../core/notify/notify.service';
import { formatRelativeTime } from '../../../core/i18n/relative-time';

import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { CartStatusTabsComponent } from '../../../shared/components/cart-status-tabs/cart-status-tabs.component';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar/user-avatar.component';

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
    HlmNativeSelectImports,
    HlmTooltipImports,
    BrnTooltip,
    NgIcon,
    TranslocoPipe,
    MoneyPipe,
    StatusBadgeComponent,
    CartStatusTabsComponent,
    DialogShellComponent,
    UserAvatarComponent,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight,
      lucideShoppingCart,
      lucidePackage,
      lucideX,
      lucideActivity,
      lucideDollarSign,
      lucideUsers,
      lucideTrendingUp,
      lucideRefreshCw,
      lucideCopy,
      lucideMail,
      lucideAlertCircle,
      lucideCheckCircle,
    }),
  ],
  templateUrl: './carts-list.component.html',
})
export class CartsListComponent {
  private notify = inject(NotifyService);
  private cartService = inject(CartService);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly Math = Math;
  protected readonly formatRelativeTime = formatRelativeTime;

  items = signal<CartResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<CartResponse> | null>(null);
  stats = signal<CartStatsResponse | null>(null);
  error = signal(false);
  currentPage = signal(0);
  pageSize = signal(20);
  readonly pageSizeOptions = [10, 20, 50] as const;
  currentSort = 'lastActivityAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  searchQuery = '';
  private searchTimeout: any;

  /** Current lifecycle tab: 'active' | 'abandoned' | 'converted' | 'all' */
  listView = signal<'all' | 'active' | 'abandoned' | 'converted'>('all');

  viewing = signal<CartResponse | null>(null);
  sendingReminder = signal(false);

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);

  private columnHelper = createColumnHelper<CartResponse>();
  columns: ColumnDef<CartResponse, any>[] = [
    this.columnHelper.accessor(
      (row) => ({
        name: row.userFullName,
        email: row.userEmail,
        avatar: row.avatarUrl,
      }),
      { id: 'userFullName', header: 'carts.columns.customer', enableSorting: true },
    ),
    this.columnHelper.accessor('items', { id: 'items', header: 'carts.columns.items', enableSorting: false }),
    this.columnHelper.accessor('itemCount', { header: 'carts.columns.itemCount', enableSorting: false, meta: { width: '70px' } }),
    this.columnHelper.accessor('total', { header: 'carts.columns.total', enableSorting: true, meta: { width: '140px' } }),
    this.columnHelper.accessor(
      (row) => row.lastActivityAt ?? row.updatedAt,
      { id: 'lastActivity', header: 'carts.columns.lastActivity', enableSorting: true, meta: { width: '160px' } },
    ),
    this.columnHelper.display({ id: 'actions', header: 'carts.columns.actions', meta: { width: '100px' } }),
  ];

  constructor() {
    effect(() => {
      this.listView();
      this.currentPage.set(0);
      this.loadPage();
      this.loadStats();
    });
  }

  loadStats(): void {
    this.cartService.getStats().subscribe({
      next: (res) => this.stats.set(res.data),
      error: () => this.stats.set(null),
    });
  }

  loadPage(): void {
    this.loading.set(true);
    this.error.set(false);
    const params: CartListParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      search: this.searchQuery || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
      hasItems: true,
    };

    // Map lifecycle tab to backend status filter
    if (this.listView() !== 'all') {
      params.status = this.listView().toUpperCase();
    }

    this.cartService.getAll(params).subscribe({
      next: (res) => {
        this.pageData.set(res.data);
        this.items.set(res.data.content);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(true);
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

  setListView(view: 'all' | 'active' | 'abandoned' | 'converted'): void {
    this.listView.set(view);
  }

  openView(cart: CartResponse): void {
    this.viewing.set(cart);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  onSortChange(event: { column: string; direction: 'asc' | 'desc' } | null): void {
    this.currentSort = event?.column ?? 'lastActivityAt';
    this.currentDirection = event?.direction ?? 'desc';
    this.currentPage.set(0);
    this.loadPage();
  }

  /** Map backend status to StatusKind for the badge component. */
  cartStatusKind(cart: CartResponse): StatusKind {
    switch (cart.status) {
      case 'ACTIVE': return 'active';
      case 'ABANDONED': return 'abandoned';
      case 'CONVERTED': return 'converted';
      default: return 'active';
    }
  }

  /** Send abandonment reminder for a cart. */
  sendReminder(cart: CartResponse): void {
    this.sendingReminder.set(true);
    this.cartService.sendReminder(cart.id).subscribe({
      next: (res) => {
        this.sendingReminder.set(false);
        if (res.data) {
          this.notify.success('carts.reminderSent', 'Reminder sent');
        } else {
          this.notify.warning('carts.reminderFailed', 'Could not send reminder');
        }
      },
      error: (err) => {
        this.sendingReminder.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not send reminder');
      },
    });
  }

  /** Human-readable status label for the dialog subtitle. */
  cartStatusLabel(cart: CartResponse): string {
    const key = `carts.status.${cart.status.toLowerCase()}`;
    return this.transloco.translate(key);
  }

  /** Copy cart link to clipboard (dashboard URL). */
  copyCartLink(cart: CartResponse): void {
    const url = `${window.location.origin}/dashboard/carts/${cart.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.notify.success('carts.linkCopied', 'Cart link copied');
    }).catch(() => {
      this.notify.apiError(new Error('clipboard'), 'carts.linkCopyFailed', 'Failed to copy link');
    });
  }

  /** Count of carts for a given status (for tab badges). */
  countForStatus(status: 'ACTIVE' | 'ABANDONED' | 'CONVERTED'): number {
    const s = this.stats();
    if (!s) return 0;
    switch (status) {
      case 'ACTIVE': return s.activeCarts;
      case 'ABANDONED': return s.abandonedCarts;
      case 'CONVERTED': return s.convertedCarts;
    }
  }

  /** Tab label with count. */
  tabLabel(status: 'ACTIVE' | 'ABANDONED' | 'CONVERTED'): string {
    const count = this.countForStatus(status);
    const key = `carts.status.${status.toLowerCase()}`;
    return `${this.transloco.translate(key)} (${count})`;
  }
}