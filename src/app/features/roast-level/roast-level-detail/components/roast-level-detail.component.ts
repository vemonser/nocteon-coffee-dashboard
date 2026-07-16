import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  lucidePalette,
  lucideCheck,
  lucideX,
  lucideLoader2,
} from '@ng-icons/lucide';

import { RoastLevelService } from '../../services/roast-level.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';
import { RoastLevelRequest, RoastLevelResponse } from '../../models/roast-level.model';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';

type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-roast-level-detail',
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
      lucidePalette,
      lucideCheck,
      lucideX,
      lucideLoader2,
    }),
  ],
  templateUrl: './roast-level-detail.component.html',
})
export class RoastLevelDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private roastLevelService = inject(RoastLevelService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);

  protected readonly Math = Math;

  readonly level = signal<RoastLevelResponse | null>(null);
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
            this.error.set('Roast level not found');
            return of(null);
          }
          this.loading.set(true);
          return this.roastLevelService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load roast level');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.level.set(res.data);
          this.buildForm(res.data);

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildForm(data: RoastLevelResponse): void {
    this.form = this.fb.group({
      color: [
        data.color,
        [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
      ],
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
    const data = this.level();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const slug = this.level()?.slug;
    if (!slug) return;

    this.saving.set(true);

    const req: RoastLevelRequest = {
      color: this.form.value.color,
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    this.roastLevelService
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
          this.level.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  deleteLevel(): void {
    const name = this.getTranslationName('en');
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const slug = this.level()?.slug;
    if (!slug) return;

    this.roastLevelService.delete(slug).subscribe({
      next: () => this.router.navigate(['/dashboard/roast-levels']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/roast-levels']);
  }

  getTranslationName(lang: string): string {
    return this.level()?.translations.find((t: { language: string }) => t.language === lang)?.name || '';
  }

  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}
