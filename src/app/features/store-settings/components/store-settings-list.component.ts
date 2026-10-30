import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucideTriangleAlert } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { StoreSetting, StoreSettingResponse } from '../models/store-settings.model';
import { StoreSettingService } from '../services/store-settings.service';
import { StoreSettingsService } from '../../../core/settings/store-settings.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { HasUnsavedChanges } from '../../../core/guards/has-unsaved-changes';

/**
 * Store settings — a settings FORM, not a one-row table.
 *
 * <p>The two sections are the two things the API actually stores: the store
 * currency and the shipping rule. The threshold uses the selected currency as
 * its adornment, the currency is a real select instead of a free-text code, and
 * the single Save is disabled until the form is dirty and valid. The API is
 * unchanged (GET /api/settings, PUT /api/dashboard/settings).
 */
@Component({
  selector: 'app-store-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ErrorStateComponent,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    HlmSwitchImports,
    HlmSelectImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [provideIcons({ lucideLoader2, lucideTriangleAlert })],
  templateUrl: './store-settings-list.component.html',
})
export class StoreSettingsListComponent implements HasUnsavedChanges {
  private readonly service = inject(StoreSettingService);
  private readonly storeSettings = inject(StoreSettingsService);
  private readonly notify = inject(NotifyService);
  private readonly permissions = inject(PermissionService);
  private readonly transloco = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);

  /** The ISO codes the store is allowed to use. EGP is the store's default. */
  readonly currencies = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'] as const;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly saved = signal<StoreSettingResponse | null>(null);
  readonly dirty = signal(false);
  readonly formError = signal<string | null>(null);
  readonly isDirtyGuard = signal(false);
  /** The form value as a signal, so the currency warning recomputes. */
  readonly selectedCurrency = signal('EGP');

  /** View and edit are separate grants: a reader may not change the store. */
  readonly canUpdate = computed(() => this.permissions.has('settings:update'));

  readonly currencyChanged = computed(() => {
    const saved = this.saved();
    return !!saved && this.selectedCurrency() !== saved.currency;
  });

  form: FormGroup = this.fb.group({
    freeShippingThreshold: [0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    currency: ['EGP', [Validators.required]],
    isFreeShippingActive: [true],
  });

  constructor() {
    this.load();
    this.form.valueChanges.subscribe(() => {
      const dirty = this.form.dirty;
      this.dirty.set(dirty);
      this.isDirtyGuard.set(dirty);
      this.selectedCurrency.set(String(this.form.value.currency ?? 'EGP'));
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.get().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res?.data) {
          this.loadError.set(true);
          return;
        }
        this.saved.set(res.data);
        this.form.reset(
          {
            freeShippingThreshold: Number(res.data.freeShippingThreshold ?? 0),
            currency: res.data.currency ?? 'EGP',
            isFreeShippingActive: res.data.isFreeShippingActive ?? true,
          },
          { emitEvent: false },
        );
        this.selectedCurrency.set(String(res.data.currency ?? 'EGP'));
        if (!this.canUpdate()) this.form.disable({ emitEvent: false });
        this.dirty.set(false);
        this.isDirtyGuard.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  /** The threshold's adornment follows the selected currency, not a hardcode. */
  get currency(): string {
    return String(this.form?.value?.currency ?? 'EGP');
  }

  canSave(): boolean {
    return this.canUpdate() && this.dirty() && this.form.valid && !this.saving();
  }

  save(): void {
    if (!this.canSave()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const body: StoreSetting = {
      freeShippingThreshold: Number(this.form.value.freeShippingThreshold),
      currency: String(this.form.value.currency),
      isFreeShippingActive: Boolean(this.form.value.isFreeShippingActive),
    };

    this.service.update('', body).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (!res?.data) {
          this.formError.set(this.t('StoreSettingPage.saveFailed', 'Could not save the settings.'));
          return;
        }
        this.saved.set(res.data);
        // Every price in the app formats with this value: re-read it.
        this.storeSettings.load();
        this.form.markAsPristine();
        this.dirty.set(false);
        this.isDirtyGuard.set(false);
        this.formError.set(null);
        this.notify.success('StoreSettingPage.saved', 'Store settings saved');
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(
          err?.error?.message ?? this.t('StoreSettingPage.saveFailed', 'Could not save the settings.'),
        );
      },
    });
  }

  // ─── Unsaved-changes guard (router) ─────────────────────────────────────────

  /** The router guard asks this before leaving; its modal owns the question. */
  isDirty(): boolean {
    return this.isDirtyGuard();
  }

  /** Discard the edits and rebuild the form from the last saved settings. */
  discard(): void {
    const saved = this.saved();
    if (!saved) return;
    this.form.reset(
      {
        freeShippingThreshold: Number(saved.freeShippingThreshold ?? 0),
        currency: saved.currency ?? 'EGP',
        isFreeShippingActive: saved.isFreeShippingActive ?? true,
      },
      { emitEvent: false },
    );
    this.selectedCurrency.set(String(saved.currency ?? 'EGP'));
    this.dirty.set(false);
    this.isDirtyGuard.set(false);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.isDirtyGuard()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  private t(key: string, fallback: string): string {
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
