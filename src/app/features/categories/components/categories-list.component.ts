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
import { AuthService } from '../../../core/auth/auth.service';

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

import { TranslocoPipe } from '@jsverse/transloco';
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
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { ConfirmTypedDialogComponent } from '../../../shared/components/confirm-typed-dialog/confirm-typed-dialog.component';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import { Router } from '@angular/router';


@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    LifecycleTabsComponent,
    ConfirmTypedDialogComponent,
    HlmToaster,
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
    TranslocoPipe,
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
  private auth = inject(AuthService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  /** Opt into the shared soft-delete capability (tabs, counts, undo, restore). */
  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('category:delete');
  protected override statusFilterValue: boolean | undefined = undefined;

  readonly isActiveFilterString = computed(() => {
    if (this.statusFilterValue === undefined) return 'all';
    return this.statusFilterValue ? 'enabled' : 'disabled';
  });

  /** The trash endpoints require 'category:delete' — hide the tab without it. */
  readonly isTrashAllowed = computed(() => this.auth.hasPermission('category:delete'));

  onStatusFilterValueChange(value: string | null | undefined): void {
    this.statusFilterValue = value === 'enabled' ? true : value === 'disabled' ? false : undefined;
    this.currentPage.set(0);
    this.writeUrlState();
    this.load();
  }

  itemToString = (value: string) => {
    const labels: Record<string, string> = { all: 'All Status', enabled: 'Active', disabled: 'Inactive' };
    return labels[value] ?? value;
  };

  protected override getId(item: CategoryResponse): string {
    return item.slug;
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────

  protected override loadTrashPage(): Observable<PageResponse<CategoryResponse>> {
    return this.categoryService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
  }

  private trashParams() {
    return {
      page: this.currentPage(),
      search: this.searchQuery || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
    };
  }

  protected override callRestore(id: number) {
    return this.categoryService.restore(id);
  }

  protected override restoreIdOf(item: CategoryResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  /** DataTable selection is keyed on the backend id (what restore takes). */
  readonly rowIdOf = (row: CategoryResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  protected override confirmTokenOf(item: CategoryResponse): string {
    return item.slug;
  }

  protected override undoItemLabel(item: CategoryResponse): string {
    return this.getTranslationName(item, 'en');
  }

  // ─── Copy ────────────────────────────────────────────────────────────────────

  protected override undoLabel(): string {
    return 'common.undo';
  }
  protected override undoMessage(): string {
    return 'categories.trash.movedToTrash';
  }
  protected override restoreConflictTitle(): string {
    return 'categories.trash.restoreConflictTitle';
  }
  protected override restoreConflictBody(): string {
    return 'categories.trash.restoreConflictBody';
  }
  protected override restoreNotFoundBody(): string {
    return 'categories.trash.restoreNotFound';
  }
  protected override restoreForbiddenBody(): string {
    return 'categories.trash.restoreForbidden';
  }
  protected override restoreFailedBody(): string {
    return 'categories.trash.restoreFailed';
  }
  protected override permanentDeleteUnsupportedTitle(): string {
    return 'common.permanentDeleteUnavailable';
  }
  protected override permanentDeleteUnsupportedBody(): string {
    return 'common.permanentDeleteUnsupported';
  }

  // View mode toggle

  // Columns for list view
  private columnHelper = createColumnHelper<CategoryResponse>();

  /**
   * Columns that exist on both tabs. Explicitly composed rather than filtered:
   * TanStack's generated column ids made a filter-by-id unreliable.
   */
  private sharedColumns: ColumnDef<CategoryResponse, any>[] = [
    this.columnHelper.accessor('id', {
      header: 'ID',
      enableSorting: true,
      meta: { width: '72px' },
    }),
    this.columnHelper.accessor((row) => row.imageUrl, {
      id: 'image',
      header: 'Image',
      enableSorting: false,
      meta: { width: '72px' },
    }),
    this.columnHelper.accessor('slug', {
      header: 'Slug',
      enableSorting: true,
      meta: { width: '160px' },
    }),
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.name ?? '—',
        {
          id: `name_${lang.code}`,
          header: `Name (${lang.label})`,
          enableSorting: false,
          meta: { width: '160px' },
        },
      ),
    ),
  ];

  /** Active tail: status (enabled/disabled) + when it was created. */
  private activeTail: ColumnDef<CategoryResponse, any>[] = [
    this.columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => info.getValue(),
      meta: { width: '112px' },
    }),
    this.columnHelper.accessor('createdAt', {
      header: 'Created At',
      cell: (info) => info.getValue(),
      meta: { width: '132px' },
    }),
  ];

  /**
   * Trash tail: lifecycle replaces status and created-at — Deleted (relative) and
   * Deleted At. Neither active-tab column survives the switch.
   */
  private trashTail: ColumnDef<CategoryResponse, any>[] = [
    this.columnHelper.accessor('deletedAt', {
      id: 'deleted',
      header: 'Deleted',
      enableSorting: false,
      cell: (info) => info.row.original.deletedAt,
      meta: { width: '148px' },
    }),
    this.columnHelper.accessor('deletedAt', {
      header: 'Deleted At',
      enableSorting: false,
      meta: { width: '132px' },
    }),
  ];

  /** Actions cell — edit/delete on active, restore/permanent on trash. */
  private actionsColumn: ColumnDef<CategoryResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
    meta: { width: '104px' },
  });

  /** Lifecycle and status are separate concepts: the tab picks the tail. */
  readonly columns = computed<ColumnDef<CategoryResponse, any>[]>(() =>
    this.listView() === 'trash'
      ? [...this.sharedColumns, ...this.trashTail, this.actionsColumn]
      : [...this.sharedColumns, ...this.activeTail, this.actionsColumn],
  );

  // Computed


  // ─── Base contract ─────────────────────────────────────────────────────────

  /**
   * ACTIVE rows only. The base picks the endpoint by tab and calls
   * `loadTrashPage()` for trash, so branching here as well would make this method
   * useless as the source for the other tab's count.
   */
  protected override loadPage(): Observable<PageResponse<CategoryResponse>> {
    return this.categoryService
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
        isActive: this.statusFilterValue,
      })
      .pipe(map((res) => res.data));
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
    // Trashed rows are hidden from the backend detail queries — stay on the list.
    if (this.listView() === 'trash') return;
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

}
