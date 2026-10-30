import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBellOff,
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { countMessage } from '../../../core/i18n/plural';
import { NotificationService } from '../services/notification.service';
import { NotificationItem } from '../../notification/models/notification.model';
import { NotificationItemComponent } from '../../notification/components/notification-item.component';
import { PermissionService } from '../../../core/auth/permission.service';
import {
  notificationRoute,
  NOTIFICATION_TYPE_REGISTRY,
} from '../../notification/notification-type.registry';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSeparatorImports,
    NgIcon,
    TranslocoPipe,
    PluralPipe,
    NotificationItemComponent,
    DialogShellComponent,
  ],
  providers: [
    provideIcons({
      lucideBellOff,
      lucideCheck,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './notification-list.component.html',
})
export class NotificationListComponent {
  private notificationService = inject(NotificationService);
  private perm = inject(PermissionService);
  private router = inject(Router);
  private transloco = inject(TranslocoService);

  items = this.notificationService.notifications;
  loading = this.notificationService.loading;
  error = this.notificationService.error;
  unreadCount = this.notificationService.unreadCount;
  pageData = this.notificationService.page;
  totalElements = this.notificationService.totalElements;
  totalPages = this.notificationService.totalPages;
  filter = this.notificationService.filter;

  selected = signal<Set<string | number>>(new Set());
  typeFilter = signal<string>('all');
  confirmState = signal<{ items: NotificationItem[]; message: string } | null>(null);

  canUpdate = () => this.perm.has('notification:update');
  canDelete = () => this.perm.has('notification:delete');

  readonly typeOptions = computed(() =>
    Array.from(new Set(this.items().map((n) => n.type))).sort(),
  );

  visibleItems = computed(() => {
    const t = this.typeFilter();
    return t === 'all' ? this.items() : this.items().filter((n) => n.type === t);
  });

  selectedItems = computed(() => {
    const ids = this.selected();
    return this.items().filter((n) => ids.has(n.id));
  });

  allSelected = computed(() => {
    const list = this.visibleItems();
    return list.length > 0 && list.every((n) => this.selected().has(n.id));
  });

  // `page` is the 0-based page index the store last loaded; the UI labels
  // pages from 1. Subtracting 1 here made page 2 render as "Page 1" and
  // disabled Prev, so paging past page 2 kept reloading the same page.
  currentPage = computed(() => Math.max(0, this.pageData()));

  typeLabel(type: string): string {
    const config = NOTIFICATION_TYPE_REGISTRY[type];
    const key = config?.i18nKey ?? 'system';
    return this.transloco.translate(`notifications.types.${key}.title`);
  }

  constructor() {
    this.notificationService.loadItems(true);
  }

  onStatusChange(value: string | null | undefined): void {
    this.notificationService.setFilter(value === 'unread' ? 'unread' : 'all');
    this.selected.set(new Set());
  }

  onTypeChange(value: string | null | undefined): void {
    this.typeFilter.set(value || 'all');
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.notificationService.loadPage(page);
  }

  toggleSelect(item: NotificationItem): void {
    const next = new Set(this.selected());
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    this.selected.set(next);
  }

  toggleAll(): void {
    if (this.allSelected()) {
      this.selected.set(new Set());
      return;
    }
    this.selected.set(new Set(this.visibleItems().map((n) => n.id)));
  }

  isSelected(item: NotificationItem): boolean {
    return this.selected().has(item.id);
  }

  openItem(item: NotificationItem): void {
    if (!item.read) this.notificationService.markAsRead(item, true);
    const route = notificationRoute(item);
    if (route) this.router.navigateByUrl(route);
  }

  markSelectedAsRead(): void {
    if (!this.canUpdate() || this.selectedItems().length === 0) return;
    this.notificationService.markManyAsRead(this.selectedItems());
    this.selected.set(new Set());
  }

  deleteSelected(): void {
    if (!this.canDelete() || this.selectedItems().length === 0) return;
    this.confirmState.set({
      items: this.selectedItems(),
      // A count inside a sentence: Arabic has six plural categories and a
      // single-form string is wrong at 3–10 and 11+.
      message: countMessage(
        (key, params) => this.transloco.translate(key, params),
        this.transloco.getActiveLang() as 'en' | 'ar',
        'notifications.deleteMessage',
        this.selectedItems().length,
      ),
    });
  }

  deleteOne(item: NotificationItem): void {
    if (!this.canDelete()) return;
    this.confirmState.set({
      items: [item],
      message: this.transloco.translate('notifications.deleteOneMessage'),
    });
  }

  confirmDelete(): void {
    const state = this.confirmState();
    if (!state) return;
    if (state.items.length === 1) this.notificationService.delete(state.items[0]);
    else this.notificationService.deleteMany(state.items);
    this.selected.set(new Set());
    this.confirmState.set(null);
  }

  cancelDelete(): void {
    this.confirmState.set(null);
  }

  markAllAsRead(): void {
    if (!this.canUpdate() || this.unreadCount() === 0) return;
    this.notificationService.markAllAsRead();
  }

  retry(): void {
    this.notificationService.loadItems(true);
  }

  onMarkRead(item: NotificationItem): void {
    this.notificationService.markAsRead(item, true);
  }

  onMarkUnread(item: NotificationItem): void {
    this.notificationService.markAsUnread(item);
  }
}
