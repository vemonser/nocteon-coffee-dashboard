import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, tap } from 'rxjs';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucidePencil,
  lucideTrash2,
  lucideImage,
  lucidePackage,
  lucideTag,
  lucideCheck,
  lucideX,
  lucideLoader2,
  lucideGrid3x3,
  lucideList,
  lucideChevronLeft,
  lucideChevronRight,
  lucideEye,
} from '@ng-icons/lucide';
import { PairingService } from '../../services/pairing.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';
import {
  PairingRequest,
  PairingResponse,
  DashboardPairingResponse,
} from '../../models/pairing.model';
import { PageResponse } from '../../../../core/models/api-response.model';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';

type ViewMode = 'list' | 'grid';
type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-pairing-detail',
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
    HlmTableImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePencil,
      lucideTrash2,
      lucideImage,
      lucidePackage,
      lucideTag,
      lucideCheck,
      lucideX,
      lucideLoader2,
      lucideGrid3x3,
      lucideList,
      lucideChevronLeft,
      lucideChevronRight,
      lucideEye,
    }),
  ],
  templateUrl: './pairing-detail.component.html',
})
export class PairingDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private pairingService = inject(PairingService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);

  // For template access
  protected readonly Math = Math;

  readonly pairing = signal<DashboardPairingResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');


  // Form
  form!: FormGroup;

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        switchMap((slug) => {
          if (!slug) {
            this.error.set('Pairing not found');
            return of(null);
          }
          this.loading.set(true);
          return this.pairingService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load ');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.pairing.set(res.data);
          this.buildForm(res.data);

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildForm(data: DashboardPairingResponse): void {
    this.form = this.fb.group({
      isActive: [data.isActive],
      translations: this.translationHelper.buildArray(data.translations, ['description']),
    });

    // ← الإضافة الجديدة: كل مرة الفورم يتغيّر، حدّث الـ signal يدويًا
    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  // ─── Edit Actions ──────────────────────────────────────────────────────────

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.pairing();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    // Resolve slug before flipping `saving` to true, so a missing slug
    // can never leave the Save button stuck on "Saving...".
    const slug = this.pairing()?.slug;
    if (!slug) return;

    this.saving.set(true);

    const req: PairingRequest = {
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    this.pairingService
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
          this.pairing.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();

          // Keep the breadcrumb in sync if the name changed during this edit.
          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  deletePairing(): void {
    const name = this.getTranslationName('en');
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const slug = this.pairing()?.slug;
    if (!slug) return;

    this.pairingService.delete(slug).subscribe({
      next: () => this.router.navigate(['/dashboard/pairings']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/pairings']);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getTranslationName(lang: string): string {
    return this.pairing()?.translations.find((t) => t.language === lang)?.name || '';
  }

  getTranslationDescription(lang: string): string {
    return this.pairing()?.translations.find((t) => t.language === lang)?.description || '';
  }

  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}
