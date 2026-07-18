import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { NotificationService } from '../services/notification.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroBell } from '@ng-icons/heroicons/outline';
import { NotificationDto } from '../models/notification.model';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { SmoothScroll } from 'ngx-scrollbar/smooth-scroll';
import { HlmSeparator } from '@spartan-ng/helm/separator';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  imports: [
    NgIcon,
    DatePipe,
    HlmPopoverImports,
    HlmButtonImports,
    SmoothScroll,
    HlmSeparator,
    RouterLink,
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
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  isOpen = signal(false);
  notifications = signal<NotificationDto[]>([]);
  loading = signal(false);

  ngOnInit() {
    console.log(this.notifications());
  }
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
      this.notificationService.markAsRead(notification.id).subscribe(() => {
        // نقلل العداد فورًا محليًا من غير ما نستنى الـ polling
        this.notificationService.unreadCount.update((c) => Math.max(0, c - 1));
      });
    }
    this.isOpen.set(false);
    this.router.navigateByUrl(notification.link);
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe(() => {
      this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
      this.notificationService.unreadCount.set(0);
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
