import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
  lucideEye,
  lucideImage,
  lucideLoader2,
  lucidePackage,
  lucidePencil,
  lucideTag,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { BrewingMethodService } from '../../services/brewing-method.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';
import {
  BrewingMethodRequest,
  DashboardBrewingMethodResponse,
  ProductWithScoreResponse,
} from '../../models/brewing-method.model';
import { PageResponse } from '../../../../core/models/api-response.model';
import { catchError, map, of, switchMap, tap } from 'rxjs';

type SortField = 'score' | 'createdAt';
type SortDir = 'asc' | 'desc';
type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-brewing-method-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSkeletonImports,
    HlmSeparatorImports,
    HlmInputImports,
    HlmLabelImports,
    HlmTableImports,
    HlmSelectImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePencil,
      lucideTrash2,
      lucidePackage,
      lucideTag,
      lucideCheck,
      lucideX,
      lucideLoader2,
      lucideChevronLeft,
      lucideChevronRight,
      lucideEye,
      lucideImage,
    }),
  ],
  templateUrl: './brewing-method-detail.component.html',
})
export class BrewingMethodDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private brewingMethodService = inject(BrewingMethodService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);

  protected readonly Math = Math;

  readonly brewingMethod = signal<DashboardBrewingMethodResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');

  // Linked Products state
  readonly products = signal<ProductWithScoreResponse[]>([]);
  readonly productsLoading = signal(false);
  readonly productsPage = signal<PageResponse<ProductWithScoreResponse> | null>(null);
  readonly currentProductPage = signal(0);
  readonly sortField = signal<SortField>('score');
  readonly sortDir = signal<SortDir>('desc');

  readonly sortOptions: { label: string; field: SortField; dir: SortDir }[] = [
    { label: 'Best Match', field: 'score', dir: 'desc' },
    { label: 'Worst Match', field: 'score', dir: 'asc' },
    { label: 'Newest', field: 'createdAt', dir: 'desc' },
    { label: 'Oldest', field: 'createdAt', dir: 'asc' },
  ];

  form!: FormGroup;
  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        switchMap((slug) => {
          if (!slug) {
            this.error.set('Brewing method not found');
            return of(null);
          }
          this.loading.set(true);
          return this.brewingMethodService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load brewing method');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.brewingMethod.set(res.data);
          this.buildForm(res.data);
          this.loadProducts(res.data.slug, 0);

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildForm(data: DashboardBrewingMethodResponse): void {
    this.form = this.fb.group({
      translations: this.translationHelper.buildArray(data.translations, ['description']),
    });
    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => this.isDirty.set(this.form.dirty));
  }

  // ─── Products ──────────────────────────────────────────────

  private loadProducts(slug: string, page: number): void {
    this.productsLoading.set(true);
    this.brewingMethodService
      .getProducts(slug, {
        page,
        size: 10,
        sort: this.sortField(),
        direction: this.sortDir(),
      })
      .pipe(
        catchError(() =>
          of({
            data: {
              content: [],
              totalElements: 0,
              totalPages: 0,
              page,
              size: 10,
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
  onSortSelectChange(value: string | null | undefined): void {
    if (!value) return; // لو undefined أو null، تجاهل (مفيش اختيار فعلي)
    const [field, dir] = value.split('_') as [SortField, SortDir];
    this.onSortChange({ field, dir });
  }
  onSortChange(option: { field: SortField; dir: SortDir }): void {
    this.sortField.set(option.field);
    this.sortDir.set(option.dir);
    this.currentProductPage.set(0); // الترتيب اتغير، نرجع لأول صفحة
    const slug = this.brewingMethod()?.slug;
    if (slug) this.loadProducts(slug, 0);
  }

  goToProductPage(page: number): void {
    const slug = this.brewingMethod()?.slug;
    if (!slug) return;
    this.currentProductPage.set(page);
    this.loadProducts(slug, page);
  }

  // ─── Edit Actions (نفس نمط الكاتيجوري، من غير isActive/image) ──────────

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.brewingMethod();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;
    const slug = this.brewingMethod()?.slug;
    if (!slug) return;

    this.saving.set(true);
    const req: BrewingMethodRequest = {
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    this.brewingMethodService
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
          this.brewingMethod.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();
          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  deleteBrewingMethod(): void {
    const name = this.getTranslationName('en');
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const slug = this.brewingMethod()?.slug;
    if (!slug) return;
    this.brewingMethodService.delete(slug).subscribe({
      next: () => this.router.navigate(['/dashboard/brewing-methods']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/brewing-methods']);
  }

  getTranslationName(lang: string): string {
    return this.brewingMethod()?.translations.find((t) => t.language === lang)?.name || '';
  }
  getTranslationDescription(lang: string): string {
    return this.brewingMethod()?.translations.find((t) => t.language === lang)?.description || '';
  }
  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}
