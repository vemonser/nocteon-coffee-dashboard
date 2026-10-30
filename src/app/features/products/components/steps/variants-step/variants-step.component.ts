import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  ControlContainer,
  FormArray,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
} from '@angular/forms';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductOption, ProductOptionValue } from '../../../../product-options/models/product-option.model';
import { filterOptionsByProductType } from '../../../product-option-applicability';
import { ProductOptionService } from '../../../../product-options/services/product-option.service';
import { ProductService } from '../../../services/product.service';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideX, lucideChevronDown, lucideChevronUp, lucideMoreVertical, lucideTrash2, lucideCopy, lucideImage, lucideUpload, lucideLoader2, lucideHistory, lucideSlidersHorizontal } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { NotifyService } from '../../../../../core/notify/notify.service';
import { stockLevel as resolveStockLevel } from '../../../../../shared/utils/stock-level';
import { StockMovement } from '../../../models/stock-movement.model';
import {
  StockAdjustmentDialogComponent,
  type StockAdjustmentDraft,
} from '../../stock-adjustment-dialog/stock-adjustment-dialog.component';
import { LocalizedDateService } from '../../../../../core/i18n/localized-date.service';

@Component({
  selector: 'app-variants-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HlmSelectImports,
    HlmInputImports,
    HlmLabel,
    HlmButtonImports,
    HlmCheckboxImports,
    HlmSwitchImports,
    NgIcon,
    StockAdjustmentDialogComponent,
    TranslocoPipe,
    MoneyPipe,
  ],
  providers: [
    provideIcons({ lucidePlus, lucideX, lucideChevronDown, lucideChevronUp, lucideMoreVertical, lucideTrash2, lucideCopy, lucideImage, lucideUpload, lucideLoader2, lucideHistory, lucideSlidersHorizontal }),
  ],
  templateUrl: './variants-step.component.html',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupDirective,
    },
  ],
})
export class VariantsStepComponent implements OnInit {
  protected state = inject(ProductWizardStateService);
  private optionService = inject(ProductOptionService);
  private productService = inject(ProductService);
  private language = inject(LanguageService);
  private notify = inject(NotifyService);
  private confirmDialog = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);
  protected readonly dates = inject(LocalizedDateService);

  loadingOptions = signal(false);
  collapsed = signal<Set<number>>(new Set());
  readonly view = signal<'cards' | 'table'>('cards');

  /** Index of the variant whose photo is uploading, so only that tile shows progress. */
  readonly uploadingIndex = signal<number | null>(null);

  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  private static readonly IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  // ─── FE-13: the stock history, per saved variant ────────────────────────

  /** Which variants have their history open. */
  readonly openHistory = signal<ReadonlySet<number>>(new Set());
  /** The last movements per variant, once loaded. */
  private readonly histories = signal<ReadonlyMap<number, StockMovement[]>>(new Map());
  /** Variants whose history is being fetched. */
  private readonly historyLoading = signal<ReadonlySet<number>>(new Set());

  /** The variant whose stock is being adjusted, or null. */
  readonly adjustTarget = signal<{
    index: number;
    variantId: number;
    sku: string;
    stock: number;
  } | null>(null);
  readonly savingAdjustment = signal(false);

  /** The server id of a variant, or null while it has never been saved. */
  variantId(group: AbstractControl): number | null {
    const id = group.get('id')?.value;
    return id === null || id === undefined || id === '' ? null : Number(id);
  }

  isHistoryOpen(variantId: number): boolean {
    return this.openHistory().has(variantId);
  }

  isHistoryLoading(variantId: number): boolean {
    return this.historyLoading().has(variantId);
  }

  movementsOf(variantId: number): StockMovement[] {
    return this.histories().get(variantId) ?? [];
  }

  /**
   * Open or close a variant's stock history.
   *
   * <p>Loaded on first open, not with the page: a product with eight variants
   * would fire eight requests nobody asked for, and the list is only read when
   * somebody is asking "why is this 7?".
   */
  toggleHistory(variantId: number): void {
    const open = new Set(this.openHistory());
    if (open.has(variantId)) {
      open.delete(variantId);
      this.openHistory.set(open);
      return;
    }
    open.add(variantId);
    this.openHistory.set(open);
    if (!this.histories().has(variantId)) this.loadHistory(variantId);
  }

  private loadHistory(variantId: number): void {
    const loading = new Set(this.historyLoading());
    loading.add(variantId);
    this.historyLoading.set(loading);

    this.productService
      .getVariantMovements(variantId, 10)
      .pipe(
        finalize(() => {
          const done = new Set(this.historyLoading());
          done.delete(variantId);
          this.historyLoading.set(done);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const next = new Map(this.histories());
          next.set(variantId, res.data ?? []);
          this.histories.set(next);
        },
        error: (err) => {
          this.notify.apiError(
            err,
            'products.variants.history.loadError',
            'The stock history could not be loaded',
          );
        },
      });
  }

  /** Open the adjustment dialog for one variant. */
  openAdjustment(index: number): void {
    const group = this.state.variantsArray.at(index);
    const variantId = group ? this.variantId(group) : null;
    if (!group || variantId === null) return;
    this.adjustTarget.set({
      index,
      variantId,
      sku: String(group.get('sku')?.value ?? ''),
      stock: Number(group.get('stockQuantity')?.value ?? 0),
    });
  }

  closeAdjustment(): void {
    if (this.savingAdjustment()) return;
    this.adjustTarget.set(null);
  }

  /**
   * Send the adjustment, then keep the form in step with the server.
   *
   * <p>The stock now lives in two places — the row the server changed and the
   * number in the form — and the form is the one that gets SAVED later. Leaving
   * the old figure there would post it back and record a second, opposite
   * movement, so the control is patched with the server's answer (without
   * marking the form dirty for a change the admin did not type).
   */
  saveAdjustment(draft: StockAdjustmentDraft): void {
    const target = this.adjustTarget();
    if (!target || this.savingAdjustment()) return;

    this.savingAdjustment.set(true);
    this.productService
      .adjustVariantStock(target.variantId, draft.delta, draft.reason)
      .pipe(
        finalize(() => this.savingAdjustment.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const after = res.data?.stockAfter;
          if (typeof after === 'number') {
            this.state.variantsArray
              .at(target.index)
              ?.get('stockQuantity')
              ?.setValue(after, { emitEvent: false });
          }
          this.adjustTarget.set(null);
          this.notify.apiSuccess(res, 'products.variants.history.adjusted', 'Stock adjusted');
          if (this.openHistory().has(target.variantId)) this.loadHistory(target.variantId);
        },
        error: (err) => {
          this.notify.apiError(
            err,
            'products.variants.history.adjustFailed',
            'The stock could not be adjusted',
          );
        },
      });
  }

  /** The signed delta of a movement, printed with an explicit sign. */
  movementDelta(movement: StockMovement): string {
    return movement.delta > 0 ? `+${movement.delta}` : String(movement.delta);
  }

  stockLevel(group: AbstractControl): 'out' | 'low' | 'ok' {
    return resolveStockLevel(
      group.get('stockQuantity')?.value,
      group.get('reorderThreshold')?.value,
    );
  }

  discountPercent(group: AbstractControl): number | null {
    const compare = Number(group.get('compareAtPrice')?.value);
    const price = Number(group.get('price')?.value);
    if (!compare || !price || compare <= price) return null;
    return Math.round(((compare - price) / compare) * 100);
  }

  optionNames(): string {
    return this.state.productOptions().map((o) => this.getOptionName(o)).join(', ');
  }

  compareAtPrice(group: AbstractControl): number | null {
    const value = Number(group.get('compareAtPrice')?.value);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  margin(group: AbstractControl): string | null {
    const price = Number(group.get('price')?.value);
    const cost = Number(group.get('costPrice')?.value);
    if (!price || !cost || price <= 0) return null;
    return String(Math.round(((price - cost) / price) * 1000) / 10);
  }

  isCollapsed(i: number): boolean {
    if (this.collapsed().size === 0 && this.state.variantsArray.length > 1) {
      return i !== 0;
    }
    return this.collapsed().has(i);
  }

  toggleCollapse(i: number): void {
    const next = new Set(this.collapsed());
    if (next.has(i)) next.delete(i);
    else next.add(i);
    this.collapsed.set(next);
  }

  variantLabel(group: AbstractControl): string {
    const picks = group.get('optionPicks') as FormArray | null;
    const parts: string[] = [];
    
    if (picks) {
      picks.controls.forEach((c) => {
        const optionId = Number(c.get('optionId')?.value);
        const valueId = Number(c.get('valueId')?.value);
        
        const option = this.state.productOptions().find((o) => o.id === optionId);
        if (!option) return;
        
        const value = option.values.find((v) => v.id === valueId);
        if (!value) return;
        
        const lang = this.language.current();
        const valueName = value.translations.find((t) => t.language?.toLowerCase() === lang?.toLowerCase())?.name;
        
        // The summary is the buyer-facing variant identity: values only.
        if (valueName) {
          parts.push(valueName);
        } else if (value.slug) {
          parts.push(value.slug);
        }
      });
    }
    
    const sku = group.get('sku')?.value;
    if (parts.length > 0) {
      return parts.join(' • ');
    }
    
    // Fallback to SKU if no options selected
    return sku || this.notify.t('products.variants.unnamed', 'Variant');
  }

  getEnhancedValueName(option: ProductOption, valueId: string | number | null): string {
    if (valueId == null) return '';
    
    const value = option.values.find((v) => v.id === Number(valueId));
    if (!value) return String(valueId);
    
    const lang = this.language.current();
    const valueName = value.translations.find((t) => t.language?.toLowerCase() === lang?.toLowerCase())?.name;
    const optionName = option.translations.find((t) => t.language?.toLowerCase() === lang?.toLowerCase())?.name;
    
    // Enhanced display with option context
    if (valueName && optionName) {
      return `${valueName} · ${optionName}`;
    }
    return valueName || value.slug || String(value.id);
  }

  ngOnInit(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);
    const productType = this.state.form.get('productType')?.value;
    this.optionService.getAll({ page: 0, size: 100, productType }).subscribe({
      next: (res) => {
        const productType = this.state.form.get('productType')?.value;
        this.state.setProductOptions(filterOptionsByProductType(res.data.content, productType));
        this.loadingOptions.set(false);
      },
      error: (err) => {
        this.loadingOptions.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load product options');
      },
    });
  }

  get currentLang(): string {
    return this.language.current();
  }

  getOptionName(option: ProductOption): string {
    const t = option.translations.find((t) => t.language?.toLowerCase() === this.currentLang?.toLowerCase());
    return t?.name ?? option.slug ?? `Option ${option.id}`;
  }

  getValueName(option: ProductOption, valueId: string | number | null): string {
    if (valueId == null) return '';
    const value = option.values.find((v) => v.id === Number(valueId));
    if (!value) return String(valueId);
    const t = value.translations.find((t) => t.language?.toLowerCase() === this.currentLang?.toLowerCase());
    return t?.name ?? value.slug ?? String(value.id);
  }

  /** Stringify a value id for hlm-select-item's string-based binding. */
  valueIdString(id: number): string {
    return String(id);
  }

  /** The trigger must read "250g", not the raw option-value id. */
  valueLabelFor(option: ProductOption): (value: string) => string {
    return (value: string) => this.getValueName(option, value);
  }

  /** Returns (creating on demand) the valueId FormControl for the given option. */
  getPickControl(group: AbstractControl, option: ProductOption): FormControl {
    const picks = group.get('optionPicks') as FormArray;
    let pick = picks.controls.find(
      (c) => Number(c.get('optionId')?.value) === option.id,
    ) as FormGroup | undefined;
    if (!pick) {
      pick = this.state.buildVariantPickGroup(option.id);
      picks.push(pick);
    }
    return pick.get('valueId') as FormControl;
  }

  addVariant(): void {
    this.state.addVariant();
  }

  /**
   * One photo per variant (FE-09). The file is uploaded on its own before the product is
   * saved — the same contract the story editor uses — so the tile can show the picture
   * immediately; the URL then travels with the variant in the product request.
   *
   * <p>The picker is built here rather than in the template: a native file input cannot carry
   * the design-system directive, and the raw-control guard exists to keep those out of markup.
   */
  pickVariantImage(index: number): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) this.onVariantImageSelected(index, file);
    };
    input.click();
  }

  private onVariantImageSelected(index: number, file: File): void {
    if (!VariantsStepComponent.IMAGE_TYPES.includes(file.type)) {
      this.notify.error(
        'products.variants.image.wrongType',
        'Use a JPEG, PNG, GIF or WebP image.',
      );
      return;
    }
    if (file.size > VariantsStepComponent.MAX_IMAGE_BYTES) {
      this.notify.error('products.variants.image.tooLarge', 'The image must be 5 MB or smaller.');
      return;
    }

    const group = this.state.variantsArray.at(index) as FormGroup;
    this.uploadingIndex.set(index);
    this.productService
      .uploadVariantImage(file)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.uploadingIndex.set(null)),
      )
      .subscribe({
        next: (res) => {
          const url = res.data?.url;
          if (!url) return;
          const control = group.get('imageUrl');
          control?.setValue(url);
          control?.markAsDirty();
        },
        error: (err) => {
          this.notify.apiError(err, 'products.variants.image.failed', 'Could not upload the image');
        },
      });
  }

  removeVariantImage(group: AbstractControl): void {
    const control = group.get('imageUrl');
    control?.setValue('');
    control?.markAsDirty();
  }

  removeVariant(index: number): void {
    this.state.removeVariant(index);
  }

  async confirmRemoveVariant(index: number): Promise<void> {
    if (
      await this.confirmDialog.confirm({
        title: this.notify.t('products.variants.removeTitle', 'Remove variant'),
        message: this.notify.t(
          'products.variants.removeMessage',
          'Remove this variant? Its stock and price settings go with it.',
        ),
        confirmLabel: this.notify.t('products.variants.remove', 'Remove'),
        cancelLabel: this.notify.t('common.cancel', 'Cancel'),
        tone: 'destructive',
      })
    ) {
      this.removeVariant(index);
    }
  }

  duplicateVariant(index: number): void {
    // Clone the variant group by re-adding and patching from the source.
    this.state.addVariant();
    const src = this.state.variantsArray.at(index) as FormGroup;
    const dst = this.state.variantsArray.at(this.state.variantsArray.length - 1) as FormGroup;
    // FE-15: the barcode is not cloned. It identifies one physical item, and the API rejects a
    // second variant that claims it — the copy starts with an empty field instead.
    dst.patchValue({ ...src.getRawValue(), barcode: '' });
  }
}