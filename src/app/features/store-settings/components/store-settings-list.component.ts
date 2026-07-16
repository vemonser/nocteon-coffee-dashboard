import { Component, inject } from '@angular/core';
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

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideCheck,
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
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideX,
      lucideCheck,
    }),
  ],
  templateUrl: './store-settings-list.component.html',
})
export class StoreSettingsListComponent extends BaseListComponent<StoreSettingResponse, StoreSetting> {
  private storeSettingService = inject(StoreSettingService);
  private columnHelper = createColumnHelper<StoreSettingResponse>();

  columns: ColumnDef<StoreSettingResponse, any>[] = [
    this.columnHelper.accessor('id', {
      header: 'ID',
      enableSorting: false,
    }),
    this.columnHelper.accessor('freeShippingThreshold', {
      header: 'Free Shipping Threshold',
      enableSorting: false,
    }),
    this.columnHelper.accessor('createdAt', {
      header: 'Created At',
      enableSorting: false,
    }),
    this.columnHelper.accessor('updatedAt', {
      header: 'Updated At',
      enableSorting: false,
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
    });
  }

  protected override onEditOpen(setting: StoreSetting): void {
    this.form.patchValue({ freeShippingThreshold: setting.freeShippingThreshold });
  }

  protected override toRequest(): StoreSetting {
    return {
      freeShippingThreshold: Number(this.form.value.freeShippingThreshold),
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
