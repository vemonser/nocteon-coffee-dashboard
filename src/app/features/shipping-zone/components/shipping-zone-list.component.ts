import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { ShippingZoneRequest, ShippingZoneResponse } from '../models/shipping-zone.model';
import { ShippingZoneService } from '../services/shipping-zone.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmLabelImports } from '@spartan-ng/helm/label';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucidePencil,
  lucideTrash2,
  lucideX,
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-shipping-zone-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmDialogImports,
    HlmTableImports,
    HlmLabelImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucidePlus,
      lucideSearch,
      lucidePencil,
      lucideTrash2,
      lucideX,
      lucideCheck,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './shipping-zone-list.component.html',
})
export class ShippingZoneListComponent extends BaseListComponent<
  ShippingZoneResponse,
  ShippingZoneRequest,
  string
> {
  private shippingZoneService = inject(ShippingZoneService);
  protected router = inject(Router);

  protected override getId(item: ShippingZoneResponse): string {
    return String(item.id);
  }

  goToDetail(item: ShippingZoneResponse): void {
    this.router.navigate(['/dashboard/shipping-zones', item.id]);
  }

  private columnHelper = createColumnHelper<ShippingZoneResponse>();
  columns: ColumnDef<ShippingZoneResponse, any>[] = [
    this.columnHelper.accessor('id', {
      header: 'ID',
      enableSorting: true,
    }),
    this.columnHelper.accessor('name', {
      header: 'Name',
      enableSorting: true,
    }),
    this.columnHelper.accessor('shippingCost', {
      header: 'Shipping Cost',
      enableSorting: true,
    }),
    this.columnHelper.accessor((row): string => row.cities?.join(', ') ?? '—', {
      id: 'cities',
      header: 'Cities',
      enableSorting: false,
    }),
    this.columnHelper.accessor('active', {
      id: 'isActive',
      header: 'Active',
      enableSorting: true,
    }),
    this.columnHelper.accessor('createdAt', {
      header: 'Created At',
      enableSorting: true,
    }),
    this.columnHelper.accessor('updatedAt', {
      header: 'Updated At',
      enableSorting: true,
    }),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  protected override loadPage(): Observable<PageResponse<ShippingZoneResponse>> {
    return this.shippingZoneService
      .getAll({
        page: this.currentPage(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .pipe(map((res) => res.data));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      shippingCost: [0, [Validators.required, Validators.min(0)]],
      cities: ['', Validators.required],
      active: [true],
    });
  }

  protected override onEditOpen(item: ShippingZoneResponse): void {
    this.form.patchValue({
      name: item.name,
      shippingCost: item.shippingCost,
      cities: item.cities?.join(', ') ?? '',
      active: item.active,
    });
  }

  protected override toRequest(): ShippingZoneRequest {
    return {
      name: this.form.value.name,
      shippingCost: Number(this.form.value.shippingCost),
      cities: (this.form.value.cities ?? '')
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0),
      active: this.form.value.active,
    };
  }

  protected override callCreate(req: ShippingZoneRequest) {
    return this.shippingZoneService.create(req);
  }

  protected override callUpdate(id: string, req: ShippingZoneRequest) {
    return this.shippingZoneService.update(id, req);
  }

  protected override callDelete(id: string) {
    return this.shippingZoneService.delete(id);
  }
}
