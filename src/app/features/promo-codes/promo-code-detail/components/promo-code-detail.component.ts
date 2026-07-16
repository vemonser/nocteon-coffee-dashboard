import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideLoader2,
  lucidePencil,
  lucidePercent,
  lucidePlus,
  lucideSearch,
  lucideTag,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';

import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';

import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { ActivatedRoute, Router } from '@angular/router';
import { PromoCodeService } from '../../services/promo-code.service';
import { CategoryService } from '../../../categories/services/category.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { PromoCodeRequest, PromoCodeResponse } from '../../models/promo-code.model';
import { CategoryResponse } from '../../../categories/models/category.model';

type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-promo-code-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSkeletonImports,
    HlmSeparatorImports,
    HlmInputImports,
    HlmDatePickerImports,
    HlmLabelImports,
    HlmSelectImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePencil,
      lucideTrash2,
      lucideTag,
      lucideCheck,
      lucideX,
      lucideLoader2,
      lucidePercent,
    }),
  ],
  templateUrl: './promo-code-detail.component.html',
})
export class PromoCodeDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private promoCodeService = inject(PromoCodeService);
  private categoryService = inject(CategoryService);
  private breadcrumbService = inject(BreadcrumbService);

  readonly promoCode = signal<PromoCodeResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');
  readonly categoryOptions = signal<CategoryResponse[]>([]);

  form!: FormGroup;

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);
  readonly isCategoryScope = computed(() => this.form?.value.scopeType === 'CATEGORY');
  readonly isFreeShipping = computed(() => this.form?.value.discountType === 'FREE_SHIPPING');

  ngOnInit(): void {
    // this.categoryService.getAll({ isActive: true }).subscribe((res) => {
    //   this.categoryOptions.set(res.data.content);
    // });
    console.log('From Ngon it');
    this.route.paramMap
      .pipe(
        map((params) => {
          console.log(params.get('slug'));
          return params.get('slug');
        }),
        switchMap((id) => {
          if (!id) {
            console.log(id);
            this.error.set('Promo code not found');
            return of(null);
          }
          this.loading.set(true);
          return this.promoCodeService.getById(id).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load promo code');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          console.log(res.data);
          this.promoCode.set(res.data);
          this.buildForm(res.data);
          this.breadcrumbService.updateLastLabel(res.data.code);
        }
      });
  }

  private buildForm(data: PromoCodeResponse): void {
    const validFromParts = this.splitDateTime(data.validFrom);
    const validUntilParts = this.splitDateTime(data.validUntil);

    this.form = this.fb.group({
      code: [data.code, Validators.required],
      discountType: [data.discountType, Validators.required],
      discountValue: [data.discountValue],
      minOrderAmount: [data.minOrderAmount],
      scopeType: [data.scopeType, Validators.required],
      categorySlugs: [data.categorySlugs.map((c) => c)],
      maxTotalRedemptions: [data.maxTotalRedemptions],
      maxRedemptionsPerUser: [data.maxRedemptionsPerUser, [Validators.required, Validators.min(1)]],
      validFromDate: [validFromParts.date, Validators.required],
      validFromTime: [validFromParts.time, Validators.required],
      validUntilDate: [validUntilParts.date, Validators.required],
      validUntilTime: [validUntilParts.time, Validators.required],
      isActive: [data.active],
    });

    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => this.isDirty.set(this.form.dirty));
  }

  /** يفكّ ISO string لتاريخ + وقت (HH:mm) */
  private splitDateTime(iso: string | undefined): { date: Date | null; time: string } {
    if (!iso) return { date: null, time: '00:00' };
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return { date: d, time: `${hh}:${mm}` };
  }

  /** يدمج Date (اليوم بس) مع وقت "HH:mm" في Date واحد كامل */
  private combineDateAndTime(date: Date | null, time: string | null): Date | null {
    if (!date) return null;
    const combined = new Date(date);
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      combined.setHours(hours || 0, minutes || 0, 0, 0);
    }
    return combined;
  }

  toggleCategory(slug: string): void {
    const current: string[] = this.form.value.categorySlugs;
    const updated = current.includes(slug) ? current.filter((x) => x !== slug) : [...current, slug];
    this.form.patchValue({ categorySlugs: updated });
  }

  getTranslationName(cat: CategoryResponse): string {
    return cat.translations.find((t) => t.language === 'en')?.name ?? cat.slug;
  }

  // ─── Edit Actions ──────────────────────────────────────────────────────────

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.promoCode();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const id = this.promoCode()?.id;
    if (!id) return;

    this.saving.set(true);

    const v = this.form.value;
    const validFrom = this.combineDateAndTime(v.validFromDate, v.validFromTime);
    const validUntil = this.combineDateAndTime(v.validUntilDate, v.validUntilTime);

    const req: PromoCodeRequest = {
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

    this.promoCodeService
      .update(String(id), req, undefined, 'json')
      .pipe(
        tap(() => this.saving.set(false)),
        catchError((err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Failed to save');
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res?.data) {
          this.promoCode.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();
          this.breadcrumbService.updateLastLabel(res.data.code);
        }
      });
  }

  deletePromoCode(): void {
    const code = this.promoCode()?.code;
    if (!confirm(`Delete "${code}"? This cannot be undone.`)) return;

    const id = this.promoCode()?.id;
    if (!id) return;

    this.promoCodeService.delete(String(id)).subscribe({
      next: () => this.router.navigate(['/dashboard/promo-codes']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/promo-codes']);
  }
}
