import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { PairingService } from '../../../../pairing/services/pairing.service';
import { PairingResponse } from '../../../../pairing/models/pairing.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { LanguageService } from '../../../../../core/i18n/language.service';

/**
 * Step 5 — Pairings (multi-select from existing lookup entity).
 * Identical pattern to TastingNotesStepComponent — kept as a separate
 * component rather than a generic "chip selector" because the two will
 * likely diverge (pairings may later need a category/icon, notes may not).
 * If they stay this simple long-term, worth extracting a shared
 * ChipMultiSelectComponent — not done yet to avoid premature abstraction.
 */
@Component({
  selector: 'app-pairings-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './pairings-step.component.html',
})
export class PairingsStepComponent {
  protected state = inject(ProductWizardStateService);
  private pairingService = inject(PairingService);
  private notify = inject(NotifyService);
  private language = inject(LanguageService);
  private wizard = inject(ProductWizardComponent);

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

  allPairings = signal<PairingResponse[]>([]);

  constructor() {
    this.pairingService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allPairings.set(res.data.content),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load pairings'),
    });
  }

  isSelected(slug: string): boolean {
    return this.state.pairingsArray.value.includes(slug);
  }

  selectedCount(): number {
    return this.state.pairingsArray.value.length;
  }

  toggle(slug: string): void {
    const index = this.state.pairingsArray.value.indexOf(slug);
    if (index === -1) {
      this.state.pairingsArray.push(new FormControl(slug));
    } else {
      this.state.pairingsArray.removeAt(index);
    }
  }

  getPairingName(pairing: PairingResponse): string {
    const lang = this.language.current();
    const t = pairing.translations.find((x) => x.language?.toLowerCase() === lang?.toLowerCase());
    return t?.name ?? pairing.translations[0]?.name ?? pairing.slug;
}
}
