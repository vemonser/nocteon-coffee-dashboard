import { Component, ElementRef, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBell, lucideBellOff, lucideMailOpen } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmPopover, HlmPopoverImports } from '@spartan-ng/helm/popover';
import { BrnPopover } from '@spartan-ng/brain/popover';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotificationService } from '../services/notification.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { NotificationItem } from '../models/notification.model';
import { NotificationItemComponent } from './notification-item.component';
import { notificationRoute } from '../notification-type.registry';
import { LanguageService } from '../../../core/i18n/language.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    HlmButtonImports,
    HlmPopoverImports,
    HlmBadgeImports,
    HlmSeparatorImports,
    TranslocoPipe,
    NotificationItemComponent,
  ],
  providers: [provideIcons({ lucideBell, lucideBellOff, lucideMailOpen })],
  templateUrl: './notification.component.html',
})
export class NotificationComponent {
  notificationService = inject(NotificationService);
  private perm = inject(PermissionService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private language = inject(LanguageService);
  private popover = viewChild(HlmPopover, { read: BrnPopover });

  isOpen = signal(false);
  focusedIndex = signal(-1);

  /** Keep the 380px panel inside the viewport on both sides of the bell. */
  align = computed<'start' | 'end'>(() =>
    this.language.language() === 'ar' ? 'start' : 'end',
  );

  canRead = () => this.perm.has('notification:read');
  canUpdate = () => this.perm.has('notification:update');

  items = this.notificationService.notifications;
  loading = this.notificationService.loading;
  error = this.notificationService.error;
  unreadCount = this.notificationService.unreadCount;

  badgeLabel = computed(() => {
    const n = this.unreadCount();
    return n > 9 ? '9+' : String(n);
  });

  todayItems = computed(() => {
    const start = this.startOfToday();
    return this.items().filter((n) => new Date(n.createdAt).getTime() >= start);
  });

  earlierItems = computed(() => {
    const start = this.startOfToday();
    return this.items().filter((n) => new Date(n.createdAt).getTime() < start);
  });

  private startOfToday(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  onPopoverState(state: 'open' | 'closed'): void {
    this.isOpen.set(state === 'open');
    if (state === 'open') {
      this.focusedIndex.set(-1);
      this.notificationService.loadItems(true);
    }
  }

  close(): void {
    this.popover()?.close();
    this.focusedIndex.set(-1);
    setTimeout(() => {
      const btn = this.elementRef.nativeElement.querySelector(
        '[data-testid="notifications-bell"]',
      ) as HTMLElement | null;
      btn?.focus();
    }, 0);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;
    const flat = this.items();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusedIndex.update((i) => Math.min(flat.length - 1, i + 1));
      this.focusItem();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusedIndex.update((i) => Math.max(0, i - 1));
      this.focusItem();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const idx = this.focusedIndex();
      if (idx >= 0 && flat[idx]) {
        event.preventDefault();
        this.handleItemClick(flat[idx]);
      }
    }
  }

  private focusItem(): void {
    setTimeout(() => {
      const idx = this.focusedIndex();
      const el = document.querySelector(
        `[data-idx="${idx}"] .item-main`,
      ) as HTMLElement | null;
      el?.focus();
      el?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  handleItemClick(item: NotificationItem): void {
    if (!item.read) {
      this.notificationService.markAsRead(item, true);
    }
    const route = notificationRoute(item);
    this.close();
    if (route) {
      this.router.navigateByUrl(route);
    }
  }

  markAllAsRead(): void {
    if (!this.canUpdate() || this.unreadCount() === 0) return;
    this.notificationService.markAllAsRead();
  }

  onMarkRead(item: NotificationItem): void {
    this.notificationService.markAsRead(item, true);
  }

  onMarkUnread(item: NotificationItem): void {
    this.notificationService.markAsUnread(item);
  }

  onDelete(item: NotificationItem): void {
    this.notificationService.delete(item);
  }

  loadMore(): void {
    this.notificationService.loadMore();
  }

  retry(): void {
    this.notificationService.loadItems(true);
  }

  goToAll(): void {
    this.close();
    this.router.navigateByUrl('/dashboard/notifications');
  }
}
