import { Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
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
import { lucidePencil } from '@ng-icons/lucide';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { QuillEditorComponent } from 'ngx-quill';
import { QUILL_CONFIG_TOKEN } from 'ngx-quill/config';
import Quill from 'quill';
import '../../../../../shared/quill/divider.blot';
import { finalize } from 'rxjs';
import { RICH_TEXT_QUILL_CONFIG } from '../../../../../shared/quill/rich-text.config';
import { RichTextVideoDialogComponent } from '../../../../../shared/ui/rich-text-video-dialog/rich-text-video-dialog.component';
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
    RichTextVideoDialogComponent,
    RouterLink,
  ],
  providers: [
    { provide: QUILL_CONFIG_TOKEN, useValue: RICH_TEXT_QUILL_CONFIG },
    provideIcons({ lucidePencil }),
  ],
  templateUrl: './basic-info-step.component.html',
})
export class BasicInfoStepComponent {
  /** Store the editor's real HTML (semantic HTML would turn a video into a link). */
  readonly htmlValueGetter = (editor: Quill): string => editor.root.innerHTML;
  readonly uploadingStory = signal(false);
  readonly storyVideoOpen = signal(false);
  private storyVideoEditor: Quill | null = null;
  private storyVideoRange: { index: number; length: number } | null = null;

  protected state = inject(ProductWizardStateService);
  protected translationHelper = inject(TranslationFormHelper);
  private wizard = inject(ProductWizardComponent);

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
  readonly translationLanguages: { code: 'en' | 'ar'; label: string; dir: 'ltr' | 'rtl' }[] = [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'ar', label: 'العربي', dir: 'rtl' },
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

  constructor() {
    effect(() => {
      this.language.current();
      for (const { button, key } of this.toolbarActions) {
        const label = this.transloco.translate(key);
        button.title = label;
        button.setAttribute('aria-label', label);
      }
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

  saveCurrentStep(): void {
    this.wizard.saveCurrentStep();
  }

  onCancel(): void {
    this.wizard.onCancel();
  }

  onStoryEditorCreated(editor: Quill): void {
    const toolbar = editor.getModule('toolbar') as { addHandler: (name: string, fn: () => void) => void };
    toolbar.addHandler('image', () => this.pickStoryImage(editor));
    this.addToolbarAction(editor, '↶', 'journal.undo', () => editor.history.undo());
    this.addToolbarAction(editor, '↷', 'journal.redo', () => editor.history.redo());
    this.addToolbarAction(editor, '―', 'journal.horizontalRule', () => {
      const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      editor.insertEmbed(range.index, 'divider', true, 'user');
      editor.setSelection(range.index + 1, 0);
    });
    toolbar.addHandler('video', () => {
      this.storyVideoEditor = editor;
      this.storyVideoRange = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      this.storyVideoOpen.set(true);
    });
  }

  private addToolbarAction(editor: Quill, label: string, titleKey: string, action: () => void): void {
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
    container.appendChild(button);
    this.toolbarActions.push({ button, key: titleKey });
  }

  closeStoryVideo(): void {
    this.storyVideoOpen.set(false);
    this.storyVideoEditor = null;
    this.storyVideoRange = null;
  }

  onStoryVideoInserted(url: string): void {
    const editor = this.storyVideoEditor;
    if (!editor) return;
    const range = this.storyVideoRange ?? editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
    editor.insertEmbed(range.index, 'video', url, 'user');
    editor.setSelection(range.index + 1, 0);
    this.closeStoryVideo();
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

  isCurrentStepDirty(): boolean {
    return this.wizard.isCurrentStepDirty();
  }

  isCurrentStepValid(): boolean {
    return this.state.isCurrentStepValid();
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
