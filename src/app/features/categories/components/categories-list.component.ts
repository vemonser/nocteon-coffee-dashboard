import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { CategoryRequest, CategoryResponse } from '../models/category.model';
import { CategoryService } from '../services/category.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/auth/auth.service';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { LanguageService } from '../../../core/i18n/language.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucideList,
  lucidePencil,
  lucideTrash2,
  lucideX,
  lucideCheck,
  lucideImage,
  lucideChevronLeft,
  lucideChevronRight,
  lucideColumns,
  lucideInbox,
  lucideLoader2,
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';
import { CategoryFormComponent } from './category-form/category-form.component';
import { Router } from '@angular/router';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';


@Component({
  selector: 'app-categories-list',
  standalone: true,
  host: {
    '(document:keydown.escape)': 'onEscapeKey()',
  },
  imports: [
    PagerComponent,
    CommonModule,
    ImageUploadComponent,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    ClickOutsideDirective,
    LifecycleTabsComponent,
    TrashBannerComponent,
    CategoryFormComponent,
    // Spartan
    HlmCardImports,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    HlmSelectImports,
    HlmSwitchImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideSearch,
      lucideList,
      lucidePencil,
      lucideTrash2,
      lucideX,
      lucideCheck,
      lucideImage,
      lucideChevronLeft,
      lucideChevronRight,
      lucideColumns,
      lucideInbox,
      lucideLoader2,
    }),
  ],
  templateUrl: './categories-list.component.html',
})
export class CategoriesListComponent extends BaseListComponent<CategoryResponse, CategoryRequest> {
  /** Escape closes whichever confirm dialog asked for it (dialog parity). */
  onEscapeKey(): void {
    if (this.bulkConfirm()) return this.cancelBulkConfirm();
    if (this.permanentDeleteTarget() && !this.permanentDeletePending()) {
      return this.closePermanentDelete();
    }
    if (this.deleting() && !this.submitting()) this.deleting.set(null);
  }

  private categoryService = inject(CategoryService);
  private auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly trx = inject(TranslocoService);
  private readonly statusLabel = {
    all: toSignal(this.trx.selectTranslate('categories.trash.statusAll'), { initialValue: 'All' }),
    enabled: toSignal(this.trx.selectTranslate('categories.trash.statusEnabled'), {
      initialValue: 'Active',
    }),
    disabled: toSignal(this.trx.selectTranslate('categories.trash.statusDisabled'), {
      initialValue: 'Inactive',
    }),
  };

  /**
   * Columns menu (§8): secondary columns toggle on wide screens. Narrow
   * screens hide them via CSS regardless — the detail page holds the dates.
   */
  readonly showId = signal(false);
  readonly showDates = signal(true);
  readonly columnsOpen = signal(false);

  toggleShowId(value: boolean): void {
    this.showId.set(value);
  }

  toggleShowDates(value: boolean): void {
    this.showDates.set(value);
  }

  noResultsKey(): string {
    return this.isTrash() ? 'categories.trash.noResultsInTrash' : 'categories.trash.noResultsInActive';
  }
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  /** Opt into the shared soft-delete capability (tabs, counts, undo, restore). */
  protected override softDeleteEnabled = true;

  /**
   * Categories edit on their detail page, not in a dialog: the row's name and
   * its edit action are real anchors to `/categories/:slug`.
   */
  protected override editMode: 'dialog' | 'page' = 'page';

  /**
   * RouterLink command for a row's detail page — the destination for the
   * name/slug anchors and the edit action. Returns null for trashed rows
   * (their detail page is unreachable), which `hrefFor` turns into "inert".
   */
  rowHref(row: CategoryResponse): any[] | null {
    return this.listView() === 'trash' ? null : ['/dashboard/categories', row.slug];
  }
  protected override canManageTrash = this.auth.hasPermission('category:delete');
  protected override createPermission = 'category:create';
  protected override updatePermission = 'category:update';
  protected override deletePermission = 'category:delete';
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
    switch (value) {
      case 'enabled':
        return this.statusLabel.enabled();
      case 'disabled':
        return this.statusLabel.disabled();
      default:
        return this.statusLabel.all();
    }
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
      size: this.pageSize(),
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

  /** Backend: DELETE /dashboard/categories/{id}/permanent → 204 (hard delete). */
  protected override permanentDeleteSrv() {
    return this.categoryService;
  }

