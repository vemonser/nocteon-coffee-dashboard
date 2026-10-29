import { inject, Injectable } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { signal } from '@angular/core';
import { ProductDetail, ProductVariant, RelatedProductSummary, StagedMedia } from '../../models/product.models';
import { ProductOption, ProductOptionValueSummary } from '../../../product-options/models/product-option.model';
import { ExistingMedia } from '../../models/product.models';
/**
 * Holds the wizard's shared state across all 5 steps.
 *
 * Why a dedicated service instead of putting everything in the container
 * component: each step is a separate child component (cleaner template,
 * easier to test in isolation). They all need to read/write the SAME
 * form — a service is the simplest way to share it without prop-drilling
 * through 5 levels or using @Input/@Output chains.
 *
 * Scoped to the wizard route only (provided in the wizard container,
 * NOT providedIn: 'root') so state resets when the user leaves the wizard.
 */
@Injectable()
export class ProductWizardStateService {
  private fb = inject(FormBuilder);
  // ─── Wizard navigation state ───────────────────────────────────────────────────
  currentStep = signal(0);
  readonly steps = ['Basic Info', 'Variants', 'Media', 'Tasting Notes', 'Pairings'];

  // ─── Mode ────────────────────────────────────────────────────────────────────
  isEditMode = signal(false);
  editingSlug = signal<string | null>(null);
  editingName = signal<string | null>(null);

  // ─── Staged media files (not yet uploaded — sent together on final submit) ────
  stagedMedia = signal<StagedMedia[]>([]);
  /** Media lives outside the reactive form, so it tracks dirty separately. */
  readonly mediaDirty = signal(false);
  /** Normalized snapshot of the form value captured on load/create, used for dirty comparison. */
  initialFormValue: any = null;
  initialMediaSnapshot: string | null = null;

  // ─── The single source of truth form, built once ──────────────────────────────
  form: FormGroup = this.fb.group({
    // Step 1 — Basic Info
    categorySlug: ['', Validators.required],
    originSlug: [''],
    farmSlug: [''], // NEW — FK to Farm (optional)
    productType: ['', Validators.required],
    isActive: [true],
    featured: [false],
    /** Product-level social card. Empty = use the primary image. */
    ogImageUrl: [''],
    translations: this.fb.array([]),

    // Step 1b — Coffee Details (only relevant when productType === 'COFFEE')
    // Kept flat in the form for simplicity (no nested FormGroup needed since
    // backend accepts them in a CoffeeDetailsRequest but they're all optional).
    altitude: [null],
    harvestYear: [''],
    processingMethodSlug: [''],
    roastLevelSlug: [''],
    coffeeVarietySlug: [''],

    // Step 2 — Variants
    variants: this.fb.array([], Validators.minLength(1)),

    // Step 3 — Brewing Methods (each has a slug + optional notes)
    brewingMethods: this.fb.array([]),

    // Step 4 — Tasting Notes (slugs only, simplified)
    tastingNoteSlugs: this.fb.array([]),

    // Merchandising tags (slugs only). Optional; assigned from the tag vocabulary.
    tagSlugs: this.fb.array([]),

    // "You may also like" (FE-11): slugs, ordered, at most 6.
    relatedProductSlugs: this.fb.array([]),

    // Step 5 — Pairings (slugs only)
    pairingSlugs: this.fb.array([]),
  });

  // ─── 2. Add new getter ────────────────────────────────────────────────────────
  //
  // Add alongside existing getters (translationsArray, variantsArray, etc.)

  get brewingMethodsArray(): FormArray {
    return this.form.get('brewingMethods') as FormArray;
  }

  get translationsArray(): FormArray {
    return this.form.get('translations') as FormArray;
  }
  get variantsArray(): FormArray {
    return this.form.get('variants') as FormArray;
  }
  get tastingNotesArray(): FormArray {
    return this.form.get('tastingNoteSlugs') as FormArray;
  }
  /** FE-10: the merchandising tags this product carries, by slug. */
  get tagSlugsArray(): FormArray {
    return this.form.get('tagSlugs') as FormArray;
  }

  /** FE-11: the display data for the selected related products (slug, name, thumbnail). */
  readonly relatedProducts = signal<RelatedProductSummary[]>([]);

  get relatedProductSlugsArray(): FormArray {
    return this.form.get('relatedProductSlugs') as FormArray;
  }

  hasRelated(slug: string): boolean {
    return (this.relatedProductSlugsArray.value as string[]).includes(slug);
  }

  addRelated(summary: RelatedProductSummary): void {
    if (!summary?.slug || this.hasRelated(summary.slug)) return;
    if ((this.relatedProductSlugsArray.value as string[]).length >= 6) return;
    this.relatedProductSlugsArray.push(this.fb.control(summary.slug));
    this.relatedProducts.update((list) => [...list, summary]);
  }

