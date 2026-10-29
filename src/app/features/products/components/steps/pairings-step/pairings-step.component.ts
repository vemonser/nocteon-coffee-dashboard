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
import { ChipMultiselectComponent, ChipMultiselectItem } from '../../../../../shared/ui/chip-multiselect/chip-multiselect.component';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { ProductService } from '../../../services/product.service';
import { ProductListItem } from '../../../models/product.models';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';

@Component({
  selector: 'app-pairings-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
    HlmButtonImports,
    HlmInputImports,
    NgIcon,
    ChipMultiselectComponent,
  ],
  providers: [provideIcons({ lucideSearch, lucideX })],
  templateUrl: './pairings-step.component.html',
})
export class PairingsStepComponent {
  protected state = inject(ProductWizardStateService);
  private pairingService = inject(PairingService);
  private notify = inject(NotifyService);
  private language = inject(LanguageService);
  private wizard = inject(ProductWizardComponent);
  private router = inject(Router);
  private productService = inject(ProductService);

  readonly allPairings = signal<PairingResponse[]>([]);

  readonly items = computed<ChipMultiselectItem[]>(() =>
    this.allPairings().map((pairing) => ({
      slug: pairing.slug,
      name: this.getPairingName(pairing),
      imageUrl: pairing.imageUrl,
    })),
  );

  readonly selected = computed<string[]>(() => this.state.pairingsArray.value as string[]);

  constructor() {
    this.pairingService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allPairings.set(res.data.content),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load pairings'),
    });
  }

  readonly MAX_RELATED = 6;
  readonly relatedSearch = signal('');
  readonly relatedResults = signal<ProductListItem[]>([]);
  readonly relatedSearching = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly selectedRelated = computed(() => this.state.relatedProducts());
  readonly canAddMore = computed(() => this.selectedRelated().length < this.MAX_RELATED);

  onRelatedSearchInput(value: string): void {
    this.relatedSearch.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const term = value.trim();
    if (term.length < 2) {
      this.relatedResults.set([]);
      this.relatedSearching.set(false);
      return;
    }
    this.relatedSearching.set(true);
    this.searchTimer = setTimeout(() => this.runRelatedSearch(term), 300);
  }

  private runRelatedSearch(term: string): void {
    this.productService.getAll({ search: term, size: 8, isActive: true }).subscribe({
      next: (res) => {
        const selfSlug = this.state.editingSlug();
        this.relatedResults.set(
          (res.data.content ?? []).filter(
            (p) => p.slug !== selfSlug && !this.state.hasRelated(p.slug),
          ),
        );
        this.relatedSearching.set(false);
      },
      error: (err) => {
        this.relatedSearching.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not search products');
      },
    });
  }

  addRelated(product: ProductListItem): void {
    if (!this.canAddMore()) return;
    this.state.addRelated({
      slug: product.slug,
      name: product.name,
      primaryImageUrl: product.primaryImageUrl,
    });
    this.relatedSearch.set('');
    this.relatedResults.set([]);
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  removeRelated(slug: string): void {
    this.state.removeRelated(slug);
  }

  onSelectionChange(slugs: string[]): void {
    const arr = this.state.pairingsArray;
    while (arr.length) arr.removeAt(0);
    slugs.forEach((slug) => arr.push(new FormControl(slug)));
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

  getPairingName(pairing: PairingResponse): string {
    const lang = this.language.current();
    const t = pairing.translations.find((x) => x.language?.toLowerCase() === lang?.toLowerCase());
    return t?.name ?? pairing.translations[0]?.name ?? pairing.slug;
  }

  goManagePairings(): void {
    this.router.navigate(['/dashboard/pairings']);
  }
}