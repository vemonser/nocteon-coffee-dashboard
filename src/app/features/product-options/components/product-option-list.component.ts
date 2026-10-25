import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable, map } from 'rxjs';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmPopover, HlmPopoverImports } from '@spartan-ng/helm/popover';
import { BrnPopover } from '@spartan-ng/brain/popover';

import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucideX,
  lucideChevronLeft,
  lucideChevronRight,
  lucideTrash2,
  lucidePencil,
  lucideSlidersHorizontal,
  lucideCirclePlus,
  lucideLoader2,
} from '@ng-icons/lucide';

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { LanguageService } from '../../../core/i18n/language.service';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';

import {
  ProductOption,
  ProductOptionRequest,
  ProductOptionValue,
} from '../models/product-option.model';
import { ProductOptionService } from '../services/product-option.service';
import { PagerComponent } from '../../../shared/components/pager/pager.component';

@Component({
  selector: 'app-product-option-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmLabelImports,
    HlmDialogImports,
    HlmPopoverImports,
    NgIcon,
    TranslocoPipe,
    DragDropModule,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucidePlus,
      lucideSearch,
      lucideX,
      lucideChevronLeft,
      lucideChevronRight,
      lucideTrash2,
      lucidePencil,
      lucideSlidersHorizontal,
      lucideCirclePlus,
    }),
  ],
  templateUrl: './product-option-list.component.html',
})
export class ProductOptionListComponent extends BaseListComponent<
  ProductOption,
  ProductOptionRequest,
  number
