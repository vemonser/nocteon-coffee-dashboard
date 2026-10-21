import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { AuthService } from '../../../core/auth/auth.service';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { BrewingMethodRequest, DashboardBrewingMethodResponse } from '../models/brewing-method.model';
import { BrewingMethodService } from '../services/brewing-method.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { LanguageService } from '../../../core/i18n/language.service';
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
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';

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
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';


@Component({
  selector: 'app-brewing-methods-list',
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
    HlmTextareaImports,
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
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './brewing-methods-list.component.html',
})
export class BrewingMethodsListComponent extends BaseListComponent<DashboardBrewingMethodResponse, BrewingMethodRequest> {
  private brewingMethodService = inject(BrewingMethodService);
  protected readonly language = inject(LanguageService);
  protected translationHelper = inject(TranslationFormHelper);
  private auth = inject(AuthService);

  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('brewing_method:delete');
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('brewing_method:delete'));

  protected override getId(item: DashboardBrewingMethodResponse): string {
    return item.slug;
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────

  protected override loadTrashPage(): Observable<PageResponse<DashboardBrewingMethodResponse>> {
    return this.brewingMethodService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
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
    return this.brewingMethodService.restore(id);
  }

  protected override restoreIdOf(item: DashboardBrewingMethodResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  protected override permanentDeleteSrv() {
    return this.brewingMethodService;
  }

  readonly rowIdOf = (row: DashboardBrewingMethodResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  rowName(item: DashboardBrewingMethodResponse): string {
    return this.getTranslationName(item, this.language.language());
  }

  protected override undoItemLabel(item: DashboardBrewingMethodResponse): string {
    return this.getTranslationName(item, 'en');
  }

  protected override deleteToastKey(): string {
    return 'brewingMethods.trash.movedToTrash';
  }

  protected override undoLabel(): string {
    return 'common.undo';
  }
  protected override undoMessage(): string {
    return 'brewingMethods.trash.movedToTrash';
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
    return this.isTrash() ? 'brewingMethods.trash.noResultsInTrash' : 'brewingMethods.trash.noResultsInActive';
  }

  getTranslationName(item: DashboardBrewingMethodResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  readonly showId = signal(false);
  readonly showDates = signal(true);
  readonly columnsOpen = signal(false);

  toggleShowId(value: boolean): void {
    this.showId.set(value);
  }

  toggleShowDates(value: boolean): void {
    this.showDates.set(value);
  }

  private columnHelper = createColumnHelper<DashboardBrewingMethodResponse>();

  readonly columns = computed<ColumnDef<DashboardBrewingMethodResponse, any>[]>(() => {
    const currentLang = this.language.current();
    const otherLang = SUPPORTED_LANGUAGES.find((l) => l.code !== currentLang)!;

    const mainCell = this.columnHelper.accessor(
      (row): { name: string; slug: string; imageUrl: string | null; otherName: string; hideThumbnail?: boolean } => {
        const current = row.translations.find((t) => t.language === currentLang)?.name ?? '—';
        const other = row.translations.find((t) => t.language === otherLang.code)?.name ?? '—';
        return {
          name: current,
          slug: row.slug,
          imageUrl: null,
          otherName: other,
          hideThumbnail: true,
        };
      },
      {
        id: `main_${currentLang}`,
        header: currentLang === 'en' ? 'Brewing Method' : 'طريقة التحضير',
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

  private actionsColumn: ColumnDef<DashboardBrewingMethodResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
  });

  protected override loadPage(): Observable<PageResponse<DashboardBrewingMethodResponse>> {
    return this.brewingMethodService
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
      isActive: [true],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(variety: DashboardBrewingMethodResponse): void {
    this.translationHelper.patchArray(this.translationsArray, variety.translations, ['description']);
  }

  protected override toRequest(): BrewingMethodRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: BrewingMethodRequest) {
    return this.brewingMethodService.create(req);
  }

  protected override callUpdate(slug: string, req: BrewingMethodRequest) {
    return this.brewingMethodService.update(slug, req);
  }

  protected override callDelete(slug: string) {
    return this.brewingMethodService.delete(slug);
  }
}
