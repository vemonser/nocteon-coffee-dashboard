import { Component, computed, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { TranslocoPipe } from '@jsverse/transloco';

export interface TranslationExtraField {
  controlName: string;
  labelKey: string;
  maxLength?: number;
}

/**
 * One language's name + description fields, with the limits the API enforces
 * (`name` 2-100, `description` <= 500) shown as live counters.
 *
 * <p>Shared by every catalog create/edit dialog so the Arabic field is
 * `dir="rtl"`, the limit and the counter are the same, and a page cannot
 * invent its own shorter limit. The control itself stays the native input.
 * `extraFields` covers a translated field that is not name/description (a
 * farm's country) without giving the page its own copy of the block.
 */
@Component({
  selector: 'app-translation-field',
  standalone: true,
  imports: [ReactiveFormsModule, HlmBadgeImports, HlmInputImports, HlmLabelImports, HlmTextareaImports, TranslocoPipe],
  templateUrl: './translation-field.component.html',
})
export class TranslationFieldComponent {
  readonly group = input.required<FormGroup>();
  readonly language = input.required<string>();
  /** The entity's own name label ("Roast level name", "Method name", …). */
  readonly nameLabelKey = input<string>('common.name');
  /** The entity's own required message. */
  readonly nameRequiredKey = input<string>('common.nameRequired');
  readonly descriptionLabelKey = input<string>('common.description');
  readonly showDescription = input<boolean>(true);
  readonly nameMax = input<number>(100);
  readonly descriptionMax = input<number>(500);
  readonly rows = input<number>(3);
  readonly placeholderEn = input<string>('');
  readonly placeholderAr = input<string>('');
  /** Extra translated controls rendered between name and description. */
  readonly extraFields = input<TranslationExtraField[]>([]);

  protected readonly isArabic = computed(() => this.language() === 'ar');
  protected readonly dir = computed(() => (this.isArabic() ? 'rtl' : 'ltr'));
  protected readonly nameLength = computed(() => String(this.group().get('name')?.value ?? '').length);
  protected readonly descriptionLength = computed(() =>
    String(this.group().get('description')?.value ?? '').length,
  );
  protected readonly nameInvalid = computed(() => {
    const control = this.group().get('name');
    return !!control && control.invalid && control.touched;
  });
}
