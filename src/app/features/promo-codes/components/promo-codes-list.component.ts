import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
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
import {
  PromoCodeDiscountType,
  PromoCodeRequest,
  PromoCodeResponse,
  PromoScopeType,
} from '../models/promo-code.model';
import { CategoryService } from '../../categories/services/category.service';
import { PromoCodeService } from '../services/promo-code.service';
import { CategoryResponse } from '../../categories/models/category.model';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-promo-codes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmSelectImports,
    HlmDatePickerImports,
    HlmTableImports,
    HlmLabelImports,
    NgIcon,
  ],
  providers: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideX, lucideSearch })],
  templateUrl: './promo-codes-list.component.html',
})
export class PromoCodesListComponent extends BaseListComponent<
  PromoCodeResponse,
  PromoCodeRequest,
  string
> {
  router = inject(Router);
  private promoCodeService = inject(PromoCodeService);
  private categoryService = inject(CategoryService); // for the category picker

  // Category options for the scope picker
  categoryOptions = signal<CategoryResponse[]>([]);

  protected ngOnInitOverrideHook(): void {} // placeholder if BaseListComponent exposes a hook; otherwise load in constructor

  constructor() {
    super();
    this.categoryService.getAll({ isActive: true }).subscribe((res) => {
      this.categoryOptions.set(res.data.content);
    });
  }

  protected override getId(item: PromoCodeResponse): string {
    return item.id;
  }

  goToDetail(item: PromoCodeResponse): void {
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

  protected override callUpdate(id: string, req: PromoCodeRequest) {
    return this.promoCodeService.update(id, req, undefined, 'json');
  }

  protected override callDelete(id: string) {
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
