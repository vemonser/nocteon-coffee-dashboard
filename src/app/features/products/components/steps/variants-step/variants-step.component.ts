import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { GRIND_TYPE_LABELS, GrindType } from '../../../models/product.models';

/**
 * Step 2 — Variants (SKU, weight, price, stock).
 * A product must have at least one variant — enforced in
 * ProductWizardStateService.isCurrentStepValid().
 */
@Component({
  selector: 'app-variants-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './variants-step.component.html',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupDirective,
    },
  ],
})
export class VariantsStepComponent {
  protected state = inject(ProductWizardStateService);
  protected readonly GrindType = GrindType;
  protected readonly grindTypeOptions = Object.values(GrindType);

  getGrindTypeLabel(type: GrindType): string {
    return GRIND_TYPE_LABELS[type];
  }
  addVariant(): void {
    this.state.addVariant();
  }

  removeVariant(index: number): void {
    this.state.removeVariant(index);
  }
}
