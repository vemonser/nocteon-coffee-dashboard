import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { AuthService } from '../../../core/auth/auth.service';
import { OriginRequest, OriginResponse } from '../models/origin.model';
import { OriginService } from '../services/origin.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { AbstractControl } from '@angular/forms';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { LanguageService } from '../../../core/i18n/language.service';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';

import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus, lucideSearch, lucideList, lucidePencil,
  lucideTrash2, lucideX, lucideCheck, lucideImage, lucideLoader2,
} from '@ng-icons/lucide';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';
import { CrudDialogComponent } from '../../../shared/components/crud-dialog/crud-dialog.component';
import { TranslationFieldComponent } from '../../../shared/components/crud-dialog/translation-field.component';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { Router } from '@angular/router';
import { PagerComponent } from '../../../shared/components/pager/pager.component';


@Component({
  selector: 'app-origins-list',
  standalone: true,
  imports: [ EmptyStateComponent,
    PagerComponent,
    CommonModule, FormsModule, ReactiveFormsModule, HasPermissionDirective, DataTableComponent,
    LifecycleTabsComponent, TrashBannerComponent,
    CrudDialogComponent, TranslationFieldComponent, ImageUploadComponent,
    HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmInputImports,
    HlmLabelImports, HlmTextareaImports, NgIcon, TranslocoPipe,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucidePlus, lucideSearch, lucideList, lucidePencil,
      lucideTrash2, lucideX, lucideCheck, lucideImage,
    }),
  ],
  templateUrl: './origins-list.component.html',
})
export class OriginsListComponent extends BaseListComponent<OriginResponse, OriginRequest> {

  /** The create action's own copy, for the empty state's button. */
  protected override createActionLabel(): string {
    return this.t('origins.add', 'Add origin');
  }
  private originService = inject(OriginService);
  private auth = inject(AuthService);
  protected readonly language = inject(LanguageService);

