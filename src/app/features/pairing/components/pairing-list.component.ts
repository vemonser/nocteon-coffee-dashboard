import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ColumnDef, createColumnHelper } from '@tanstack/angular-table';
import { map, Observable } from 'rxjs';

// Spartan UI
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
  lucideImage,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';

import { PairingService } from '../services/pairing.service';
import { PairingRequest, PairingResponse } from '../models/pairing.model';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-pairing-list',
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
      lucideImage,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './pairing-list.component.html',
})
export class PairingListComponent extends BaseListComponent<PairingResponse, PairingRequest, string> {
  private pairingService = inject(PairingService);
  protected translationHelper = inject(TranslationFormHelper);

  protected override getId(item: PairingResponse): string {
    return item.slug;
  }

  viewMode = signal<ViewMode>('list');

  private columnHelper = createColumnHelper<PairingResponse>();
  columns: ColumnDef<PairingResponse, any>[] = [
    this.columnHelper.accessor((row) => row.imageUrl, {
      id: 'image',
      header: 'Image',
      enableSorting: false,
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
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.description ?? '—',
        {
          id: `desc_${lang.code}`,
          header: `Desc (${lang.label})`,
          enableSorting: false,
        },
      ),
    ),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  protected override loadPage(): Observable<PageResponse<PairingResponse>> {
    return this.pairingService
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

  protected override onEditOpen(item: PairingResponse): void {
    this.translationHelper.patchArray(this.translationsArray, item.translations, ['description']);
    this.imagePreview.set(item.imageUrl);
  }

  protected override toRequest(): PairingRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: PairingRequest, image?: File) {
    return this.pairingService.create(req, image);
  }

  protected override callUpdate(slug: string, req: PairingRequest, image?: File) {
    return this.pairingService.update(slug, req, image);
  }

  protected override callDelete(slug: string) {
    return this.pairingService.delete(slug);
  }

  getTranslationName(item: PairingResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }
}