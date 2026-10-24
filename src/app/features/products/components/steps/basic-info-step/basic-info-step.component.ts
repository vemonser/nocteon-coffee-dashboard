import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { ProductType } from '../../../models/product.models';
import { TranslationFormHelper } from '../../../../../shared/utils/translation.utils';
import { CategoryService } from '../../../../categories/services/category.service';
import { OriginService } from '../../../../origins/services/origin.service';
import { CategoryResponse } from '../../../../categories/models/category.model';
import { OriginOption } from '../../../../origins/models/origin.model';
import { FarmResponse } from '../../../../farms/models/farm.model';
import { RoastLevelResponse } from '../../../../roast-level/models/roast-level.model';
import { ProcessingMethodResponse } from '../../../../processing-method/models/processing-method.model';
import { CoffeeVarietyResponse } from '../../../../coffee-variety/models/coffee-variety.model';
import { FarmService } from '../../../../farms/services/farm.service';
import { RoastLevelService } from '../../../../roast-level/services/roast-level.service';
import { ProcessingMethodService } from '../../../../processing-method/services/processing-method.service';
import { CoffeeVarietyService } from '../../../../coffee-variety/services/coffee-variety.service';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil } from '@ng-icons/lucide';
import { LanguageService } from '../../../../../core/i18n/language.service';

@Component({
  selector: 'app-basic-info-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HlmSelectImports,
    HlmInputImports,
    HlmLabel,
    HlmCheckboxImports,
    HlmSwitchImports,
    TranslocoPipe,
    NgIcon,
  ],
  providers: [provideIcons({ lucidePencil })],
  templateUrl: './basic-info-step.component.html',
})
export class BasicInfoStepComponent {
  protected state = inject(ProductWizardStateService);
  protected translationHelper = inject(TranslationFormHelper);
  private wizard = inject(ProductWizardComponent);

  private categoryService = inject(CategoryService);
  private originService = inject(OriginService);
  private farmService = inject(FarmService);
  private roastLevelService = inject(RoastLevelService);
  private processingMethodService = inject(ProcessingMethodService);
  private coffeeVarietyService = inject(CoffeeVarietyService);
  private notify = inject(NotifyService);
  private transloco = inject(TranslocoService);
  private language = inject(LanguageService);

  categories = signal<CategoryResponse[]>([]);
  origins = signal<OriginOption[]>([]);
  farms = signal<FarmResponse[]>([]);
  roastLevels = signal<RoastLevelResponse[]>([]);
  processingMethods = signal<ProcessingMethodResponse[]>([]);
  coffeeVarieties = signal<CoffeeVarietyResponse[]>([]);

  readonly harvestYears: number[] = Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i);

  readonly productTypes: { value: ProductType }[] = [
    { value: 'COFFEE' },
    { value: 'EQUIPMENT' },
  ];

  readonly activeLanguage = signal<'en' | 'ar'>('en');
  readonly slugUnlocked = signal(false);
  readonly translationLanguages: { code: 'en' | 'ar'; label: string; dir: 'ltr' | 'rtl' }[] = [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'ar', label: 'العربي', dir: 'rtl' },
  ];

  readonly productTypeLabel = (value: string): string =>
    value ? this.transloco.translate(`products.form.productTypes.${value}`) : '';
  readonly categoryLabel = (value: string): string => this.getCategoryName(value);
  readonly originLabel = (value: string): string => this.getOriginName(value);
  readonly farmLabel = (value: string): string => this.getFarmName(value);
  readonly roastLevelLabel = (value: string): string => this.getRoastLevelName(value);
  readonly processingMethodLabel = (value: string): string =>
    this.getProcessingMethodName(value);
  readonly coffeeVarietyLabel = (value: string): string => this.getCoffeeVarietyName(value);

  isTranslationComplete(code: string): boolean {
    const group = this.state.translationsArray.controls.find(
      (c) => c.get('language')?.value === code,
    );
    return String(group?.get('name')?.value ?? '').trim().length >= 2;
  }

  constructor() {
    // A failed preload must not look like an empty catalog: toast on error.
    const onErr = (what: string) => (err: unknown) =>
      this.notify.apiError(err, 'notify.errorFallback', `Could not load ${what}`);

    this.categoryService.getAll({ size: 200, isActive: true }).subscribe({
      next: (r) => this.categories.set(r.data.content),
      error: onErr('categories'),
    });

    this.originService.getAllOptions().subscribe({
      next: (r) => this.origins.set(r.data),
      error: onErr('origins'),
    });

    this.farmService.getAll({ size: 200 }).subscribe({
      next: (r) => this.farms.set(r.data.content),
      error: onErr('farms'),
    });

    this.roastLevelService.getAll({ size: 200 }).subscribe({
      next: (r) => this.roastLevels.set(r.data.content),
      error: onErr('roast levels'),
    });

    this.processingMethodService.getAll({ size: 200 }).subscribe({
      next: (r) => this.processingMethods.set(r.data.content),
      error: onErr('processing methods'),
    });

    this.coffeeVarietyService.getAll({ size: 200 }).subscribe({
      next: (r) => this.coffeeVarieties.set(r.data.content),
      error: onErr('coffee varieties'),
    });
  }

  get isCoffee(): boolean {
    return this.state.form.get('productType')?.value === 'COFFEE';
  }

  saveCurrentStep(): void {
    this.wizard.saveCurrentStep();
  }

  onCancel(): void {
    this.wizard.onCancel();
  }

  isCurrentStepDirty(): boolean {
    return this.wizard.isCurrentStepDirty();
  }

  isCurrentStepValid(): boolean {
    return this.state.isCurrentStepValid();
  }

  private localizedName(
    translations: { language: string; name: string }[],
    fallback: string,
  ): string {
    const lang = this.language.current();
    return (
      translations.find((t) => t.language?.toLowerCase() === lang)?.name ??
      translations.find((t) => t.language?.toLowerCase() === 'en')?.name ??
      translations[0]?.name ??
      fallback
    );
  }

  getCategoryName(slug: string): string {
    const c = this.categories().find((c) => c.slug === slug);
    return c ? this.localizedName(c.translations, slug) : slug;
  }

  getOriginName(slug: string): string {
    const o = this.origins().find((o) => o.slug === slug);
    return o?.name ?? slug;
  }

  getFarmName(slug: string): string {
    const f = this.farms().find((f) => f.slug === slug);
    return f ? this.localizedName(f.translations, slug) : slug;
  }

  getRoastLevelName(slug: string): string {
    const r = this.roastLevels().find((r) => r.slug === slug);
    return r ? this.localizedName(r.translations, slug) : slug;
  }

  getProcessingMethodName(slug: string): string {
    const p = this.processingMethods().find((p) => p.slug === slug);
    return p ? this.localizedName(p.translations, slug) : slug;
  }

  getCoffeeVarietyName(slug: string): string {
    const v = this.coffeeVarieties().find((v) => v.slug === slug);
    return v ? this.localizedName(v.translations, slug) : slug;
  }
}
