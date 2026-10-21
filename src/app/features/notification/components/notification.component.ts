import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { NotificationService } from '../services/notification.service';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroBell } from '@ng-icons/heroicons/outline';
import { NotificationDto } from '../models/notification.model';
import { Router, RouterLink } from '@angular/router';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { SmoothScroll } from 'ngx-scrollbar/smooth-scroll';
import { HlmSeparator } from '@spartan-ng/helm/separator';

import { TranslocoPipe } from '@jsverse/transloco';
import { NotifyService } from '../../../core/notify/notify.service';
@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  imports: [
    NgIcon,
    HlmPopoverImports,
    HlmButtonImports,
    SmoothScroll,
    HlmSeparator,
    RouterLink,
      TranslocoPipe,
      LocalizedDateComponent,
  ],
  providers: [
    provideIcons({
      heroBell,
      lucideChevronLeft,
    }),
  ],
})
export class NotificationComponent {
  notificationService = inject(NotificationService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  isOpen = signal(false);
  notifications = signal<NotificationDto[]>([]);
  loading = signal(false);

  toggleDropdown() {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.loadNotifications();
    }
  }

  goToAllNotifications() {
    this.router.navigateByUrl('/dashboard/notifications');
  }
  loadNotifications() {
    this.loading.set(true);
    this.notificationService.getNotifications(true, 0, 10).subscribe({
      next: (res) => {
        this.notifications.set(res.data?.content ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onNotificationClick(notification: NotificationDto) {
    if (!notification.read) {
      this.notificationService.markAsRead(notification.id).subscribe({
        // نقلل العداد فورًا محليًا من غير ما نستنى الـ polling
        next: () => this.notificationService.unreadCount.update((c) => Math.max(0, c - 1)),
        error: (err) =>
          this.notify.apiError(err, 'notify.errorFallback', 'Could not mark as read'),
      });
    }
    this.isOpen.set(false);
    this.router.navigateByUrl(notification.link);
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
        this.notificationService.unreadCount.set(0);
        this.notify.success('notify.allMarkedAsRead', 'All marked as read');
      },
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark all as read'),
    });
  }

  // يقفل الـ dropdown لو دست بره الـ component
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}