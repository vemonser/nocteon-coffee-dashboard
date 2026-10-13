import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideLoader2,
  lucideNewspaper,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideTrash2,
} from '@ng-icons/lucide';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { JournalPostResponse } from '../models/journal.model';
import { JournalService } from '../services/journal.service';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-journal-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideLoader2,
      lucideNewspaper,
      lucidePencil,
      lucidePlus,
      lucideSearch,
      lucideTrash2,
    }),
  ],
  templateUrl: './journal-list.component.html',
})
export class JournalListComponent extends BaseListComponent<JournalPostResponse, never, string> {
  router = inject(Router);
  private journalService = inject(JournalService);

  protected override getId(item: JournalPostResponse): string {
    return item.slug;
  }

  protected override loadPage(): Observable<PageResponse<JournalPostResponse>> {
    return this.journalService
      .getAll({
        page: this.currentPage(),
        size: 20,
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm() {
    return this.fb.group({ _: ['', Validators.nullValidator] });
  }

  protected override onEditOpen(_item: JournalPostResponse): void {
    // Routing-based edit — handled by goToEdit instead of a dialog.
  }

  protected override toRequest(): never {
    throw new Error('Journal posts are created via a separate form route');
  }

  protected override callCreate(_request: never): Observable<never> {
    throw new Error('Journal posts are created via a separate form route');
  }

  protected override callUpdate(_id: string, _request: never): Observable<never> {
    throw new Error('Journal posts are edited via a separate form route');
  }

  protected override callDelete(slug: string) {
    return this.journalService.remove(slug);
  }

  goToNew(): void {
    this.router.navigate(['/dashboard/journal/new']);
  }

  goToEdit(item: JournalPostResponse): void {
    this.router.navigate(['/dashboard/journal', item.slug, 'edit']);
  }

  /** Journal item title comes from whichever translation exists. */
  titleOf(item: JournalPostResponse): string {
    return item.title ?? item.slug;
  }
}