  removeRelated(slug: string): void {
    const index = (this.relatedProductSlugsArray.value as string[]).indexOf(slug);
    if (index !== -1) this.relatedProductSlugsArray.removeAt(index);
    this.relatedProducts.update((list) => list.filter((item) => item.slug !== slug));
  }

  hasTag(slug: string): boolean {
    return this.tagSlugsArray.value.includes(slug);
  }

  toggleTag(slug: string): void {
    const index = (this.tagSlugsArray.value as string[]).indexOf(slug);
    if (index === -1) this.tagSlugsArray.push(this.fb.control(slug));
    else this.tagSlugsArray.removeAt(index);
  }
  get pairingsArray(): FormArray {
    return this.form.get('pairingSlugs') as FormArray;
  }

  // ─── Variant helpers ────────────────────────────────────────────────────────────

  /** Product options (e.g. Weight → 250g/500g) loaded once by the variants step. */
  productOptions = signal<ProductOption[]>([]);

  private pendingEditPicks: { optionSlug: string; valueSlug: string }[][] = [];

  /** True when at least one variant has picked at least one option value. */
  static atLeastOneValueSelected(control: AbstractControl): { noValues: true } | null {
    const picks = (control as FormArray).value as { valueId: string | number | null }[];
    return picks.some((p) => p.valueId != null) ? null : { noValues: true };
  }

  /** Assign loaded options and resolve edit-mode picks from slug pairs. */
  setProductOptions(options: ProductOption[]): void {
    this.productOptions.set(options);
    this.applyEditOptionPicks();
  }

  private applyEditOptionPicks(): void {
    if (this.pendingEditPicks.length === 0) return;

    const opts = this.productOptions();
    this.variantsArray.controls.forEach((variant, vi) => {
      const picks = variant.get('optionPicks') as FormArray;
      picks.clear();
      for (const pair of this.pendingEditPicks[vi] ?? []) {
        const option = opts.find((o) => o.slug === pair.optionSlug);
        const value = option?.values.find((v) => v.slug === pair.valueSlug);
        if (option && value) {
          picks.push(
            this.fb.group({
              optionId: [option.id],
              valueId: [String(value.id)],
            }),
          );
        }
      }
    });
    this.pendingEditPicks = [];
    if (this.isEditMode()) {
      this.captureInitialSnapshot();
    }
  }

  static compareAtGreaterThanPrice(control: AbstractControl): ValidationErrors | null {
    const group = control.parent as FormGroup | null;
    if (!group) return null;
    const price = group.get('price')?.value;
    const compare = control.value;
    if (compare == null || compare === '' || price == null) return null;
    return Number(compare) > Number(price) ? null : { compareAtNotGreater: true };
  }

  buildVariantGroup(v?: Partial<ProductVariant>): FormGroup {
    return this.fb.group({
      sku: [v?.sku ?? '', Validators.required],
      price: [v?.price ?? null, [Validators.required, Validators.min(0.01)]],
      compareAtPrice: [v?.compareAtPrice ?? null, [ProductWizardStateService.compareAtGreaterThanPrice]],
      costPrice: [v?.costPrice ?? null],
      imageUrl: [v?.imageUrl ?? ''],
      stockQuantity: [v?.stockQuantity ?? 0, [Validators.required, Validators.min(0)]],
      reorderThreshold: [v?.reorderThreshold ?? 5, [Validators.min(0)]],
      isActive: [v?.isActive ?? true],
      optionPicks: this.fb.array([], ProductWizardStateService.atLeastOneValueSelected),
    });
  }

  /** A single "option → valueId" selection inside a variant's optionPicks array. */
  buildVariantPickGroup(optionId: number): FormGroup {
    return this.fb.group({
      optionId: [optionId],
      valueId: [null],
    });
  }

  buildBrewingMethodGroup(bm?: { brewingMethodSlug?: string; notes?: string }): FormGroup {
    return this.fb.group({
      brewingMethodSlug: [bm?.brewingMethodSlug ?? '', Validators.required],
      notes: [bm?.notes ?? ''],
    });
  }

  addBrewingMethod(): void {
    this.brewingMethodsArray.push(this.buildBrewingMethodGroup());
  }

  removeBrewingMethod(index: number): void {
    this.brewingMethodsArray.removeAt(index);
  }
  addVariant(): void {
    this.variantsArray.push(this.buildVariantGroup());
  }

  removeVariant(index: number): void {
    this.variantsArray.removeAt(index);
  }

  // ─── Existing media (already uploaded, has a URL) — kept separately from staged files
  existingMedia = signal<ExistingMedia[]>([]);

