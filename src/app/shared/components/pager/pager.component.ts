import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Shared pagination footer (§8). Renders the range line, a per-page selector
 * (opt-in via `showPageSize`), numbered page buttons with `…` gaps, and the
 * prev/next chevrons. Zero-based pages flow through `page`/`pageChange` —
 * callers keep their own loading/visibility guard and pass signals straight
 * through:
 *
 *   <app-pager
 *     [page]="pageData()!.page"
 *     [size]="pageData()!.size"
 *     [totalElements]="pageData()!.totalElements"
 *     [totalPages]="pageData()!.totalPages"
 *     [first]="pageData()!.first"
 *     [last]="pageData()!.last"
 *     (pageChange)="goToPage($event)"
 *   />
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [FormsModule, HlmButtonImports, HlmNativeSelectImports, NgIcon, TranslocoPipe],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pager.component.html',
})
export class PagerComponent {
  page = input.required<number>();
  size = input.required<number>();
  totalElements = input.required<number>();
  totalPages = input.required<number>();
  first = input.required<boolean>();
  last = input.required<boolean>();

  /** Show the rows-per-page select (lists that wire `sizeChange` opt in). */
  showPageSize = input<boolean>(false);
  sizeOptions = input<readonly number[]>([10, 20, 50]);

  pageChange = output<number>();
  sizeChange = output<number>();

  protected readonly rangeStart = computed(() => {
    const s = this.rangeStartRaw();
    return this.totalElements() > 0 ? s : 0;
  });
  private readonly rangeStartRaw = computed(() => this.page() * this.size() + 1);

  protected readonly rangeEnd = computed(() =>
    Math.min((this.page() + 1) * this.size(), this.totalElements()),
  );

  /**
   * Numbered page strip (zero-based) with `…` gap markers — always shows the
   * first and last pages plus a sliding window around the current one, so a
   * long list renders like `1 2 3 … 10` instead of "Page 4 of 10".
   */
  protected readonly pageStrip = computed<Array<number | 'ellipsis'>>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const windowStart = Math.max(1, Math.min(current - 1, total - 3));
    const windowEnd = Math.min(total - 2, Math.max(current + 1, 2));
    const strip: Array<number | 'ellipsis'> = [];
    for (let i = 0; i < total; i++) {
      if (i === 0 || i === total - 1 || (i >= windowStart && i <= windowEnd)) {
        strip.push(i);
      } else if (strip[strip.length - 1] !== 'ellipsis') {
        strip.push('ellipsis');
      }
    }
    return strip;
  });

  protected jump(page: number): void {
    if (page !== this.page()) this.pageChange.emit(page);
  }

  protected onSizeChange(value: string | number): void {
    const size = Number(value);
    if (Number.isFinite(size) && size !== this.size()) {
      this.sizeChange.emit(size);
    }
  }
}
