import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideInbox,
  lucideMail,
  lucideSearch,
  lucideX,
} from '@ng-icons/lucide';
import { ContactMessageService } from '../services/contact-message.service';
import { ContactResponse } from '../models/contact-message.model';
import { LanguageService } from '../../../core/i18n/language.service';
import { PageResponse } from '../../../core/models/api-response.model';
import { NotifyService } from '../../../core/notify/notify.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';

@Component({
  selector: 'app-contact-messages-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideInbox,
      lucideMail,
      lucideSearch,
      lucideX,
    }),
  ],
  templateUrl: './contact-messages-list.component.html',
})
export class ContactMessagesListComponent {
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);
  private service = inject(ContactMessageService);
  protected readonly language = inject(LanguageService);

  protected readonly Math = Math;

  items = signal<ContactResponse[]>([]);
  loading = signal(false);
  /** The dashboard's "unread messages" drill-down asks for unread only. */
  readonly unreadOnly = signal(false);
  pageData = signal<PageResponse<ContactResponse> | null>(null);
  currentPage = signal(0);
  pageSize = signal(20);
  readonly pageSizeOptions = [10, 20, 50] as const;
  searchQuery = '';
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  selected = signal<ContactResponse | null>(null);
  replyText = signal('');
  replying = signal(false);

  constructor() {
    // The dashboard's "unread messages" drill-down asks for the unread list.
    this.unreadOnly.set(this.route.snapshot.queryParamMap.get('status') === 'unread');
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    const request = this.unreadOnly()
      ? this.service.getAllUnread({
          page: this.currentPage(),
          size: this.pageSize(),
          search: this.searchQuery || undefined,
          sort: 'createdAt',
          direction: 'desc',
        })
      : this.service
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: 'createdAt',
        direction: 'desc',
      });
    request.subscribe({
        next: (res) => {
          this.pageData.set(res.data);
          this.items.set(res.data.content);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load messages');
        },
      });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
      this.loadPage();
    }, 400);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.loadPage();
  }

  openMessage(item: ContactResponse): void {
    this.selected.set(item);
    this.replyText.set(item.replyContent ?? '');
    if (!item.isRead) {
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

  closeMessage(): void {
    this.selected.set(null);
    this.replyText.set('');
  }

  sendReply(): void {
    const item = this.selected();
    if (!item || !this.replyText().trim()) return;
    this.replying.set(true);
    this.service.reply(item.id, this.replyText().trim()).subscribe({
      next: (res) => {
        this.replying.set(false);
        if (res?.data) {
          this.selected.set(res.data);
          this.items.update((list) => list.map((m) => (m.id === item.id ? res.data! : m)));
          this.notify.success('notify.updated', 'Reply sent');
        }
      },
      error: (err) => {
        this.replying.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not send reply');
      },
    });
  }
}