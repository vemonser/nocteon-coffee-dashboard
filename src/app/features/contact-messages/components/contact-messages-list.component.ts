import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArchive,
  lucideCopy,
  lucideReply,
  lucideInbox,
  lucideMail,
  lucideMoreVertical,
  lucideSearch,
  lucideSend,
  lucideTrash2,
  lucideX,
  lucideArrowUpDown,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

import { ViewMode } from '../../../core/crud/base-list.component';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { formatRelativeTime } from '../../../core/i18n/relative-time';
import { formatDateAndTime } from '../../../shared/utils/locale-format';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar/user-avatar.component';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { ContactResponse, ContactStats } from '../models/contact-message.model';
import { ContactMessageService } from '../services/contact-message.service';
import { UserService } from '../../users/services/user.service';
import { AuthService } from '../../../core/auth/auth.service';

type MessageTab = 'all' | 'unread' | 'replied' | 'archived';

@Component({
  selector: 'app-contact-messages-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    HlmButtonImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmTooltipImports,
    HlmDropdownMenuImports,
    PluralPipe,
    LocalizedDateComponent,
    PagerComponent,
    HlmTextareaImports,
    UserAvatarComponent,
    DialogShellComponent,
    StatusBadgeComponent,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideArchive,
      lucideCopy,
      lucideInbox,
  lucideReply,
      lucideMail,
      lucideMoreVertical,
      lucideSearch,
      lucideSend,
      lucideTrash2,
      lucideX,
      lucideArrowUpDown,
    }),
  ],
  templateUrl: './contact-messages-list.component.html',
})
export class ContactMessagesListComponent {
  private readonly notify = inject(NotifyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ContactMessageService);
  private readonly userService = inject(UserService);
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  readonly customerLinks = signal<Record<number, string | null>>({});

