import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucideMoreVertical, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { UnsavedChangesDialogService } from '../../../core/services/unsaved-changes-dialog.service';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';
import { ProductTag } from '../models/product-tag.model';
import { ProductTagService } from '../services/product-tag.service';

/**
 * FE-10: the labels the catalogue is merchandised with.
 *
 * <p>Same contract as the journal categories page: products, the list filter and the public API
 * all point at the slug, so this edits translated names only. A tag that products still carry
 * cannot be deleted — the API answers 409 with the count and the message is shown as-is.
 */
@Component({
  selector: 'app-product-tags',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDropdownMenuImports,
    HlmInputImports,
    HlmLabel,
    DialogShellComponent,
    HasPermissionDirective,
    TranslocoPipe,
    NgIcon,
  ],
  providers: [provideIcons({ lucideLoader2, lucideMoreVertical, lucidePencil, lucidePlus, lucideTrash2 })],
  template: `
    <div class="page-shell">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-medium tracking-tight">{{ 'productTags.title' | transloco }}</h1>
          <p class="text-sm text-muted-foreground">{{ 'productTags.subtitle' | transloco }}</p>
        </div>
        <button hlmBtn type="button" *hasPermission="'product:create'" (click)="openCreate()">
          <ng-icon name="lucidePlus" class="me-2 size-4" aria-hidden="true" />
          {{ 'productTags.add' | transloco }}
        </button>
      </div>

      @if (loading()) {
        <div class="space-y-3">
          @for (row of [1, 2, 3]; track row) {
            <div class="h-16 animate-pulse rounded-md bg-muted"></div>
          }
        </div>
      } @else if (error()) {
        <div class="rounded-md border border-destructive/40 bg-destructive-soft p-4">
          <p class="text-sm text-destructive">{{ 'productTags.loadFailed' | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" class="mt-3" type="button" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (tags().length === 0) {
        <div class="rounded-md border-2 border-dashed px-6 py-16 text-center">
          <p class="font-medium">{{ 'productTags.empty' | transloco }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ 'productTags.emptyHint' | transloco }}</p>
        </div>
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (tag of tags(); track tag.id) {
            <div class="card-surface flex flex-col gap-3 p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ nameOf(tag) }}</p>
                  <p class="truncate text-xs text-muted-foreground">/{{ tag.slug }}</p>
                </div>
                <button
                  type="button"
                  hlmBtn
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  [hlmDropdownMenuTrigger]="rowMenu"
                  align="end"
                  [attr.aria-label]="'common.actions' | transloco"
                  [title]="'common.actions' | transloco"
                >
                  <ng-icon name="lucideMoreVertical" class="size-4" aria-hidden="true" />
                </button>

                <ng-template #rowMenu>
                  <hlm-dropdown-menu class="min-w-40 rounded-md">
                    <button
                      *hasPermission="'product:update'"
                      hlmDropdownMenuItem
                      class="flex items-center gap-2"
                      (click)="openRename(tag)"
                    >
                      <ng-icon name="lucidePencil" class="size-4 shrink-0" aria-hidden="true" />
                      <span>{{ 'productTags.edit' | transloco }}</span>
                    </button>
                    <button
                      *hasPermission="'product:delete'"
                      hlmDropdownMenuItem
                      class="flex items-center gap-2 text-destructive-text"
                      [disabled]="deletingId() === tag.id"
                      (click)="askDelete(tag)"
                    >
                      <ng-icon name="lucideTrash2" class="size-4 shrink-0" aria-hidden="true" />
                      <span>{{ 'common.delete' | transloco }}</span>
                    </button>
                  </hlm-dropdown-menu>
                </ng-template>
              </div>
              <div class="flex flex-wrap gap-1.5">
                @for (translation of tag.translations; track $index) {
                  <hlm-badge variant="outline">{{ translation.title }}</hlm-badge>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-dialog-shell
      [open]="editorOpen()"
      [title]="(editing() ? 'productTags.edit' : 'productTags.add') | transloco"
      testId="product-tag-editor"
      (closed)="closeEditor()"
    >
      <form [formGroup]="form" class="space-y-4" (ngSubmit)="save()">
        <div class="space-y-1.5">
          <label hlmLabel for="tag-name-en">{{ 'productTags.nameEn' | transloco }} *</label>
          <input hlmInput id="tag-name-en" formControlName="enName" type="text" class="w-full" dir="ltr" />
          @if (form.controls.enName.touched && form.controls.enName.invalid) {
            <p class="text-xs text-destructive">{{ 'productTags.nameRequired' | transloco }}</p>
          }
        </div>
        <div class="space-y-1.5">
          <label hlmLabel for="tag-name-ar">{{ 'productTags.nameAr' | transloco }} *</label>
          <input hlmInput id="tag-name-ar" formControlName="arName" type="text" class="w-full" dir="rtl" />
          @if (form.controls.arName.touched && form.controls.arName.invalid) {
            <p class="text-xs text-destructive">{{ 'productTags.nameRequired' | transloco }}</p>
          }
        </div>
        <p class="text-xs text-muted-foreground">{{ 'productTags.slugHint' | transloco }}</p>
      </form>

      <div dialog-footer-start>
        <button hlmBtn variant="ghost" type="button" (click)="closeEditor()">
          {{ 'common.cancel' | transloco }}
        </button>
      </div>
      <button
        dialog-footer-end
        hlmBtn
        type="button"
        [disabled]="saving() || form.invalid || !isDirty()"
        (click)="save()"
      >
        @if (saving()) {
          <ng-icon name="lucideLoader2" class="me-2 size-4 animate-spin" aria-hidden="true" />
        }
        {{ (editing() ? 'productTags.saveName' : 'productTags.add') | transloco }}
      </button>
    </app-dialog-shell>
  `,
})
export class ProductTagsComponent implements OnInit {
  private tagService = inject(ProductTagService);
  private language = inject(LanguageService);
  private notify = inject(NotifyService);
  private confirmDialog = inject(ConfirmDialogService);
  private unsavedDialog = inject(UnsavedChangesDialogService);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);

  readonly tags = signal<ProductTag[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly editing = signal<ProductTag | null>(null);
  readonly deletingId = signal<number | null>(null);
  private readonly initialSnapshot = signal('');

  readonly form = this.fb.group({
    enName: ['', [Validators.required, Validators.minLength(2)]],
    arName: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.tagService.getAll().subscribe({
      next: (res) => {
        this.tags.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  nameOf(tag: ProductTag): string {
    const language = this.language.current();
    return (
      tag.translations.find((t) => t.language === language)?.title ??
      tag.translations.find((t) => t.language === 'en')?.title ??
      tag.slug
    );
  }

  /** Trimmed deep-compare of the two names, the app's dirty rule for forms. */
  isDirty(): boolean {
    return this.snapshot() !== this.initialSnapshot();
  }

  private snapshot(): string {
    const value = this.form.getRawValue();
    return JSON.stringify({
      en: (value.enName ?? '').trim(),
      ar: (value.arName ?? '').trim(),
    });
  }

  private captureInitial(): void {
    this.initialSnapshot.set(this.snapshot());
    this.form.markAsPristine();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ enName: '', arName: '' });
    this.captureInitial();
    this.editorOpen.set(true);
  }

  openRename(tag: ProductTag): void {
    this.editing.set(tag);
    this.form.reset({
      enName: tag.translations.find((t) => t.language === 'en')?.title ?? '',
      arName: tag.translations.find((t) => t.language === 'ar')?.title ?? '',
    });
    this.captureInitial();
    this.editorOpen.set(true);
  }

  async closeEditor(): Promise<void> {
    if (this.isDirty()) {
      const choice = await this.unsavedDialog.open({ canSave: false });
      if (choice !== 'discard') return;
    }
    this.editorOpen.set(false);
    this.editing.set(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const request = {
      translations: [
        { language: 'en', name: this.form.value.enName!.trim() },
        { language: 'ar', name: this.form.value.arName!.trim() },
      ],
    };
    this.saving.set(true);
    const editing = this.editing();
    const call$ = editing ? this.tagService.rename(editing.id, request) : this.tagService.create(request);

    call$.subscribe({
      next: () => {
        this.saving.set(false);
        // Saved: refresh the snapshot before closing, or the discard guard fires on a form
        // that is no longer dirty in any meaningful sense.
        this.captureInitial();
        this.editorOpen.set(false);
        this.editing.set(null);
        this.notify.success(
          editing ? 'productTags.renamed' : 'productTags.created',
          editing ? 'Tag renamed' : 'Tag created',
        );
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.apiError(err, 'productTags.saveFailed', 'Could not save the tag');
      },
    });
  }

  async askDelete(tag: ProductTag): Promise<void> {
    if (this.deletingId() !== null) return;
    const confirmed = await this.confirmDialog.confirm({
      title: this.transloco.translate('productTags.deleteTitle'),
      message: this.transloco.translate('productTags.deleteMessage', { name: this.nameOf(tag) }),
      confirmLabel: this.transloco.translate('common.delete'),
      tone: 'destructive',
    });
    if (!confirmed) return;

    this.deletingId.set(tag.id);
    this.tagService.delete(tag.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.notify.success('productTags.deleted', 'Tag deleted');
        this.load();
      },
      error: (err) => {
        this.deletingId.set(null);
        // A 409 carries the number of products still using the tag; the server message already
        // includes it, so it is shown as-is.
        this.notify.apiError(err, 'productTags.deleteFailed', 'Could not delete the tag');
      },
    });
  }
}
