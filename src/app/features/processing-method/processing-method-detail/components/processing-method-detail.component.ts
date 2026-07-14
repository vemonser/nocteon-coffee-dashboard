import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, tap } from 'rxjs';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucidePencil,
  lucideTrash2,
  lucideTag,
  lucideCheck,
  lucideX,
  lucideLoader2,
} from '@ng-icons/lucide';


import {
  ProcessingMethodRequest,
  DashboardProcessingMethodResponse,
} from '../../models/processing-method.model';
import { ProcessingMethodService } from '../../services/processing-method.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';


type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-processing-method-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSkeletonImports,
    HlmSeparatorImports,
    HlmInputImports,
    HlmLabelImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePencil,
      lucideTrash2,
      lucideTag,
      lucideCheck,
      lucideX,
      lucideLoader2,
    }),
  ],
  templateUrl: './processing-method-detail.component.html',
})
export class ProcessingMethodDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private processingMethodService = inject(ProcessingMethodService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);

  protected readonly Math = Math;

  readonly method = signal<DashboardProcessingMethodResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');

  form!: FormGroup;

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        switchMap((slug) => {
          if (!slug) {
            this.error.set('Processing method not found');
            return of(null);
          }
          this.loading.set(true);
          return this.processingMethodService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load processing method');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.method.set(res.data);
          this.buildForm(res.data);

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildForm(data: DashboardProcessingMethodResponse): void {
    this.form = this.fb.group({
      translations: this.translationHelper.buildArray(data.translations, ['description']),
    });

    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.method();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const slug = this.method()?.slug;
    if (!slug) return;

    this.saving.set(true);

    const req: ProcessingMethodRequest = {
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    this.processingMethodService
      .update(slug, req)
      .pipe(
        tap(() => this.saving.set(false)),
        catchError((err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Failed to save');
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res?.data) {
          this.method.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  deleteMethod(): void {
    const name = this.getTranslationName('en');
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const slug = this.method()?.slug;
    if (!slug) return;

    this.processingMethodService.delete(slug).subscribe({
      next: () => this.router.navigate(['/dashboard/processing-methods']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/processing-methods']);
  }

  getTranslationName(lang: string): string {
    return this.method()?.translations.find((t: { language: string }) => t.language === lang)?.name || '';
  }

  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}
