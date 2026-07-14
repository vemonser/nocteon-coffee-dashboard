import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ColumnDef, createColumnHelper } from '@tanstack/angular-table';
import { map, Observable } from 'rxjs';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmToggleImports } from '@spartan-ng/helm/toggle';

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
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { Router } from '@angular/router';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { PairingRequest, PairingResponse } from '../models/pairing.model';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { PairingService } from '../services/pairing.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-pairings-list',
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
    HlmSelectImports,
    HlmDialogImports,
    HlmTableImports,
    HlmAvatarImports,
    HlmSkeletonImports,
    HlmToggleImports,
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
    }),
  ],
  templateUrl: './pairing-list.component.html',
})
export class PairingListComponent extends BaseListComponent<PairingResponse, PairingRequest> {
  private pairingService = inject(PairingService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  protected override getId(item: PairingResponse): string {
    return item.slug;
  }

  // View mode toggle
  viewMode = signal<ViewMode>('list');


  
  // Columns for list view
  private columnHelper = createColumnHelper<PairingResponse>();
  columns: ColumnDef<PairingResponse, any>[] = [
    this.columnHelper.accessor('id', {
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
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.name ?? '—',
        {
          id: `name_${lang.code}`, // يفضل زي ما هو كـ column id بس للعرض
          header: `Name (${lang.label})`,
          enableSorting: false,
        },
      ),
    ),
    this.columnHelper.accessor('createdAt', {
      header: 'Created At',
      cell: (info) => info.getValue(),
    }),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  // ─── Base contract ─────────────────────────────────────────────────────────

  protected override loadPage(): Observable<PageResponse<PairingResponse>> {
    return this.pairingService
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(
        map((res) => {
          console.log(res.data);
          return res.data;
        }),
      );
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      isActive: [true],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(pairing: PairingResponse): void {
    this.translationHelper.patchArray(this.translationsArray, pairing.translations, [
      'description',
    ]);
    this.imagePreview.set(pairing.imageUrl);
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
    return this.pairingService.create(req, image, 'multipart');
  }

  protected override callUpdate(slug: string, req: PairingRequest, image?: File) {
    return this.pairingService.update(slug, req, image, 'multipart');
  }

  protected override callDelete(slug: string) {
    return this.pairingService.delete(slug);
  }

  goToDetail(item: PairingResponse): void {
    this.router.navigate(['/dashboard/pairings', item.slug]);
  }
  // ─── UI helpers ────────────────────────────────────────────────────────────

  getTranslationName(item: PairingResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  getTranslationDesc(item: PairingResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.description ?? '';
  }

  onStatusFilterChange(): void {
    this.currentPage.set(0);
    this.load();
  }

  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }
}
