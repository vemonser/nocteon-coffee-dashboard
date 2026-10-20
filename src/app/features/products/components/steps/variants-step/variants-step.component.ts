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
import { ProductOption } from '../../../../product-options/models/product-option.model';
import { ProductOptionService } from '../../../../product-options/services/product-option.service';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { NotifyService } from '../../../../../core/notify/notify.service';

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
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({ lucidePlus, lucideX }),
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

  loadingOptions = signal(false);

  ngOnInit(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);
    this.optionService.getAll({ page: 0, size: 100 }).subscribe({
      next: (res) => {
        this.state.setProductOptions(res.data.content);
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
    return option.translations.find((t) => t.language === this.currentLang)?.name ?? option.slug;
  }

  getValueName(option: ProductOption, valueId: string | number | null): string {
    if (valueId == null) return '';
    const value = option.values.find((v) => v.id === Number(valueId));
    return value?.translations.find((t) => t.language === this.currentLang)?.name ?? '';
  }

  /** Stringify a value id for hlm-select-item's string-based binding. */
  valueIdString(id: number): string {
    return String(id);
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

  removeVariant(index: number): void {
    this.state.removeVariant(index);
  }
}