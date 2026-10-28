import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProductRequest, ProductTranslation } from '../../models/product.models';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';
import { BasicInfoStepComponent } from '../steps/basic-info-step/basic-info-step.component';
import { VariantsStepComponent } from '../steps/variants-step/variants-step.component';
import { MediaStepComponent } from '../steps/media-step/media-step.component';
import { TastingNotesStepComponent } from '../steps/tasting-notes-step/tasting-notes-step.component';
import { PairingsStepComponent } from '../steps/pairings-step/pairings-step.component';
import { ProductWizardStateService } from './product-wizard-state.service';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotifyService } from '../../../../core/notify/notify.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { CanComponentDeactivate } from '../../../../core/guards/unsaved-changes.guard';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatRelativeTime } from '../../../../core/i18n/relative-time';
import { clearProductDraft, loadProductDraft, saveProductDraft } from './product-draft';
import { HasUnsavedChanges } from '../../../../core/guards/has-unsaved-changes';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
  lucideSearch,
  lucideX,
  lucideLoader2,
  lucideSave,
  lucideExternalLink,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-product-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BasicInfoStepComponent,
    VariantsStepComponent,
    MediaStepComponent,
    TastingNotesStepComponent,
    PairingsStepComponent,
    HlmTabsImports,
    HlmButtonImports,
    NgIcon,
    TranslocoPipe,
  ],
    providers: [
      ProductWizardStateService,
    provideIcons({
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight,
      lucideArrowRight,
      lucideArrowLeft,
      lucideX,
      lucideCheck,
      lucideLoader2,
      lucideSave,
      lucideExternalLink
    }),
  ],
  templateUrl: './product-wizard.component.html',
})
export class ProductWizardComponent implements CanComponentDeactivate, HasUnsavedChanges {
  isDirty(): boolean { return this.hasUnsavedChanges(); }
  async saveAll(): Promise<{ ok: boolean; firstInvalidTab?: string }> {
    if (!this.isFormValid()) {
      const firstInvalid = this.stepTabs.find((t) => this.hasTabError(t.id));
      return { ok: false, firstInvalidTab: firstInvalid?.id };
    }
    this.onSubmit();
    return { ok: true };
  }
  protected state = inject(ProductWizardStateService);
  private productService = inject(ProductService);
  private translationHelper = inject(TranslationFormHelper);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);
  private language = inject(LanguageService);
  private confirmDialog = inject(ConfirmDialogService);

  loadingDetail = signal(false);
  submitting = signal(false);
  loadError = signal<string | null>(null);

  get stepTabs() {
    const isCoffee = this.state.form.get('productType')?.value === 'COFFEE';
    const tabs = [
      { id: 'basic', label: 'Basic Info', count: 0, hasError: false },
      { id: 'variants', label: 'Variants', count: this.state.variantsArray.length, hasError: this.state.variantsArray.invalid },
      { id: 'media', label: 'Media', count: this.state.existingMedia().length + this.state.stagedMedia().length, hasError: false },
    ];
    if (isCoffee) {
      tabs.push({ id: 'tasting-notes', label: 'Tasting Notes', count: this.state.tastingNotesArray.length, hasError: false });
      tabs.push({ id: 'pairings', label: 'Pairings', count: this.state.pairingsArray.length, hasError: false });
    }
    return tabs;
  }

  hasTabError(tabId: string): boolean {
    switch (tabId) {
      case 'basic':
        return this.state.form.get('categorySlug')?.invalid || this.state.form.get('productType')?.invalid || this.state.translationsArray.invalid;
      case 'variants':
        return this.state.variantsArray.invalid;
      default:
        return false;
    }
  }

  readonly activeTab = signal<string>('basic');

  canDeactivate(): boolean {
    if (this.hasUnsavedChanges() && !this.submitting()) {
      return true; // handled by global guard/dialog service
    }
    return true;
  }

  constructor() {
    // ── Draft autosave (UX_AUDIT_products.md #7b) ──────────────────────────
    // The 5-step form is long enough to lose on a stray refresh. Everything
    // that is serialisable is saved a beat after typing stops; files staged
    // for upload live outside the form and are deliberately NOT drafted.
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    this.state.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => this.saveDraft(), 1200);
      });
  }

  // ── Draft storage (rules live in product-draft.ts, unit-tested) ────────

  private draftSlug(): string | null {
    return this.state.isEditMode() ? this.state.editingSlug() : null;
  }

  private saveDraft(): void {
    if (!this.hasUnsavedChanges()) return;
    saveProductDraft(this.draftSlug(), this.state.form.getRawValue());
  }

  private clearDraft(): void {
    clearProductDraft(this.draftSlug());
  }

  /** Offers the draft found for this product; restoring re-dirties the form on purpose. */
  private async offerDraftRestore(): Promise<void> {
    const draft = loadProductDraft(this.draftSlug());
    if (!draft) return;

    const when = formatRelativeTime(draft.savedAt, this.language.language(), { lowercase: true });
    const restore = await this.confirmDialog.confirm({
      title: this.notify.t('products.draft.title', 'Restore unsaved draft?'),
      message: this.notify
        .t('products.draft.message', 'There is an unsaved draft from {{time}}. Restore it?')
        .replace('{{time}}', when),
      confirmLabel: this.notify.t('products.draft.restore', 'Restore draft'),
      cancelLabel: this.notify.t('products.draft.discard', 'Discard draft'),
    });

    if (!restore) {
      this.clearDraft();
      return;
    }
    try {
      this.state.form.patchValue(draft.value as never, { emitEvent: false });
    } catch {
      // The draft no longer matches the form shape (schema change) — drop it.
      this.clearDraft();
    }
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (slug) {
      this.loadingDetail.set(true);
      this.productService.getBySlug(slug).subscribe({
        next: (res) => {
          this.state.loadFromDetail(res.data, (existing: ProductTranslation[]) =>
            this.translationHelper.buildArray(existing, [
              'description',
              'shortDescription',
              'story',
              'metaTitle',
              'metaDescription',
            ]),
          );
          this.loadingDetail.set(false);
          this.applyStepFromUrl();
          void this.offerDraftRestore();
        },
        error: () => {
          this.loadError.set('Could not load product. It may have been deleted.');
          this.loadingDetail.set(false);
        },
      });
    } else {
      this.state.form.setControl(
        'translations',
        this.translationHelper.buildArray([], [
          'description',
          'shortDescription',
          'story',
          'metaTitle',
          'metaDescription',
        ]),
      );
      this.state.captureInitialSnapshot();
      this.applyStepFromUrl();
      void this.offerDraftRestore();
    }
  }

  saveCurrentStep(): void {
    if (this.state.isCurrentStepValid()) {
      this.onSubmit();
    }
  }

  isCurrentStepDirty(): boolean {
    return this.hasUnsavedChanges();
  }

  onTabChange(tabId: string): void {
    const targetIndex = this.stepTabs.findIndex((t) => t.id === tabId);
    if (targetIndex === -1) return;

    if (targetIndex > this.state.currentStep()) {
      if (this.state.isCurrentStepValid()) {
        while (this.state.currentStep() < targetIndex) {
          this.state.goNext();
        }
        this.activeTab.set(tabId);
      } else {
        this.markCurrentStepTouched();
      }
    } else {
      while (this.state.currentStep() > targetIndex) {
        this.state.goBack();
      }
      this.activeTab.set(tabId);
    }
    this.syncStepUrl();
  }

  onNext(): void {
    if (this.state.isCurrentStepValid()) {
      this.state.goNext();
      this.activeTab.set(this.stepTabs[this.state.currentStep()].id);
      this.syncStepUrl();
    } else {
      this.markCurrentStepTouched();
    }
  }

  onBack(): void {
    if (this.state.currentStep() > 0) {
      this.state.goBack();
      this.activeTab.set(this.stepTabs[this.state.currentStep()].id);
      this.syncStepUrl();
    }
  }

  /**
   * The step lives in the URL (?step=media): a refresh keeps the reader on
   * the step they were on instead of restarting at Basic info
   * (UX_AUDIT_products.md #7). The gate is the same as a tab click — a step
   * that does not validate cannot be deep-linked past.
   */
  private syncStepUrl(): void {
    const id = this.stepTabs[this.state.currentStep()]?.id;
    if (!id) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private applyStepFromUrl(): void {
    const id = this.route.snapshot.queryParamMap.get('step');
    if (!id) return;
    if (!this.stepTabs.some((t) => t.id === id)) return;
    if (id === this.stepTabs[this.state.currentStep()]?.id) {
      this.activeTab.set(id);
      return;
    }
    this.onTabChange(id);
  }

  private markCurrentStepTouched(): void {
    if (this.state.currentStep() === 0) {
      this.state.form.get('categorySlug')?.markAsTouched();
      this.state.form.get('productType')?.markAsTouched();
      this.state.translationsArray.markAllAsTouched();
    } else if (this.state.currentStep() === 1) {
      this.state.variantsArray.markAllAsTouched();
    }
  }

  onSubmit(): void {
    if (!this.state.isCurrentStepValid()) {
      this.markCurrentStepTouched();
      return;
    }

    this.submitting.set(true);
    const request = this.buildRequest();
    const stagedMedia = this.state.stagedMedia();
    const mediaFiles = stagedMedia.map((m) => m.file);
    const slug = this.state.editingSlug();

    const call$ =
      this.state.isEditMode() && slug
        ? this.productService.update(slug, request, mediaFiles)
        : this.productService.create(request, mediaFiles);

    const wasEdit = this.state.isEditMode() && !!slug;
    call$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.state.mediaDirty.set(false);
        this.state.form.markAsPristine();
        // The guard compares against the load snapshot, not form.dirty: refresh it, or the
        // redirect after a successful save asks the admin to discard the save they just made.
        this.state.captureInitialSnapshot();
        this.clearDraft();
        this.notify.success(wasEdit ? 'notify.updated' : 'notify.created', wasEdit ? 'Updated successfully' : 'Created successfully');
        this.router.navigate(['/dashboard/products']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not save the product');
      },
    });
  }

  private buildRequest(): ProductRequest {
    const v = this.state.form.value;
    const isCoffee = v.productType === 'COFFEE';

    return {
      categorySlug: v.categorySlug,
      originSlug: v.originSlug || undefined,
      farmSlug: v.farmSlug || undefined,
      productType: v.productType,
      active: v.isActive,
      isActive: v.isActive,
      featured: v.featured,

      translations: this.state.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
        shortDescription: t.shortDescription || undefined,
        story: t.story || undefined,
        metaTitle: t.metaTitle || undefined,
        metaDescription: t.metaDescription || undefined,
      })),

      ogImageUrl: v.ogImageUrl || undefined,

      coffeeDetails: isCoffee
        ? {
            altitude: v.altitude || undefined,
            harvestYear: v.harvestYear || undefined,
            processingMethodSlug: v.processingMethodSlug || undefined,
            roastLevelSlug: v.roastLevelSlug || undefined,
            coffeeVarietySlug: v.coffeeVarietySlug || undefined,
          }
        : undefined,

      variants: this.state.variantsArray.value.map((v: any) => ({
        sku: v.sku,
        price: v.price,
        compareAtPrice: v.compareAtPrice || undefined,
        costPrice: v.costPrice || undefined,
        imageUrl: v.imageUrl || undefined,
        stockQuantity: v.stockQuantity,
        reorderThreshold: v.reorderThreshold ?? undefined,
        isActive: v.isActive,
        optionValueIds: (v.optionPicks ?? [])
          .map((p: any) => (p.valueId != null ? Number(p.valueId) : null))
          .filter((id: number | null): id is number => id != null),
      })),

      tastingNoteSlugs: this.state.tastingNotesArray.value,
      pairingSlugs: this.state.pairingsArray.value,
      tagSlugs: this.state.tagSlugsArray.value,
      relatedProductSlugs: this.state.relatedProductSlugsArray.value,

      media: [
        ...this.state.existingMedia().map((m, index) => ({
          id: m.id,
          type: m.type,
          altText: m.altText || undefined,
          sortOrder: index,
          isPrimary: m.isPrimary,
        })),
        ...this.state.stagedMedia().map((m, index) => ({
          id: undefined,
          type: m.type,
          altText: m.altText || undefined,
          sortOrder: this.state.existingMedia().length + index,
          isPrimary: m.isPrimary,
        })),
      ],

      brewingMethods: this.state.brewingMethodsArray.value.map((bm: any) => ({
        brewingMethodSlug: bm.brewingMethodSlug,
        notes: bm.notes || undefined,
      })),
    };
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/products']);
  }

  viewOnStorefront(): void {
    if (this.state.editingSlug()) {
      window.open(`/products/${this.state.editingSlug()}`, '_blank');
    }
  }

  productNameInCurrentLang(): string {
    const lang = this.language.current();
    const arr = this.state.translationsArray.value as { language: string; name: string }[];
    const t =
      arr.find((x) => (x.language || '').toLowerCase() === lang) ??
      arr.find((x) => (x.language || '').toLowerCase() === 'en') ??
      arr[0];
    return t?.name || this.state.editingName() || this.state.editingSlug() || 'Product';
  }

  arabicName(): string {
    const arr = this.state.translationsArray.value as { language: string; name: string }[];
    return arr.find((x) => (x.language || '').toLowerCase() === 'ar')?.name || '';
  }

  showSecondaryArabicName(): boolean {
    return (
      this.language.current() === 'en' &&
      !!this.arabicName() &&
      this.arabicName() !== this.productNameInCurrentLang()
    );
  }

  isFormValid(): boolean {
    const basicValid = ['categorySlug', 'productType'].every(
      (f) => this.state.form.get(f)?.valid,
    );
    return (
      basicValid &&
      this.state.translationsArray.valid &&
      this.state.variantsArray.length > 0 &&
      this.state.variantsArray.valid
    );
  }

  isTabDirty(tabId: string): boolean {
    if (this.state.initialFormValue === null) return false;
    const cur = this.state.normalize(this.state.form.value);
    const init = this.state.normalize(this.state.initialFormValue);
    const eq = (a: any, b: any) => JSON.stringify(this.state.normalize(a)) === JSON.stringify(this.state.normalize(b));
    switch (tabId) {
      case 'basic':
        return !eq(
          { ...cur, variants: undefined, brewingMethods: undefined, tastingNoteSlugs: undefined, pairingSlugs: undefined, relatedProductSlugs: undefined },
          { ...init, variants: undefined, brewingMethods: undefined, tastingNoteSlugs: undefined, pairingSlugs: undefined, relatedProductSlugs: undefined },
        );
      case 'variants':
        return !eq(cur.variants, init.variants) || !eq(cur.brewingMethods, init.brewingMethods);
      case 'media':
        return this.state.hasMediaChanged();
      case 'tasting-notes':
        return !eq(cur.tastingNoteSlugs, init.tastingNoteSlugs);
      case 'pairings':
        return (
          !eq(cur.pairingSlugs, init.pairingSlugs) ||
          !eq(cur.relatedProductSlugs, init.relatedProductSlugs)
        );
      default:
        return false;
    }
  }

  hasUnsavedChanges(): boolean {
    return this.state.hasFormChanged() || this.state.hasMediaChanged();
  }

  onBackToList(): void {
    this.router.navigate(['/dashboard/products']);
  }

  saveAllTabs(): void {
    if (!this.isFormValid()) {
      const firstInvalid = this.stepTabs.find((t) => this.hasTabError(t.id));
      if (firstInvalid) this.onTabChange(firstInvalid.id);
      this.focusFirstInvalidField();
      return;
    }
    this.onSubmit();
  }

  private focusFirstInvalidField(): void {
    setTimeout(() => {
      const el = document.querySelector(
        '.ng-invalid, [aria-invalid="true"]',
      ) as HTMLElement | null;
      el?.focus();
    }, 0);
  }
}
