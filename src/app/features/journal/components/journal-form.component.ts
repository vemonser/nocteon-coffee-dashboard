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
import { CategoryService } from '../../categories/services/category.service';
import { ProductService } from '../../products/services/product.service';
import { CategoryResponse } from '../../categories/models/category.model';
import { JournalPostRequest, JournalPostResponse } from '../models/journal.model';
import { QuillEditorComponent, QuillModule } from 'ngx-quill';
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
    // QuillEditorComponent,
    NgIcon,
  ],
  providers: [provideIcons({ lucideArrowLeft, lucideCheck, lucideLoader2, lucideUpload })],
  templateUrl: './journal-form.component.html',
})
export class JournalFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private journalService = inject(JournalService);
  private categoryService = inject(CategoryService);
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly languages: Lang[] = ['en', 'ar'];

  readonly editingSlug = signal<string | null>(null);
  readonly isEditing = computed(() => !!this.editingSlug());

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly categories = signal<CategoryResponse[]>([]);
  readonly products = signal<{ slug: string; name: string }[]>([]);

  readonly coverPreviewUrl = signal<string | null>(null);
  readonly coverFile = signal<File | null>(null);
  readonly existingCoverUrl = signal<string | null>(null);

  readonly activeTab = signal<'basic' | 'translations' | 'products'>('basic');

  form!: FormGroup;

  get translationsArray(): FormArray {
    return this.form.get('translations') as FormArray;
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    this.editingSlug.set(slug);

    this.buildForm();

    forkJoin({
      categories: this.categoryService
        .getAll({ isActive: true })
        .pipe(catchError(() => of({ data: { content: [] } }))),
      products: this.productService
        .getAll({ size: 200 })
        .pipe(catchError(() => of({ data: { content: [] } }))),
      post: slug ? this.journalService.getBySlug(slug).pipe(catchError(() => of(null))) : of(null),
    }).subscribe(({ categories, products, post }) => {
      this.categories.set(categories.data.content);
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
      publishedAt: [null],
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
      publishedAt: post.publishedAt ? post.publishedAt.substring(0, 16) : null,
      productSlugs: post.relatedProductSlugs ?? [],
    });

    // لو الـ getBySlug بيرجّع ترجمة واحدة بس (حسب اللغة الحالية)، هنملى بس الـ en تلقائيًا هنا.
    // لو محتاج كل الترجمات مع بعض، الـ backend محتاج يرجّع array ترجمات كاملة بدل ترجمة واحدة —
    // قولّي لو محتاج نعدّل الـ getBySlug/DTO عشان يرجع الكل وقت التعديل.
    const enGroup = this.translationsArray.at(0);
    enGroup.patchValue({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
    });
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
      publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
      productSlugs: v.productSlugs,
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
