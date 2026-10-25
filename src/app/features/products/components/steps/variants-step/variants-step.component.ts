import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  ControlContainer,
  FormArray,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
} from '@angular/forms';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { ProductOption, ProductOptionValue } from '../../../../product-options/models/product-option.model';
import { filterOptionsByProductType } from '../../../product-option-applicability';
import { ProductOptionService } from '../../../../product-options/services/product-option.service';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideX, lucideChevronDown, lucideChevronUp, lucideMoreVertical, lucideTrash2, lucideCopy } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { stockLevel as resolveStockLevel } from '../../../../../shared/utils/stock-level';

@Component({
  selector: 'app-variants-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HlmSelectImports,
    HlmInputImports,
    HlmLabel,
    HlmButtonImports,
    HlmCheckboxImports,
    HlmSwitchImports,
    NgIcon,
    TranslocoPipe,
    MoneyPipe,
  ],
  providers: [
    provideIcons({ lucidePlus, lucideX, lucideChevronDown, lucideChevronUp, lucideMoreVertical, lucideTrash2, lucideCopy }),
  ],
  templateUrl: './variants-step.component.html',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupDirective,
    },
  ],
})
export class VariantsStepComponent implements OnInit {
  protected state = inject(ProductWizardStateService);
  private optionService = inject(ProductOptionService);
  private language = inject(LanguageService);
  private notify = inject(NotifyService);
  private wizard = inject(ProductWizardComponent);

  loadingOptions = signal(false);
  collapsed = signal<Set<number>>(new Set());
  readonly view = signal<'cards' | 'table'>('cards');

  stockLevel(group: AbstractControl): 'out' | 'low' | 'ok' {
    return resolveStockLevel(
      group.get('stockQuantity')?.value,
      group.get('reorderThreshold')?.value,
    );
  }

  discountPercent(group: AbstractControl): number | null {
    const compare = Number(group.get('compareAtPrice')?.value);
    const price = Number(group.get('price')?.value);
    if (!compare || !price || compare <= price) return null;
    return Math.round(((compare - price) / compare) * 100);
  }

  optionNames(): string {
    return this.state.productOptions().map((o) => this.getOptionName(o)).join(', ');
  }

  compareAtPrice(group: AbstractControl): number | null {
    const value = Number(group.get('compareAtPrice')?.value);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  margin(group: AbstractControl): string | null {
    const price = Number(group.get('price')?.value);
    const cost = Number(group.get('costPrice')?.value);
    if (!price || !cost || price <= 0) return null;
    return String(Math.round(((price - cost) / price) * 1000) / 10);
  }

  isCollapsed(i: number): boolean {
    if (this.collapsed().size === 0 && this.state.variantsArray.length > 1) {
      return i !== 0;
    }
    return this.collapsed().has(i);
  }

  toggleCollapse(i: number): void {
    const next = new Set(this.collapsed());
    if (next.has(i)) next.delete(i);
    else next.add(i);
    this.collapsed.set(next);
  }

  variantLabel(group: AbstractControl): string {
    const picks = group.get('optionPicks') as FormArray | null;
    const parts: string[] = [];
    
    if (picks) {
      picks.controls.forEach((c) => {
        const optionId = Number(c.get('optionId')?.value);
        const valueId = Number(c.get('valueId')?.value);
        
        const option = this.state.productOptions().find((o) => o.id === optionId);
        if (!option) return;
        
        const value = option.values.find((v) => v.id === valueId);
        if (!value) return;
        
        const lang = this.language.current();
        const valueName = value.translations.find((t) => t.language?.toLowerCase() === lang?.toLowerCase())?.name;
        
        // The summary is the buyer-facing variant identity: values only.
        if (valueName) {
          parts.push(valueName);
        } else if (value.slug) {
          parts.push(value.slug);
        }
      });
    }
    
    const sku = group.get('sku')?.value;
    if (parts.length > 0) {
      return parts.join(' • ');
    }
    
    // Fallback to SKU if no options selected
    return sku || 'Variant';
  }

  getEnhancedValueName(option: ProductOption, valueId: string | number | null): string {
    if (valueId == null) return '';
    
    const value = option.values.find((v) => v.id === Number(valueId));
    if (!value) return String(valueId);
    
    const lang = this.language.current();
    const valueName = value.translations.find((t) => t.language?.toLowerCase() === lang?.toLowerCase())?.name;
    const optionName = option.translations.find((t) => t.language?.toLowerCase() === lang?.toLowerCase())?.name;
    
    // Enhanced display with option context
    if (valueName && optionName) {
      return `${valueName} · ${optionName}`;
    }
    return valueName || value.slug || String(value.id);
  }

  ngOnInit(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);
    const productType = this.state.form.get('productType')?.value;
    this.optionService.getAll({ page: 0, size: 100, productType }).subscribe({
      next: (res) => {
        const productType = this.state.form.get('productType')?.value;
        this.state.setProductOptions(filterOptionsByProductType(res.data.content, productType));
        this.loadingOptions.set(false);
      },
      error: (err) => {
        this.loadingOptions.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load product options');
      },
    });
  }

  get currentLang(): string {
    return this.language.current();
  }

  getOptionName(option: ProductOption): string {
    const t = option.translations.find((t) => t.language?.toLowerCase() === this.currentLang?.toLowerCase());
    return t?.name ?? option.slug ?? `Option ${option.id}`;
  }

  getValueName(option: ProductOption, valueId: string | number | null): string {
    if (valueId == null) return '';
    const value = option.values.find((v) => v.id === Number(valueId));
    if (!value) return String(valueId);
    const t = value.translations.find((t) => t.language?.toLowerCase() === this.currentLang?.toLowerCase());
    return t?.name ?? value.slug ?? String(value.id);
  }

  /** Stringify a value id for hlm-select-item's string-based binding. */
  valueIdString(id: number): string {
    return String(id);
  }

  /** The trigger must read "250g", not the raw option-value id. */
  valueLabelFor(option: ProductOption): (value: string) => string {
    return (value: string) => this.getValueName(option, value);
  }

  /** Returns (creating on demand) the valueId FormControl for the given option. */
  getPickControl(group: AbstractControl, option: ProductOption): FormControl {
    const picks = group.get('optionPicks') as FormArray;
    let pick = picks.controls.find(
      (c) => Number(c.get('optionId')?.value) === option.id,
    ) as FormGroup | undefined;
    if (!pick) {
      pick = this.state.buildVariantPickGroup(option.id);
      picks.push(pick);
    }
    return pick.get('valueId') as FormControl;
  }

  addVariant(): void {
    this.state.addVariant();
  }

  saveCurrentStep(): void {
    this.wizard.saveCurrentStep();
  }

  onBack(): void {
    this.wizard.onBack();
  }

  isCurrentStepDirty(): boolean {
    return this.wizard.isCurrentStepDirty();
  }

  isCurrentStepValid(): boolean {
    return this.state.isCurrentStepValid();
  }

  removeVariant(index: number): void {
    this.state.removeVariant(index);
  }

  confirmRemoveVariant(index: number): void {
    if (window.confirm('Remove this variant?')) {
      this.removeVariant(index);
    }
  }

  duplicateVariant(index: number): void {
    // Clone the variant group by re-adding and patching from the source.
    this.state.addVariant();
    const src = this.state.variantsArray.at(index) as FormGroup;
    const dst = this.state.variantsArray.at(this.state.variantsArray.length - 1) as FormGroup;
    dst.patchValue(src.getRawValue());
  }
}