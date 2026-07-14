import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ColumnDef, createColumnHelper } from '@tanstack/table-core';

import { map, Observable } from 'rxjs';


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
  lucideChevronLeft,
  lucideChevronRight,
  lucideCheck,
} from '@ng-icons/lucide';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { BrewingMethodRequest, BrewingMethodResponse, DashboardBrewingMethodResponse } from '../models/brewing-method.model';
import { BrewingMethodService } from '../services/brewing-method.service';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { Router } from '@angular/router';



@Component({
  selector: 'app-brewing-methods-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    HasPermissionDirective, DataTableComponent,
    HlmCardImports, HlmButtonImports, HlmBadgeImports,
    HlmInputImports, HlmSkeletonImports, HlmLabelImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucidePlus, lucideSearch, lucidePencil, lucideTrash2,
      lucideX, lucideCheck, lucideChevronLeft, lucideChevronRight,
    }),
  ],
  templateUrl: './brewing-methods-list.component.html',
})
export class BrewingMethodsListComponent extends BaseListComponent<
  DashboardBrewingMethodResponse,
  BrewingMethodRequest
> {
  private brewingMethodService = inject(BrewingMethodService);
  protected translationHelper = inject(TranslationFormHelper);
  protected router = inject(Router);

  protected override getId(item: DashboardBrewingMethodResponse): string {
    return item.slug;
  }

  private columnHelper = createColumnHelper<DashboardBrewingMethodResponse>();
  columns: ColumnDef<DashboardBrewingMethodResponse, any>[] = [
    this.columnHelper.accessor('id', { header: 'ID', enableSorting: true }),
    this.columnHelper.accessor('slug', { header: 'Slug', enableSorting: true }),
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.name ?? '—',
        {
          id: `name_${lang.code}`,
          header: `Name (${lang.label})`,
          enableSorting: false, // زي ما اتفقنا: مش عمود DB حقيقي
        },
      ),
    ),
    this.columnHelper.accessor('createdAt', { header: 'created at', enableSorting: true }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
  ];

  protected override loadPage(): Observable<PageResponse<DashboardBrewingMethodResponse>> {
    return this.brewingMethodService
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
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(item: DashboardBrewingMethodResponse): void {
    this.translationHelper.patchArray(this.translationsArray, item.translations, ['description']);
  }

  protected override toRequest(): BrewingMethodRequest {
    return {
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: BrewingMethodRequest) {
    return this.brewingMethodService.create(req, undefined, 'json');
  }

  protected override callUpdate(slug: string, req: BrewingMethodRequest) {
    return this.brewingMethodService.update(slug, req, undefined, 'json');
  }

  protected override callDelete(slug: string) {
    return this.brewingMethodService.delete(slug);
  }

  goToDetail(item: DashboardBrewingMethodResponse): void {
    this.router.navigate(['/dashboard/brewing-methods', item.slug]);
  }


}