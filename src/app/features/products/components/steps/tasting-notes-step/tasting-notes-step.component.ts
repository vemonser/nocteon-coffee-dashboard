import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { TastingNoteService } from '../../../../tasting-note/services/tasting-note.service';
import { TastingNoteResponse } from '../../../../tasting-note/models/tasting-note.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { LanguageService } from '../../../../../core/i18n/language.service';

/**
 * Step 4 — Tasting Notes (multi-select from existing lookup entity).
 * Simplified model: product just stores an array of tasting-note slugs,
 * the actual TastingNote entities are managed in their own CRUD page
 * (same Type-A pattern as ProcessingMethod/RoastLevel).
 */
@Component({
  selector: 'app-tasting-notes-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './tasting-notes-step.component.html',
})
export class TastingNotesStepComponent {
  protected state = inject(ProductWizardStateService);
  private tastingNoteService = inject(TastingNoteService);
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

  allNotes = signal<TastingNoteResponse[]>([]);

  constructor() {
    this.tastingNoteService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allNotes.set(res.data.content),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load tasting notes'),
    });
  }

  isSelected(slug: string): boolean {
    return this.state.tastingNotesArray.value.includes(slug);
  }

  selectedCount(): number {
    return this.state.tastingNotesArray.value.length;
  }

  toggle(slug: string): void {
    const index = this.state.tastingNotesArray.value.indexOf(slug);
    if (index === -1) {
      this.state.tastingNotesArray.push(new FormControl(slug));
    } else {
      this.state.tastingNotesArray.removeAt(index);
    }
  }

getNoteName(note: TastingNoteResponse): string {
    const lang = this.language.current();
    const t = note.translations.find((x) => x.language?.toLowerCase() === lang?.toLowerCase());
    return t?.name ?? note.translations[0]?.name ?? note.slug;
}
}
