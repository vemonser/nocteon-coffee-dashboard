import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
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

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';

import { FarmService } from '../services/farm.service';
import { OriginService } from '../../origins/services/origin.service';
import { FarmRequest, FarmResponse } from '../models/farm.model';
import { OriginResponse } from '../../origins/models/origin.model';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-farms-list',
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
  templateUrl: './farms-list.component.html',
})
export class FarmsListComponent extends BaseListComponent<FarmResponse, FarmRequest, string> {
  private farmService = inject(FarmService);
  private originService = inject(OriginService);
  protected translationHelper = inject(TranslationFormHelper);

  protected override getId(item: FarmResponse): string {
    return item.slug;
  }

  // View mode toggle
  viewMode = signal<ViewMode>('list');

  // Farm-specific state
  origins = signal<OriginResponse[]>([]);
  originSlugFilter = '';

  // Columns
  private columnHelper = createColumnHelper<FarmResponse>();
  columns: ColumnDef<FarmResponse, any>[] = [
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
      enableSorting: false,
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
        (row): string => row.translations.find((t) => t.language === lang.code)?.country ?? '—',
        {
          id: `country_${lang.code}`,
          header: `Country (${lang.label})`,
          enableSorting: false,
        },
      ),
    ),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadOrigins();
  }

  loadOrigins(): void {
    this.originService.getAllOptions().subscribe({
      next: (res) => this.origins.set(res.data.content),
    });
  }

  // ─── Filters ───────────────────────────────────────────────────────────────

  onOriginFilterChange(): void {
    this.currentPage.set(0);
    this.load();
  }

  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  // Helper
  getOriginName(slug: string): string {
    const o = this.origins().find((o) => o.slug === slug);
    return o?.translations.find((t) => t.language === 'en')?.name ?? slug;
  }

  // ─── Base contract ─────────────────────────────────────────────────────────

  protected override loadPage(): Observable<PageResponse<FarmResponse>> {
    return this.farmService
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        originSlug: this.originSlugFilter || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      originSlug: ['', Validators.required],
      translations: this.translationHelper.buildArray([], ['country', 'description']),
    });
  }

  protected override onEditOpen(farm: FarmResponse): void {
    this.form.patchValue({ originSlug: farm.originSlug });
    this.translationHelper.patchArray(this.translationsArray, farm.translations, [
      'country',
      'description',
    ]);
    this.imagePreview.set(farm.imageUrl);
  }

  protected override toRequest(): FarmRequest {
    return {
      originSlug: this.form.value.originSlug!,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        country: t.country || undefined,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: FarmRequest, image?: File) {
    return this.farmService.create(req, image);
  }

  protected override callUpdate(slug: string, req: FarmRequest, image?: File) {
    return this.farmService.update(slug, req, image);
  }

  protected override callDelete(slug: string) {
    return this.farmService.delete(slug);
  }

  getTranslationName(item: FarmResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  getTranslationCountry(item: FarmResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.country ?? '—';
  }
}