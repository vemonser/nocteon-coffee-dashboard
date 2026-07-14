import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { ProcessingMethodRequest, ProcessingMethodResponse } from '../models/processing-method.model';
import { ProcessingMethodService } from '../services/processing-method.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmLabelImports } from '@spartan-ng/helm/label';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucideGrid3x3,
  lucideList,
  lucidePencil,
  lucideTrash2,
  lucideX,
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { Router } from '@angular/router';

type ViewMode = 'list' | 'grid';

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
    HlmSelectImports,
    HlmDialogImports,
    HlmTableImports,
    HlmAvatarImports,
    HlmSkeletonImports,
    HlmLabelImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideSearch,
      lucideGrid3x3,
      lucideList,
      lucidePencil,
      lucideTrash2,
      lucideX,
      lucideCheck,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './processing-method-list.component.html',
})
export class ProcessingMethodListComponent extends BaseListComponent<ProcessingMethodResponse, ProcessingMethodRequest> {
  private processingMethodService = inject(ProcessingMethodService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  protected override getId(item: ProcessingMethodResponse): string {
    return item.slug;
  }

  viewMode = signal<ViewMode>('list');

  isActiveFilter: boolean | undefined = undefined;

  onStatusFilterValueChange(value: string | null | undefined): void {
    this.isActiveFilter = value === 'active' ? true : value === 'inactive' ? false : undefined;
    this.currentPage.set(0);
    this.load();
  }

  itemToString = (value: string) => {
    const labels: Record<string, string> = { all: 'All Status', active: 'Active', inactive: 'Inactive' };
    return labels[value] ?? value;
  };

  private columnHelper = createColumnHelper<ProcessingMethodResponse>();
  columns: ColumnDef<ProcessingMethodResponse, any>[] = [
    this.columnHelper.accessor((row) => row.id, {
      id: 'id',
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

    this.columnHelper.accessor('createdAt', {
      header: 'Created At',
      enableSorting: true,
    }),
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
      isActive: [true],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(variety: ProcessingMethodResponse): void {
    this.translationHelper.patchArray(this.translationsArray, variety.translations, ['description']);
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

  goToDetail(item: ProcessingMethodResponse): void {
    this.router.navigate(['/dashboard/processing-methods', item.slug]);
  }

  getTranslationName(item: ProcessingMethodResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }


  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }
}
