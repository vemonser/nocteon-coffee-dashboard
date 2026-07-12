import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, tap } from 'rxjs';

// Spartan UI
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
  lucideArrowLeft,
  lucidePencil,
  lucideTrash2,
  lucideImage,
  lucidePackage,
  lucideTag,
  lucideCheck,
  lucideX,
  lucideLoader2,
  lucideGrid3x3,
  lucideList,
  lucideChevronLeft,
  lucideChevronRight,
  lucideEye,
} from '@ng-icons/lucide';
import { CategoryService } from '../../services/category.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';
import {
  CategoryRequest,
  CategoryResponse,
  DashboardCategoryResponse,
  ProductCardResponse,
} from '../../models/category.model';
import { PageResponse } from '../../../../core/models/api-response.model';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';

type ViewMode = 'list' | 'grid';
type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-category-detail',
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
    HlmLabelImports,
    HlmTableImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePencil,
      lucideTrash2,
      lucideImage,
      lucidePackage,
      lucideTag,
      lucideCheck,
      lucideX,
      lucideLoader2,
      lucideGrid3x3,
      lucideList,
      lucideChevronLeft,
      lucideChevronRight,
      lucideEye,
    }),
  ],
  templateUrl: './category-detail.component.html',
})
export class CategoryDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);

  // For template access
  protected readonly Math = Math;

  // Category state
  readonly category = signal<DashboardCategoryResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');

  // Products state
  readonly products = signal<ProductCardResponse[]>([]);
  readonly productsLoading = signal(false);
  readonly productsPage = signal<PageResponse<ProductCardResponse> | null>(null);
  readonly productViewMode = signal<ViewMode>('grid');
  readonly currentProductPage = signal(0);

  // Form
  form!: FormGroup;

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        switchMap((slug) => {
          if (!slug) {
            this.error.set('Category not found');
            return of(null);
          }
          this.loading.set(true);
          return this.categoryService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load category');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.category.set(res.data);
          this.buildForm(res.data);
          this.loadProducts(res.data.slug, 0);

          // Replace the last breadcrumb segment with the actual category name.
          // Falls back to the slug if no English translation exists.
          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildForm(data: DashboardCategoryResponse): void {
    this.form = this.fb.group({
      isActive: [data.isActive],
      translations: this.translationHelper.buildArray(data.translations, ['description']),
    });

    // ← الإضافة الجديدة: كل مرة الفورم يتغيّر، حدّث الـ signal يدويًا
    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  // ─── Products ──────────────────────────────────────────────────────────────

  private loadProducts(slug: string, page: number): void {
    this.productsLoading.set(true);
    this.categoryService
      .getProducts(slug, { page, size: 8 })
      .pipe(
        catchError(() =>
          of({
            data: {
              content: [],
              totalElements: 0,
              totalPages: 0,
              page,
              size: 8,
              first: true,
              last: true,
            },
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
    const slug = this.category()?.slug;
    if (!slug) return;
    this.currentProductPage.set(page);
    this.loadProducts(slug, page);
  }

  toggleProductView(mode: ViewMode): void {
    this.productViewMode.set(mode);
  }

  // ─── Edit Actions ──────────────────────────────────────────────────────────

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.category();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    // Resolve slug before flipping `saving` to true, so a missing slug
    // can never leave the Save button stuck on "Saving...".
    const slug = this.category()?.slug;
    if (!slug) return;

    this.saving.set(true);

    const req: CategoryRequest = {
      isActive: this.form.value.isActive,
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    this.categoryService
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
          this.category.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();

          // Keep the breadcrumb in sync if the name changed during this edit.
          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  deleteCategory(): void {
    const name = this.getTranslationName('en');
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const slug = this.category()?.slug;
    if (!slug) return;

    this.categoryService.delete(slug).subscribe({
      next: () => this.router.navigate(['/dashboard/categories']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/categories']);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getTranslationName(lang: string): string {
    return this.category()?.translations.find((t) => t.language === lang)?.name || '';
  }

  getTranslationDescription(lang: string): string {
    return this.category()?.translations.find((t) => t.language === lang)?.description || '';
  }

  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}
