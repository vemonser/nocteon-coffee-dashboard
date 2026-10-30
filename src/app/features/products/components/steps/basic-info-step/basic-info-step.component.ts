import { Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductType } from '../../../models/product.models';
import { TranslationFormHelper } from '../../../../../shared/utils/translation.utils';
import { CategoryService } from '../../../../categories/services/category.service';
import { OriginService } from '../../../../origins/services/origin.service';
import { CategoryResponse } from '../../../../categories/models/category.model';
import { OriginOption } from '../../../../origins/models/origin.model';
import { FarmResponse } from '../../../../farms/models/farm.model';
import { RoastLevelResponse } from '../../../../roast-level/models/roast-level.model';
import { ProcessingMethodResponse } from '../../../../processing-method/models/processing-method.model';
import { CoffeeVarietyResponse } from '../../../../coffee-variety/models/coffee-variety.model';
import { FarmService } from '../../../../farms/services/farm.service';
import { RoastLevelService } from '../../../../roast-level/services/roast-level.service';
import { ProcessingMethodService } from '../../../../processing-method/services/processing-method.service';
import { CoffeeVarietyService } from '../../../../coffee-variety/services/coffee-variety.service';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideCheck, lucideAlertCircle } from '@ng-icons/lucide';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { QuillEditorComponent } from 'ngx-quill';
import Quill from 'quill';
import '../../../../../shared/quill/divider.blot';
import { finalize } from 'rxjs';
import { PRODUCT_STORY_QUILL_MODULES } from '../../../../../shared/quill/rich-text.config';
import { htmlTextLength } from '../../../../../shared/utils/html-text';
import { ProductService } from '../../../services/product.service';
import { ProductTagService } from '../../../../product-tags/services/product-tag.service';
import { ProductTag } from '../../../../product-tags/models/product-tag.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-basic-info-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HlmSelectImports,
    HlmInputImports,
    HlmLabel,
    HlmCheckboxImports,
    HlmButtonImports,
    HlmSwitchImports,
    TranslocoPipe,
    NgIcon,
    QuillEditorComponent,
    RouterLink,
  ],
  providers: [
    provideIcons({ lucidePencil, lucideCheck, lucideAlertCircle }),
  ],
  templateUrl: './basic-info-step.component.html',
  styleUrl: './basic-info-step.component.css',
})
export class BasicInfoStepComponent {
  /** Store the editor's real HTML (semantic HTML would turn a video into a link). */
  readonly htmlValueGetter = (editor: Quill): string => editor.root.innerHTML;
  readonly uploadingStory = signal(false);
  /** The story toolbar (W5): bound through the input, not the root config token. */
  readonly storyModules = PRODUCT_STORY_QUILL_MODULES;
  private storyEditor: Quill | null = null;

  protected state = inject(ProductWizardStateService);
  protected translationHelper = inject(TranslationFormHelper);

  private categoryService = inject(CategoryService);
  private originService = inject(OriginService);
  private farmService = inject(FarmService);
  private roastLevelService = inject(RoastLevelService);
  private processingMethodService = inject(ProcessingMethodService);
  private coffeeVarietyService = inject(CoffeeVarietyService);
  private notify = inject(NotifyService);
  private productService = inject(ProductService);
  private productTagService = inject(ProductTagService);
  private destroyRef = inject(DestroyRef);
  private readonly toolbarActions: { button: HTMLButtonElement; key: string }[] = [];

  private transloco = inject(TranslocoService);
  private language = inject(LanguageService);

  categories = signal<CategoryResponse[]>([]);
  origins = signal<OriginOption[]>([]);
  farms = signal<FarmResponse[]>([]);
  roastLevels = signal<RoastLevelResponse[]>([]);
  processingMethods = signal<ProcessingMethodResponse[]>([]);
  coffeeVarieties = signal<CoffeeVarietyResponse[]>([]);
  /** FE-10: the tag vocabulary, assigned by toggling chips. */
  readonly productTags = signal<ProductTag[]>([]);

