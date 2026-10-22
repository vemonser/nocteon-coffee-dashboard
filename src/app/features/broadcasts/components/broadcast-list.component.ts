import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBellRing,
  lucideChevronLeft,
  lucideChevronRight,
  lucideLoader2,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { BroadcastRecipientResponse, BroadcastRequest, BroadcastResponse, BroadcastStatus } from '../models/broadcast.model';
import { BroadcastService } from '../services/broadcast.service';
import { map, Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';

/**
 * The broadcasts list.
 *
 * A broadcast reaches EVERY customer of the store: the backend picks the
 * recipients with `findByRoleAndSubscribedTrue(CUSTOMER)` plus the
 * newsletter subscribers, so there is no audience to choose in the UI —
 * one message, everybody. The page says so in the create dialog, and
 * every row carries the number of recipients the backend counted, so
 * "who did this go to" is never a guess.
 *
 * THE SENDING IS THE BACKEND'S, AND IT HAPPENS NOW:
 * `BroadcastCreationService` creates the broadcast, its recipient rows,
 * and sends it in the same request. Each recipient's email is enqueued
 * (and attempted inline, the way every other email in this store is), the
 * recipient ends in SENT or FAILED with the error recorded, and the
 * broadcast ends in COMPLETED with the counters saying how many of each.
 * A failed address does not stop the others, and a broadcast that failed
 * on some addresses can be re-sent from the row.
 */
@Component({
  selector: 'app-broadcast-list',
  standalone: true,
  imports: [
    LocalizedDateComponent,
    PluralPipe,
    PagerComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmLabelImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideBellRing,
      lucideChevronLeft,
      lucideChevronRight,
      lucideLoader2,
      lucidePlus,
      lucideSearch,
      lucideTrash2,
      lucideX,
    }),
  ],
  templateUrl: './broadcast-list.component.html',
})
export class BroadcastListComponent extends BaseListComponent<BroadcastResponse, BroadcastRequest> {
  private broadcastService = inject(BroadcastService);

  /** True while the export is running. */
  protected readonly exporting = signal(false);

  protected override getId(item: BroadcastResponse): string {
    return item.id;
  }

  protected override loadPage(): Observable<PageResponse<BroadcastResponse>> {
    return this.broadcastService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm() {
    return this.fb.group({
      subject: ['', Validators.required],
      content: ['', Validators.required],
    });
  }

  protected override onEditOpen(_item: BroadcastResponse): void {
    // Broadcasts are create-only — list UI never opens the edit dialog.
  }

  protected override toRequest(): BroadcastRequest {
    return {
      subject: this.form.value.subject,
      content: this.form.value.content,
    };
  }

  protected override callCreate(request: BroadcastRequest) {
    return this.broadcastService.create(request, undefined, 'json');
  }

  protected override callUpdate(_id: string, _request: BroadcastRequest): Observable<never> {
    throw new Error('Broadcasts cannot be edited');
  }

  /**
   * Delete a broadcast.
   *
   * The backend HAS the endpoint (`DELETE /api/dashboard/broadcasts/{id}`
   * — it removes the broadcast and its recipient rows), so the page can
   * offer it. The previous version threw, which left no way to get rid of
   * a broadcast.
   */
  protected override callDelete(id: string): Observable<ApiResponse<void>> {
    return this.broadcastService.deleteBroadcast(id);
  }

  /**
   * Re-send a broadcast that failed on some addresses. The backend skips the
   * ones that already reached SENT, so only the failed ones are retried.
   */
  protected resendBroadcast(item: BroadcastResponse): void {
    this.broadcastService.sendBroadcast(item.id).subscribe({
      next: (res) => {
        this.notify.apiSuccess(res, 'broadcasts.sent', 'The broadcast was sent');
        this.load();
      },
      error: (err) => {
        this.notify.apiError(err, 'broadcasts.sendFailed', 'The broadcast could not be sent');
      },
    });
  }

  protected override deleteToastKey(): string {
    return 'broadcasts.deleted';
  }

  protected override deleteToastFallback(): string {
    return 'The broadcast was deleted';
  }

  /**
   * Export the broadcasts as a CSV.
   *
   * Every broadcast, not only the rows on this page — an export of "the
   * twenty rows on this page" is not an export.
   */
  protected exportBroadcasts(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.broadcastService.getEveryBroadcast().subscribe({
        next: (rows) => {
          this.exporting.set(false);
          if (!rows.length) {
            this.notify.warning('broadcasts.export.empty', 'There are no broadcasts to export');
            return;
          }
          const escape = (value: unknown): string => {
            const text = value === null || value === undefined ? '' : String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          };
          const lines = ['subject,content,status,sent,recipients,failed,createdAt'];
          for (const row of rows) {
            lines.push(
              [
                row.subject,
                row.content,
                row.status,
                row.sentCount,
                row.totalRecipients,
                row.failedCount,
                row.createdAt,
              ]
                .map(escape)
                .join(','),
            );
          }
          // The BOM, so Excel reads the file as UTF-8.
          const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `broadcasts-${new Date().toISOString().slice(0, 10)}.csv`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.notify.success('broadcasts.export.done', 'The broadcasts were exported');
        },
        error: () => {
          this.exporting.set(false);
          this.notify.apiError(null, 'broadcasts.export.failed', 'The broadcasts could not be exported');
        },
      });
  }

  /**
   * The number of broadcasts in the store — the TOTAL, not the number of
   * rows on this page. The header used to print the page's row count
   * followed by the word "of" and a bell, which read as "2 of 🔔".
   */
  protected readonly totalCount = computed(() => this.pageData()?.totalElements ?? 0);

  /** The status, in the reader's language. */
  protected statusLabel(status: BroadcastStatus): string {
    const key =
      status === 'COMPLETED'
        ? 'broadcasts.status.completed'
        : status === 'IN_PROGRESS'
          ? 'broadcasts.status.inProgress'
          : 'broadcasts.status.queued';
    return this.t(key, status);
  }

  /**
   * What the sent line means.
   *
   * A broadcast that has not gone out says so: the reader sees the queue,
   * not a silent zero.
   */
  protected sentTitle(item: BroadcastResponse): string {
    return this.t('broadcasts.sentTitle', `${item.sentCount} of ${item.totalRecipients}`);
  }
}
