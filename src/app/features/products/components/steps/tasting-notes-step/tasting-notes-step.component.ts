import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { TastingNoteService } from '../../../../tasting-note/services/tasting-note.service';
import { TastingNoteResponse } from '../../../../tasting-note/models/tasting-note.model';
 
/**
 * Step 4 — Tasting Notes (multi-select from existing lookup entity).
 * Simplified model: product just stores an array of tasting-note slugs,
 * the actual TastingNote entities are managed in their own CRUD page
 * (same Type-A pattern as ProcessingMethod/RoastLevel).
 */
@Component({
  selector: 'app-tasting-notes-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tasting-notes-step.component.html',
})
export class TastingNotesStepComponent {
  protected state = inject(ProductWizardStateService);
  private tastingNoteService = inject(TastingNoteService);

  allNotes = signal<TastingNoteResponse[]>([]);

  constructor() {
    this.tastingNoteService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allNotes.set(res.data.content),
    });
  }

  isSelected(slug: string): boolean {
    return this.state.tastingNotesArray.value.includes(slug);
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
    const name = note.translations.find((t) => t.language === 'en')?.name;
    return name ?? note.slug;
}
}
