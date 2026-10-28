import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideCheck, lucideLoader2, lucideUpload } from '@ng-icons/lucide';
import { JournalService } from '../services/journal.service';
import { ProductService } from '../../products/services/product.service';
import { JournalCategory, JournalPostRequest, JournalPostResponse } from '../models/journal.model';
import { QuillEditorComponent } from 'ngx-quill';
import Quill from 'quill';
import { QUILL_CONFIG_TOKEN } from 'ngx-quill/config';

import { TranslocoPipe } from '@jsverse/transloco';
import { NotifyService } from '../../../core/notify/notify.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { toLocalInputValue } from '../../../shared/utils/date-input';
type Lang = 'en' | 'ar';

@Component({
  selector: 'app-journal-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    HlmCardImports,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    HlmSelectImports,
    HlmTabsImports,
    HlmBadgeImports,
    QuillEditorComponent,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    // The editor config lives with the only page that has an editor:
    // `provideQuillConfig` in app.config pulled Quill into the initial bundle.
    {
      provide: QUILL_CONFIG_TOKEN,
      useValue: {
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ header: [1, 2, 3, false] }],
            ['link', 'image', 'blockquote'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['clean'],
          ],
        },
      },
    },
    provideIcons({ lucideArrowLeft, lucideCheck, lucideLoader2, lucideUpload }),
  ],
  templateUrl: './journal-form.component.html',
  styles: [':host ::ng-deep .ql-editor img { max-width: 100%; height: auto; }'],
})
export class JournalFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private journalService = inject(JournalService);
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private language = inject(LanguageService);

  readonly languages: Lang[] = ['en', 'ar'];

  readonly editingSlug = signal<string | null>(null);
  readonly isEditing = computed(() => !!this.editingSlug());

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly categories = signal<JournalCategory[]>([]);
  readonly products = signal<{ slug: string; name: string }[]>([]);

  readonly coverPreviewUrl = signal<string | null>(null);
  readonly coverFile = signal<File | null>(null);
  readonly existingCoverUrl = signal<string | null>(null);

  readonly activeTab = signal<'basic' | 'translations' | 'products'>('basic');
  readonly uploadingImage = signal(false);

  form!: FormGroup;



  get translationsArray(): FormArray {
    return this.form.get('translations') as FormArray;
  }

  private notify = inject(NotifyService);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    this.editingSlug.set(slug);

    this.buildForm();

    let preloadError = false;
    const warnPreload = () => {
      // Only the POST load reports its own not-found; a failed categories/products
      // preload must not look like an empty store — say so once.
      if (preloadError) return;
      preloadError = true;
      this.notify.apiError(null, 'notify.errorFallback', 'Could not load categories or products');
    };
    forkJoin({
      categories: this.journalService
        .getCategories()
        .pipe(catchError(() => (warnPreload(), of({ data: [] })))),
      products: this.productService
        .getAll({ size: 200 })
        .pipe(catchError(() => (warnPreload(), of({ data: { content: [] } })))),
      post: slug ? this.journalService.getBySlug(slug).pipe(catchError(() => of(null))) : of(null),
    }).subscribe(({ categories, products, post }) => {
      this.categories.set(categories.data);
      this.products.set(
        products.data.content.map((p: any) => ({ slug: p.slug, name: p.name ?? p.slug })),
      );

      if (slug) {
        if (post?.data) {
          this.patchForm(post.data);
        } else {
          this.error.set('Journal post not found');
        }
      }

      this.loading.set(false);
    });
  }

  private buildForm(): void {
    this.form = this.fb.group({
      categorySlug: ['', Validators.required],
      featured: [false],
      status: ['DRAFT', Validators.required],
      publishedAt: [null],
      tagsInput: [''],
      productSlugs: [[] as string[]],
      translations: this.fb.array(
        this.languages.map((lang) =>
          this.fb.group({
            language: [lang],
            title: ['', lang === 'en' ? [Validators.required] : []],
            excerpt: [''],
            content: ['', lang === 'en' ? [Validators.required] : []],
            metaTitle: [''],
            metaDescription: [''],
          }),
        ),
      ),
    });
  }

  private patchForm(post: JournalPostResponse): void {
    this.existingCoverUrl.set(post.coverImageUrl);
    this.form.patchValue({
      categorySlug: post.categorySlug,
      featured: post.featured,
      status: post.status,
      publishedAt: toLocalInputValue(post.publishedAt) || null,
      tagsInput: (post.tags ?? []).join(', '),
      productSlugs: post.relatedProductSlugs ?? [],
    });

    // The dashboard detail endpoint returns one entry per language; the old code read
    // `post.title`/`post.content`, which that DTO does not have, so every edit opened
    // blank and could not be saved (the English title is required).
    const translations = post.translations ?? [];
    this.translationsArray.controls.forEach((group) => {
      const language = group.get('language')?.value;
      const translation = translations.find((t) => t.language === language);
      group.patchValue({
        title: translation?.title ?? '',
        excerpt: translation?.excerpt ?? '',
        content: translation?.content ?? '',
        metaTitle: translation?.metaTitle ?? '',
        metaDescription: translation?.metaDescription ?? '',
      });
    });

    if (translations.length === 0) {
      // Older responses carried a single, already-localized translation.
      this.translationsArray.at(0).patchValue({
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
      });
    }
  }

  onEditorCreated(editor: Quill): void {
    // One handler per editor: the page renders English and Arabic editors side by side, and a
    // shared field would insert the image into whichever editor was created last.
    const toolbar = editor.getModule('toolbar') as { addHandler: (name: string, fn: () => void) => void };
    toolbar.addHandler('image', () => this.pickInlineImage(editor));
  }

  private pickInlineImage(editor: Quill): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) this.uploadInlineImage(editor, file);
    };
    input.click();
  }

  private uploadInlineImage(editor: Quill, file: File): void {
    this.uploadingImage.set(true);
    this.journalService.uploadInlineImage(file).subscribe({
      next: (res) => {
        const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
        editor.insertEmbed(range.index, 'image', res.data.url, 'user');
        editor.setSelection(range.index + 1, 0);
        this.uploadingImage.set(false);
      },
      error: () => {
        // The editor keeps its content; only the upload failed.
        this.uploadingImage.set(false);
        this.notify.apiError(null, 'journal.imageUploadFailed', 'Could not upload the image');
      },
    });
  }

  /** The picker shows the category's name in the current language, falling back to English. */
  categoryName(category: JournalCategory): string {
    const language = this.language.current();
    return (
      category.translations.find((t) => t.language === language)?.title ??
      category.translations.find((t) => t.language === 'en')?.title ??
      category.slug
    );
  }

  onCoverSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.coverFile.set(file);
    this.coverPreviewUrl.set(URL.createObjectURL(file));
  }

  toggleProduct(slug: string): void {
    const current: string[] = this.form.value.productSlugs;
    const updated = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    this.form.patchValue({ productSlugs: updated });
  }

  setTab(tab: 'basic' | 'translations' | 'products'): void {
    this.activeTab.set(tab);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.activeTab.set(this.form.get('categorySlug')?.invalid ? 'basic' : 'translations');
      return;
    }

    this.saving.set(true);
    const v = this.form.value;

    const request: JournalPostRequest = {
      categorySlug: v.categorySlug,
      featured: v.featured,
      status: v.status ?? 'DRAFT',
      publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
      productSlugs: v.productSlugs,
      tags: (v.tagsInput ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
      translations: v.translations.filter((t: any) => t.title?.trim() && t.content?.trim()),
    };

    const slug = this.editingSlug();
    const req$ = slug
      ? this.journalService.update(slug, request, this.coverFile())
      : this.journalService.create(request, this.coverFile());

    req$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.router.navigate(['/dashboard/journal']);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Failed to save post');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/journal']);
  }
}