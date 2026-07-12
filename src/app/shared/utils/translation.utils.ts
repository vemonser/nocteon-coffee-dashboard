import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { SUPPORTED_LANGUAGES } from '../../core/i18n/language';

/**
 * Shared helper for building translation FormArrays.
 *
 * Every entity that has bilingual translations (Category, Farm, Origin, Brand, Product…)
 * uses the same pattern: one FormGroup per supported language with a `name` field
 * plus optional extra fields (description, country, etc.).
 *
 * Usage in a list component:
 *
 *   constructor(private translationHelper: TranslationFormHelper) {}
 *
 *   buildForm() {
 *     return this.fb.group({
 *       isActive: [true],
 *       translations: this.translationHelper.buildArray([], ['name', 'description']),
 *     });
 *   }
 *
 *   patchTranslations(existing: TranslationLike[]) {
 *     this.translationHelper.patchArray(
 *       this.translationsArray,
 *       existing,
 *       ['name', 'description'],
 *     );
 *   }
 */

export type TranslationLike = {
  language: string;
  name?: string;
  [key: string]: any;
};

@Injectable({ providedIn: 'root' })
export class TranslationFormHelper {
  private fb = inject(FormBuilder);

  /**
   * Returns lang metadata helpers used in templates.
   */
  getLangLabel(code: string): string {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
  }

  getLangDir(code: string): string {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.dir ?? 'ltr';
  }

  /**
   * Builds a fresh FormArray with one group per supported language.
   *
   * @param existing   Pre-fill values (from API response on edit). Pass [] for create.
   * @param extraFields Additional optional fields beyond 'name' (e.g. ['description', 'country']).
   *
   * 'name' is always required with minLength(2).
   * Extra fields are optional (no validators by default).
   */
  buildArray(existing: TranslationLike[] = [], extraFields: string[] = []): FormArray {
    const controls = SUPPORTED_LANGUAGES.map((lang) => {
      const found = existing.find((t) => t.language === lang.code);
      return this.buildGroup(lang.code, found, extraFields);
    });
    return this.fb.array(controls);
  }
 
  /**
   * Rebuilds a FormArray in place (clear + refill).
   * Call this when switching from create → edit mode.
   */
  patchArray(
    target: FormArray,
    existing: TranslationLike[] = [],
    extraFields: string[] = [],
  ): void {
    target.clear();
    SUPPORTED_LANGUAGES.forEach((lang) => {
      const found = existing.find((t) => t.language === lang.code);
      target.push(this.buildGroup(lang.code, found, extraFields));
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private buildGroup(
    langCode: string,
    values: TranslationLike | undefined,
    extraFields: string[],
  ): FormGroup {
    const config: Record<string, any> = {
      language: [langCode],
      name: [values?.['name'] ?? '', [Validators.required, Validators.minLength(2)]],
    };

    extraFields.forEach((field) => {
      config[field] = [values?.[field] ?? ''];
    });

    return this.fb.group(config);
  }
}
