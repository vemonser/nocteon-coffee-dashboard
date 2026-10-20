import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { PairingRequest, PairingResponse } from '../models/pairing.model';
import { PairingService } from '../services/pairing.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { LanguageService } from '../../../core/i18n/language.service';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/auth/auth.service';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';

import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideSearch, lucideList, lucidePencil, lucideTrash2, lucideX, lucideCheck, lucideImage, lucideLoader2, lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';

@Component({
  selector: 'app-pairings-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    LifecycleTabsComponent,
    TrashBannerComponent,
    ImageUploadComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmLabelImports,
    HlmTextareaImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucidePlus, lucideSearch, lucideList, lucidePencil, lucideTrash2, lucideX, lucideCheck, lucideImage, lucideChevronLeft, lucideChevronRight }),
  ],
  templateUrl: './pairing-list.component.html',
})
export class PairingListComponent extends BaseListComponent<PairingResponse, PairingRequest> {
  private pairingService = inject(PairingService);
  private auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  protected translationHelper = inject(TranslationFormHelper);

  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('pairing:delete');
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('pairing:delete'));

  protected override getId(item: PairingResponse): string {
    return item.slug;
  }

  readonly showId = signal(false);
  readonly showDates = signal(true);
  readonly columnsOpen = signal(false);

  toggleShowId(value: boolean): void { this.showId.set(value); }
  toggleShowDates(value: boolean): void { this.showDates.set(value); }

  private columnHelper = createColumnHelper<PairingResponse>();

  private makeMainCell(langCode: string): ColumnDef<PairingResponse, any> {
    const otherLang = SUPPORTED_LANGUAGES.find((l) => l.code !== langCode)!;
    return this.columnHelper.accessor(
      (row): { name: string; slug: string; imageUrl: string | null; otherName: string } => {
        const current = row.translations.find((t) => t.language === langCode)?.name ?? '—';
        const other = row.translations.find((t) => t.language === otherLang.code)?.name ?? '—';
        return { name: current, slug: row.slug, imageUrl: row.imageUrl, otherName: other };
      },
      {
        id: `main_${langCode}`,
        header: langCode === 'en' ? 'Pairing' : 'إقران',
        enableSorting: true,
        meta: { width: '30%' },
      }
    );
  }

  readonly columns = computed<ColumnDef<PairingResponse, any>[]>(() => {
    const currentLang = this.language.current();
    const mainCell = this.makeMainCell(currentLang);
    const shared = this.showId()
      ? [this.columnHelper.accessor('id', { header: 'ID', enableSorting: true, meta: { width: '48px' } }), mainCell]
      : [mainCell];

    const otherLang = SUPPORTED_LANGUAGES.find((l) => l.code !== currentLang)!;
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

    if (this.listView() === 'trash') {
      const tail = this.showDates()
        ? [this.columnHelper.accessor('deletedAt', { id: 'deleted', header: 'Deleted', enableSorting: true, cell: (info) => info.row.original.deletedAt, meta: { width: '132px' } })]
        : [];
      return [...shared, otherNameColumn, ...tail, this.actionsColumn];
    }
    const tail = this.showDates()
      ? [this.columnHelper.accessor('createdAt', { header: 'Created At', enableSorting: true, meta: { width: '120px' } })]
      : [];
    return [...shared, otherNameColumn, ...tail, this.actionsColumn];
  });

  private actionsColumn: ColumnDef<PairingResponse, any> = this.columnHelper.display({ id: 'actions', header: 'Actions' });

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────

  protected override loadTrashPage(): Observable<PageResponse<PairingResponse>> {
    return this.pairingService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
  }

  private trashParams() {
    return { page: this.currentPage(), size: this.pageSize(), search: this.searchQuery || undefined, sort: this.currentSort, direction: this.currentDirection };
  }

  protected override callRestore(id: number) {
    return this.pairingService.restore(id);
  }

  protected override restoreIdOf(item: PairingResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  protected override permanentDeleteSrv() {
    return this.pairingService;
  }

  readonly rowIdOf = (row: PairingResponse): number | null => typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  rowName(item: PairingResponse): string {
    return this.getTranslationName(item, this.language.language());
  }

  protected override undoItemLabel(item: PairingResponse): string {
    return this.getTranslationName(item, 'en');
  }

  protected override deleteToastKey(): string {
    return 'pairings.trash.movedToTrash';
  }

  protected override undoLabel(): string { return 'common.undo'; }
  protected override undoMessage(): string { return 'pairings.trash.movedToTrash'; }
  protected override restoreConflictTitle(): string { return 'common.restoreConflictTitle'; }
  protected override restoreConflictBody(): string { return 'common.restoreConflictBody'; }
  protected override restoreNotFoundBody(): string { return 'common.restoreNotFound'; }
  protected override restoreForbiddenBody(): string { return 'common.restoreForbidden'; }
  protected override restoreFailedBody(): string { return 'common.restoreFailed'; }
  protected override permanentDeleteUnsupportedTitle(): string { return 'common.permanentDeleteUnavailable'; }
  protected override permanentDeleteUnsupportedBody(): string { return 'common.permanentDeleteUnsupported'; }

  noResultsKey(): string {
    return this.isTrash() ? 'pairings.trash.noResultsInTrash' : 'pairings.trash.noResultsInActive';
  }

  getTranslationName(item: PairingResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  protected override loadPage(): Observable<PageResponse<PairingResponse>> {
    return this.pairingService
      .getAll({ page: this.currentPage(), size: this.pageSize(), search: this.searchQuery || undefined, sort: this.currentSort, direction: this.currentDirection })
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
    return this.pairingService.create(req, image, 'multipart');
  }

  protected override callUpdate(slug: string, req: PairingRequest, image?: File) {
    return this.pairingService.update(slug, req, image, 'multipart');
  }

  protected override callDelete(slug: string) {
    return this.pairingService.delete(slug);
  }
}