  /** DataTable selection is keyed on the backend id (what restore takes). */
  readonly rowIdOf = (row: CategoryResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  /** Current-UI-language name for dialog copy ("Move "X" to the trash?"). */
  rowName(item: CategoryResponse): string {
    return this.getTranslationName(item, this.language.language());
  }

  protected override undoItemLabel(item: CategoryResponse): string {
    return this.getTranslationName(item, 'en');
  }

  /** Deleting a category means moving it to the trash — the toast says that. */
  protected override deleteToastKey(): string {
    return 'categories.trash.movedToTrash';
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

  // Columns for list view
  private columnHelper = createColumnHelper<CategoryResponse>();

  /**
   * Main-cell accessor: thumbnail + name (current UI language) + slug below.
   * The other language's name stays in its own column.
   */
  private makeMainCell(langCode: string): ColumnDef<CategoryResponse, any> {
    const otherLang = SUPPORTED_LANGUAGES.find((l) => l.code !== langCode)!;
    return this.columnHelper.accessor(
      (row): { name: string; slug: string; imageUrl: string | null; otherName: string } => {
        const current = row.translations.find((t) => t.language === langCode)?.name ?? '—';
        const other = row.translations.find((t) => t.language === otherLang.code)?.name ?? '—';
        return {
          name: current,
          slug: row.slug,
          imageUrl: row.imageUrl,
          otherName: other,
        };
      },
      {
        id: `main_${langCode}`,
        header: langCode === 'en' ? 'Category' : 'فئة',
        enableSorting: true,
        // The entity column keeps the O1 proportional share (30% of the row in
        // `table-fixed`). It does not absorb leftover — the other-language
        // name column (`name_${otherLang}`) is the table's ONE flex column
        // and takes whatever remains, so Actions never stretches. See
        // data-table.component.ts `columnWidths`.
        meta: { width: '30%' },
      }
    );
  }

  private sharedColumns: ColumnDef<CategoryResponse, any>[] = [
    // Main cell for current UI language (thumbnail + name + slug)
    // The column is dynamic based on current language
  ];

  /**
   * Active tail: status (enabled/disabled) + when it was created.
   */
  private activeTail: ColumnDef<CategoryResponse, any>[] = [
    this.columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => info.getValue(),
      meta: { width: '96px' },
    }),
    this.columnHelper.accessor('createdAt', {
      header: 'Created At',
      cell: (info) => info.getValue(),
      // 120px, not 104px: the header label + its sort arrow need ~82px inside
      // px-4 padding, so at 104px "Created at" rendered as "Created... ↓".
      meta: { width: '120px' },
    }),
  ];

  /**
   * Trash tail: lifecycle replaces status and created-at. ONE column, labeled
   * "Deleted" (design.md §4): the relative time as plain text, sorted by the
   * real `deletedAt` timestamp rather than by the rendered text. There is no
   * second absolute-date column — the tooltip is the absolute date.
   */
  private trashTail: ColumnDef<CategoryResponse, any>[] = [
    this.columnHelper.accessor('deletedAt', {
      id: 'deleted',
      header: 'Deleted',
      enableSorting: true,
      cell: (info) => info.row.original.deletedAt,
      meta: { width: '132px' },
    }),
  ];

  /** Actions cell — edit/delete on active, restore/permanent on trash. */
  private actionsColumn: ColumnDef<CategoryResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
    // No meta width here: the shared DataTable resolves the actions budget —
    // 116px for icon rows, 264px in trash where rows carry text labels that
    // would otherwise overflow the column and force a horizontal scroll.
  });

  /**
   * Columns are now computed dynamically based on current language.
   * Main cell for current language, separate column for other language.
   * ID column hidden by default (showId signal), available in Columns menu.
   */
  readonly columns = computed<ColumnDef<CategoryResponse, any>[]>(() => {
    const currentLang = this.language.current();
    const mainCell = this.makeMainCell(currentLang);

    const shared = this.showId()
      ? [
          this.columnHelper.accessor('id', {
            header: 'ID',
            enableSorting: true,
            meta: { width: '48px' },
          }),
          mainCell,
        ]
      : [mainCell];

    // Other language name column (always shown)
    const otherLang = SUPPORTED_LANGUAGES.find((l) => l.code !== currentLang)!;
    // Header names the language the column holds, expressed in the UI language
    // it is rendered in — 'Arabic name' (EN UI) / 'الاسم بالإنجليزية' (AR UI)
    // over English cells, 'Arabic name' (EN UI) / 'الاسم بالعربية' (AR UI) over
    // Arabic cells. Keeps headers single-script and semantically honest.
    const otherNameHeaders: Record<string, Record<string, string>> = {
      en: { en: 'English name', ar: 'الاسم بالإنجليزية' },
      ar: { en: 'Arabic name', ar: 'الاسم بالعربية' },
    };
    const otherNameColumn = this.columnHelper.accessor(
      (row): string => row.translations.find((t) => t.language === otherLang.code)?.name ?? '—',
      {
        id: `name_${otherLang.code}`,
        header: otherNameHeaders[otherLang.code][currentLang],
        enableSorting: false,
        // The table's ONE flex column. `auto` OVERRIDES the shared map — the
        // map pins `name_ar: '28%'`, but in EN-UI the other-language column's
        // id IS `name_ar`, so without this override EN tables would have NO
        // flex column and Chrome would smear the leftover across the metadata
        // columns (Actions 116→182px et al). This column absorbs the leftover
        // instead; Actions keeps its exact budget at any viewport.
        meta: { width: 'auto' },
      }
    );

    if (this.listView() === 'trash') {
      const tail = this.showDates() ? this.trashTail : [];
      return [...shared, otherNameColumn, ...tail, this.actionsColumn];
    }
    const tail = this.showDates() ? this.activeTail : [this.activeTail[0]];
    return [...shared, otherNameColumn, ...tail, this.actionsColumn];
  });

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
        size: this.pageSize(),
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

  override goToDetail(item: CategoryResponse): void {
    // Trashed rows cannot open a detail page: `Category` extends
    // `SoftDeletableEntity` (`@SQLRestriction("deleted_at IS NULL")`), so every
    // detail query filters them out, and there is no single-trashed-entity
    // endpoint to fall back on. Routing anyway would land on a 404, so the slug
    // stays inert in that tab (see the `navigableColumn` note in the template).
    if (this.listView() === 'trash') return;
    this.router.navigate(['/dashboard/categories', item.slug]);
  }

  /** The create dialog lands the new category on its detail page (the edit surface). */
  protected override afterCreate(item: CategoryResponse): void {
    this.listRouter.navigate(['/dashboard/categories', item.slug]);
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

  /** Empty-state escape hatch: clear the term and reload the current tab. */
  protected override clearSearch(): void {
    this.searchQuery = '';
    this.onSearch();
  }
}
