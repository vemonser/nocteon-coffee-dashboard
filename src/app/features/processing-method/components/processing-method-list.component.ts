import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';

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


import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { ProcessingMethodRequest, ProcessingMethodResponse } from '../models/processing-method.model';
import { ProcessingMethodService } from '../services/processing-method.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';


@Component({
  selector: 'app-processing-method-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
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
  templateUrl: './processing-method-list.component.html',
})
export class ProcessingMethodListComponent extends BaseListComponent<ProcessingMethodResponse, ProcessingMethodRequest, string> {
  private processingMethodService = inject(ProcessingMethodService);
  protected translationHelper = inject(TranslationFormHelper);

  protected override getId(item: ProcessingMethodResponse): string {
    return item.slug;
  }

  private columnHelper = createColumnHelper<ProcessingMethodResponse>();
  columns: ColumnDef<ProcessingMethodResponse, any>[] = [
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

  protected override loadPage(): Observable<PageResponse<ProcessingMethodResponse>> {
    return this.processingMethodService
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

  protected override onEditOpen(item: ProcessingMethodResponse): void {
    this.translationHelper.patchArray(this.translationsArray, item.translations, ['description']);
  }

  protected override toRequest(): ProcessingMethodRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: ProcessingMethodRequest) {
    return this.processingMethodService.create(req);
  }

  protected override callUpdate(slug: string, req: ProcessingMethodRequest) {
    return this.processingMethodService.update(slug, req);
  }

  protected override callDelete(slug: string) {
    return this.processingMethodService.delete(slug);
  }

  getTranslationName(item: ProcessingMethodResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }
}