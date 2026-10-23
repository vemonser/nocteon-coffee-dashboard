import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { AuthService } from '../../../core/auth/auth.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucidePlus, lucideSearch, lucideTrash2, lucideX } from '@ng-icons/lucide';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  PromoCodeDiscountType,
  PromoCodeRequest,
  PromoCodeResponse,
  PromoScopeType,
} from '../models/promo-code.model';
import { CategoryService } from '../../categories/services/category.service';
import { PromoCodeService } from '../services/promo-code.service';
import { CategoryResponse } from '../../categories/models/category.model';
import { StoreSettingsService } from '../../../core/settings/store-settings.service';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { Router } from '@angular/router';
import { PromoCodeAnalyticsResponse } from '../models/promo-code.model';

import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { KpiCardComponent } from '../../../shared/components/dashboard/kpi-card/kpi-card.component';
@Component({
  selector: 'app-promo-codes-list',
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
    HlmDatePickerImports,
    HlmTableImports,
    HlmLabelImports,
    NgIcon,
    TranslocoPipe,
    MoneyPipe,
    KpiCardComponent,
  ],
  providers: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideX, lucideSearch })],
  templateUrl: './promo-codes-list.component.html',
})
export class PromoCodesListComponent extends BaseListComponent<
  PromoCodeResponse,
  PromoCodeRequest,
  number
