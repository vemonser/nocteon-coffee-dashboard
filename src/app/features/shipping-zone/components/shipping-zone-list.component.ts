import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { AuthService } from '../../../core/auth/auth.service';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { ShippingZoneRequest, ShippingZoneResponse } from '../models/shipping-zone.model';
import { ShippingZoneService } from '../services/shipping-zone.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { map, Observable } from 'rxjs';
import { PageResponse } from '../../../core/models/api-response.model';
import { LanguageService } from '../../../core/i18n/language.service';
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
  lucideList,
} from '@ng-icons/lucide';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { LifecycleTabsComponent } from '../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../shared/components/trash-banner/trash-banner.component';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-shipping-zone-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    PagerComponent,
    LifecycleTabsComponent,
    TrashBannerComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmDialogImports,
    HlmTableImports,
    HlmLabelImports,
    NgIcon,
    TranslocoPipe,
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
      lucideList,
    }),
  ],
  templateUrl: './shipping-zone-list.component.html',
})
export class ShippingZoneListComponent extends BaseListComponent<
  ShippingZoneResponse,
  ShippingZoneRequest,
  number
> {
  private shippingZoneService = inject(ShippingZoneService);
  protected readonly language = inject(LanguageService);
  private auth = inject(AuthService);

  protected override softDeleteEnabled = true;
  protected override canManageTrash = this.auth.hasPermission('shipping_zone:delete');
  protected readonly isTrashAllowed = computed(() => this.auth.hasPermission('shipping_zone:delete'));

  protected override getId(item: ShippingZoneResponse): number {
    return item.id;
  }

  // ─── Soft-delete hooks ───────────────────────────────────────────────────────

  protected override loadTrashPage(): Observable<PageResponse<ShippingZoneResponse>> {
    return this.shippingZoneService.getDeleted(this.trashParams()).pipe(map((res) => res.data));
  }

  private trashParams() {
    return {
      page: this.currentPage(),
      size: this.pageSize(),
      search: this.searchQuery || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
    };
  }

  protected override callRestore(id: number) {
    return this.shippingZoneService.restore(id);
  }

  protected override restoreIdOf(item: ShippingZoneResponse): number | null {
    return typeof item.id === 'number' ? item.id : null;
  }

  protected override permanentDeleteSrv() {
    return this.shippingZoneService;
  }

  readonly rowIdOf = (row: ShippingZoneResponse): number | null =>
    typeof row?.id === 'number' ? row.id : null;

  onSelectionChange(event: { id: number; checked: boolean }): void {
    this.toggleSelection(event.id, event.checked);
  }

  rowName(item: ShippingZoneResponse): string {
    return item.name;
  }

  protected override undoItemLabel(item: ShippingZoneResponse): string {
    return item.name;
  }

  protected override deleteToastKey(): string {
    return 'shippingZones.trash.movedToTrash';
  }

  protected override undoLabel(): string {
    return 'common.undo';
  }
  protected override undoMessage(): string {
    return 'shippingZones.trash.movedToTrash';
  }
  protected override restoreConflictTitle(): string {
    return 'common.restoreConflictTitle';
  }
  protected override restoreConflictBody(): string {
    return 'common.restoreConflictBody';
  }
  protected override restoreNotFoundBody(): string {
    return 'common.restoreNotFound';
  }
  protected override restoreForbiddenBody(): string {
    return 'common.restoreForbidden';
  }
  protected override restoreFailedBody(): string {
    return 'common.restoreFailed';
  }
  protected override permanentDeleteUnsupportedTitle(): string {
    return 'common.permanentDeleteUnavailable';
  }
  protected override permanentDeleteUnsupportedBody(): string {
    return 'common.permanentDeleteUnsupported';
  }

  noResultsKey(): string {
    return this.isTrash() ? 'shippingZones.trash.noResultsInTrash' : 'shippingZones.trash.noResultsInActive';
  }

  readonly showId = signal(false);
  readonly showDates = signal(true);
  readonly columnsOpen = signal(false);

  toggleShowId(value: boolean): void {
    this.showId.set(value);
  }

  toggleShowDates(value: boolean): void {
    this.showDates.set(value);
  }

  private columnHelper = createColumnHelper<ShippingZoneResponse>();

  readonly columns = computed<ColumnDef<ShippingZoneResponse, any>[]>(() => {
    const tail = this.isTrash()
      ? (this.showDates()
          ? [
              this.columnHelper.accessor('deletedAt', {
                id: 'deleted',
                header: 'Deleted',
                enableSorting: true,
                cell: (info) => info.row.original.deletedAt,
                meta: { width: '132px' },
              }),
            ]
          : [])
      : (this.showDates()
          ? [
              this.columnHelper.accessor('createdAt', {
                header: 'Created At',
                enableSorting: true,
                meta: { width: '120px' },
              }),
            ]
          : []);

    return [
      this.columnHelper.accessor('id', {
        header: 'ID',
        enableSorting: true,
        meta: { width: '48px' },
      }),
      this.columnHelper.accessor('name', {
        header: 'Name',
        enableSorting: true,
        meta: { width: '260px' },
      }),
      this.columnHelper.accessor('shippingCost', {
        header: 'Shipping Cost',
        enableSorting: true,
        meta: { width: '160px' },
      }),
      this.columnHelper.accessor((row): string => row.cities?.join(', ') ?? '—', {
        id: 'cities',
        header: 'Cities',
        enableSorting: false,
        meta: { width: 'auto' },
      }),
      this.columnHelper.accessor('active', {
        id: 'isActive',
        header: 'Active',
        enableSorting: true,
        meta: { width: '96px' },
      }),
      ...tail,
      this.actionsColumn,
    ];
  });

  private actionsColumn: ColumnDef<ShippingZoneResponse, any> = this.columnHelper.display({
    id: 'actions',
    header: 'Actions',
  });

  protected override loadPage(): Observable<PageResponse<ShippingZoneResponse>> {
    return this.shippingZoneService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
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

  protected override callUpdate(id: number, req: ShippingZoneRequest) {
    return this.shippingZoneService.update(id, req);
  }

  protected override callDelete(id: number) {
    return this.shippingZoneService.delete(id);
  }
}
