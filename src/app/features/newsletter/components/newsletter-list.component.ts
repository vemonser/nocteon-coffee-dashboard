import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideDownload,
  lucideLoader2,
  lucideMail,
  lucideSearch,
  lucideUsers,
} from '@ng-icons/lucide';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { NewsletterService } from '../services/newsletter.service';
import { UserResponse } from '../../users/model/user.model';
import { PageResponse } from '../../../core/models/api-response.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';

/**
 * The newsletter page.
 *
 * The audience you can send a newsletter to — the store's customers — as a
 * TABLE, like every other list in the dashboard, and as a CSV you can hand
 * to a newsletter tool.
 *
 * Two rules:
 *
 *  - the EXPORT is the point of the page, so it is the primary action in
 *    the header, and it exports EVERY email of the audience (not the rows
 *    on the current page) — an export of "the 20 emails on this page" is
 *    not an export of the audience;
 *  - the page says WHAT the list is. The admin users endpoint does not
 *    carry the per-user newsletter flag, so a customer who unsubscribed is
 *    still listed. The help line says so.
 */
@Component({
  selector: 'app-newsletter-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    ErrorStateComponent,
    DataTableComponent,
    HlmButtonImports,
    HlmInputImports,
    HlmTooltipImports,
    BrnTooltip,
    NgIcon,
    TranslocoPipe,
        PluralPipe,
  ],
  providers: [
    provideIcons({ lucideDownload, lucideLoader2, lucideMail, lucideSearch, lucideUsers }),
  ],
  templateUrl: './newsletter-list.component.html',
})
export class NewsletterListComponent extends BaseListComponent<UserResponse, never, string> {

  protected override createPermission: string | null = null;
  protected override updatePermission: string | null = null;
  protected override deletePermission: string | null = null;
  private readonly newsletterService = inject(NewsletterService);

  /** The whole audience, for the export. */
  private audience: UserResponse[] = [];

  /** True while the export is running. */
  protected readonly exporting = signal(false);

  private readonly columnHelper = createColumnHelper<UserResponse>();

  protected readonly columns: ColumnDef<UserResponse, any>[] = [
    // The address is the point of the page, so it is the first column, and
    // it is wide enough for a real address (the longest one in the store
    // is 28 characters).
    this.columnHelper.accessor('email', {
      id: 'email',
      header: 'newsletter.columns.email',
      enableSorting: true,
      meta: { width: '260px' },
    }),
    this.columnHelper.accessor(
      (row) => this.fullName(row),
      {
        id: 'fullName',
        header: 'newsletter.columns.name',
        enableSorting: false,
        meta: { width: '190px' },
      },
    ),
    this.columnHelper.accessor((row) => row.createdAt, {
      id: 'joined',
      header: 'newsletter.columns.joined',
      enableSorting: true,
      meta: { width: '120px' },
    }),
    this.columnHelper.accessor((row) => row.lastActiveAt, {
      id: 'createdAtTime',
      header: 'newsletter.columns.lastActive',
      enableSorting: true,
      meta: { width: '170px' },
    }),
  ];

  /** The number of addresses in the audience — the TOTAL, not the page. */
  protected readonly totalCount = computed(() => this.pageData()?.totalElements ?? 0);

  protected override getId(item: UserResponse): string {
    return item.id;
  }

  /**
   * The page is READ-ONLY: a newsletter address is an account, not a
   * record of its own, so there is nothing to create, edit or delete here.
   */
  protected override buildForm(): FormGroup {
    return this.fb.group({});
  }
  protected override toRequest(): never {
    throw new Error('The newsletter audience is read-only');
  }
  protected override callCreate(): Observable<never> {
    throw new Error('The newsletter audience is read-only');
  }
  protected override callUpdate(): Observable<never> {
    throw new Error('The newsletter audience is read-only');
  }
  protected override callDelete(): Observable<never> {
    throw new Error('The newsletter audience is read-only');
  }
  protected override onEditOpen(): void {
    /* the audience is read-only */
  }

  protected override loadPage(): Observable<PageResponse<UserResponse>> {
    return this.newsletterService.getAll({
      page: this.currentPage(),
      size: this.pageSize(),
      search: this.searchQuery || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
    });
  }

  /** The name, or an empty string when the account has none. */
  private fullName(row: UserResponse): string {
    return [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  }

  /**
   * Export the addresses of the WHOLE audience as a CSV.
   *
   * The export is what the page is for, so it covers every address, not
   * the rows on the current page.
   */
  protected exportEmails(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.newsletterService.getEveryAddress().subscribe({
        next: (addresses) => {
          this.audience = addresses;
          this.exporting.set(false);
          if (!this.audience.length) {
            this.notify.warning('newsletter.export.empty', 'There are no addresses to export');
            return;
          }
          this.downloadCsv();
        },
        error: () => {
          this.exporting.set(false);
          this.notify.apiError(
            null,
            'newsletter.export.failed',
            'The addresses could not be exported',
          );
        },
      });
  }

  /** The CSV: one address per line, with the name next to it. */
  private downloadCsv(): void {
    const escape = (value: unknown): string => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = ['email,name,role,joined'];
    for (const row of this.audience) {
      lines.push(
        [row.email, this.fullName(row), row.role, row.createdAt].map(escape).join(','),
      );
    }
    // The BOM, so Excel reads the file as UTF-8.
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.notify.success('newsletter.export.done', 'The addresses were exported');
  }
}
