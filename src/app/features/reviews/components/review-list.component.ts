import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ColumnDef, createColumnHelper } from '@tanstack/angular-table';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBadgeCheck,
  lucideCheck,
  lucideGrid3x3,
  lucideList,
  lucideMoreVertical,
  lucideSearch,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { ViewMode } from '../../../core/crud/base-list.component';
import { DataTableComponent, TableSortEvent } from '../../../shared/components/data-table/data-table.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { ActionsCellComponent } from '../../../shared/ui/actions-cell/actions-cell.component';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';
import { RatingStarsComponent } from '../../../shared/ui/rating-stars/rating-stars.component';
import { VerifiedBadgeComponent } from '../../../shared/ui/verified-badge/verified-badge.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar/user-avatar.component';
import { RowMenuAction } from '../../../shared/ui/actions-cell/actions-cell.component';
import { ProductService } from '../../products/services/product.service';
import { ReviewResponse, ReviewStats } from '../models/review.model';
import { ReviewService } from '../services/review.service';

type ReviewTab = 'pending' | 'approved' | 'all';

/**
 * The reviews console.
 *
 * Pending is the DEFAULT tab: pending is the work queue, and the reviews
 * that need a decision are the ones the admin came for. The count line
 * names the entity ("15 reviews · 13 approved · 2 pending"), because a
 * bare "15 · 13 · 2" is not a count line.
 */
@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    RouterModule,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HasPermissionDirective,
    DataTableComponent,
    PagerComponent,
    PluralPipe,
    ActionsCellComponent,
    LocalizedDateComponent,
    DialogShellComponent,
    StatusBadgeComponent,
    RatingStarsComponent,
    VerifiedBadgeComponent,
    UserAvatarComponent,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideBadgeCheck,
      lucideCheck,
      lucideGrid3x3,
      lucideList,
      lucideMoreVertical,
      lucideSearch,
      lucideTrash2,
      lucideX,
    }),
  ],
  templateUrl: './review-list.component.html',
})
export class ReviewListComponent {
  private readonly reviewService = inject(ReviewService);
  private readonly productService = inject(ProductService);
  private readonly notify = inject(NotifyService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly columnHelper = createColumnHelper<ReviewResponse>();

  readonly items = signal<ReviewResponse[]>([]);
  readonly stats = signal<ReviewStats>({
    total: 0,
    pending: 0,
    approved: 0,
    averageRating: null,
    distribution: {},
  });
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly status = signal<ReviewTab>('pending');
  readonly productSlug = signal('');
  readonly search = signal('');
  readonly rating = signal('');
  readonly verification = signal('');
  readonly range = signal('all');
  readonly from = signal('');
  readonly to = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50] as const;
  /** The totals of the LAST load — the pager's numbers come from the API. */
  readonly totalElements = signal(0);
  readonly totalPages = signal(1);
  readonly sort = signal('createdAt');
  readonly direction = signal<'asc' | 'desc'>('desc');

  readonly products = signal<{ slug: string; name: string }[]>([]);
  readonly columns = signal<ColumnDef<ReviewResponse, any>[]>([]);

  readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  readonly bulkSubmitting = signal(false);
  readonly viewing = signal<ReviewResponse | null>(null);
  readonly deleting = signal<ReviewResponse | null>(null);
  readonly deletingBusy = signal(false);
  /** The dialog's own request: the action button waits for the answer. */
  readonly dialogBusy = signal(false);
  /**
   * The comment's scroll area, and whether it actually scrolls.
   *
   * <p>The area is focusable ONLY when it scrolls: a focusable box that
   * does not scroll is a dead stop in the middle of the tab order, and
   * most comments are short.
   */
  protected readonly commentBox = viewChild<ElementRef<HTMLElement>>('commentBox');
  protected readonly commentScrolls = signal(false);

  private readonly VIEW_KEY = 'nocteon-reviews-view-mode';
  readonly viewMode = signal<ViewMode>(this.readViewMode());

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  protected readonly Math = Math;
  protected readonly String = String;

