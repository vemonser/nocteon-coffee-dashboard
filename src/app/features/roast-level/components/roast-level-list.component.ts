import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ColumnDef, createColumnHelper } from '@tanstack/angular-table';
import { map, Observable } from 'rxjs';

// Spartan UI
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
} from '@ng-icons/lucide';

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { TranslationFormHelper } from '../../../shared/utils/translation.utils';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/language';
import { PageResponse } from '../../../core/models/api-response.model';

import { RoastLevelRequest, RoastLevelResponse } from '../models/roast-level.model';
import { RoastLevelService } from '../services/roast-level.service';

@Component({
  selector: 'app-roast-level-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    // Spartan
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
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  templateUrl: './roast-level-list.component.html',
})
export class RoastLevelListComponent extends BaseListComponent<
  RoastLevelResponse,
  RoastLevelRequest,
  string
> {
  private roastLevelService = inject(RoastLevelService);
  protected translationHelper = inject(TranslationFormHelper);

  protected override getId(item: RoastLevelResponse): string {
    return item.slug;
  }

  // ─── Columns ──────────────────────────────────────────────────────────────
  private columnHelper = createColumnHelper<RoastLevelResponse>();

  columns: ColumnDef<RoastLevelResponse, any>[] = [
    this.columnHelper.accessor('id', {
      header: 'ID',
      enableSorting: true,
    }),
    this.columnHelper.accessor('slug', {
      header: 'Slug',
      enableSorting: true,
    }),
    this.columnHelper.accessor('color', {
      header: 'Color',
      enableSorting: false,
    }),
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.name ?? '—',
        {
          id: `name_${lang.code}`,
          header: `Name (${lang.label})`,
          enableSorting: false,
        },
      ),
    ),
    ...SUPPORTED_LANGUAGES.map((lang) =>
      this.columnHelper.accessor(
        (row): string => row.translations.find((t) => t.language === lang.code)?.description ?? '—',
        {
          id: `desc_${lang.code}`,
          header: `Desc (${lang.label})`,
          enableSorting: false,
        },
      ),
    ),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
    }),
  ];

  // ─── Base contract ────────────────────────────────────────────────────────

  protected override loadPage(): Observable<PageResponse<RoastLevelResponse>> {
    return this.roastLevelService
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
      color: ['#8B4513', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
      translations: this.translationHelper.buildArray([], ['description']),
    });
  }

  protected override onEditOpen(item: RoastLevelResponse): void {
    this.form.patchValue({ color: item.color });
    this.translationHelper.patchArray(this.translationsArray, item.translations, ['description']);
  }

  protected override toRequest(): RoastLevelRequest {
    return {
      color: this.form.value.color,
      translations: this.translationsArray.value.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  protected override callCreate(req: RoastLevelRequest) {
    return this.roastLevelService.create(req);
  }

  protected override callUpdate(slug: string, req: RoastLevelRequest) {
    return this.roastLevelService.update(slug, req);
  }

  protected override callDelete(slug: string) {
    return this.roastLevelService.delete(slug);
  }
}