import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { TastingNoteService } from '../../../../tasting-note/services/tasting-note.service';
import { TastingNoteResponse } from '../../../../tasting-note/models/tasting-note.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { LanguageService } from '../../../../../core/i18n/language.service';

/**
 * Step 4 — Tasting Notes (multi-select from the existing lookup entity).
 *
 * The API's tasting-note model has no category, so the notes stay one flat
 * list. The search appears only once the list is long enough to need it.
 */
@Component({
  selector: 'app-tasting-notes-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe, HlmButtonImports, HlmInputImports],
  templateUrl: './tasting-notes-step.component.html',
})
export class TastingNotesStepComponent {
  protected state = inject(ProductWizardStateService);
  private tastingNoteService = inject(TastingNoteService);
  private notify = inject(NotifyService);
  private language = inject(LanguageService);
  private wizard = inject(ProductWizardComponent);
  private router = inject(Router);

  readonly allNotes = signal<TastingNoteResponse[]>([]);
  readonly search = signal('');

  readonly showSearch = computed(() => this.allNotes().length > 12);

  readonly filteredNotes = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.allNotes();
    return this.allNotes().filter((note) =>
      this.getNoteName(note).toLowerCase().includes(term),
    );
  });

  /** Selected notes in the order they were picked; falls back to the slug. */
  readonly selectedNotes = computed(() => {
    const selected = this.state.tastingNotesArray.value as string[];
    return selected.map((slug) => ({
      slug,
      name: this.nameForSlug(slug),
    }));
  });

  constructor() {
    this.tastingNoteService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allNotes.set(res.data.content),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load tasting notes'),
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
    return (this.state.tastingNotesArray.value as string[]).includes(slug);
  }

  selectedCount(): number {
    return this.state.tastingNotesArray.value.length;
  }

  toggle(slug: string): void {
    const index = (this.state.tastingNotesArray.value as string[]).indexOf(slug);
    if (index === -1) {
      this.state.tastingNotesArray.push(new FormControl(slug));
    } else {
      this.state.tastingNotesArray.removeAt(index);
    }
  }

  remove(slug: string): void {
    const index = (this.state.tastingNotesArray.value as string[]).indexOf(slug);
    if (index !== -1) this.state.tastingNotesArray.removeAt(index);
  }

  getNoteName(note: TastingNoteResponse): string {
    const lang = this.language.current();
    const t = note.translations.find((x) => x.language?.toLowerCase() === lang?.toLowerCase());
    return t?.name ?? note.translations[0]?.name ?? note.slug;
  }

  private nameForSlug(slug: string): string {
    const note = this.allNotes().find((n) => n.slug === slug);
    return note ? this.getNoteName(note) : slug;
  }

  goManageNotes(): void {
    this.router.navigate(['/dashboard/tasting-notes']);
  }
}
