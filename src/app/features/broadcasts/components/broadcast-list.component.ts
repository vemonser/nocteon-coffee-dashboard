import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
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
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { BroadcastRecipientResponse, BroadcastRequest, BroadcastResponse, BroadcastStatus } from '../models/broadcast.model';
import { BroadcastService } from '../services/broadcast.service';
import { UserService } from '../../users/services/user.service';
import { UserResponse } from '../../users/model/user.model';
import { map, Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { MultiSelect, MultiSelectOption } from '../../../shared/components/multi-select/multi-select.component';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';

/**
 * The broadcasts list.
 *
 * A broadcast reaches EVERY customer of the store: the backend picks the
 * recipients with `findByRoleAndSubscribedTrue(CUSTOMER)` plus the
 * newsletter subscribers, so there is no audience to choose in the UI ->
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
    MultiSelect,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmNativeSelectImports,
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
      lucideUsers,
      lucideX,
    }),
  ],
  templateUrl: './broadcast-list.component.html',
})
export class BroadcastListComponent extends BaseListComponent<BroadcastResponse, BroadcastRequest> {

  protected override createPermission = 'broadcast:create';
  protected override updatePermission = 'broadcast:update';
  protected override deletePermission = 'broadcast:delete';
  private broadcastService = inject(BroadcastService);
  private userService = inject(UserService);

  /** True while the export is running. */
  protected readonly exporting = signal(false);

  /** All customers — used for recipient selection. */
  protected readonly customers = signal<UserResponse[]>([]);

  /** The recipients of the broadcast the admin is currently viewing. */
  protected readonly viewingRecipients = signal<BroadcastResponse | null>(null);
  protected readonly recipientsList = signal<BroadcastRecipientResponse[]>([]);
  protected readonly recipientsLoading = signal(false);

  /** Selected recipient IDs (for 'specific' audience). */
  protected readonly selectedRecipientIds = signal<number[]>([]);
  /** Excluded recipient IDs (for 'exclude' audience). */
  protected readonly excludedIds = signal<number[]>([]);

  /** Customers mapped to MultiSelect options. */
  protected readonly customerOptions = computed<MultiSelectOption[]>(() =>
    this.customers().map((c) => ({
      id: Number(c.id),
      label: c.email + (c.firstName ? ` — ${c.firstName} ${c.lastName ?? ''}`.trim() : ''),
    })),
  );

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
      audience: ['all'],
    });
  }

  protected override onEditOpen(_item: BroadcastResponse): void {
    // Broadcasts are create-only — list UI never opens the edit dialog.
  }

  /** Reset selection when the create dialog opens. */
  override openCreateDialog(): void {
    super.openCreateDialog();
    this.selectedRecipientIds.set([]);
    this.excludedIds.set([]);
  }

  /** Load the customer list so the admin can pick recipients. */
  override ngOnInit(): void {
    super.ngOnInit();
    this.userService.getAll({ role: 'CUSTOMER', size: 100 }).subscribe({
      next: (res) => this.customers.set(res.data?.content ?? []),
      error: () => this.customers.set([]),
    });
  }

  protected override toRequest(): BroadcastRequest {
    const audience = this.form.value.audience;
    const req: BroadcastRequest = {
      subject: this.form.value.subject,
      content: this.form.value.content,
    };
    if (audience === 'specific') {
      req.recipientIds = this.selectedRecipientIds();
    }
    if (audience === 'exclude') {
      req.excludeIds = this.excludedIds();
    }
    return req;
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

  /** Open the recipient delivery-status dialog for a broadcast. */
  protected viewRecipients(item: BroadcastResponse): void {
    this.viewingRecipients.set(item);
    this.recipientsLoading.set(true);
    this.recipientsList.set([]);
    this.broadcastService.getRecipients(item.id).subscribe({
      next: (res) => {
        this.recipientsList.set(res.data ?? []);
        this.recipientsLoading.set(false);
      },
      error: () => {
        this.recipientsLoading.set(false);
      },
    });
  }

  protected closeRecipients(): void {
    this.viewingRecipients.set(null);
    this.recipientsList.set([]);
  }

  /** Check if a customer is selected as a recipient. */
  protected isRecipientSelected(id: string | number): boolean {
    return this.selectedRecipientIds().includes(Number(id));
  }

  /** Toggle a customer in the recipient selection. */
  protected toggleRecipient(id: string | number, event: Event): void {
    const numId = Number(id);
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedRecipientIds.update((ids) =>
      checked ? [...ids, numId] : ids.filter((i) => i !== numId),
    );
  }

  /** Check if a customer is excluded. */
  protected isExcluded(id: string | number): boolean {
    return this.excludedIds().includes(Number(id));
  }

  /** Toggle a customer in the exclusion list. */
  protected toggleExclude(id: string | number, event: Event): void {
    const numId = Number(id);
    const checked = (event.target as HTMLInputElement).checked;
    this.excludedIds.update((ids) =>
      checked ? [...ids, numId] : ids.filter((i) => i !== numId),
    );
  }

  /** Sync MultiSelect output into the recipient signal. */
  protected onRecipientsChange(ids: number[]): void {
    this.selectedRecipientIds.set(ids);
  }

  /** Sync MultiSelect output into the excluded signal. */
  protected onExcludedChange(ids: number[]): void {
    this.excludedIds.set(ids);
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
