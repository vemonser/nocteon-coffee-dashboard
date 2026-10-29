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
import { ChipMultiselectComponent, ChipMultiselectItem } from '../../../../../shared/ui/chip-multiselect/chip-multiselect.component';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { LanguageService } from '../../../../../core/i18n/language.service';

@Component({
  selector: 'app-tasting-notes-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe, HlmButtonImports, ChipMultiselectComponent],
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

  readonly items = computed<ChipMultiselectItem[]>(() =>
    this.allNotes().map((note) => ({
      slug: note.slug,
      name: this.getNoteName(note),
    })),
  );

  readonly selected = computed<string[]>(() => this.state.tastingNotesArray.value as string[]);

  constructor() {
    this.tastingNoteService.getAll({ size: 200 }).subscribe({
      next: (res) => this.allNotes.set(res.data.content),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load tasting notes'),
    });
  }

  onSelectionChange(slugs: string[]): void {
    const arr = this.state.tastingNotesArray;
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

  getNoteName(note: TastingNoteResponse): string {
    const lang = this.language.current();
    const t = note.translations.find((x) => x.language?.toLowerCase() === lang?.toLowerCase());
    return t?.name ?? note.translations[0]?.name ?? note.slug;
  }

  goManageNotes(): void {
    this.router.navigate(['/dashboard/tasting-notes']);
  }
}