  readonly harvestYears: number[] = Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i);

  readonly productTypes: { value: ProductType }[] = [
    { value: 'COFFEE' },
    { value: 'EQUIPMENT' },
  ];

  readonly activeLanguage = signal<'en' | 'ar'>('en');
  readonly slugUnlocked = signal(false);
  readonly translationLanguages: { code: 'en' | 'ar'; dir: 'ltr' | 'rtl' }[] = [
    { code: 'en', dir: 'ltr' },
    { code: 'ar', dir: 'rtl' },
  ];

  readonly productTypeLabel = (value: string): string =>
    value ? this.transloco.translate(`products.form.productTypes.${value}`) : '';
  readonly categoryLabel = (value: string): string => this.getCategoryName(value);
  readonly originLabel = (value: string): string => this.getOriginName(value);
  readonly farmLabel = (value: string): string => this.getFarmName(value);
  readonly roastLevelLabel = (value: string): string => this.getRoastLevelName(value);
  readonly processingMethodLabel = (value: string): string =>
    this.getProcessingMethodName(value);
  readonly coffeeVarietyLabel = (value: string): string => this.getCoffeeVarietyName(value);

  isTranslationComplete(code: string): boolean {
    const group = this.state.translationsArray.controls.find(
      (c) => c.get('language')?.value === code,
    );
    return String(group?.get('name')?.value ?? '').trim().length >= 2;
  }

  /**
   * Red on a language segment only after the reader submitted the step or left
   * the name empty (W3). A pristine form shows neutral dots.
   */
  showLanguageError(code: string): boolean {
    if (this.isTranslationComplete(code)) return false;
    if (this.state.submitAttempted()) return true;
    const group = this.state.translationsArray.controls.find(
      (control) => control.get('language')?.value === code,
    );
    return !!group?.get('name')?.touched;
  }

  constructor() {
    effect(() => {
      this.language.current();
      for (const { button, key } of this.toolbarActions) {
        const label = this.transloco.translate(key);
        button.title = label;
        button.setAttribute('aria-label', label);
      }
      // The format buttons belong to the editor, not to `toolbarActions`, so a
      // language switch re-names them too.
      if (this.storyEditor) this.labelToolbar(this.storyEditor);
    });

    // A failed preload must not look like an empty catalog: toast on error.
    const onErr = (what: string) => (err: unknown) =>
      this.notify.apiError(err, 'notify.errorFallback', `Could not load ${what}`);

    this.categoryService.getAll({ size: 200, isActive: true }).subscribe({
      next: (r) => this.categories.set(r.data.content),
      error: onErr('categories'),
    });

    this.originService.getAllOptions().subscribe({
      next: (r) => this.origins.set(r.data),
      error: onErr('origins'),
    });

    this.farmService.getAll({ size: 200 }).subscribe({
      next: (r) => this.farms.set(r.data.content),
      error: onErr('farms'),
    });

    this.roastLevelService.getAll({ size: 200 }).subscribe({
      next: (r) => this.roastLevels.set(r.data.content),
      error: onErr('roast levels'),
    });

    this.processingMethodService.getAll({ size: 200 }).subscribe({
      next: (r) => this.processingMethods.set(r.data.content),
      error: onErr('processing methods'),
    });

    this.coffeeVarietyService.getAll({ size: 200 }).subscribe({
      next: (r) => this.coffeeVarieties.set(r.data.content),
      error: onErr('coffee varieties'),
    });

    this.productTagService.getAll().subscribe({
      next: (r) => this.productTags.set(r.data ?? []),
      error: onErr('tags'),
    });
  }

  // ── Tags (FE-10) ────────────────────────────────────────────────────────────

  tagName(tag: ProductTag): string {
    const lang = this.language.current();
    return (
      tag.translations.find((t) => t.language === lang)?.title ??
      tag.translations.find((t) => t.language === 'en')?.title ??
      tag.slug
    );
  }

  /** A chip is a toggle; the FormArray is the single source of truth for the selection. */
  isTagSelected(slug: string): boolean {
    return this.state.hasTag(slug);
  }

  toggleTag(slug: string): void {
    this.state.toggleTag(slug);
  }

  get isCoffee(): boolean {
    return this.state.form.get('productType')?.value === 'COFFEE';
  }

  formatStoryCharacters(value: unknown): number {
    return htmlTextLength(typeof value === 'string' ? value : '');
  }

  onStoryEditorCreated(editor: Quill): void {
    this.storyEditor = editor;
    const toolbar = editor.getModule('toolbar') as { addHandler: (name: string, fn: () => void) => void };
    toolbar.addHandler('image', () => this.pickStoryImage(editor));
    // Undo/redo are not Quill toolbar formats: real buttons, prepended so the
    // order is undo, redo, then the formats. `prepend` inserts at the start,
    // so the right-most action is added first.
    this.addToolbarAction(editor, '↷', 'journal.redo', () => editor.history.redo(), true);
    this.addToolbarAction(editor, '↶', 'journal.undo', () => editor.history.undo(), true);
    this.labelToolbar(editor);
  }

  /**
   * Every toolbar control needs a name — Quill ships them as icon-only buttons
   * with an English `aria-label` at best ("bold"), and the heading select has
   * no label at all. Titles double as the hover tooltip.
   */
  private labelToolbar(editor: Quill): void {
    const container = (editor.getModule('toolbar') as { container: HTMLElement }).container;
    const buttons: [string, string][] = [
      ['.ql-bold', 'products.form.storyToolbar.bold'],
      ['.ql-italic', 'products.form.storyToolbar.italic'],
      ['.ql-underline', 'products.form.storyToolbar.underline'],
      ['.ql-list[value="bullet"]', 'products.form.storyToolbar.bulletList'],
      ['.ql-list[value="ordered"]', 'products.form.storyToolbar.numberedList'],
      ['.ql-blockquote', 'products.form.storyToolbar.quote'],
      ['.ql-link', 'products.form.storyToolbar.link'],
      ['.ql-image', 'products.form.storyToolbar.image'],
      ['.ql-clean', 'products.form.storyToolbar.clear'],
    ];
    for (const [selector, key] of buttons) {
      container.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        const label = this.transloco.translate(key);
        element.setAttribute('aria-label', label);
        element.setAttribute('title', label);
        if (element.tagName === 'BUTTON') element.setAttribute('type', 'button');
      });
    }

    const header = container.querySelector<HTMLSelectElement>('select.ql-header');
    if (header) {
      const label = this.transloco.translate('products.form.storyToolbar.heading');
      header.setAttribute('aria-label', label);
      header.setAttribute('title', label);
      header.querySelectorAll<HTMLOptionElement>('option').forEach((option) => {
        option.textContent = this.transloco.translate(this.headerKey(option.value));
      });
    }

    /**
     * Quill's snow theme hides that select and renders its own picker whose
     * items are built from the (then empty) option text, so the heading menu
     * opened with three blank rows. Label the picker and fill its items.
     */
    const picker = container.querySelector<HTMLElement>('.ql-picker.ql-header');
    if (picker) {
      const pickerLabel = picker.querySelector<HTMLElement>('.ql-picker-label');
      const headingLabel = this.transloco.translate('products.form.storyToolbar.heading');
      if (pickerLabel) {
        pickerLabel.setAttribute('aria-label', headingLabel);
        pickerLabel.setAttribute('title', headingLabel);
        pickerLabel.setAttribute('role', 'button');
      }
      picker.querySelectorAll<HTMLElement>('.ql-picker-item').forEach((item) => {
        const text = this.transloco.translate(this.headerKey(item.getAttribute('data-value')));
        item.textContent = text;
        item.setAttribute('aria-label', text);
        item.setAttribute('title', text);
      });
    }
  }

  /** The i18n key for a header level: '' (normal), '2' or '3'. */
  private headerKey(level: string | null): string {
    return level === '2'
      ? 'products.form.storyToolbar.heading2'
      : level === '3'
        ? 'products.form.storyToolbar.heading3'
        : 'products.form.storyToolbar.normal';
  }

  private addToolbarAction(
    editor: Quill,
    label: string,
    titleKey: string,
    action: () => void,
    prepend = false,
  ): void {
    const container = (editor.getModule('toolbar') as { container: HTMLElement }).container;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = this.transloco.translate(titleKey);
    button.setAttribute('aria-label', this.transloco.translate(titleKey));
    button.className = 'ql-toolbar-action';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      action();
    });
    if (prepend) container.prepend(button);
    else container.appendChild(button);
    this.toolbarActions.push({ button, key: titleKey });
  }

  private pickStoryImage(editor: Quill): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) this.uploadStoryImage(editor, file);
    };
    input.click();
  }

  private uploadStoryImage(editor: Quill, file: File): void {
    if (this.uploadingStory()) return;
    const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
    this.uploadingStory.set(true);
    this.productService
      .uploadStoryImage(file)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.uploadingStory.set(false)),
      )
      .subscribe({
        next: (res) => {
          editor.insertEmbed(range.index, 'image', res.data.url, 'user');
          editor.setSelection(range.index + 1, 0);
        },
        error: () => {
          this.notify.apiError(null, 'products.form.imageUploadFailed', 'Could not upload the image');
        },
      });
  }

  private localizedName(
    translations: { language: string; name: string }[],
    fallback: string,
  ): string {
    const lang = this.language.current();
    return (
      translations.find((t) => t.language?.toLowerCase() === lang)?.name ??
      translations.find((t) => t.language?.toLowerCase() === 'en')?.name ??
      translations[0]?.name ??
      fallback
    );
  }

  getCategoryName(slug: string): string {
    const c = this.categories().find((c) => c.slug === slug);
    return c ? this.localizedName(c.translations, slug) : slug;
  }

  getOriginName(slug: string): string {
    const o = this.origins().find((o) => o.slug === slug);
    return o?.name ?? slug;
  }

  getFarmName(slug: string): string {
    const f = this.farms().find((f) => f.slug === slug);
    return f ? this.localizedName(f.translations, slug) : slug;
  }

  getRoastLevelName(slug: string): string {
    const r = this.roastLevels().find((r) => r.slug === slug);
    return r ? this.localizedName(r.translations, slug) : slug;
  }

  getProcessingMethodName(slug: string): string {
    const p = this.processingMethods().find((p) => p.slug === slug);
    return p ? this.localizedName(p.translations, slug) : slug;
  }

  getCoffeeVarietyName(slug: string): string {
    const v = this.coffeeVarieties().find((v) => v.slug === slug);
    return v ? this.localizedName(v.translations, slug) : slug;
  }
}
