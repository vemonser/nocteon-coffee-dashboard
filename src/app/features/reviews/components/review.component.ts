import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';

import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { PageResponse } from '../../../core/models/api-response.model';

import { ReviewResponse } from '../models/review.model';
import { ReviewService } from '../services/review.service';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective],
  templateUrl: './review.component.html',
})
export class ReviewComponent {
  private reviewService = inject(ReviewService);
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

  constructor() {
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.reviewService
      .getAll({
        page: this.currentPage(),
        sort: this.currentSort,
        direction: this.currentDirection,
        productSlug: this.searchQuery || undefined,
      })
      .subscribe({
        next: (res) => {
          this.pageData.set(res.data);
          this.items.set(res.data.content);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.currentPage.set(0);
    this.loadPage();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  openView(review: ReviewResponse): void {
    this.viewing.set(review);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  toggleApproval(review: ReviewResponse): void {
    this.reviewService.setApproval(review.id, !review.approved).subscribe({
      next: (res) => {
        this.items.update((list) => list.map((r) => (r.id === review.id ? res.data : r)));
        if (this.viewing()?.id === review.id) {
          this.viewing.set(res.data);
        }
      },
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
      },
      error: () => this.submitting.set(false),
    });
  }
}
