import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ColumnDef, createColumnHelper } from '@tanstack/angular-table';
import { map, Observable } from 'rxjs';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmLabelImports } from '@spartan-ng/helm/label';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucidePencil,
  lucideTrash2,
  lucideX,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';

import { TastingNoteService } from '../services/tasting-note.service';
import { TastingNoteRequest, TastingNoteResponse } from '../models/tasting-note.model';

@Component({
  selector: 'app-tasting-note-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    // Spartan
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmDialogImports,
    HlmTableImports,
    HlmLabelImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideSearch,
      lucidePencil,
      lucideTrash2,
      lucideX,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './tasting-note-list.component.html',
})
export class TastingNoteListComponent extends BaseListComponent<
  TastingNoteResponse,
  TastingNoteRequest,
  string
> {
  private tastingNoteService = inject(TastingNoteService);
  protected translationHelper = inject(TranslationFormHelper);

  protected override getId(item: TastingNoteResponse): string {
    return item.slug;
  }

  // ─── Columns ──────────────────────────────────────────────────────────────
  private columnHelper = createColumnHelper<TastingNoteResponse>();

  columns: ColumnDef<TastingNoteResponse, any>[] = [
    this.columnHelper.accessor('id', {
      header: 'ID',
      enableSorting: true,
    }),
    this.columnHelper.accessor('slug', {
      header: 'Slug',
      enableSorting: true,
    }),
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.name ?? '—',
        {
          id: `name_${lang.code}`,
          header: `Name (${lang.label})`,
          enableSorting: false,
        },
      ),
    ),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  // ─── Base contract ─────────────────────────────────────────────────────────

  protected override loadPage(): Observable<PageResponse<TastingNoteResponse>> {
    return this.tastingNoteService
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      translations: this.translationHelper.buildArray(),
    });
  }

  protected override onEditOpen(item: TastingNoteResponse): void {
    this.translationHelper.patchArray(this.translationsArray, item.translations);
  }

  protected override toRequest(): TastingNoteRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
      })),
    };
  }

  protected override callCreate(req: TastingNoteRequest) {
    return this.tastingNoteService.create(req);
  }

  protected override callUpdate(slug: string, req: TastingNoteRequest) {
    return this.tastingNoteService.update(slug, req);
  }

  protected override callDelete(slug: string) {
    return this.tastingNoteService.delete(slug);
  }

  getTranslationName(item: TastingNoteResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }
}