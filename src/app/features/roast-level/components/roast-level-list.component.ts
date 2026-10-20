import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ColumnDef, createColumnHelper } from '@tanstack/angular-table';
import { map, Observable } from 'rxjs';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';

import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucideList,
  lucidePencil,
  lucideTrash2,
  lucideX,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';
import { AuthService } from '../../../core/auth/auth.service';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { LanguageService } from '../../../core/i18n/language.service';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';

import { RoastLevelRequest, RoastLevelResponse } from '../models/roast-level.model';
import { RoastLevelService } from '../services/roast-level.service';

@Component({
  selector: 'app-roast-level-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    PagerComponent,
    LifecycleTabsComponent,
    TrashBannerComponent,
    // Spartan
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmDialogImports,
    HlmTableImports,
    HlmLabelImports,
    HlmTextareaImports,
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
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './roast-level-list.component.html',
})
export class RoastLevelListComponent extends BaseListComponent<
  RoastLevelResponse,
  RoastLevelRequest,
  string
> {
  private roastLevelService = inject(RoastLevelService);
  protected readonly language = inject(LanguageService);
  protected translationHelper = inject(TranslationFormHelper);
  private auth = inject(AuthService);

  readonly showId = signal(false);
  readonly showDates = signal(true);
  readonly columnsOpen = signal(false);

  toggleShowId(value: boolean): void {
    this.showId.set(value);
  }

  toggleShowDates(value: boolean): void {
    this.showDates.set(value);
  }

  /** Opt into the shared soft-delete capability (tabs, counts, undo, restore). */
  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('roast_level:delete');
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('roast_level:delete'));

  protected override getId(item: RoastLevelResponse): string {
    return item.slug;
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────

  protected override loadTrashPage(): Observable<PageResponse<RoastLevelResponse>> {
    return this.roastLevelService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
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
    return this.roastLevelService.restore(id);
  }

  protected override restoreIdOf(item: RoastLevelResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  /** Backend: DELETE /dashboard/roast-levels/{id}/permanent → 204 (hard delete). */
  protected override permanentDeleteSrv() {
    return this.roastLevelService;
  }

  /** DataTable selection is keyed on the backend id (what restore takes). */
  readonly rowIdOf = (row: RoastLevelResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  /** Current-UI-language name for dialog copy. */
  rowName(item: RoastLevelResponse): string {
    return this.getTranslationName(item, this.language.language());
  }

  protected override undoItemLabel(item: RoastLevelResponse): string {
    return this.getTranslationName(item, 'en');
  }

  /** Deleting a roast level means moving it to the trash — the toast says that. */
  protected override deleteToastKey(): string {
    return 'roastLevels.trash.movedToTrash';
  }

  // ─── Copy ────────────────────────────────────────────────────────────────────

  protected override undoLabel(): string {
    return 'common.undo';
  }
  protected override undoMessage(): string {
    return 'roastLevels.trash.movedToTrash';
  }
  protected override restoreConflictTitle(): string {
    return 'common.restoreConflictTitle';
  }
  protected override restoreConflictBody(): string {
    return 'common.restoreConflictBody';
  }
  protected override restoreNotFoundBody(): string {
    return 'common.restoreNotFound';
  }
  protected override restoreForbiddenBody(): string {
    return 'common.restoreForbidden';
  }
  protected override restoreFailedBody(): string {
    return 'common.restoreFailed';
  }
  protected override permanentDeleteUnsupportedTitle(): string {
    return 'common.permanentDeleteUnavailable';
  }
  protected override permanentDeleteUnsupportedBody(): string {
    return 'common.permanentDeleteUnsupported';
  }

  noResultsKey(): string {
    return this.isTrash() ? 'roastLevels.trash.noResultsInTrash' : 'roastLevels.trash.noResultsInActive';
  }

  getTranslationName(item: RoastLevelResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  /** The trash endpoints require 'roast_level:delete' — hide the tab without it. */

  // ─── Columns ──────────────────────────────────────────────────────────────
  private columnHelper = createColumnHelper<RoastLevelResponse>();

  readonly columns = computed<ColumnDef<RoastLevelResponse, any>[]>(() => {
    const currentLang = this.language.current();
    const otherLang = SUPPORTED_LANGUAGES.find((l) => l.code !== currentLang)!;

    const mainCell = this.columnHelper.accessor(
      (row): { name: string; slug: string; imageUrl: string | null; otherName: string; color?: string | null } => {
        const current = row.translations.find((t) => t.language === currentLang)?.name ?? '—';
        const other = row.translations.find((t) => t.language === otherLang.code)?.name ?? '—';
        return {
          name: current,
          slug: row.slug,
          imageUrl: null,
          otherName: other,
          color: row.color,
        };
      },
      {
        id: `main_${currentLang}`,
        header: currentLang === 'en' ? 'Roast Level' : 'درجة التحميص',
        enableSorting: true,
        meta: { width: '30%' },
      }
    );

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
        meta: { width: 'auto' },
      }
    );

    const trashTail = [
      this.columnHelper.accessor('deletedAt', {
        id: 'deleted',
        header: 'Deleted',
        enableSorting: true,
        cell: (info) => info.row.original.deletedAt,
        meta: { width: '132px' },
      }),
    ];
    const activeTail = this.showDates()
      ? [
          this.columnHelper.accessor('createdAt', {
            header: 'Created At',
            enableSorting: true,
            meta: { width: '120px' },
          }),
        ]
      : [];

    const tail = this.isTrash() ? (this.showDates() ? trashTail : []) : activeTail;

    return [
      mainCell,
      otherNameColumn,
      ...tail,
      this.actionsColumn,
    ];
  });

  private actionsColumn: ColumnDef<RoastLevelResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
  });

  // ─── Base contract ────────────────────────────────────────────────────────

  protected override loadPage(): Observable<PageResponse<RoastLevelResponse>> {
    return this.roastLevelService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      color: ['#8B4513', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(item: RoastLevelResponse): void {
    this.form.patchValue({ color: item.color });
    this.translationHelper.patchArray(this.translationsArray, item.translations, ['description']);
  }

  protected override toRequest(): RoastLevelRequest {
    return {
      color: this.form.value.color,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: RoastLevelRequest) {
    return this.roastLevelService.create(req);
  }

  protected override callUpdate(slug: string, req: RoastLevelRequest) {
    return this.roastLevelService.update(slug, req);
  }

  protected override callDelete(slug: string) {
    return this.roastLevelService.delete(slug);
  }
}