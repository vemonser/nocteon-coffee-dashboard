import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { PairingService } from '../../../../pairing/services/pairing.service';
import { PairingResponse } from '../../../../pairing/models/pairing.model';
 
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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pairings-step.component.html',
})
export class PairingsStepComponent {
  protected state = inject(ProductWizardStateService);
  private pairingService = inject(PairingService);

  allPairings = signal<PairingResponse[]>([]);

  constructor() {
    this.pairingService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allPairings.set(res.data.content),
    });
  }

  isSelected(slug: string): boolean {
    return this.state.pairingsArray.value.includes(slug);
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
    const name = pairing.translations.find((t) => t.language === 'en')?.name;
    return name ?? pairing.slug;
}
}
