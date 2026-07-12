import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ColumnDef, createColumnHelper } from '@tanstack/table-core';

import { map, Observable } from 'rxjs';


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
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { BrewingMethodRequest, BrewingMethodResponse } from '../models/brewing-method.model';
import { BrewingMethodService } from '../services/brewing-method.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';




@Component({
  selector: 'app-brewing-method-list',
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
  templateUrl: './brewing-method-list.component.html',
})
export class BrewingMethodListComponent extends BaseListComponent<BrewingMethodResponse, BrewingMethodRequest, string> {
  private brewingMethodService = inject(BrewingMethodService);
  protected translationHelper = inject(TranslationFormHelper);

  protected override getId(item: BrewingMethodResponse): string {
    return item.slug;
  }

  // Columns for list view only
  private columnHelper = createColumnHelper<BrewingMethodResponse>();
  columns: ColumnDef<BrewingMethodResponse, any>[] = [
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
        },
      ),
    ),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  // ─── Base contract ─────────────────────────────────────────────────────────

  protected override loadPage(): Observable<PageResponse<BrewingMethodResponse>> {
    return this.brewingMethodService
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
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(item: BrewingMethodResponse): void {
    this.translationHelper.patchArray(this.translationsArray, item.translations, ['description']);
  }

  protected override toRequest(): BrewingMethodRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: BrewingMethodRequest) {
    // مفيش image، فـ بنادي الـ base method عادي
    return this.brewingMethodService.create(req);
  }

  protected override callUpdate(slug: string, req: BrewingMethodRequest) {
    return this.brewingMethodService.update(slug, req);
  }

  protected override callDelete(slug: string) {
    return this.brewingMethodService.delete(slug);
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  getTranslationName(item: BrewingMethodResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }
}