> {
  private optionService = inject(ProductOptionService);
  protected translationHelper = inject(TranslationFormHelper);
  protected language = inject(LanguageService);
  protected readonly SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
  get currentLang(): string { return this.language.current(); }

  // ─── Value management state ───────────────────────────────────────────────────
  addingValueFor = signal<ProductOption | null>(null);
  valueForm: FormGroup = this.buildValueForm();
  valueSubmitting = signal(false);
  deletingValue = signal<{ option: ProductOption; value: ProductOptionValue; usageCount?: number } | null>(null);
  editingValue = signal<{ option: ProductOption; value: ProductOptionValue } | null>(null);

  // ─── Base contract ────────────────────────────────────────────────────────────

  protected override getId(item: ProductOption): number {
    return item.id;
  }

  protected override loadPage(): Observable<PageResponse<ProductOption>> {
    return this.optionService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      translations: this.translationHelper.buildArray([], []),
      sortOrder: [null],
    });
  }

  protected override onEditOpen(item: ProductOption): void {
    this.form.patchValue({ sortOrder: item.sortOrder ?? null });
    this.translationHelper.patchArray(this.translationsArray, item.translations, []);
  }

  protected override toRequest(): ProductOptionRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
      })),
      sortOrder: this.form.value.sortOrder ?? undefined,
    };
  }

  protected override callCreate(req: ProductOptionRequest) {
    return this.optionService.create(req);
  }

  protected override callUpdate(id: number, req: ProductOptionRequest) {
    return this.optionService.update(id, req);
  }

  protected override callDelete(id: number) {
    return this.optionService.delete(id);
  }

  override openCreateDialog(): void {
    super.openCreateDialog();
    const next = (this.items().reduce((m, o) => Math.max(m, o.sortOrder ?? 0), 0) || 0) + 1;
    this.form.patchValue({ sortOrder: next });
  }

  // ─── Value helpers ────────────────────────────────────────────────────────────

  private buildValueForm(): FormGroup {
    const config: Record<string, any> = {};
    SUPPORTED_LANGUAGES.forEach((lang) => {
      config[lang.code] = ['', Validators.required];
    });
    config['numericValue'] = [null];
    config['sortOrder'] = [null];
    return this.fb.group(config);
  }

  openAddValue(option: ProductOption): void {
    this.addingValueFor.set(option);
    this.valueForm.reset();
  }

  closeAddValue(): void {
    this.addingValueFor.set(null);
    this.valueForm.reset();
  }

  getValueName(value: ProductOptionValue, lang: string): string {
    return value.translations.find((t) => t.language === lang)?.name ?? '';
  }

  getOptionName(option: ProductOption, lang: string): string {
    return option.translations.find((t) => t.language === lang)?.name ?? '—';
  }

  submitValue(pop?: any): void {
    const option = this.addingValueFor();
    if (!option || this.valueForm.invalid) return;

    this.valueSubmitting.set(true);
    const vals = this.valueForm.value as Record<string, any>;
    const req = {
      translations: SUPPORTED_LANGUAGES.map((lang) => ({
        language: lang.code,
        name: vals[lang.code] as string,
      })),
      numericValue: vals['numericValue'] ?? undefined,
      sortOrder: vals['sortOrder'] ?? undefined,
    };

    this.optionService.createValue(option.id, req).subscribe({
      next: () => {
        pop?.close?.();
        this.closeAddValue();
        this.load();
        this.valueSubmitting.set(false);
        this.valueForm.reset();
      },
      error: () => this.valueSubmitting.set(false),
    });
  }

  // ─── Value edit popover ──────────────────────────────────────────────────────

  onValuePopoverState(state: 'open' | 'closed', option: ProductOption, value: ProductOptionValue): void {
    if (state === 'open') {
      this.beginValueEdit(option, value);
    } else {
      this.editingValue.set(null);
    }
  }

  beginValueEdit(option: ProductOption, value: ProductOptionValue): void {
    this.editingValue.set({ option, value });
    const vals: Record<string, any> = {};
    SUPPORTED_LANGUAGES.forEach((lang) => {
      vals[lang.code] = this.getValueName(value, lang.code);
    });
    vals['numericValue'] = value.numericValue ?? null;
    vals['sortOrder'] = value.sortOrder ?? null;
    this.valueForm.reset(vals);
  }

  valueTooltip(value: ProductOptionValue): string {
    if (value.numericValue != null) {
      return `${this.notify.t('productOptions.numericValue', 'Numeric value')}: ${value.numericValue}`;
    }
    const otherLang = this.currentLang === 'en' ? 'ar' : 'en';
    return this.getValueName(value, otherLang);
  }

  saveValueEdit(pop: any): void {
    const entry = this.editingValue();
    if (!entry || this.valueForm.invalid) {
      this.valueForm.markAllAsTouched();
      return;
    }
    this.valueSubmitting.set(true);
    const vals = this.valueForm.value as Record<string, any>;
    const req = {
      nameEn: vals['en'] as string,
      nameAr: vals['ar'] as string,
      numericValue: vals['numericValue'] ?? null,
      sortOrder: vals['sortOrder'] ?? undefined,
    };
    this.optionService.updateValue(entry.option.id, entry.value.id, req).subscribe({
      next: () => {
        pop?.close?.();
        this.editingValue.set(null);
        this.load();
        this.valueSubmitting.set(false);
      },
      error: (err) => {
        this.valueSubmitting.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Something went wrong. Please try again.');
      },
    });
  }

  deleteValueFromPopover(option: ProductOption, value: ProductOptionValue, pop: any): void {
    pop?.close?.();
    this.confirmDeleteValue(option, value);
  }

  dropValue(event: CdkDragDrop<ProductOptionValue[]>, option: ProductOption): void {
    const values = [...option.values];
    moveItemInArray(values, event.previousIndex, event.currentIndex);
    const ids = values.map((v) => v.id);
    this.optionService.reorderValues(option.id, ids).subscribe({
      next: () => this.load(),
      error: () => this.load(),
    });
  }

  confirmDeleteValue(option: ProductOption, value: ProductOptionValue): void {
    // Get usage count before showing confirmation
    this.optionService.getValueUsageCount(option.id, value.id).subscribe({
      next: (count: number) => {
        this.deletingValue.set({ option, value, usageCount: count });
      },
      error: () => {
        this.deletingValue.set({ option, value, usageCount: 0 });
      }
    });
  }

  submitDeleteValue(): void {
    const entry = this.deletingValue();
    if (!entry) return;

    this.valueSubmitting.set(true);
    this.optionService.deleteValue(entry.option.id, entry.value.id).subscribe({
      next: () => {
        this.deletingValue.set(null);
        this.load();
        this.valueSubmitting.set(false);
      },
      error: () => this.valueSubmitting.set(false),
    });
  }

  getValueUsageCount(option: ProductOption, value: ProductOptionValue): number {
    // This would need to be implemented based on backend API
    // For now, return 0 as placeholder
    return 0;
  }
}