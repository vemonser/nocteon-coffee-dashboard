import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, tap } from 'rxjs';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft, lucidePencil, lucideTrash2, lucideImage, lucidePackage,
  lucideTag, lucideCheck, lucideX, lucideLoader2, lucideGrid3x3, lucideList,
  lucideChevronLeft, lucideChevronRight, lucideEye,
} from '@ng-icons/lucide';
import { OriginService } from '../../services/origin.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';

import { PageResponse } from '../../../../core/models/api-response.model';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { DashboardOriginResponse, OriginRequest, ProductCardResponse } from '../../models/origin.model';

type ViewMode = 'list' | 'grid';
type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-origin-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmSkeletonImports,
    HlmSeparatorImports, HlmInputImports, HlmLabelImports, HlmTableImports, NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft, lucidePencil, lucideTrash2, lucideImage, lucidePackage,
      lucideTag, lucideCheck, lucideX, lucideLoader2, lucideGrid3x3, lucideList,
      lucideChevronLeft, lucideChevronRight, lucideEye,
    }),
  ],
  templateUrl: './origin-detail.component.html',
})
export class OriginDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private originService = inject(OriginService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);

  protected readonly Math = Math;

  readonly origin = signal<DashboardOriginResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');

  readonly products = signal<ProductCardResponse[]>([]);
  readonly productsLoading = signal(false);
  readonly productsPage = signal<PageResponse<ProductCardResponse> | null>(null);
  readonly productViewMode = signal<ViewMode>('grid');
  readonly currentProductPage = signal(0);

  form!: FormGroup;

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        switchMap((slug) => {
          if (!slug) {
            this.error.set('Origin not found');
            return of(null);
          }
          this.loading.set(true);
          return this.originService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load origin');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.origin.set(res.data);
          this.buildForm(res.data);
          this.loadProducts(res.data.slug, 0);

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildForm(data: DashboardOriginResponse): void {
    this.form = this.fb.group({
      code: [data.code],
      translations: this.translationHelper.buildArray(data.translations, ['description']),
    });

    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  private loadProducts(slug: string, page: number): void {
    this.productsLoading.set(true);
    this.originService
      .getProducts(slug, { page, size: 8 })
      .pipe(
        catchError(() =>
          of({
            data: { content: [], totalElements: 0, totalPages: 0, page, size: 8, first: true, last: true },
          } as any),
        ),
      )
      .subscribe((res) => {
        this.productsLoading.set(false);
        this.products.set(res.data.content);
        this.productsPage.set(res.data);
      });
  }

  goToProductPage(page: number): void {
    const slug = this.origin()?.slug;
    if (!slug) return;
    this.currentProductPage.set(page);
    this.loadProducts(slug, page);
  }

  toggleProductView(mode: ViewMode): void {
    this.productViewMode.set(mode);
  }

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.origin();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const slug = this.origin()?.slug;
    if (!slug) return;

    this.saving.set(true);

    const req: OriginRequest = {
      code: this.form.value.code,
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    this.originService
      .update(slug, req)
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
          this.origin.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  deleteOrigin(): void {
    const name = this.getTranslationName('en');
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const slug = this.origin()?.slug;
    if (!slug) return;

    this.originService.delete(slug).subscribe({
      next: () => this.router.navigate(['/dashboard/origins']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/origins']);
  }

  getTranslationName(lang: string): string {
    return this.origin()?.translations.find((t) => t.language === lang)?.name || '';
  }

  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}