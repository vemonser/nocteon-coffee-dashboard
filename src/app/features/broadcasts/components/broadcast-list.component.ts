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
  lucideSearch,
  lucideX,
} from '@ng-icons/lucide';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { BroadcastRequest, BroadcastResponse, BroadcastStatus } from '../models/broadcast.model';
import { BroadcastService } from '../services/broadcast.service';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';

/**
 * The broadcasts list.
 *
 * A broadcast reaches EVERY customer of the store: the backend picks the
 * recipients with `findByRoleAndSubscribedTrue(CUSTOMER)`, so there is no
 * audience to choose in the UI — one message, everybody. The page says so
 * in the create dialog, and every row carries the number of recipients the
 * backend counted, so "who did this go to" is never a guess.
 *
 * THE SENDING IS THE BACKEND'S (and it is a known gap):
 * `BroadcastCreationService` creates the broadcast and its recipient rows
 * and stops there. The build in the container has no sender and no
 * scheduler for it, so a broadcast stays PENDING with `sentCount = 0`.
 * The page therefore says "Queued" and shows what HAS been sent, rather
 * than pretending the delivery is done.
 */
@Component({
  selector: 'app-broadcast-list',
  standalone: true,
  imports: [
    LocalizedDateComponent,
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
      lucideX,
    }),
  ],
  templateUrl: './broadcast-list.component.html',
})
export class BroadcastListComponent extends BaseListComponent<BroadcastResponse, BroadcastRequest> {
  private broadcastService = inject(BroadcastService);

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

  protected override callDelete(_id: string): Observable<never> {
    throw new Error('Broadcasts cannot be deleted');
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