  /** Opt into the shared soft-delete capability. */
  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('origin:delete');
  protected override createPermission = 'origin:create';
  protected override updatePermission = 'origin:update';
  protected override deletePermission = 'origin:delete';
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('origin:delete'));
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  protected override getId(item: OriginResponse): string {
    return item.slug;
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

  private columnHelper = createColumnHelper<OriginResponse>();

  /**
   * Main-cell accessor: thumbnail + name (current UI language) + slug below.
   * The other language's name stays in its own column.
   */
  private makeMainCell(langCode: string): ColumnDef<OriginResponse, any> {
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
        header: langCode === 'en' ? 'Origin' : 'منشأ',
        enableSorting: true,
        meta: { width: '30%' },
      }
    );
  }

  readonly columns = computed<ColumnDef<OriginResponse, any>[]>(() => {
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

    // Entity-specific column: Code (origins only)
    const codeColumn = this.columnHelper.accessor('code', {
      header: 'Code',
      enableSorting: true,
      meta: { width: '80px' },
    });

    if (this.listView() === 'trash') {
      const tail = this.showDates()
        ? [
            this.columnHelper.accessor(
              (row): string => row.deletedAt ?? '',
              {
                id: 'deleted',
                header: 'Deleted',
                enableSorting: true,
                meta: { width: '132px' },
              },
            ),
          ]
        : [];
      return [...shared, otherNameColumn, codeColumn, ...tail, this.actionsColumn];
    }
    const tail = this.showDates()
      ? [
          this.columnHelper.accessor('createdAt', {
            header: 'Created At',
            enableSorting: true,
            meta: { width: '120px' },
          }),
        ]
      : [];
    return [...shared, otherNameColumn, codeColumn, ...tail, this.actionsColumn];
  });

  private actionsColumn: ColumnDef<OriginResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
  });

  protected override restoreIdOf(item: OriginResponse): number | null {
    return item.id;
  }

  protected override callRestore(id: number) {
    return this.originService.restore(id);
  }

  protected override permanentDeleteSrv() {
    return this.originService;
  }

  readonly rowIdOf = (row: OriginResponse): number | null =>
    typeof row?.id === 'number' ? row.id : Number(row?.id) || null;

  protected override loadPage(): Observable<PageResponse<OriginResponse>> {
    return this.originService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────
  protected override loadTrashPage(): Observable<PageResponse<OriginResponse>> {
    return this.originService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
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

  protected override buildForm(): FormGroup {
    return this.fb.group({
      code: [''],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(origin: OriginResponse): void {
    this.form.patchValue({ code: origin.code });
    this.translationHelper.patchArray(this.translationsArray, origin.translations, ['description']);
    this.imagePreview.set(origin.imageUrl);
  }

  protected override toRequest(): OriginRequest {
    return {
      code: this.form.value.code,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: OriginRequest, image?: File) {
    return this.originService.create(req, image, 'multipart');
  }

  protected override callUpdate(slug: string, req: OriginRequest, image?: File) {
    return this.originService.update(slug, req, image, 'multipart');
  }

  protected override callDelete(slug: string) {
    return this.originService.delete(slug);
  }

  readonly rowHref = (row: OriginResponse): any[] | null =>
    row?.slug ? ['/dashboard/origins', row.slug] : null;

  override goToDetail(item: OriginResponse): void {
    this.router.navigate(['/dashboard/origins', item.slug]);
  }

  // ─── Create dialog ───────────────────────────────────────────────────────────
  readonly showCreateDialog = signal(false);
  readonly createForm = signal<FormGroup | null>(null);
  readonly createImagePreview = signal<string | null>(null);
  readonly createImageFile = signal<File | null>(null);
  readonly createSubmitting = signal(false);
  readonly createError = signal<string | null>(null);

  override openCreateDialog(): void {
    this.createForm.set(this.fb.group({
      code: [''],
      translations: this.translationHelper.buildArray([], ['description']),
    }));
    this.createImagePreview.set(null);
    this.createImageFile.set(null);
    this.createError.set(null);
    this.showCreateDialog.set(true);
  }

  closeCreateDialog(): void {
    // Close FIRST, and keep the form alive: the dialog is still in the DOM for
    // this change-detection pass, and nulling the FormGroup under its
    // `[formGroup]` binding throws NG01052 before the close can render.
    // The next open() builds a fresh form anyway.
    this.showCreateDialog.set(false);
    this.createImagePreview.set(null);
    this.createImageFile.set(null);
    this.createError.set(null);
  }

  onCreateImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.createImageFile.set(input.files[0]);
      const reader = new FileReader();
      reader.onload = (e) => this.createImagePreview.set(e.target?.result as string);
      reader.readAsDataURL(input.files[0]);
    }
  }

  submitCreate(): void {
    const form = this.createForm();
    if (!form || form.invalid) return;

    this.createSubmitting.set(true);
    this.createError.set(null);

    const req: OriginRequest = {
      code: form.value.code,
      translations: form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    const image = this.createImageFile() ?? undefined;

    this.originService.create(req, image, 'multipart').subscribe({
      next: (res) => {
        this.createSubmitting.set(false);
        if (res?.data) {
          this.closeCreateDialog();
          this.load();
          this.router.navigate(['/dashboard/origins', res.data.slug]);
        }
      },
      error: (err) => {
        this.createSubmitting.set(false);
        this.createError.set(err?.error?.message || 'Failed to create origin');
      },
    });
  }

  get createTranslationsArray(): FormArray {
    return (this.createForm()?.get('translations') as FormArray) ?? new FormArray([]);
  }

  override asGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  override langOf(group: AbstractControl): string {
    return (group.get('language')?.value as string) ?? '';
  }

  langDir(group: AbstractControl): string {
    return (group.get('language')?.value as string) === 'ar' ? 'rtl' : 'ltr';
  }

  getTranslationName(item: OriginResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  onSelectionChange(event: { id: number; checked: boolean }): void {
    const next = new Set(this.selection());
    if (event.checked) next.add(event.id);
    else next.delete(event.id);
    this.selection.set(next);
  }

  override toggleAll(checked: boolean): void {
    const ids = this.items()
      .map((i) => this.rowIdOf(i))
      .filter((id): id is number => id !== null);
    this.selection.set(checked ? new Set(ids) : new Set());
  }
}