  protected readonly verifiedShare = computed(() => {
    const total = this.stats().total || 0;
    if (total === 0) return 0;
    const verified = this.items().filter((r) => r.verified).length;
    return Math.round((verified / Math.max(1, this.items().length)) * 100);
  });

  constructor() {
    this.readUrl();
    this.buildColumns();
    this.loadStats();
    this.loadPage();
    this.loadProducts();

    // The product cell's direction follows the UI language, and the name
    // comes from the backend in the request language — so the columns are
    // rebuilt when the language changes.
    effect(() => {
      this.language.language();
      this.buildColumns();
    });

    // The comment's scroll area: measured AFTER the comment is in the DOM,
    // so the area is focusable exactly when it has something to scroll.
    effect(() => {
      const review = this.viewing();
      const box = this.commentBox()?.nativeElement;
      if (!review || !box) {
        this.commentScrolls.set(false);
        return;
      }
      requestAnimationFrame(() => {
        this.commentScrolls.set(box.scrollHeight > box.clientHeight + 1);
      });
    });
  }

  // ── the view mode ─────────────────────────────────────────────────────────

  private readViewMode(): ViewMode {
    const stored = localStorage.getItem(this.VIEW_KEY);
    return stored === 'grid' ? 'grid' : 'list';
  }

  protected toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
    localStorage.setItem(this.VIEW_KEY, mode);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode === 'grid' ? 'grid' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── the URL state ─────────────────────────────────────────────────────────

