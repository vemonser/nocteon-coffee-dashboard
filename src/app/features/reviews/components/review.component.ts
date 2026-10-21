import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { PageResponse } from '../../../core/models/api-response.model';
import { ReviewResponse } from '../models/review.model';
import { ReviewService } from '../services/review.service';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmToggleImports } from '@spartan-ng/helm/toggle';

import { HlmLabelImports } from '@spartan-ng/helm/label';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucideGrid3x3,
  lucideList,
  lucidePencil,
  lucideTrash2,
  lucideX,
  lucideCheck,
  lucideImage,
  lucideChevronLeft,
  lucideChevronRight,
  lucideStar,
  lucideEye,
} from '@ng-icons/lucide';
import { heroStarSolid } from '@ng-icons/heroicons/solid';
import { ViewMode } from '../../../core/crud/base-list.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { heroStar } from '@ng-icons/heroicons/outline';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { NotifyService } from '../../../core/notify/notify.service';
@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    HasPermissionDirective,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmSelectImports,
    HlmDialogImports,
    HlmTableImports,
    HlmAvatarImports,
    HlmSkeletonImports,
    HlmToggleImports,
    HlmLabelImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      heroStar,
      lucideSearch,
      lucideGrid3x3,
      lucideList,
      lucidePencil,
      lucideTrash2,
      heroStarSolid,
      lucideStar,
      lucideEye,
      lucideX,
      lucideCheck,
      lucideImage,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './review.component.html',
})
export class ReviewListComponent {
  private reviewService = inject(ReviewService);
  private notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly statusLabel = {
    all: toSignal(this.transloco.selectTranslate('common.all'), { initialValue: 'All' }),
    approved: toSignal(this.transloco.selectTranslate('reviews.approved'), { initialValue: 'Approved' }),
    unapproved: toSignal(this.transloco.selectTranslate('reviews.unapproved'), {
      initialValue: 'Unapproved',
    }),
  };
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly Math = Math;

  items = signal<ReviewResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<ReviewResponse> | null>(null);
  currentPage = signal(0);
  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  searchQuery = '';

  deleting = signal<ReviewResponse | null>(null);
  viewing = signal<ReviewResponse | null>(null);
  submitting = signal(false);
  viewMode = signal<ViewMode>('list');
  
  private searchTimeout: any;
  readonly activeCount = computed(() => this.items().filter((i) => i.approved).length);
  readonly inactiveCount = computed(() => this.items().filter((i) => !i.approved).length);
  readonly stars = Array.from({ length: 5 }, (_, i) => i);
  readonly range = (count: number) =>
    Array.from({
      length: Math.floor(count),
    });
  readonly reviewId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = params.get('id');
        return id ? String(id) : null;
      }),
    ),
    { initialValue: null },
  );
  isVerifiedFilter: boolean | undefined = undefined;

  readonly isVerifiedFilterString = computed(() => {
    if (this.isVerifiedFilter === undefined) return 'all';
    return this.isVerifiedFilter ? 'verified' : 'unverified';
  });
  minRatingFilter: number | undefined = undefined;

  readonly minRatingFilterString = computed(() => {
    return this.minRatingFilter?.toString() ?? 'all';
  });
  verifiedItemToString = (value: string) => {
    const labels: Record<string, string> = {
      all: 'All Verification',
      verified: 'Verified',
      unverified: 'Not Verified',
    };

    return labels[value] ?? value;
  };
  ratingItemToString = (value: string) => {
    const labels: Record<string, string> = {
      all: 'All Ratings',
      '1': '1★ & Up',
      '2': '2★ & Up',
      '3': '3★ & Up',
      '4': '4★ & Up',
      '5': '5★ Only',
    };

    return labels[value] ?? value;
  };
  onVerifiedFilterValueChange(value: string | null | undefined): void {
    this.isVerifiedFilter =
      value === 'verified' ? true : value === 'unverified' ? false : undefined;

    this.currentPage.set(0);
    this.loadPage();
  }
  onMinRatingValueChange(value: string | null | undefined): void {
    this.minRatingFilter = value && value !== 'all' ? Number(value) : undefined;

    this.currentPage.set(0);
    this.loadPage();
  }
  isApprovedFilter: boolean | undefined = undefined;
  readonly isApprovedFilterString = computed(() => {
    if (this.isApprovedFilter === undefined) return 'all';
    return this.isApprovedFilter ? 'approved' : 'unapproved';
  });

  onApprovedFilterValueChange(value: string | null | undefined): void {
    this.isApprovedFilter =
      value === 'approved' ? true : value === 'unapproved' ? false : undefined;
    this.currentPage.set(0);
    this.loadPage();
  }
  itemToString = (value: string) => {
    switch (value) {
      case 'approved':
        return this.statusLabel.approved();
      case 'unapproved':
        return this.statusLabel.unapproved();
      default:
        return this.statusLabel.all();
    }
  };

  // ===============================================================
  // ===============================================================
  // ===============================================================

  constructor() {
    // The dashboard's "reviews awaiting moderation" drill-down asks for the
    // UNAPPROVED ones: /dashboard/reviews?status=pending
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status === 'pending' || status === 'unapproved') {
      this.isApprovedFilter = false;
    }
    this.loadPage();

    effect(() => {
      const id = this.reviewId();

      if (id == null) {
        this.viewing.set(null);
        return;
      }

      const review = this.items().find((r) => r.id === id);

      if (review) {
        this.viewing.set(review);
        return;
      }

      this.reviewService.getById(id).subscribe({
        next: (res) => {
          this.viewing.set(res.data);
        },
        error: () => {
          this.router.navigate(['../'], {
            relativeTo: this.route,
          });
        },
      });
    });
  }

  loadPage(): void {
    this.loading.set(true);
    this.reviewService
      .getAll({
        page: this.currentPage(),
        sort: this.currentSort,
        direction: this.currentDirection,
        productSlug: this.searchQuery || undefined,
        isApproved: this.isApprovedFilter,
        isVerified: this.isVerifiedFilter,
        minRating: this.minRatingFilter,
      })
      .subscribe({
        next: (res) => {
          this.pageData.set(res.data);
          this.items.set(res.data.content);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load reviews');
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

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  openView(review: ReviewResponse) {
    this.router.navigate([review.id], {
      relativeTo: this.route,
    });
  }

  closeView() {
    this.router.navigate(['../'], {
      relativeTo: this.route,
    });
  }

  toggleApproval(review: ReviewResponse): void {
    this.reviewService.setApproval(review.id, !review.approved).subscribe({
      next: (res) => {
        this.items.update((list) => list.map((r) => (r.id === review.id ? res.data : r)));
        if (this.viewing()?.id === review.id) {
          this.viewing.set(res.data);
        }
        this.notify.success('notify.statusUpdated', 'Status updated');
      },
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not update approval'),
    });
  }

  confirmDelete(review: ReviewResponse): void {
    this.deleting.set(review);
    this.viewing.set(null);
  }

  submitDelete(): void {
    const review = this.deleting();
    if (!review) return;
    this.submitting.set(true);
    this.reviewService.remove(review.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.deleting.set(null);
        this.loadPage();
        this.notify.success('notify.deleted', 'Deleted successfully');
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete review');
      },
    });
  }

  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }
}