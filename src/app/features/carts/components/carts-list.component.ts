import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight,
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
  lucideCheck,
  lucideMinus,
  lucidePlus,
  lucidePercent,
  lucideClock,
  lucideArchive,
  lucideFileText,
  lucideXCircle as lucideXCircle2,
} from '@ng-icons/lucide';
import { PageResponse } from '../../../core/models/api-response.model';
import { CartItemResponse, CartResponse, CartStatsResponse, CartListParams } from '../models/cart.model';
import { StatusKind } from '../../../shared/ui/status-badge/status-badge.component';
import { CartService } from '../services/cart.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import { StoreSettingsService } from '../../../core/settings/store-settings.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import type { RowMenuAction } from '../../../shared/ui/actions-cell/actions-cell.component';
import { NotifyService } from '../../../core/notify/notify.service';
import { formatRelativeTime } from '../../../core/i18n/relative-time';

import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { CartStatusTabsComponent } from '../../../shared/components/cart-status-tabs/cart-status-tabs.component';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar/user-avatar.component';
import { KpiCardComponent } from '../../../shared/components/dashboard/kpi-card/kpi-card.component';

@Component({
  selector: 'app-carts-list',
  standalone: true,
  imports: [
    LocalizedDateComponent,
    PagerComponent,
    CommonModule,
    FormsModule,
    RouterModule,
    DataTableComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmTableImports,
    HlmSkeletonImports,
    HlmNativeSelectImports,
    NgIcon,
    TranslocoPipe,
    MoneyPipe,
    PluralPipe,
    StatusBadgeComponent,
    CartStatusTabsComponent,
    DialogShellComponent,
    UserAvatarComponent,
    KpiCardComponent,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight,
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
      lucideCheck,
      lucideMinus,
      lucidePlus,
      lucidePercent,
      lucideClock,
      lucideArchive,
      lucideFileText,
      lucideXCircle2,
    }),
  ],
  templateUrl: './carts-list.component.html',
})
export class CartsListComponent {
  private notify = inject(NotifyService);
  private cartService = inject(CartService);
  private readonly storeSettings = inject(StoreSettingsService);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly storeCurrency = computed(() => this.storeSettings.currency());

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
    this.columnHelper.accessor('itemCount', { header: 'carts.columns.itemCount', enableSorting: false, meta: { width: '110px' } }),
    this.columnHelper.accessor('total', { header: 'carts.columns.total', enableSorting: true, meta: { width: '140px' } }),
    this.columnHelper.accessor(
      (row) => ({
        kind: this.cartStatusKind(row),
        since: row.status === 'ABANDONED'
          ? formatRelativeTime(row.lastActivityAt ?? row.updatedAt, this.language.language())
          : '',
      }),
      { id: 'cartStatus', header: 'carts.columns.status', enableSorting: false, meta: { width: '128px' } },
    ),
    this.columnHelper.accessor(
      (row) => row.lastActivityAt ?? row.updatedAt,
      { id: 'lastActivity', header: 'carts.columns.lastActivity', enableSorting: true, meta: { width: '160px' } },
    ),
    this.columnHelper.display({ id: 'actions', header: 'carts.columns.actions', meta: { width: '100px' } }),
  ];

  /** Kebab menu actions for a cart row: copy link always, send reminder when abandoned. */
  readonly menuActionsFor = (row: CartResponse): RowMenuAction[] => [
    { id: 'copyLink', label: 'carts.copyLink', icon: 'lucideCopy' },
    ...(row.status === 'ABANDONED'
      ? [{ id: 'sendReminder', label: 'carts.sendReminder', icon: 'lucideMail' }]
      : []),
  ];

  onMenuAction(event: { id: string; item: CartResponse }): void {
    if (event.id === 'copyLink') this.copyCartLink(event.item);
    if (event.id === 'sendReminder') this.sendReminder(event.item);
  }

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

  /** The search box holds a term: an empty list means "no matches". */
  protected readonly hasSearch = computed(() => this.searchQuery.trim().length > 0);

  /**
   * The action that resolves an empty cart list: clear the search when there
   * is one. There is nothing else to resolve — a cart is created by a
   * CUSTOMER starting a checkout, and no console button can summon one.
   */
  protected readonly emptyAction = computed<{ label: string; action: () => void } | null>(() =>
    this.hasSearch()
      ? {
          label: this.transloco.translate('common.clearSearch'),
          action: () => this.clearSearch(),
        }
      : null,
  );

  /** Drop the search term and reload. */
  protected clearSearch(): void {
    this.searchQuery = '';
    this.currentPage.set(0);
    this.loadPage();
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
  cartStatusKind(cart: CartResponse | null): StatusKind {
    if (!cart) return 'active';
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