  private readUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    if (status === 'pending' || status === 'approved' || status === 'all') {
      this.status.set(status);
    }
    const view = params.get('view');
    if (view === 'grid' || view === 'list') {
      this.viewMode.set(view);
      localStorage.setItem(this.VIEW_KEY, view);
    }
    this.productSlug.set(params.get('product') ?? '');
    this.search.set(params.get('q') ?? '');
    this.rating.set(params.get('rating') ?? '');
    this.verification.set(params.get('verification') ?? '');
    this.range.set(params.get('range') ?? 'all');
    this.from.set(params.get('from') ?? '');
    this.to.set(params.get('to') ?? '');
    const page = Number(params.get('page') ?? '0');
    if (Number.isFinite(page) && page > 0) this.page.set(page);
    const sort = params.get('sort');
    if (sort) this.sort.set(sort);
    const dir = params.get('direction');
    if (dir === 'asc' || dir === 'desc') this.direction.set(dir);
  }

  private writeUrl(): void {
    const params: Record<string, string> = {};
    if (this.status() !== 'pending') params['status'] = this.status();
    if (this.productSlug()) params['product'] = this.productSlug();
    if (this.search()) params['q'] = this.search();
    if (this.rating()) params['rating'] = this.rating();
    if (this.verification()) params['verification'] = this.verification();
    if (this.range() !== 'all') params['range'] = this.range();
    if (this.from()) params['from'] = this.from();
    if (this.to()) params['to'] = this.to();
    if (this.page() > 0) params['page'] = `${this.page()}`;
    if (this.sort() !== 'createdAt') params['sort'] = this.sort();
    if (this.direction() !== 'desc') params['direction'] = this.direction();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true,
    });
  }

  // ── the data ──────────────────────────────────────────────────────────────

  private loadStats(): void {
    this.reviewService.getStats().subscribe({
      next: (res) => {
        if (res?.data) this.stats.set(res.data);
      },
      error: () => {
        /* the list still works without the statistics */
      },
    });
  }

  protected loadPage(): void {
    this.loading.set(true);
    this.error.set(false);
    this.reviewService
      .getAll({
        page: this.page(),
        size: this.size(),
        sort: this.sort(),
        direction: this.direction(),
        productSlug: this.productSlug() || undefined,
        search: this.search() || undefined,
        isApproved: this.status() === 'all' ? undefined : this.status() === 'approved',
        isVerified:
          this.verification() === 'verified'
            ? true
            : this.verification() === 'unverified'
              ? false
              : undefined,
        minRating: this.rating() ? Number(this.rating()) : undefined,
        createdFrom: this.rangeStart() ?? undefined,
        createdTo: this.rangeEnd() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data?.content ?? []);
          this.totalElements.set(res.data?.totalElements ?? 0);
          this.totalPages.set(res.data?.totalPages ?? 1);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(true);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load reviews');
        },
      });
  }

  private loadProducts(): void {
    this.productService.getAll({ page: 0, size: 100 }).subscribe({
      next: (res) => {
        this.products.set(
          (res.data?.content ?? []).map((p) => ({ slug: p.slug, name: p.name })),
        );
      },
      error: () => {
        /* the filter stays empty; the rest of the page still works */
      },
    });
  }

  private rangeStart(): string | null {
    const now = Date.now();
    switch (this.range()) {
      case 'today':
        return new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z';
      case '7d':
        return new Date(now - 7 * 86400000).toISOString();
      case '30d':
        return new Date(now - 30 * 86400000).toISOString();
      case 'custom':
        return this.from() ? new Date(this.from()).toISOString() : null;
      default:
        return null;
    }
  }

  private rangeEnd(): string | null {
    if (this.range() === 'custom' && this.to()) {
      return new Date(this.to()).toISOString();
    }
    return null;
  }

  // ── the filters ───────────────────────────────────────────────────────────

  protected setStatus(tab: ReviewTab): void {
    this.status.set(tab);
    this.page.set(0);
    this.writeUrl();
    this.loadPage();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.page.set(0);
      this.writeUrl();
      this.loadPage();
    }, 400);
  }

  protected onSort(event: TableSortEvent | null): void {
    if (!event) return;
    const col = event.column;
    const mapped =
      col.startsWith('main_') ? 'product.name' : col === 'createdAtTime' ? 'createdAt' : col;
    this.sort.set(mapped);
    this.direction.set(event.direction);
    this.page.set(0);
    this.writeUrl();
    this.loadPage();
  }

  protected applyFilter(): void {
    this.page.set(0);
    this.writeUrl();
    this.loadPage();
  }

  protected clearFilters(): void {
    this.productSlug.set('');
    this.search.set('');
    this.rating.set('');
    this.verification.set('');
    this.range.set('all');
    this.from.set('');
    this.to.set('');
    this.applyFilter();
  }

  protected readonly hasActiveFilters = computed(
    () =>
      this.productSlug() !== '' ||
      this.search() !== '' ||
      this.rating() !== '' ||
      this.verification() !== '' ||
      this.range() !== 'all',
  );

  protected onPageSizeChange(size: number): void {
    if (size === this.size()) return;
    this.size.set(size);
    this.page.set(0);
    this.writeUrl();
    this.loadPage();
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    this.writeUrl();
    this.loadPage();
  }

  // ── the columns ───────────────────────────────────────────────────────────

  private buildColumns(): void {
    const lang = this.language.language();
    const langCode = lang === 'ar' ? 'ar' : 'en';

    this.columns.set([
      this.columnHelper.accessor(
        (row) => ({
          name: row.productName ?? row.productSlug,
          slug: row.productSlug,
          imageUrl: row.primaryImageUrl,
          otherName: '',
        }),
        {
          id: `main_${langCode}`,
          header: 'Product',
          enableSorting: true,
          meta: { width: '220px' },
        },
      ),
      this.columnHelper.accessor(
        (row) => ({
          name: this.toDisplayName(row.username),
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
        enableSorting: true,
        meta: { width: '150px' },
      }),
      this.columnHelper.accessor((row) => row.comment, {
        id: 'comment',
        header: 'Comment',
        enableSorting: false,
        // The comment is what a moderator reads, so it gets the width.
        meta: { width: '225px' },
      }),
      this.columnHelper.accessor(
        (row) => ({
          approved: row.approved,
          label: row.approved ? 'reviews.status.approved' : 'reviews.status.pending',
        }),
        { id: 'statusReview', header: 'Status', enableSorting: false },
      ),
      this.columnHelper.accessor((row) => row.createdAt, {
        id: 'createdAtTime',
        header: 'Created at',
        enableSorting: true,
        // The date and the time stack, so it needs room for both: a
        // truncated "Cre" header is a bug, not a layout.
        meta: { width: '125px' },
      }),
      this.columnHelper.display({
        id: 'actions',
        header: 'Actions',
        // The Approve button plus the menu: the shared 116px budget fits an
        // icon row, not a labelled button.
        meta: { width: '135px' },
      }),
    ]);
  }

  protected readonly rowId = (row: ReviewResponse): number | null => row?.id ?? null;

  /**
   * The row's primary action: Approve, LABELLED.
   *
   * <p>design.md §10 — one visible action, plus a kebab menu when there are
   * more than two. An unlabelled icon makes the reader guess, and a review
   * approved by mistake reaches a customer.
   */
  protected readonly primaryActionFor = (row: ReviewResponse) =>
    row.approved ? null : { id: 'approve', label: 'reviews.approve' };

  /**
   * The menu holds the SECONDARY action only.
   *
   * <p>View and Delete are VISIBLE buttons: they are what an admin reaches
   * for on a row, and hiding them behind a kebab menu means two clicks to
   * read a review.
   */
  private readonly withdrawAction: RowMenuAction = { id: 'withdraw', label: 'reviews.withdrawApproval', icon: 'lucideX' };
  private readonly deleteAction: RowMenuAction = { id: 'delete', label: 'common.delete', icon: 'lucideTrash2', danger: true };

  protected readonly menuActions: RowMenuAction[] = [this.withdrawAction, this.deleteAction];

  /** Per-row kebab: Withdraw only on Approved rows, Delete always. */
  protected readonly menuActionsFor = (row: ReviewResponse): RowMenuAction[] =>
    row.approved ? [this.withdrawAction, this.deleteAction] : [this.deleteAction];

  protected onMenuAction(event: { id: string; item: ReviewResponse }): void {
    const review = event.item;
    switch (event.id) {
      case 'approve':
        this.approve(review);
        break;
      case 'view':
        this.openView(review);
        break;
      case 'withdraw':
        this.setApproval(review, false);
        break;
      case 'delete':
        this.confirmDelete(review);
        break;
    }
  }

  // ── the selection ─────────────────────────────────────────────────────────

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  protected onSelectionChange(event: { id: number; checked: boolean }): void {
    const next = new Set(this.selectedIds());
    event.checked ? next.add(event.id) : next.delete(event.id);
    this.selectedIds.set(next);
  }

  protected onToggleAll(checked: boolean): void {
    if (!checked) {
      this.selectedIds.set(new Set());
      return;
    }
    this.selectedIds.set(new Set(this.items().map((r) => r.id)));
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected bulkApprove(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkSubmitting.set(true);
    this.reviewService.setApproval(ids, true).subscribe({
      next: (res) => {
        this.bulkSubmitting.set(false);
        this.clearSelection();
        this.notify.success('reviews.bulk.approved', 'Reviews approved');
        this.loadPage();
        this.loadStats();
      },
      error: (err) => {
        this.bulkSubmitting.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not approve the reviews');
      },
    });
  }

  // ── the actions ───────────────────────────────────────────────────────────

  protected approve(review: ReviewResponse): void {
    this.setApproval(review, true);
  }

  protected setApproval(review: ReviewResponse, approved: boolean): void {
    this.reviewService.setSingleApproval(review.id, approved).subscribe({
      next: (res) => {
        if (res?.data) {
          this.items.update((list) => list.map((r) => (r.id === review.id ? res.data! : r)));
          if (this.viewing()?.id === review.id) this.viewing.set(res.data);
        }
        this.loadStats();
      },
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not update the review'),
    });
  }

  protected openView(review: ReviewResponse): void {
    this.viewing.set(review);
  }

  /**
   * The product page of the dashboard.
   *
   * <p>`/dashboard/products/{slug}` is not a route — the router has
   * `products`, `products/new` and `products/:slug/edit` — so the product
   * name used to link to a URL that resolved to nothing. The edit page is
   * the product page the dashboard has, and the one the category, farm and
   * origin pages link to as well.
   */
  protected productLink(review: ReviewResponse): string[] {
    return ['/dashboard/products', review.productSlug, 'edit'];
  }

  /**
   * The review the delete confirmation is about: its product and its
   * reviewer. "Delete this one" is a question only the admin can answer, so
   * the confirmation names the review instead of saying "this item".
   */
  protected readonly deleteTargetLabel = computed(() => {
    const review = this.deleting();
    if (!review) return '';
    return `${review.productName ?? review.productSlug} (${this.toDisplayName(review.username)})`;
  });

  /**
   * Approve, or withdraw the approval, FROM THE DIALOG.
   *
   * <p>The row's own Approve button keeps its own behaviour: the dialog
   * toasts, because the admin is reading a dialog and not watching a table
   * cell change under the cursor. The button is disabled while the request
   * is in flight, so a double press cannot approve twice.
   */
  protected setApprovalFromDialog(review: ReviewResponse, approved: boolean): void {
    if (this.dialogBusy()) return;
    this.dialogBusy.set(true);
    this.reviewService.setSingleApproval(review.id, approved).subscribe({
      next: (res) => {
        this.dialogBusy.set(false);
        if (res?.data) {
          this.items.update((list) => list.map((r) => (r.id === review.id ? res.data! : r)));
          // The dialog is only refreshed when it is STILL OPEN on this
          // review: the admin can close it while the request is in flight,
          // and a response that arrives afterwards must not pop the dialog
          // back open.
          if (this.viewing()?.id === review.id) this.viewing.set(res.data);
        }
        this.notify.success(
          approved ? 'reviews.action.approved' : 'reviews.action.approvalWithdrawn',
          approved ? 'Review approved' : 'Approval withdrawn',
        );
        this.loadStats();
      },
      error: (err) => {
        this.dialogBusy.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not update the review');
      },
    });
  }

  protected closeView(): void {
    this.viewing.set(null);
  }

  protected confirmDelete(review: ReviewResponse): void {
    this.deleting.set(review);
  }

  protected cancelDelete(): void {
    if (this.deletingBusy()) return;
    this.deleting.set(null);
  }

  protected submitDelete(): void {
    const review = this.deleting();
    if (!review) return;
    this.deletingBusy.set(true);
    this.reviewService.remove(review.id).subscribe({
      next: () => {
        this.deletingBusy.set(false);
        this.deleting.set(null);
        this.viewing.set(null);
        this.notify.success('notify.deleted', 'Deleted successfully');
        this.loadPage();
        this.loadStats();
      },
      error: (err) => {
        this.deletingBusy.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete the review');
      },
    });
  }

  // ── the statistics strip ──────────────────────────────────────────────────

  protected barPercent(star: number): number {
    const counts = this.stats().distribution ?? {};
    const max = Math.max(1, ...Object.values(counts).map((n) => Number(n) || 0));
    return Math.round(((Number(counts[String(star)]) || 0) / max) * 100);
  }

  protected barHeight(star: number): number {
    const counts = this.stats().distribution ?? {};
    const max = Math.max(1, ...Object.values(counts).map((n) => Number(n) || 0));
    return Math.round(((Number(counts[String(star)]) || 0) * 24) / max) + 4;
  }

  protected distributionText(): string {
    const counts = this.stats().distribution ?? {};
    return [5, 4, 3, 2, 1]
      .map((star) => `${star}: ${counts[String(star)] ?? 0}`)
      .join(', ');
  }

  /** Proper-case a username for display; the API has no full name (see API_GAPS). */
  protected toDisplayName(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .split(/\s+/)
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ');
  }

  protected readonly emptyMessage = computed(() => {
    if (this.stats().total === 0) return 'No reviews yet';
    if (this.hasActiveFilters() || this.status() !== 'all') {
      return 'No reviews match these filters';
    }
    return 'No reviews found';
  });

  protected readonly tabs = computed(() => [
    { id: 'all' as ReviewTab, label: 'reviews.tabs.all', count: this.stats().total },
    { id: 'pending' as ReviewTab, label: 'reviews.tabs.pending', count: this.stats().pending },
    { id: 'approved' as ReviewTab, label: 'reviews.tabs.approved', count: this.stats().approved },
  ]);
}
