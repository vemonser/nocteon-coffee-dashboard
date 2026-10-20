import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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

  statusLabel(status: BroadcastStatus): string {
    const labels: Record<BroadcastStatus, string> = {
      PENDING: 'PENDING',
      IN_PROGRESS: 'IN_PROGRESS',
      COMPLETED: 'COMPLETED',
    };
    return labels[status];
  }
}