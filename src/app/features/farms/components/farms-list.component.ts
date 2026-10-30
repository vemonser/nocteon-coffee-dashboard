import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { FarmRequest, FarmResponse } from '../models/farm.model';
import { FarmService } from '../services/farm.service';
import { OriginService } from '../../origins/services/origin.service';
import { OriginOption } from '../../origins/models/origin.model';
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
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmSelectImports } from '@spartan-ng/helm/select';

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
  lucideLoader2,
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
import { AuthService } from '../../../core/auth/auth.service';


@Component({
  selector: 'app-farms-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    EmptyStateComponent,
    DataTableComponent,
    ClickOutsideDirective,
    LifecycleTabsComponent,
    TrashBannerComponent,
    CrudDialogComponent,
    TranslationFieldComponent,
    ImageUploadComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmLabelImports,
    HlmTextareaImports,
    HlmSelectImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucidePlus,
      lucideSearch,
      lucideList,
      lucidePencil,
      lucideTrash2,
      lucideX,
      lucideCheck,
      lucideImage,
    }),
  ],
  templateUrl: './farms-list.component.html',
})
export class FarmsListComponent extends BaseListComponent<FarmResponse, FarmRequest> {

  /** The create action's own copy, for the empty state's button. */
  protected override createActionLabel(): string {
    return this.t('farms.add', 'Add farm');
  }
  private farmService = inject(FarmService);
  private originService = inject(OriginService);
  private auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  /** Opt into the shared soft-delete capability (tabs, counts, undo, restore). */
  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('farm:delete');
  protected override createPermission = 'farm:create';
  protected override updatePermission = 'farm:update';
  protected override deletePermission = 'farm:delete';
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('farm:delete'));

  protected override getId(item: FarmResponse): string {
    return item.slug;
  }

  /**
   * The trash view's permanent delete. Trash rows are addressed by id, not slug, so the shared
   * base class needs the id and the service that owns the `DELETE /{id}/permanent` route.
   */
  protected override restoreIdOf(item: FarmResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  protected override callRestore(id: number) {
    return this.farmService.restore(id);
  }

  protected override permanentDeleteSrv() {
    return this.farmService;
  }


  readonly showId = signal(false);
  readonly showDates = signal(true);
  readonly columnsOpen = signal(false);

  // Origins list for the create dialog dropdown
  readonly origins = signal<OriginOption[]>([]);

  override ngOnInit(): void {
    super.ngOnInit();
    this.originService.getAllOptions().subscribe({
      next: (res) => {
        if (res?.data) this.origins.set(res.data);
      },
    });
  }

  toggleShowId(value: boolean): void {
    this.showId.set(value);
  }

  toggleShowDates(value: boolean): void {
    this.showDates.set(value);
  }

  private columnHelper = createColumnHelper<FarmResponse>();

  /**
   * Main-cell accessor: thumbnail + name (current UI language) + slug below.
   * The other language's name stays in its own column.
   */
  private makeMainCell(langCode: string): ColumnDef<FarmResponse, any> {
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
        header: langCode === 'en' ? 'Farm' : 'مزرعة',
        enableSorting: true,
        meta: { width: '30%' },
      }
    );
  }

  readonly columns = computed<ColumnDef<FarmResponse, any>[]>(() => {
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

    // Entity-specific column: Origin (farms only)
    const originColumn = this.columnHelper.accessor('originSlug', {
      header: 'Origin',
      enableSorting: true,
      meta: { width: '160px' },
    });

    if (this.listView() === 'trash') {
      const tail = this.showDates()
        ? [
            this.columnHelper.accessor('deletedAt', {
              id: 'deleted',
              header: 'Deleted',
              enableSorting: true,
              cell: (info) => info.row.original.deletedAt,
              meta: { width: '132px' },
            }),
          ]
        : [];
      return [...shared, otherNameColumn, originColumn, ...tail, this.actionsColumn];
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
    return [...shared, otherNameColumn, originColumn, ...tail, this.actionsColumn];
  });

  private actionsColumn: ColumnDef<FarmResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
  });

  protected override loadPage(): Observable<PageResponse<FarmResponse>> {
    return this.farmService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────
  protected override loadTrashPage(): Observable<PageResponse<FarmResponse>> {
    return this.farmService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
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
      originSlug: [''],
      translations: this.translationHelper.buildArray([], ['description', 'country']),
    });
  }

  protected override onEditOpen(farm: FarmResponse): void {
    this.form.patchValue({ originSlug: farm.originSlug });
    this.translationHelper.patchArray(this.translationsArray, farm.translations, [
      'description',
      'country',
    ]);
    this.imagePreview.set(farm.imageUrl);
  }

  protected override toRequest(): FarmRequest {
    return {
      originSlug: this.form.value.originSlug,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        country: t.country || undefined,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: FarmRequest, image?: File) {
    return this.farmService.create(req, image, 'multipart');
  }

  protected override callUpdate(slug: string, req: FarmRequest, image?: File) {
    return this.farmService.update(slug, req, image, 'multipart');
  }

  protected override callDelete(slug: string) {
    return this.farmService.delete(slug);
  }

  /**
   * The name link's destination — the entity's own detail page. The name
   * is the row's single clickable control; the slug stays a plain handle.
   */
  readonly rowHref = (row: FarmResponse): any[] | null =>
    row?.slug ? ['/dashboard/farms', row.slug] : null;

  override goToDetail(item: FarmResponse): void {
    this.router.navigate(['/dashboard/farms', item.slug]);
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
      originSlug: [''],
      translations: this.translationHelper.buildArray([], ['description', 'country']),
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

    const req: FarmRequest = {
      originSlug: form.value.originSlug,
      translations: form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        country: t.country || undefined,
        description: t.description || undefined,
      })),
    };

    const image = this.createImageFile() ?? undefined;

    this.farmService.create(req, image, 'multipart').subscribe({
      next: (res) => {
        this.createSubmitting.set(false);
        if (res?.data) {
          this.closeCreateDialog();
          this.load();
          this.router.navigate(['/dashboard/farms', res.data.slug]);
        }
      },
      error: (err) => {
        this.createSubmitting.set(false);
        this.createError.set(err?.error?.message || 'Failed to create farm');
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

  getTranslationName(item: FarmResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.name ?? '—';
  }

  getTranslationCountry(item: FarmResponse, langCode: string): string {
    return item.translations.find((t) => t.language === langCode)?.country ?? '—';
  }

  onSelectionChange(event: { id: number; checked: boolean }): void {
    const next = new Set(this.selection());
    if (event.checked) next.add(event.id);
    else next.delete(event.id);
    this.selection.set(next);
  }

  readonly rowIdOf = (row: FarmResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  override toggleAll(checked: boolean): void {
    const ids = this.items()
      .map((i) => this.rowIdOf(i))
      .filter((id): id is number => id !== null);
    this.selection.set(checked ? new Set(ids) : new Set());
  }

}