import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
import { CanComponentDeactivate } from '../../../../core/guards/unsaved-changes.guard';
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
      lucideSave
    }),
  ],
  templateUrl: './product-wizard.component.html',
})
export class ProductWizardComponent implements CanComponentDeactivate {
  protected state = inject(ProductWizardStateService);
  private productService = inject(ProductService);
  private translationHelper = inject(TranslationFormHelper);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);

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
    if (this.state.form.dirty && !this.submitting()) {
      return window.confirm('You have unsaved changes. Leave anyway?');
    }
    return true;
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (slug) {
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
      this.state.form.setControl(
        'translations',
        this.translationHelper.buildArray([], ['description', 'shortDescription']),
      );
    }
    
    // Subscribe to form changes to track dirty state
    this.state.form.valueChanges.subscribe(() => {
      this.state.form.markAsDirty();
    });
  }

  saveCurrentStep(): void {
    if (this.state.isCurrentStepValid()) {
      this.onSubmit();
    }
  }

  isCurrentStepDirty(): boolean {
    return this.state.form.dirty && !this.state.form.pristine;
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
  }

  onNext(): void {
    if (this.state.isCurrentStepValid()) {
      this.state.goNext();
      this.activeTab.set(this.stepTabs[this.state.currentStep()].id);
    } else {
      this.markCurrentStepTouched();
    }
  }

  onBack(): void {
    if (this.state.currentStep() > 0) {
      this.state.goBack();
      this.activeTab.set(this.stepTabs[this.state.currentStep()].id);
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
      isActive: v.isActive,
      featured: v.featured,

      translations: this.state.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
        shortDescription: t.shortDescription || undefined,
      })),

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
        price: v.price,
        compareAtPrice: v.compareAtPrice || undefined,
        costPrice: v.costPrice || undefined,
        stockQuantity: v.stockQuantity,
        reorderThreshold: v.reorderThreshold ?? undefined,
        isActive: v.isActive,
        optionValueIds: (v.optionPicks ?? [])
          .map((p: any) => (p.valueId != null ? Number(p.valueId) : null))
          .filter((id: number | null): id is number => id != null),
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
}
