import { Component, inject, input } from '@angular/core';
import { AbstractControl, FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';

/**
 * The bilingual field set, defined once — the same "one definition, no drift"
 * rule the checkboxes follow.
 *
 * Both surfaces that edit a category render the same two fields per language:
 * the list's create/edit dialog and the detail page. They used to be two copies
 * that had already drifted apart — different label keys, no label↔input
 * association, and no announced validation errors — so the fields live here.
 *
 * The "active" control is deliberately NOT here. The dialog toggles a boolean
 * as part of a form submit; the detail page's switch applies immediately. Two
 * different interactions, so each surface keeps its own control next to this
 * component.
 *
 * Every field is associated with its label and, when invalid, with its error
 * text: `for`/`id` for the label, `aria-describedby` + `role="alert"` for the
 * message. A red border alone tells a screen-reader user nothing.
 */
@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HlmBadgeImports,
    HlmInputImports,
    HlmLabelImports,
    HlmTextareaImports,
  ],
  templateUrl: './category-form.component.html',
})
export class CategoryFormComponent {
  /** The owning form's `translations` FormArray — one group per language. */
  translations = input.required<FormArray>();

  protected readonly helper = inject(TranslationFormHelper);

  protected asGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  protected langOf(group: AbstractControl): string {
    return (group.get('language')?.value as string) ?? '';
  }

  protected nameId(group: AbstractControl): string {
    return `category-name-${this.langOf(group)}`;
  }

  protected descriptionId(group: AbstractControl): string {
    return `category-description-${this.langOf(group)}`;
  }

  protected nameErrorId(group: AbstractControl): string {
    return `category-name-error-${this.langOf(group)}`;
  }

  protected nameInvalid(group: AbstractControl): boolean {
    const control = group.get('name');
    return !!control && control.invalid && control.touched;
  }
}
