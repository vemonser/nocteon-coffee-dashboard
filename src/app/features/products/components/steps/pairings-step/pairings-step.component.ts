import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { PairingService } from '../../../../pairing/services/pairing.service';
import { PairingResponse } from '../../../../pairing/models/pairing.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { LanguageService } from '../../../../../core/i18n/language.service';

@Component({
  selector: 'app-pairings-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe, HlmButtonImports, HlmInputImports],
  templateUrl: './pairings-step.component.html',
})
export class PairingsStepComponent {
  protected state = inject(ProductWizardStateService);
  private pairingService = inject(PairingService);
  private notify = inject(NotifyService);
  private language = inject(LanguageService);
  private wizard = inject(ProductWizardComponent);
  private router = inject(Router);

  readonly allPairings = signal<PairingResponse[]>([]);
  readonly search = signal('');

  readonly showSearch = computed(() => this.allPairings().length > 12);

  readonly filteredPairings = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.allPairings();
    return this.allPairings().filter((p) => this.getPairingName(p).toLowerCase().includes(term));
  });

  readonly selectedPairings = computed(() => {
    const selected = this.state.pairingsArray.value as string[];
    return selected.map((slug) => ({ slug, name: this.nameForSlug(slug) }));
  });

  constructor() {
    this.pairingService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allPairings.set(res.data.content),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load pairings'),
    });
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

  isSelected(slug: string): boolean {
    return (this.state.pairingsArray.value as string[]).includes(slug);
  }

  selectedCount(): number {
    return this.state.pairingsArray.value.length;
  }

  toggle(slug: string): void {
    const index = (this.state.pairingsArray.value as string[]).indexOf(slug);
    if (index === -1) {
      this.state.pairingsArray.push(new FormControl(slug));
    } else {
      this.state.pairingsArray.removeAt(index);
    }
  }

  remove(slug: string): void {
    const index = (this.state.pairingsArray.value as string[]).indexOf(slug);
    if (index !== -1) this.state.pairingsArray.removeAt(index);
  }

  getPairingName(pairing: PairingResponse): string {
    const lang = this.language.current();
    const t = pairing.translations.find((x) => x.language?.toLowerCase() === lang?.toLowerCase());
    return t?.name ?? pairing.translations[0]?.name ?? pairing.slug;
  }

  private nameForSlug(slug: string): string {
    const pairing = this.allPairings().find((p) => p.slug === slug);
    return pairing ? this.getPairingName(pairing) : slug;
  }

  goManagePairings(): void {
    this.router.navigate(['/dashboard/pairings']);
  }
}
