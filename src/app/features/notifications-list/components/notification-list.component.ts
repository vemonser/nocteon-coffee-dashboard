import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBell,
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
  lucideCreditCard,
  lucideShoppingCart,
  lucideStar,
} from '@ng-icons/lucide';

import { NotificationService } from '../services/notification.service';

import { PageResponse } from '../../../core/models/api-response.model';
import {
  NotificationResponse,
  NotificationType,
} from '../../notification/models/notification.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

type StatusFilter = 'all' | 'unread';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSelectImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideBell,
      lucideCheck,
      lucideChevronLeft,
      lucideChevronRight,
      lucideCreditCard,
      lucideShoppingCart,
      lucideStar,
    }),
  ],
  templateUrl: './notification-list.component.html',
})
export class NotificationListComponent {
  private notificationService = inject(NotificationService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  viewing = signal<NotificationResponse | null>(null);

  protected readonly Math = Math;
  protected readonly unreadCount = this.notificationService.unreadCount;

  items = signal<NotificationResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<NotificationResponse> | null>(null);
  currentPage = signal(0);
  pageSize = 20;

  statusFilter: StatusFilter = 'all';
  readonly statusFilterString = computed(() => this.statusFilter);
  readonly notificationId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = params.get('id');
        return id ? Number(id) : null;
      }),
    ),
    { initialValue: null },
  );

  constructor() {
    this.loadPage();
    console.log(this.notificationId());
    effect(() => {
      const id = this.notificationId();

      if (id == null) {
        this.viewing.set(null);
        return;
      }

      if (this.loading()) return; 
      const notification = this.items().find((n) => n.id === id);

      if (notification) {
        this.viewing.set(notification);
        this.markAsRead(notification);
        return;
      }

      this.router.navigate(['../'], { relativeTo: this.route });
    });
  }

  openNotification(notification: NotificationResponse): void {
    this.router.navigate([notification.id], { relativeTo: this.route });
  }

  closeView(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  itemToString = (value: string) => {
    const labels: Record<string, string> = {
      all: 'All Notifications',
      unread: 'Unread Only',
    };
    return labels[value] ?? value;
  };

  private readonly typeIconMap: Record<NotificationType, string> = {
    ORDER_CREATED: 'lucideShoppingCart',
    PAYMENT_SUCCEEDED: 'lucideCreditCard',
    PAYMENT_FAILED: 'lucideCreditCard',
    REVIEW_CREATED: 'lucideStar',
  };

  iconFor(type: NotificationType): string {
    return this.typeIconMap[type] ?? 'lucideBell';
  }

  loadPage(): void {
    this.loading.set(true);
    this.notificationService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize,
        unreadOnly: this.statusFilter === 'unread' ? true : undefined,
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

  onStatusFilterValueChange(value: string | null | undefined): void {
    this.statusFilter = value === 'unread' ? 'unread' : 'all';
    this.currentPage.set(0);
    this.loadPage();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  markAsRead(notification: NotificationResponse): void {
    if (notification.read) return;
    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        this.items.update((list) =>
          list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        );
      },
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.items.update((list) => list.map((n) => ({ ...n, read: true })));
      },
    });
  }
}