  readonly stats = signal<ContactStats>({
    total: 0,
    newCount: 0,
    repliedCount: 0,
    archivedCount: 0,
    unreadCount: 0,
  });
  readonly loading = signal(false);
  readonly total = signal(0);
  readonly unreadTotal = signal(0);
  readonly tab = signal<MessageTab>('all');
  readonly page = signal(0);
  readonly size = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50] as const;
  readonly items = signal<ContactResponse[]>([]);
  readonly search = signal('');
  readonly sort = signal('createdAt');
  readonly direction = signal<'asc' | 'desc'>('desc');
  readonly range = signal('all');
  readonly selected = signal<ContactResponse | null>(null);
  readonly replyText = signal('');
  readonly replying = signal(false);
  readonly savingDraft = signal(false);
  readonly replyError = signal<string | null>(null);
  readonly replyFeedback = signal<string | null>(null);
  readonly draftSaved = signal(false);
  readonly deleting = signal<ContactResponse | null>(null);
  readonly deletingBusy = signal(false);
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly bulkBusy = signal(false);

  private readonly VIEW_KEY = 'nocteon-contact-messages-view-mode';
  readonly viewMode = signal<ViewMode>(this.readViewMode());

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status === 'unread' || status === 'replied' || status === 'archived' || status === 'all') this.tab.set(status as MessageTab);
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.search.set(q);
    const range = this.route.snapshot.queryParamMap.get('range');
    if (range) this.range.set(range);
    const sort = this.route.snapshot.queryParamMap.get('sort');
    if (sort) this.sort.set(sort);
    const dir = this.route.snapshot.queryParamMap.get('direction');
    if (dir === 'asc' || dir === 'desc') this.direction.set(dir);
    const view = this.route.snapshot.queryParamMap.get('view');
    if (view === 'grid' || view === 'list') {
      this.viewMode.set(view as ViewMode);
      localStorage.setItem(this.VIEW_KEY, view);
    }
    this.loadPage();
    this.loadStats();
  }

  private readViewMode(): ViewMode {
    const stored = localStorage.getItem(this.VIEW_KEY);
    return stored === 'grid' ? 'grid' : 'list';
  }

  protected toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
    localStorage.setItem(this.VIEW_KEY, mode);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode === 'grid' ? 'grid' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadStats(): void {
    this.service.getStats().subscribe({
      next: (res) => {
        if (res?.data) this.stats.set(res.data);
      },
      error: () => {},
    });
  }

  protected loadPage(): void {
    this.loading.set(true);
    const tab = this.tab();
    let request;
    if (tab === 'all') {
      request = this.service.getAll({ page: this.page(), size: this.size(), sort: this.sort(), direction: this.direction() });
    } else if (tab === 'unread') {
      request = this.service.getAllUnread({ page: this.page(), size: this.size(), sort: this.sort(), direction: this.direction() });
    } else {
      request = this.service.getByStatus(tab.toUpperCase() as 'REPLIED' | 'ARCHIVED', { page: this.page(), size: this.size(), sort: this.sort(), direction: this.direction() });
    }

    request.subscribe({
      next: (res) => {
        const content = res.data?.content ?? [];
        this.total.set(res.data?.totalElements ?? content.length);
        this.items.set(content);
        this.loading.set(false);
        if (this.auth.hasPermission('user:read')) {
          for (const m of content) {
            if (this.customerLinks()[m.id] === undefined) {
              this.userService.getAll({ search: m.email, size: 5 }).subscribe({
                next: (r) => {
                  const found = (r.data?.content ?? []).find(
                    (u) => u.email?.toLowerCase() === m.email.toLowerCase(),
                  );
                  this.customerLinks.update((prev) => ({
                    ...prev,
                    [m.id]: found ? found.id : null,
                  }));
                },
                error: () =>
                  this.customerLinks.update((prev) => ({ ...prev, [m.id]: null })),
              });
            }
          }
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load messages');
      },
    });
  }

  protected setTab(tab: MessageTab): void {
    this.tab.set(tab);
    this.page.set(0);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'all' ? {} : { status: tab },
      replaceUrl: true,
    });
    this.loadPage();
  }

  protected readonly tabs = computed(() => [
    { id: 'all' as MessageTab, label: 'contactMessages.tabs.all', count: this.stats().total },
    { id: 'unread' as MessageTab, label: 'contactMessages.tabs.unread', count: this.stats().unreadCount },
    { id: 'replied' as MessageTab, label: 'contactMessages.tabs.replied', count: this.stats().repliedCount },
    { id: 'archived' as MessageTab, label: 'contactMessages.tabs.archived', count: this.stats().archivedCount },
  ]);

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.writeUrl();
      this.loadPage();
    }, 350);
  }

  protected onSortChange(event: { column: string; direction: 'asc' | 'desc' }): void {
    this.sort.set(event.column);
    this.direction.set(event.direction);
    this.writeUrl();
    this.loadPage();
  }

  protected onRangeChange(): void {
    this.writeUrl();
    this.loadPage();
  }

  private writeUrl(): void {
    const params: Record<string, string> = {};
    if (this.tab() !== 'all') params['status'] = this.tab();
    if (this.search()) params['q'] = this.search();
    if (this.sort() !== 'createdAt') params['sort'] = this.sort();
    if (this.direction() !== 'desc') params['direction'] = this.direction();
    if (this.range() !== 'all') params['range'] = this.range();
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true });
  }

  protected clearFilters(): void {
    this.search.set('');
    this.range.set('all');
    this.writeUrl();
    this.loadPage();
  }

  protected readonly hasActiveFilters = computed(
    () => this.search() !== '' || this.range() !== 'all',
  );

  protected openMessage(item: ContactResponse): void {
    this.selected.set(item);
    this.replyText.set('');
    this.replyError.set(null);
    this.replyFeedback.set(null);
    this.draftSaved.set(false);
    if (!item.read) {
      this.service.markAsRead(item.id).subscribe({
        next: (res) => {
          if (res?.data) {
            this.selected.set(res.data);
            this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          }
          this.loadStats();
        },
      });
    }
  }

  protected closeMessage(): void {
    this.selected.set(null);
    this.replyText.set('');
    this.replyError.set(null);
    this.replyFeedback.set(null);
    this.draftSaved.set(false);
  }

  protected sendReply(): void {
    const item = this.selected();
    const text = this.replyText().trim();
    if (!item || !text) return;

    this.replying.set(true);
    this.replyError.set(null);
    this.service.reply(item.id, text).subscribe({
      next: (res) => {
        this.replying.set(false);
        if (res?.data) {
          this.selected.set(res.data);
          this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          this.replyText.set('');
          this.draftSaved.set(false);
          if (res.data.emailStatus === 'SENT') {
            this.replyFeedback.set(`Reply sent to ${item.email}`);
            this.notify.success('contactMessages.replySent', `Reply sent to ${item.email}`);
          } else {
            this.replyFeedback.set('Reply saved, but the email could not be sent');
            this.notify.warning(
              'contactMessages.replySavedNotSent',
              'Reply saved, but the email could not be sent',
            );
          }
        }
      },
      error: (err) => {
        this.replying.set(false);
        this.replyError.set('Could not send the reply');
        this.notify.apiError(err, 'notify.errorFallback', 'Could not send the reply');
      },
    });
  }

  protected saveDraft(): void {
    const item = this.selected();
    const text = this.replyText().trim();
    if (!item || !text) return;

    this.savingDraft.set(true);
    this.replyError.set(null);
    try {
      localStorage.setItem(`nocteon-contact-draft:${item.id}`, text);
      this.savingDraft.set(false);
      this.draftSaved.set(true);
      this.replyFeedback.set(null);
      this.notify.success('contactMessages.replySaved', 'The reply was saved.');
    } catch {
      this.savingDraft.set(false);
      this.replyError.set('Could not save the reply');
      this.notify.apiError(null, 'notify.errorFallback', 'Could not save the reply');
    }
  }

  protected archive(item: ContactResponse): void {
    this.service.archive(item.id).subscribe({
      next: (res) => {
        if (res?.data) {
          this.selected.set(res.data);
          this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          this.notify.success('contactMessages.archived', 'Message archived');
          this.loadPage();
          this.loadStats();
        }
      },
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not archive the message'),
    });
  }

  protected resend(item: ContactResponse): void {
    this.service.resendEmail(item.id).subscribe({
      next: (res) => {
        if (res?.data) {
          this.selected.set(res.data);
          this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          if (res.data.emailStatus === 'SENT') {
            this.notify.success('contactMessages.replySent', 'Reply sent');
          } else {
            this.notify.warning(
              'contactMessages.replySavedNotSent',
              'Reply saved, but the email could not be sent',
            );
          }
        }
      },
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not resend the email'),
    });
  }

  protected copyEmail(email: string): void {
    void navigator.clipboard?.writeText(email);
    this.notify.success('contactMessages.copyEmail', 'Email copied');
  }

  protected markRead(message: ContactResponse): void {
    this.service.markAsRead(message.id).subscribe({
      next: (res) => {
        if (res?.data) {
          this.items.update((list) => list.map((m) => (m.id === message.id ? res.data! : m)));
          if (this.selected()?.id === message.id) this.selected.set(res.data);
        }
        this.loadStats();
      },
    });
  }

  protected confirmDelete(item: ContactResponse): void {
    this.deleting.set(item);
  }

  protected submitDelete(): void {
    const item = this.deleting();
    if (!item) return;
    this.deletingBusy.set(true);
    this.service.delete(item.id).subscribe({
      next: () => {
        this.deletingBusy.set(false);
        this.deleting.set(null);
        this.selected.set(null);
        this.notify.success('notify.deleted', 'Deleted successfully');
        this.loadPage();
        this.loadStats();
      },
      error: (err) => {
        this.deletingBusy.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete the message');
      },
    });
  }

  protected toggleSelect(id: number, checked: boolean): void {
    const next = new Set(this.selectedIds());
    checked ? next.add(id) : next.delete(id);
    this.selectedIds.set(next);
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected bulkMarkRead(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkBusy.set(true);
    let remaining = ids.length;
    for (const id of ids) {
      this.service.markAsRead(id).subscribe({
        next: (res) => {
          if (res?.data) {
            this.items.update((list) => list.map((m) => (m.id === id ? res.data! : m)));
          }
          if (--remaining === 0) {
            this.bulkBusy.set(false);
            this.clearSelection();
            this.loadStats();
          }
        },
        error: () => {
          if (--remaining === 0) this.bulkBusy.set(false);
        },
      });
    }
  }

  protected bulkArchive(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkBusy.set(true);
    let remaining = ids.length;
    for (const id of ids) {
      this.service.archive(id).subscribe({
        next: () => {
          if (--remaining === 0) {
            this.bulkBusy.set(false);
            this.clearSelection();
            this.loadPage();
            this.loadStats();
          }
        },
        error: () => {
          if (--remaining === 0) this.bulkBusy.set(false);
        },
      });
    }
  }

  protected bulkDelete(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkBusy.set(true);
    let remaining = ids.length;
    for (const id of ids) {
      this.service.delete(id).subscribe({
        next: () => {
          if (--remaining === 0) {
            this.bulkBusy.set(false);
            this.clearSelection();
            this.loadPage();
            this.loadStats();
          }
        },
        error: () => {
          if (--remaining === 0) this.bulkBusy.set(false);
        },
      });
    }
  }

  protected relativeTime(value: string): string {
    return formatRelativeTime(value, this.language.language());
  }

  protected absoluteTime(value: string): string {
    return formatDateAndTime(value, this.language.language());
  }

  protected customerUserId(message: ContactResponse): string | null {
    if (!this.auth.hasPermission('user:read')) return null;
    return this.customerLinks()[message.id] ?? null;
  }

  protected emailStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'SENT':
        return 'contactMessages.emailSent';
      case 'PENDING':
        return 'contactMessages.emailQueued';
      case 'FAILED':
      case 'DEAD':
        return 'contactMessages.emailNotSent';
      default:
        return 'contactMessages.emailNotSent';
    }
  }

  protected goToPage(page: number): void {
    this.page.set(page);
  }

  protected onPageSizeChange(size: number): void {
    if (size === this.size()) return;
    this.size.set(size);
    this.page.set(0);
  }

  protected readonly pageItems = computed(() => {
    const start = this.page() * this.size();
    return this.items().slice(start, start + this.size());
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.items().length / this.size())),
  );

  protected readonly emptyMessage = computed(() =>
    this.items().length === 0 ? 'No messages' : 'No messages match these filters',
  );
}