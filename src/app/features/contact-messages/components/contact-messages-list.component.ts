import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
import { PageResponse } from '../../../core/models/api-response.model';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-contact-messages-list',
  standalone: true,
  imports: [
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
  private service = inject(ContactMessageService);

  protected readonly Math = Math;

  items = signal<ContactResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<ContactResponse> | null>(null);
  currentPage = signal(0);
  searchQuery = '';
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  selected = signal<ContactResponse | null>(null);

  constructor() {
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.service
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        sort: 'createdAt',
        direction: 'desc',
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

  openMessage(item: ContactResponse): void {
    this.selected.set(item);
  }

  closeMessage(): void {
    this.selected.set(null);
  }
}