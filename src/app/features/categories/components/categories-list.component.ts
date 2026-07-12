import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { CategoryRequest, CategoryResponse } from '../models/category.model';
import { CategoryService } from '../services/category.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';

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

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-categories-list',
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
  templateUrl: './categories-list.component.html',
})
export class CategoriesListComponent extends BaseListComponent<CategoryResponse, CategoryRequest> {
  private categoryService = inject(CategoryService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);
readonly isActiveFilterString = computed(() => {
  if (this.isActiveFilter === undefined) return 'all';
  return this.isActiveFilter ? 'active' : 'inactive';
});

onStatusFilterValueChange(value: string | null | undefined): void {
  this.isActiveFilter = value === 'active' ? true : value === 'inactive' ? false : undefined;
  this.currentPage.set(0);
  this.load();
}
itemToString = (value: string) => {
  const labels: Record<string, string> = { all: 'All Status', active: 'Active', inactive: 'Inactive' };
  return labels[value] ?? value;
};

  protected override getId(item: CategoryResponse): string {
    return item.slug;
  }

  // View mode toggle
  viewMode = signal<ViewMode>('list');

  // Category-specific filter
  isActiveFilter: boolean | undefined = undefined;

  // Columns for list view
  private columnHelper = createColumnHelper<CategoryResponse>();
  columns: ColumnDef<CategoryResponse, any>[] = [
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
    this.columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => info.getValue(),
    }),
    this.columnHelper.accessor('createdAt', {
      header: 'Created At',
      cell: (info) => info.getValue(),
    }),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  // Computed
  readonly activeCount = computed(() => this.items().filter((i) => i.isActive).length);

  readonly inactiveCount = computed(() => this.items().filter((i) => !i.isActive).length);

  // ─── Base contract ─────────────────────────────────────────────────────────

  protected override loadPage(): Observable<PageResponse<CategoryResponse>> {

    return this.categoryService
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        isActive: this.isActiveFilter,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => {console.log(res.data); return res.data}));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      isActive: [true],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(category: CategoryResponse): void {
    this.form.patchValue({ isActive: category.isActive });
    this.translationHelper.patchArray(this.translationsArray, category.translations, [
      'description',
    ]);
    this.imagePreview.set(category.imageUrl);
  }

  protected override toRequest(): CategoryRequest {
    return {
      isActive: this.form.value.isActive ?? true,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: CategoryRequest, image?: File) {
    return this.categoryService.create(req, image, 'multipart');
  }

  protected override callUpdate(slug: string, req: CategoryRequest, image?: File) {
    return this.categoryService.update(slug, req, image, 'multipart');
  }

  protected override callDelete(slug: string) {
    return this.categoryService.delete(slug);
  }

  goToDetail(item: CategoryResponse): void {
    this.router.navigate(['/dashboard/categories', item.slug]);
  }
  // ─── UI helpers ────────────────────────────────────────────────────────────

  getTranslationName(item: CategoryResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  getTranslationDesc(item: CategoryResponse, langCode: string): string {
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