  addStagedMedia(media: StagedMedia): void {
    this.mediaDirty.set(true);
    const hasAnyPrimary =
      this.existingMedia().some((m) => m.isPrimary) || this.stagedMedia().some((m) => m.isPrimary);

    this.stagedMedia.update((list) => [
      ...list,
      { ...media, isPrimary: !hasAnyPrimary && media.type === 'IMAGE' },
    ]);
  }

  removeStagedMedia(index: number): void {
    this.mediaDirty.set(true);
    this.stagedMedia.update((media) =>
      media
        .filter((_, i) => i !== index)
        .map((m, i) => ({
          ...m,
          sortOrder: i,
        })),
    );
  }

  removeExistingMedia(index: number): void {
    this.mediaDirty.set(true);
    this.existingMedia.update((media) =>
      media
        .filter((_, i) => i !== index)
        .map((m, i) => ({ ...m, sortOrder: i })),
    );
  }

  reorderExistingMedia(from: number, to: number): void {
    if (from === to) return;
    this.mediaDirty.set(true);
    this.existingMedia.update((media) => {
      const next = [...media];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
  }

  reorderStagedMedia(from: number, to: number): void {
    if (from === to) return;
    this.mediaDirty.set(true);
    this.stagedMedia.update((media) => {
      const next = [...media];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  goNext(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update((s) => s + 1);
    }
  }

  goBack(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
    }
  }

  goToStep(index: number): void {
    this.currentStep.set(index);
  }

  /**
   * Per-step validity check, used to gate the "Next" button.
   * Only Step 0 (basic info) and Step 1 (variants) are hard-required;
   * media/tasting-notes/pairings are optional.
   */
  isCurrentStepValid(): boolean {
    switch (this.currentStep()) {
      case 0: {
        const basicFields = ['categorySlug', 'productType'];
        const basicValid = basicFields.every((f) => this.form.get(f)?.valid);
        const translationsValid = this.translationsArray.valid;
        return basicValid && translationsValid;
      }
      case 1:
        return this.variantsArray.length > 0 && this.variantsArray.valid;
      default:
        return true;
    }
  }

  /**
   * Loads an existing product into the form for edit mode.
   * Called once when the wizard is opened with a slug.
   */
  loadFromDetail(detail: ProductDetail, buildTranslations: (existing: any[]) => FormArray): void {
    this.isEditMode.set(true);
    this.editingSlug.set(detail.slug);
    const t = detail.translations.find((x) => x.language === 'en') ?? detail.translations[0];
    this.editingName.set(t?.name ?? detail.slug);

    this.form.patchValue({
      categorySlug: detail.categorySlug,
      originSlug: detail.originSlug ?? '',
      farmSlug: detail.farmSlug ?? '', // NEW
      productType: detail.productType,
      isActive: detail.active ?? detail.isActive ?? true,
      featured: detail.featured,
      ogImageUrl: detail.ogImageUrl ?? '',

      altitude: detail.coffeeDetails?.altitude ?? null,
      harvestYear: detail.coffeeDetails?.harvestYear ?? '',
      processingMethodSlug: detail.coffeeDetails?.processingMethodSlug ?? '',
      roastLevelSlug: detail.coffeeDetails?.roastLevelSlug ?? '',
      coffeeVarietySlug: detail.coffeeDetails?.coffeeVarietySlug ?? '',
    });

    this.form.setControl('translations', buildTranslations(detail.translations));

    this.variantsArray.clear();
    this.pendingEditPicks = [];
    detail.variants.forEach((v) => {
      this.variantsArray.push(
        this.buildVariantGroup({
          ...v,
          isActive: v.active ?? v.isActive ?? true,
        }),
      );
      this.pendingEditPicks.push(collectOptionPicks(v.optionValues));
    });
    // Options may already be loaded (order varies); resolve immediately if so.
    if (this.productOptions().length > 0) this.applyEditOptionPicks();

    this.brewingMethodsArray.clear(); // NEW
    detail.brewingMethods.forEach(
      (bm) =>
        // NEW
        this.brewingMethodsArray.push(this.buildBrewingMethodGroup(bm)), // NEW
    ); // NEW

    this.existingMedia.set(
      (detail.media ?? []).map((m) => ({
        ...m,
        isPrimary: m.isPrimary ?? !!m.primary,
      })),
    );

    this.tastingNotesArray.clear();
    detail.tastingNotes.forEach((slug) => {
      if (slug) this.tastingNotesArray.push(this.fb.control(slug));
    });

    this.tagSlugsArray.clear();
    (detail.tags ?? []).forEach((tag) => {
      if (tag?.slug) this.tagSlugsArray.push(this.fb.control(tag.slug));
    });

    this.relatedProductSlugsArray.clear();
    const related = detail.relatedProducts ?? [];
    related.forEach((item) => {
      if (item?.slug) this.relatedProductSlugsArray.push(this.fb.control(item.slug));
    });
    this.relatedProducts.set([...related]);

    this.pairingsArray.clear();
    detail.pairings.forEach((slug) => {
      if (slug) this.pairingsArray.push(this.fb.control(slug));
    });
    this.captureInitialSnapshot();
      
  }

  /** Normalize values (trim strings, empty->null, numbers) for stable comparison. */
  normalize(value: any): any {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const t = value.trim();
      return t === '' ? null : t;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (Array.isArray(value)) return value.map((v) => this.normalize(v));
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(value)) {
        out[k] = this.normalize(value[k]);
      }
      return out;
    }
    return value;
  }

  captureInitialSnapshot(): void {
    this.initialFormValue = this.normalize(this.form.value);
    this.initialMediaSnapshot = JSON.stringify(this.existingMedia());
  }

  hasFormChanged(): boolean {
    if (this.initialFormValue === null) return this.form.dirty;
    return JSON.stringify(this.normalize(this.form.value)) !== JSON.stringify(this.initialFormValue);
  }

  hasMediaChanged(): boolean {
    if (this.initialMediaSnapshot === null) return this.mediaDirty();
    return this.mediaDirty() || JSON.stringify(this.existingMedia()) !== this.initialMediaSnapshot || this.stagedMedia().length > 0;
  }

  /** Resets everything — call when leaving the wizard or starting create mode fresh. */
  reset(): void {
    this.currentStep.set(0);
    this.isEditMode.set(false);
    this.editingSlug.set(null);
    this.stagedMedia.set([]);
    this.mediaDirty.set(false);
    this.existingMedia.set([]);
    this.variantsArray.clear();
    this.brewingMethodsArray.clear();
    this.tastingNotesArray.clear();
    this.tagSlugsArray.clear();
    this.relatedProductSlugsArray.clear();
    this.relatedProducts.set([]);
    this.pairingsArray.clear();
    this.translationsArray.clear();
    this.productOptions.set([]);
    this.pendingEditPicks = [];
    this.form.reset({ isActive: true, featured: false, ogImageUrl: '' });
  }
  setPrimaryMedia(source: 'existing' | 'staged', index: number): void {
    this.mediaDirty.set(true);
    // امنع الفيديو يبقى primary من أساسه
    if (source === 'staged' && this.stagedMedia()[index]?.type === 'VIDEO') return;
    if (source === 'existing' && this.existingMedia()[index]?.type === 'VIDEO') return;

    this.existingMedia.update((media) =>
      media.map((item, i) => ({
        ...item,
        isPrimary: source === 'existing' && i === index,
      })),
    );

    this.stagedMedia.update((media) =>
      media.map((item, i) => ({
        ...item,
        isPrimary: source === 'staged' && i === index,
      })),
    );
  }

  private reassignPrimaryIfNeeded(): void {
    const hasExistingPrimary = this.existingMedia().some((m) => m.isPrimary);
    const hasStagedPrimary = this.stagedMedia().some((m) => m.isPrimary);

    if (hasExistingPrimary || hasStagedPrimary) return;

    const firstExistingImage = this.existingMedia().findIndex((m) => m.type === 'IMAGE');
    if (firstExistingImage !== -1) {
      this.existingMedia.update((media) =>
        media.map((item, i) => ({ ...item, isPrimary: i === firstExistingImage })),
      );
      return;
    }

    const firstStagedImage = this.stagedMedia().findIndex((m) => m.type === 'IMAGE');
    if (firstStagedImage !== -1) {
      this.stagedMedia.update((media) =>
        media.map((item, i) => ({ ...item, isPrimary: i === firstStagedImage })),
      );
    }
  }

  updateAltText(index: number, altText: string): void {
    this.mediaDirty.set(true);
    this.stagedMedia.update((media) =>
      media.map((item, i) => (i === index ? { ...item, altText } : item)),
    );
  }
  updateExistingAltText(index: number, altText: string): void {
    this.mediaDirty.set(true);
    this.existingMedia.update((media) =>
      media.map((item, i) => (i === index ? { ...item, altText } : item)),
    );
  }
  updateMediaType(index: number, type: 'IMAGE' | 'VIDEO'): void {
    this.stagedMedia.update((media) =>
      media.map((item, i) => (i === index ? { ...item, type } : item)),
    );
  }
}

function collectOptionPicks(
  optionValues: ProductOptionValueSummary[],
): { optionSlug: string; valueSlug: string }[] {
  return optionValues.map((ov) => ({ optionSlug: ov.optionSlug, valueSlug: ov.valueSlug }));
}
