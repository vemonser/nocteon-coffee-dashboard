import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-product-wizard',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BasicInfoStepComponent,
    VariantsStepComponent,
    MediaStepComponent,
    TastingNotesStepComponent,
    PairingsStepComponent,
  ],
  providers: [ProductWizardStateService],
  templateUrl: './product-wizard.component.html',
  styleUrl: './product-wizard.component.css',
})
export class ProductWizardComponent implements OnInit {
  protected state = inject(ProductWizardStateService);
  private productService = inject(ProductService);
  private translationHelper = inject(TranslationFormHelper);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loadingDetail = signal(false);
  submitting = signal(false);
  loadError = signal<string | null>(null);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (slug) {
      // Edit mode — fetch full detail ONCE, then populate every step's form.
      this.loadingDetail.set(true);
      this.productService.getBySlug(slug).subscribe({
        next: (res) => {
          this.state.loadFromDetail(res.data, (existing: ProductTranslation[]) =>
            this.translationHelper.buildArray(existing, ['description', 'shortDescription']),
          );
          this.loadingDetail.set(false);
        },
        error: () => {
          this.loadError.set('Could not load product. It may have been deleted.');
          this.loadingDetail.set(false);
        },
      });
    } else {
      // Create mode — fresh form, translations array still needs building
      // (state service doesn't know about TranslationFormHelper to avoid coupling).
      this.state.form.setControl(
        'translations',
        this.translationHelper.buildArray([], ['description', 'shortDescription']),
      );
    }
  }

  // ─── Step navigation guards ───────────────────────────────────────────────────

  onNext(): void {
    if (this.state.isCurrentStepValid()) {
      this.state.goNext();
    } else {
      // Surface validation errors for the current step
      this.markCurrentStepTouched();
    }
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

  // ─── Final submit — only available on the last step ──────────────────────────

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

    call$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/dashboard/products']);
      },
      error: () => this.submitting.set(false),
    });
  }

  private buildRequest(): ProductRequest {
    const v = this.state.form.value;
    const isCoffee = v.productType === 'COFFEE';

    return {
      categorySlug: v.categorySlug,
      originSlug: v.originSlug || undefined,
      farmSlug: v.farmSlug || undefined, // NEW
      productType: v.productType,
      isActive: v.isActive,
      featured: v.featured,

      translations: this.state.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
        shortDescription: t.shortDescription || undefined,
      })),

      // NEW — only send coffeeDetails when productType is COFFEE.
      // Sending it for EQUIPMENT is harmless (backend ignores it) but
      // omitting it makes the payload cleaner and the intent clearer.
      coffeeDetails: isCoffee
        ? {
            altitude: v.altitude || undefined,
            harvestYear: v.harvestYear || undefined,
            processingMethodSlug: v.processingMethodSlug || undefined,
            roastLevelSlug: v.roastLevelSlug || undefined,
            story: v.story || undefined,
            coffeeVarietySlug: v.coffeeVarietySlug || undefined,
          }
        : undefined,

      variants: this.state.variantsArray.value.map((v: any) => ({
        sku: v.sku,
        weightGrams: v.weightGrams,
        grindType: v.grindType,
        price: v.price,
        compareAtPrice: v.compareAtPrice || undefined,
        stockQuantity: v.stockQuantity,
        isActive: v.isActive,
      })),

      tastingNoteSlugs: this.state.tastingNotesArray.value,

      pairingSlugs: this.state.pairingsArray.value,

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
      // NEW — brewing methods with optional notes per method
      brewingMethods: this.state.brewingMethodsArray.value.map((bm: any) => ({
        brewingMethodSlug: bm.brewingMethodSlug,
        notes: bm.notes || undefined,
      })),
    };
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/products']);
  }
}
