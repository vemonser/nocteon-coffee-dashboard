import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { AuthService } from '../../../core/auth/auth.service';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { ProcessingMethodRequest, ProcessingMethodResponse } from '../models/processing-method.model';
import { ProcessingMethodService } from '../services/processing-method.service';
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
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';


@Component({
  selector: 'app-processing-method-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    ClickOutsideDirective,
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
  templateUrl: './processing-method-list.component.html',
})
export class ProcessingMethodListComponent extends BaseListComponent<ProcessingMethodResponse, ProcessingMethodRequest> {
  private processingMethodService = inject(ProcessingMethodService);
  protected readonly language = inject(LanguageService);
  protected translationHelper = inject(TranslationFormHelper);
  private auth = inject(AuthService);

  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('processing_method:delete');
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('processing_method:delete'));

  protected override getId(item: ProcessingMethodResponse): string {
    return item.slug;
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────

  protected override loadTrashPage(): Observable<PageResponse<ProcessingMethodResponse>> {
    return this.processingMethodService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
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
    return this.processingMethodService.restore(id);
  }

  protected override restoreIdOf(item: ProcessingMethodResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  protected override permanentDeleteSrv() {
    return this.processingMethodService;
  }

  readonly rowIdOf = (row: ProcessingMethodResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  rowName(item: ProcessingMethodResponse): string {
    return this.getTranslationName(item, this.language.language());
  }

  protected override undoItemLabel(item: ProcessingMethodResponse): string {
    return this.getTranslationName(item, 'en');
  }

  protected override deleteToastKey(): string {
    return 'processingMethods.trash.movedToTrash';
  }

  protected override undoLabel(): string {
    return 'common.undo';
  }
  protected override undoMessage(): string {
    return 'processingMethods.trash.movedToTrash';
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
    return this.isTrash() ? 'processingMethods.trash.noResultsInTrash' : 'processingMethods.trash.noResultsInActive';
  }

  getTranslationName(item: ProcessingMethodResponse, langCode: string): string {
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

  private columnHelper = createColumnHelper<ProcessingMethodResponse>();

  readonly columns = computed<ColumnDef<ProcessingMethodResponse, any>[]>(() => {
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
        header: currentLang === 'en' ? 'Processing Method' : 'طريقة المعالجة',
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

  private actionsColumn: ColumnDef<ProcessingMethodResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
  });

  protected override loadPage(): Observable<PageResponse<ProcessingMethodResponse>> {
    return this.processingMethodService
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

  protected override onEditOpen(variety: ProcessingMethodResponse): void {
    this.translationHelper.patchArray(this.translationsArray, variety.translations, ['description']);
  }

  protected override toRequest(): ProcessingMethodRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: ProcessingMethodRequest) {
    return this.processingMethodService.create(req);
  }

  protected override callUpdate(slug: string, req: ProcessingMethodRequest) {
    return this.processingMethodService.update(slug, req);
  }

  protected override callDelete(slug: string) {
    return this.processingMethodService.delete(slug);
  }
}
