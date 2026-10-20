import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArchive,
  lucideCopy,
  lucideInbox,
  lucideMail,
  lucideSearch,
  lucideSend,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

import { LanguageService } from '../../../core/i18n/language.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { formatRelativeTime } from '../../../core/i18n/relative-time';
import { formatDateAndTime } from '../../../shared/utils/locale-format';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar/user-avatar.component';
import { OrderDialogComponent } from '../../orders/components/order-dialog/order-dialog.component';
import { ContactResponse } from '../models/contact-message.model';
import { ContactMessageService } from '../services/contact-message.service';

type MessageTab = 'all' | 'unread' | 'replied';

/**
 * The contact messages console: see what has not been read, open it, write
 * a reply, move on.
 *
 * <p>The reply really emails the customer. The success toast says "Reply
 * sent" ONLY when the recorded email status is SENT — every other status
 * says what happened and offers "Send again". The typed text stays in the
 * box when the send fails: the admin's words are never lost.
 */
@Component({
  selector: 'app-contact-messages-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmButtonImports,
    HlmInputImports,
    HlmNativeSelectImports,
    PluralPipe,
    LocalizedDateComponent,
    PagerComponent,
    HlmTextareaImports,
    UserAvatarComponent,
    OrderDialogComponent,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideArchive,
      lucideCopy,
      lucideInbox,
      lucideMail,
      lucideSearch,
      lucideSend,
      lucideTrash2,
      lucideX,
    }),
  ],
  templateUrl: './contact-messages-list.component.html',
})
export class ContactMessagesListComponent {
  private readonly notify = inject(NotifyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ContactMessageService);
  protected readonly language = inject(LanguageService);

  readonly items = signal<ContactResponse[]>([]);
  readonly loading = signal(false);
  readonly total = signal(0);
  readonly unreadTotal = signal(0);
  readonly tab = signal<MessageTab>('all');
  readonly page = signal(0);
  readonly size = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50] as const;
  /** The rows of the whole loaded set; the pager slices them. */
  readonly allItems = signal<ContactResponse[]>([]);
  readonly search = signal('');
  readonly range = signal('all');
  readonly selected = signal<ContactResponse | null>(null);
  readonly replyText = signal('');
  readonly replying = signal(false);
  readonly deleting = signal<ContactResponse | null>(null);
  readonly deletingBusy = signal(false);

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status === 'unread') this.tab.set('unread');
    this.loadPage();
    this.loadUnreadCount();
  }

  // ── the data ──────────────────────────────────────────────────────────────

  private loadPage(): void {
    this.loading.set(true);
    const request =
      this.tab() === 'unread'
        ? this.service.getAllUnread({ page: 0, size: 100 })
        : this.service.getAll({ page: 0, size: 100 });

    request.subscribe({
      next: (res) => {
        const content = res.data?.content ?? [];
        this.total.set(res.data?.totalElements ?? content.length);
        this.allItems.set(content);
        this.items.set(this.applyFilters(content));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load messages');
      },
    });
  }

  /** The unread count comes from the server's own list, so the badge is
   *  never an estimate over what happened to be loaded. */
  private loadUnreadCount(): void {
    this.service.getAllUnread({ page: 0, size: 1 }).subscribe({
      next: (res) => this.unreadTotal.set(res.data?.totalElements ?? 0),
      error: () => {
        /* the badge stays at zero; the list still works */
      },
    });
  }

  /**
   * The search, the date range and the Replied tab are client-side: the
   * endpoint takes no status filter and no dates, so the page loads the
   * whole set (up to the API's maximum) and narrows it here.
   */
  private applyFilters(content: ContactResponse[]): ContactResponse[] {
    const search = this.search().trim().toLowerCase();
    const from = this.rangeStart();
    const to = this.rangeEnd();

    return content.filter((message) => {
      if (this.tab() === 'replied' && !message.replied) return false;
      if (from && new Date(message.createdAt) < from) return false;
      if (to && new Date(message.createdAt) > to) return false;
      if (!search) return true;
      return (
        message.subject.toLowerCase().includes(search) ||
        message.name.toLowerCase().includes(search) ||
        message.email.toLowerCase().includes(search) ||
        message.message.toLowerCase().includes(search)
      );
    });
  }

  private rangeStart(): Date | null {
    const now = Date.now();
    switch (this.range()) {
      case 'today':
        return new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z');
      case '7d':
        return new Date(now - 7 * 86400000);
      case '30d':
        return new Date(now - 30 * 86400000);
      default:
        return null;
    }
  }

  private rangeEnd(): Date | null {
    return null;
  }

  // ── the tabs ──────────────────────────────────────────────────────────────

  protected setTab(tab: MessageTab): void {
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'all' ? {} : { status: tab },
      replaceUrl: true,
    });
    this.loadPage();
  }

  protected readonly tabs = computed(() => [
    { id: 'all' as MessageTab, label: 'contactMessages.tabs.all', count: this.total() },
    { id: 'unread' as MessageTab, label: 'contactMessages.tabs.unread', count: this.unreadTotal() },
    { id: 'replied' as MessageTab, label: 'contactMessages.tabs.replied', count: this.repliedCount() },
  ]);

  private readonly repliedCount = computed(() => this.items().filter((m) => m.replied).length);

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadPage(), 350);
  }

  protected onRangeChange(): void {
    this.loadPage();
  }

  // ── the message ───────────────────────────────────────────────────────────

  protected openMessage(item: ContactResponse): void {
    this.selected.set(item);
    this.replyText.set('');
    if (!item.read) {
      this.service.markAsRead(item.id).subscribe({
        next: (res) => {
          if (res?.data) {
            this.selected.set(res.data);
            this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          }
        },
      });
    }
  }

  protected closeMessage(): void {
    this.selected.set(null);
    this.replyText.set('');
  }

  /**
   * Save the reply and email the customer.
   *
   * <p>The typed text stays in the box when the send fails: the admin's
   * words are never lost. And the success toast says "Reply sent" ONLY
   * when the email really went out.
   */
  protected sendReply(): void {
    const item = this.selected();
    const text = this.replyText().trim();
    if (!item || !text) return;

    this.replying.set(true);
    this.service.reply(item.id, text).subscribe({
      next: (res) => {
        this.replying.set(false);
        if (res?.data) {
          this.selected.set(res.data);
          this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          this.replyText.set('');
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
      error: (err) => {
        this.replying.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not send the reply');
      },
    });
  }

  /** Send the stored reply again, without changing it. */
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
        this.loadUnreadCount();
      },
      error: (err) => {
        this.deletingBusy.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete the message');
      },
    });
  }

  // ── the labels ────────────────────────────────────────────────────────────

  protected relativeTime(value: string): string {
    return formatRelativeTime(value, this.language.language());
  }

  protected absoluteTime(value: string): string {
    return formatDateAndTime(value, this.language.language());
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

  // ── the pager ───────────────────────────────────────────────────────────

  protected goToPage(page: number): void {
    this.page.set(page);
  }

  protected onPageSizeChange(size: number): void {
    if (size === this.size()) return;
    this.size.set(size);
    this.page.set(0);
  }

  /** The page of rows the pager is showing. */
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
