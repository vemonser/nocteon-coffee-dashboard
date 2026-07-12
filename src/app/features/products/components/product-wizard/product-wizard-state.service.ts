import { inject, Injectable } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { signal } from '@angular/core';
import { GrindType, ProductDetail, StagedMedia } from '../../models/product.models';
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

  // ─── Staged media files (not yet uploaded — sent together on final submit) ────
  stagedMedia = signal<StagedMedia[]>([]);

  // ─── The single source of truth form, built once ──────────────────────────────
  form: FormGroup = this.fb.group({
    // Step 1 — Basic Info
    categorySlug: ['', Validators.required],
    originSlug: [''],
    farmSlug: [''], // NEW — FK to Farm (optional)
    productType: ['', Validators.required],
    isActive: [true],
    featured: [false],
    translations: this.fb.array([]),

    // Step 1b — Coffee Details (only relevant when productType === 'COFFEE')
    // Kept flat in the form for simplicity (no nested FormGroup needed since
    // backend accepts them in a CoffeeDetailsRequest but they're all optional).
    altitude: [null],
    harvestYear: [''],
    processingMethodSlug: [''],
    roastLevelSlug: [''],
    story: [''],
    coffeeVarietySlug: [''],

    // Step 2 — Variants
    variants: this.fb.array([], Validators.minLength(1)),

    // Step 3 — Brewing Methods (each has a slug + optional notes)
    brewingMethods: this.fb.array([]),

    // Step 4 — Tasting Notes (slugs only, simplified)
    tastingNoteSlugs: this.fb.array([]),

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
  get pairingsArray(): FormArray {
    return this.form.get('pairingSlugs') as FormArray;
  }

  // ─── Variant helpers ────────────────────────────────────────────────────────────

  buildVariantGroup(v?: {
    sku?: string;
    grindType?: GrindType;
    weightGrams?: number;
    price?: number;
    compareAtPrice?: number | null;
    stockQuantity?: number;
    isActive?: boolean;
  }): FormGroup {
    return this.fb.group({
      sku: [v?.sku ?? '', Validators.required],
      grindType: [v?.grindType ?? '', Validators.required],
      weightGrams: [v?.weightGrams ?? null, [Validators.required, Validators.min(1)]],
      price: [v?.price ?? null, [Validators.required, Validators.min(0)]],
      compareAtPrice: [v?.compareAtPrice ?? null],
      stockQuantity: [v?.stockQuantity ?? 0, [Validators.required, Validators.min(0)]],
      isActive: [v?.isActive ?? true],
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
    const hasAnyPrimary =
      this.existingMedia().some((m) => m.isPrimary) || this.stagedMedia().some((m) => m.isPrimary);

    this.stagedMedia.update((list) => [
      ...list,
      { ...media, isPrimary: !hasAnyPrimary && media.type === 'IMAGE' },
    ]);
  }

  removeStagedMedia(index: number): void {
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
    this.existingMedia.update((media) => media.filter((_, i) => i !== index));
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

    this.form.patchValue({
      categorySlug: detail.categorySlug,
      originSlug: detail.originSlug ?? '',
      farmSlug: detail.farmSlug ?? '', // NEW
      productType: detail.productType,
      isActive: detail.isActive,
      featured: detail.featured,

      altitude: detail.coffeeDetails?.altitude ?? null,
      harvestYear: detail.coffeeDetails?.harvestYear ?? '',
      processingMethodSlug: detail.coffeeDetails?.processingMethodSlug ?? '',
      roastLevelSlug: detail.coffeeDetails?.roastLevelSlug ?? '',
      coffeeVarietySlug: detail.coffeeDetails?.coffeeVarietySlug ?? '',
      story: detail.coffeeDetails?.story ?? '',
    });

    this.form.setControl('translations', buildTranslations(detail.translations));

    this.variantsArray.clear();
    detail.variants.forEach((v) => this.variantsArray.push(this.buildVariantGroup(v)));

    this.brewingMethodsArray.clear(); // NEW
    detail.brewingMethods.forEach(
      (bm) =>
        // NEW
        this.brewingMethodsArray.push(this.buildBrewingMethodGroup(bm)), // NEW
    ); // NEW

    this.existingMedia.set(detail.media);

    this.tastingNotesArray.clear();
    detail.tastingNotes.forEach((slug) => {
      if (slug) this.tastingNotesArray.push(this.fb.control(slug));
    });

    this.pairingsArray.clear();
    detail.pairings.forEach((slug) => {
      if (slug) this.pairingsArray.push(this.fb.control(slug));
    });
      
  }

  /** Resets everything — call when leaving the wizard or starting create mode fresh. */
  reset(): void {
    this.currentStep.set(0);
    this.isEditMode.set(false);
    this.editingSlug.set(null);
    this.stagedMedia.set([]);
    this.existingMedia.set([]);
    this.variantsArray.clear();
    this.brewingMethodsArray.clear();
    this.tastingNotesArray.clear();
    this.pairingsArray.clear();
    this.translationsArray.clear();
    this.form.reset({ isActive: true, featured: false });
  }
  setPrimaryMedia(source: 'existing' | 'staged', index: number): void {
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
    this.stagedMedia.update((media) =>
      media.map((item, i) => (i === index ? { ...item, altText } : item)),
    );
  }
  updateMediaType(index: number, type: 'IMAGE' | 'VIDEO'): void {
    this.stagedMedia.update((media) =>
      media.map((item, i) => (i === index ? { ...item, type } : item)),
    );
  }
}
