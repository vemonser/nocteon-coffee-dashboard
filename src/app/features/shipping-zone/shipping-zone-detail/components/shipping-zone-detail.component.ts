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
  lucideMapPin,
  lucideCheck,
  lucideX,
  lucideLoader2,
} from '@ng-icons/lucide';

import { ShippingZoneService } from '../../services/shipping-zone.service';
import { ShippingZoneRequest, ShippingZoneResponse } from '../../models/shipping-zone.model';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';

type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-shipping-zone-detail',
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
      lucideMapPin,
      lucideCheck,
      lucideX,
      lucideLoader2,
    }),
  ],
  templateUrl: './shipping-zone-detail.component.html',
})
export class ShippingZoneDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private shippingZoneService = inject(ShippingZoneService);
  private breadcrumbService = inject(BreadcrumbService);

  protected readonly Math = Math;

  readonly zone = signal<ShippingZoneResponse | null>(null);
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
        map((params) => params.get('id')),
        switchMap((id) => {
          if (!id) {
            this.error.set('Shipping zone not found');
            return of(null);
          }
          this.loading.set(true);
          return this.shippingZoneService.getById(id).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load shipping zone');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.zone.set(res.data);
          this.buildForm(res.data);

          const displayName = res.data.name || String(res.data.id);
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildForm(data: ShippingZoneResponse): void {
    this.form = this.fb.group({
      name: [data.name, Validators.required],
      shippingCost: [data.shippingCost, [Validators.required, Validators.min(0)]],
      cities: [data.cities?.join(', ') ?? '', Validators.required],
      active: [data.active],
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
    const data = this.zone();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const id = this.zone()?.id;
    if (id == null) return;

    this.saving.set(true);

    const req: ShippingZoneRequest = {
      name: this.form.value.name,
      shippingCost: Number(this.form.value.shippingCost),
      cities: (this.form.value.cities ?? '')
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0),
      active: this.form.value.active,
    };

    this.shippingZoneService
      .update(String(id), req)
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
          this.zone.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();

          const displayName = res.data.name || String(res.data.id);
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  deleteZone(): void {
    const name = this.zone()?.name;
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const id = this.zone()?.id;
    if (id == null) return;

    this.shippingZoneService.delete(String(id)).subscribe({
      next: () => this.router.navigate(['/dashboard/shipping-zones']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/shipping-zones']);
  }

  get displayCities(): string[] {
    return this.zone()?.cities ?? [];
  }
}
