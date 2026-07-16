import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { OriginRequest, OriginResponse } from '../models/origin.model';
import { OriginService } from '../services/origin.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmLabelImports } from '@spartan-ng/helm/label';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus, lucideSearch, lucideGrid3x3, lucideList, lucidePencil,
  lucideTrash2, lucideX, lucideCheck, lucideImage, lucideChevronLeft, lucideChevronRight,
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { Router } from '@angular/router';


@Component({
  selector: 'app-origins-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, HasPermissionDirective, DataTableComponent,
    HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmInputImports,
    HlmDialogImports, HlmTableImports, HlmAvatarImports, HlmSkeletonImports, HlmLabelImports, NgIcon,
  ],
  providers: [
    provideIcons({
      lucidePlus, lucideSearch, lucideGrid3x3, lucideList, lucidePencil,
      lucideTrash2, lucideX, lucideCheck, lucideImage, lucideChevronLeft, lucideChevronRight,
    }),
  ],
  templateUrl: './origins-list.component.html',
})
export class OriginsListComponent extends BaseListComponent<OriginResponse, OriginRequest> {
  private originService = inject(OriginService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  protected override getId(item: OriginResponse): string {
    return item.slug;
  }


  private columnHelper = createColumnHelper<OriginResponse>();
  columns: ColumnDef<OriginResponse, any>[] = [
    this.columnHelper.accessor((row) => row.id, {
      id: 'id',
      header: 'ID',
      enableSorting: true,
    }),
    this.columnHelper.accessor((row) => row.imageUrl, {
      id: 'image',
      header: 'Image',
      enableSorting: false,
    }),
    this.columnHelper.accessor('slug', {
      header: 'Slug',
      enableSorting: true,
    }),
    this.columnHelper.accessor('code', {
      header: 'Code',
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
      header: 'created at',
      enableSorting: true,
    }),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  protected override loadPage(): Observable<PageResponse<OriginResponse>> {
    return this.originService
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
      code: [''],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(origin: OriginResponse): void {
    this.form.patchValue({ code: origin.code });
    this.translationHelper.patchArray(this.translationsArray, origin.translations, ['description']);
    this.imagePreview.set(origin.imageUrl);
  }

  protected override toRequest(): OriginRequest {
    return {
      code: this.form.value.code,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: OriginRequest, image?: File) {
    return this.originService.create(req, image, 'multipart');
  }

  protected override callUpdate(slug: string, req: OriginRequest, image?: File) {
    return this.originService.update(slug, req, image, 'multipart');
  }

  protected override callDelete(slug: string) {
    return this.originService.delete(slug);
  }

  goToDetail(item: OriginResponse): void {
    this.router.navigate(['/dashboard/origins', item.slug]);
  }

  getTranslationName(item: OriginResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

}