> {
  router = inject(Router);
  private promoCodeService = inject(PromoCodeService);
  private auth = inject(AuthService);

  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('promo:delete');
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('promo:delete'));
  protected readonly storeCurrency = computed(() => this.storeSettings.currency());
  protected readonly language = inject(LanguageService);
  private readonly storeSettings = inject(StoreSettingsService);
  private categoryService = inject(CategoryService); // for the category picker

  // Category options for the scope picker
  categoryOptions = signal<CategoryResponse[]>([]);
  analytics = signal<PromoCodeAnalyticsResponse | null>(null);

  protected ngOnInitOverrideHook(): void {} // placeholder if BaseListComponent exposes a hook; otherwise load in constructor

  constructor() {
    super();
    this.categoryService.getAll({ isActive: true }).subscribe((res) => {
      this.categoryOptions.set(res.data.content);
    });
    this.promoCodeService.getAnalytics(30).subscribe({
      next: (res) => this.analytics.set(res.data),
      error: () => this.analytics.set(null),
    });
  }

  protected override getId(item: PromoCodeResponse): number {
    return item.id;
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────

  protected override loadTrashPage(): Observable<PageResponse<PromoCodeResponse>> {
    return this.promoCodeService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
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
    return this.promoCodeService.restore(id);
  }

  protected override restoreIdOf(item: PromoCodeResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  protected override permanentDeleteSrv() {
    return this.promoCodeService;
  }

  readonly rowIdOf = (row: PromoCodeResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  rowName(item: PromoCodeResponse): string {
    return item.code;
  }

  protected override undoItemLabel(item: PromoCodeResponse): string {
    return item.code;
  }

  protected override deleteToastKey(): string {
    return 'promoCodes.trash.movedToTrash';
  }

  protected override undoLabel(): string {
    return 'common.undo';
  }
  protected override undoMessage(): string {
    return 'promoCodes.trash.movedToTrash';
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
    return this.isTrash() ? 'promoCodes.trash.noResultsInTrash' : 'promoCodes.trash.noResultsInActive';
  }

  protected override goToDetail(item: PromoCodeResponse): void {
    this.router.navigate(['/dashboard/promo-codes', item.id]);
  }
  protected override loadPage(): Observable<PageResponse<PromoCodeResponse>> {
    return this.promoCodeService
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      code: ['', Validators.required],
      discountType: ['PERCENTAGE' as PromoCodeDiscountType, Validators.required],
      discountValue: [null as number | null],
      minOrderAmount: [null as number | null],
      scopeType: ['GLOBAL' as PromoScopeType, Validators.required],
      categorySlugs: [[] as string[]],
      maxTotalRedemptions: [null as number | null],
      maxRedemptionsPerUser: [1, [Validators.required, Validators.min(1)]],
      validFromDate: [null as Date | null, Validators.required],
      validFromTime: ['00:00', Validators.required],
      validUntilDate: [null as Date | null, Validators.required],
      validUntilTime: ['00:00', Validators.required],
      isActive: [true],
    });
  }
  protected override onEditOpen(item: PromoCodeResponse): void {
    const validFromParts = this.splitDateTime(item.validFrom);
    const validUntilParts = this.splitDateTime(item.validUntil);

    this.form.patchValue({
      code: item.code,
      discountType: item.discountType,
      discountValue: item.discountValue,
      minOrderAmount: item.minOrderAmount,
      scopeType: item.scopeType,
      categorySlugs: item?.categorySlugs?.map((c) => c),
      maxTotalRedemptions: item.maxTotalRedemptions,
      maxRedemptionsPerUser: item.maxRedemptionsPerUser,
      validFromDate: validFromParts.date,
      validFromTime: validFromParts.time,
      validUntilDate: validUntilParts.date,
      validUntilTime: validUntilParts.time,
      isActive: item.active,
    });
  }

  private splitDateTime(iso: string | undefined): { date: Date | null; time: string } {
    if (!iso) return { date: null, time: '00:00' };
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return { date: d, time: `${hh}:${mm}` };
  }

  private combineDateAndTime(date: Date | null, time: string | null): Date | null {
    if (!date) return null;
    const combined = new Date(date);
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      combined.setHours(hours || 0, minutes || 0, 0, 0);
    }
    return combined;
  }

  protected override toRequest(): PromoCodeRequest {
    const v = this.form.value;
    const validFrom = this.combineDateAndTime(v.validFromDate, v.validFromTime);
    const validUntil = this.combineDateAndTime(v.validUntilDate, v.validUntilTime);

    return {
      code: v.code,
      discountType: v.discountType,
      discountValue: v.discountType === 'FREE_SHIPPING' ? null : v.discountValue,
      minOrderAmount: v.minOrderAmount,
      scopeType: v.scopeType,
      categorySlugs: v.scopeType === 'CATEGORY' ? v.categorySlugs : [],
      maxTotalRedemptions: v.maxTotalRedemptions,
      maxRedemptionsPerUser: v.maxRedemptionsPerUser,
      validFrom: validFrom!.toISOString(),
      validUntil: validUntil!.toISOString(),
      isActive: v.isActive,
    };
  }

  protected override callCreate(req: PromoCodeRequest) {
    return this.promoCodeService.create(req, undefined, 'json');
  }

  protected override callUpdate(id: number, req: PromoCodeRequest) {
    return this.promoCodeService.update(id, req, undefined, 'json');
  }

  protected override callDelete(id: number) {
    return this.promoCodeService.delete(id);
  }

  // ─── UI helpers ────────────────────────────────────────────────
  get isCategoryScope(): boolean {
    return this.form?.value.scopeType === 'CATEGORY';
  }

  get isFreeShipping(): boolean {
    return this.form?.value.discountType === 'FREE_SHIPPING';
  }
  toggleCategory(slug: string): void {
    const current: string[] = this.form.value?.categorySlugs;
    const updated = current?.includes(slug)
      ? current.filter((x) => x !== slug)
      : [...current, slug];
    this.form.patchValue({ categorySlugs: updated });
  }

  getTranslationName(cat: CategoryResponse): string {
    return cat.translations.find((t) => t.language === 'en')?.name ?? cat.slug;
  }
  private columnHelper = createColumnHelper<PromoCodeResponse>();
  columns: ColumnDef<PromoCodeResponse, any>[] = [
    this.columnHelper.accessor('code', { header: 'Code', enableSorting: true }),
    this.columnHelper.accessor('discountType', { header: 'Type', enableSorting: false }),
    this.columnHelper.accessor('discountValue', { header: 'Value', enableSorting: false }),
    this.columnHelper.accessor('scopeType', { header: 'Scope', enableSorting: false }),
    this.columnHelper.accessor('validUntil', { header: 'Expires', enableSorting: true }),
    this.columnHelper.accessor('active', {
      header: 'Status',
      cell: (info) => info.getValue(),
    }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
  ];
}