import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { StoreSetting, StoreSettingResponse } from '../models/store-settings.model';
import { StoreSettingService } from '../services/store-settings.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { A11yModule } from '@angular/cdk/a11y';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideCheck,
  lucideLoader2,
} from '@ng-icons/lucide';

import { TranslocoPipe } from '@jsverse/transloco';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'store-settings-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DataTableComponent,
    TranslocoPipe,
    HlmButtonImports,
    HlmInputImports,
    HlmDialogImports,
    HlmLabelImports,
    HlmSwitchImports,
    A11yModule,
    NgIcon,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucideX,
      lucideCheck,
    }),
  ],
  templateUrl: './store-settings-list.component.html',
})
export class StoreSettingsListComponent extends BaseListComponent<StoreSettingResponse, StoreSetting> {
  /** Esc closes the edit dialog — every overlay in the app must have that. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showDialog()) this.closeDialog();
  }

  private storeSettingService = inject(StoreSettingService);
  private columnHelper = createColumnHelper<StoreSettingResponse>();

  columns: ColumnDef<StoreSettingResponse, any>[] = [
    this.columnHelper.accessor('id', {
      header: 'ID',
      enableSorting: false,
    }),
    this.columnHelper.accessor('currency', {
      header: 'Currency',
      enableSorting: false,
    }),
    this.columnHelper.accessor('freeShippingThreshold', {
      header: 'Free Shipping Threshold',
      enableSorting: false,
    }),
    this.columnHelper.accessor('isFreeShippingActive', {
      header: 'Free Shipping Active',
      enableSorting: false,
      cell: (info) => (info.getValue() ? 'Yes' : 'No'),
    }),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  protected override getId(item: StoreSettingResponse): string {
    return String(item.id);
  }

  // GET returns a single settings object — wrap it into a one-row page
  // so the BaseListComponent contract (PageResponse) is satisfied.
  protected override loadPage(): Observable<PageResponse<StoreSettingResponse>> {
    return this.storeSettingService.get().pipe(
      map((res) => ({
        content: [res.data],
        page: 0,
        size: 1,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      })),
    );
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      freeShippingThreshold: [null, Validators.required],
      currency: ['EGP', [Validators.required, Validators.minLength(3), Validators.maxLength(3), Validators.pattern(/^[A-Z]{3}$/)]],
      isFreeShippingActive: [true],
    });
  }

  protected override onEditOpen(setting: StoreSetting): void {
    this.form.patchValue({
      freeShippingThreshold: setting.freeShippingThreshold,
      currency: setting.currency ?? 'EGP',
      isFreeShippingActive: setting.isFreeShippingActive ?? true,
    });
  }

  protected override toRequest(): StoreSetting {
    return {
      freeShippingThreshold: Number(this.form.value.freeShippingThreshold),
      currency: String(this.form.value.currency).toUpperCase(),
      isFreeShippingActive: Boolean(this.form.value.isFreeShippingActive),
    };
  }

  protected override callCreate(req: StoreSetting, image?: File) {
    return this.storeSettingService.create(req, image, 'json');
  }

  protected override callUpdate(slug: string, req: StoreSetting, image?: File) {
    return this.storeSettingService.update(slug, req, image, 'json');
  }

  protected override callDelete(slug: string) {
    return this.storeSettingService.delete(slug);
  }
}
