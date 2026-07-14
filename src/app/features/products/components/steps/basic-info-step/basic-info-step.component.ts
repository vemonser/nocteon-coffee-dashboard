import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';

import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';

import { ProductType } from '../../../models/product.models';
import { TranslationFormHelper } from '../../../../../shared/utils/translation.utils';
import { CategoryService } from '../../../../categories/services/category.service';
import { OriginService } from '../../../../origins/services/origin.service';
import { CategoryResponse } from '../../../../categories/models/category.model';
import { OriginOption, OriginResponse } from '../../../../origins/models/origin.model';
import { FarmResponse } from '../../../../farms/models/farm.model';
import { RoastLevelRequest,RoastLevelResponse } from '../../../../roast-level/models/roast-level.model';
import { ProcessingMethodResponse } from '../../../../processing-method/models/processing-method.model';
import { CoffeeVarietyResponse } from '../../../../coffee-variety/models/coffee-variety.model';
import { FarmService } from '../../../../farms/services/farm.service';
import { RoastLevelService } from '../../../../roast-level/services/roast-level.service';
import { ProcessingMethodService } from '../../../../processing-method/services/processing-method.service';
import { CoffeeVarietyService } from '../../../../coffee-variety/services/coffee-variety.service';

/**
 * Step 1 — Category, Origin, Product Type, Status flags, Translations.
 * Reads/writes directly into the shared ProductWizardStateService.form,
 * which is provided by the parent wizard container (not re-provided here).
 */
@Component({
  selector: 'app-basic-info-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './basic-info-step.component.html',
})
export class BasicInfoStepComponent {
  protected state = inject(ProductWizardStateService);
  protected translationHelper = inject(TranslationFormHelper);

  private categoryService       = inject(CategoryService);
  private originService         = inject(OriginService);
  private farmService           = inject(FarmService);
  private roastLevelService     = inject(RoastLevelService);
  private processingMethodService = inject(ProcessingMethodService);
  private coffeeVarietyService  = inject(CoffeeVarietyService);

  // ─── Dropdown data ────────────────────────────────────────────────────────────
  categories        = signal<CategoryResponse[]>([]);
  origins           = signal<OriginOption[]>([]);
  farms             = signal<FarmResponse[]>([]);
  roastLevels       = signal<RoastLevelResponse[]>([]);
  processingMethods = signal<ProcessingMethodResponse[]>([]);
  coffeeVarieties   = signal<CoffeeVarietyResponse[]>([]);

  readonly productTypes: ProductType[] = ['COFFEE', 'EQUIPMENT'];

  constructor() {
    // All lookups loaded on mount — these are small reference tables
    // (<<200 rows each) so fetching all upfront is fine, no search needed.
    this.categoryService.getAll({ size: 200, isActive: true })
      .subscribe({ next: (r) => this.categories.set(r.data.content) });

    this.originService.getAllOptions()
      .subscribe({ next: (r) => this.origins.set(r.data) });

    this.farmService.getAll({ size: 200 })
      .subscribe({ next: (r) => this.farms.set(r.data.content) });

    this.roastLevelService.getAll({ size: 200 })
      .subscribe({ next: (r) => this.roastLevels.set(r.data.content) });

    // Coffee-specific lookups — still loaded even for EQUIPMENT products
    // since productType may change during editing. Cost is negligible.
    this.processingMethodService.getAll({ size: 200 })
      .subscribe({ next: (r) => this.processingMethods.set(r.data.content) });

 
    this.coffeeVarietyService.getAll({ size: 200 })
      .subscribe({ next: (r) => this.coffeeVarieties.set(r.data.content) });
  }

  // ─── Computed: is this a coffee product? ─────────────────────────────────────
  // Used to conditionally show the coffee details section in the template.
  get isCoffee(): boolean {
    return this.state.form.get('productType')?.value === 'COFFEE';
  }

  // ─── Display helpers ─────────────────────────────────────────────────────────
  private enName(translations: { language: string; name: string }[], fallback: string): string {
    return translations.find((t) => t.language === 'en')?.name ?? fallback;
  }

  getCategoryName(slug: string): string {
    const c = this.categories().find((c) => c.slug === slug);
    return c ? this.enName(c.translations, slug) : slug;
  }

  getOriginName(slug: string): string {
    const o = this.origins().find((o) => o.slug === slug);
  return o?.name ?? slug;  
  }

  getFarmName(slug: string): string {
    const f = this.farms().find((f) => f.slug === slug);
    return f ? this.enName(f.translations, slug) : slug;
  }

  getRoastLevelName(slug: string): string {
    const r = this.roastLevels().find((r) => r.slug === slug);
    return r ? this.enName(r.translations, slug) : slug;
  }

  getProcessingMethodName(slug: string): string {
    const p = this.processingMethods().find((p) => p.slug === slug);
    return p ? this.enName(p.translations, slug) : slug;
  }

  getCoffeeVarietyName(slug: string): string {
    const v = this.coffeeVarieties().find((v) => v.slug === slug);
    return v ? this.enName(v.translations, slug) : slug;
  }
}
