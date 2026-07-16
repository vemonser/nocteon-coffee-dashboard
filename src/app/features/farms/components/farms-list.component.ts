import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { FarmRequest, FarmResponse } from '../models/farm.model';
import { FarmService } from '../services/farm.service';
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
  lucidePlus,
  lucideSearch,
  lucideGrid3x3,
  lucideList,
  lucidePencil,
  lucideTrash2,
  lucideX,
  lucideCheck,
  lucideImage,
  lucideChevronLeft,
  lucideChevronRight,
  lucideMapPin,
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { Router } from '@angular/router';


@Component({
  selector: 'app-farms-list',
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
      lucideImage,
      lucideChevronLeft,
      lucideChevronRight,
      lucideMapPin,
    }),
  ],
  templateUrl: './farms-list.component.html',
})
export class FarmsListComponent extends BaseListComponent<FarmResponse, FarmRequest> {
  private farmService = inject(FarmService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  protected override getId(item: FarmResponse): string {
    return item.slug;
  }


  private columnHelper = createColumnHelper<FarmResponse>();
  columns: ColumnDef<FarmResponse, any>[] = [
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
    this.columnHelper.accessor('originSlug', {
      header: 'Origin',
      enableSorting: true,
    }),
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.name ?? '—',
        {
          id: `name_${lang.code}`,
          header: `Name (${lang.label})`,
          enableSorting: false, // نفس القيد اللي طبقناه على الكاتيجوري لحد ما يتحل server-side
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

  protected override loadPage(): Observable<PageResponse<FarmResponse>> {
    return this.farmService
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
      originSlug: [''],
      translations: this.translationHelper.buildArray([], ['description', 'country']),
    });
  }

  protected override onEditOpen(farm: FarmResponse): void {
    this.form.patchValue({ originSlug: farm.originSlug });
    this.translationHelper.patchArray(this.translationsArray, farm.translations, [
      'description',
      'country',
    ]);
    this.imagePreview.set(farm.imageUrl);
  }

  protected override toRequest(): FarmRequest {
    return {
      originSlug: this.form.value.originSlug,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        country: t.country || undefined,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: FarmRequest, image?: File) {
    return this.farmService.create(req, image, 'multipart');
  }

  protected override callUpdate(slug: string, req: FarmRequest, image?: File) {
    return this.farmService.update(slug, req, image, 'multipart');
  }

  protected override callDelete(slug: string) {
    return this.farmService.delete(slug);
  }

  goToDetail(item: FarmResponse): void {
    this.router.navigate(['/dashboard/farms', item.slug]);
  }

  getTranslationName(item: FarmResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  getTranslationCountry(item: FarmResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.country ?? '—';
  }

}
