import { Component, computed, inject, input } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import { formatCount, formatRating } from '../../../shared/utils/locale-format';

/**
 * Read-only star rating.
 *
 * Whole stars render as a single filled or outlined path. The one fractional
 * star is an outline with a filled copy on top whose fill is a horizontal
 * `linearGradient`; the gradient stops at the fill percentage, so a 4.3
 * rating shows four full stars and a star that is 30% filled from the left.
 * Gradient ids are unique per component instance because several ratings can
 * share a page.
 */
@Component({
  selector: 'app-rating-stars',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @for (i of stars(); track i) {
        @if (isFull(i)) {
          <svg viewBox="0 0 24 24" class="size-4 text-warning" aria-hidden="true">
            <path [attr.d]="starPath" fill="currentColor" />
          </svg>
        } @else if (isPartial(i)) {
          <svg viewBox="0 0 24 24" class="size-4 text-warning" aria-hidden="true">
            <defs>
              <linearGradient [attr.id]="gradientId(i)" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop [attr.offset]="fillPercent(i) + '%'" stop-color="currentColor" />
                <stop [attr.offset]="fillPercent(i) + '%'" stop-color="transparent" />
              </linearGradient>
            </defs>
            <path
              [attr.d]="starPath"
              class="text-muted-foreground/40"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <path [attr.d]="starPath" [attr.fill]="'url(#' + gradientId(i) + ')'" stroke="none" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" class="size-4 text-muted-foreground/40" aria-hidden="true">
            <path [attr.d]="starPath" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        }
      }
      @if (showText()) {
        <span class="ms-1 min-w-[2.5rem] text-xs tabular-nums text-muted-foreground">
          {{ rating() }}/{{ max() }}
        </span>
      }
    </span>
  `,
})
export class RatingStarsComponent {
  readonly rating = input<number>(0);
  readonly max = input<number>(5);
  readonly showText = input<boolean>(false);

  protected readonly language = inject(LanguageService);
  protected readonly transloco = inject(TranslocoService);

  protected readonly ariaLabel = computed(() =>
    this.transloco.translate('common.rating.outOf', {
      value: formatRating(this.rating(), this.language.language()),
      max: formatCount(this.max(), this.language.language()),
    }),
  );

  /** Unique per instance so gradient ids never collide across the page. */
  private readonly uid = Math.random().toString(36).slice(2, 8);

  protected readonly starPath =
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

  protected readonly floorRating = computed(() => Math.floor(this.rating()));

  protected stars(): number[] {
    return Array.from({ length: this.max() }, (_, i) => i + 1);
  }

  protected gradientId(i: number): string {
    return `star-${this.uid}-${i}`;
  }

  protected isFull(i: number): boolean {
    return i <= this.floorRating();
  }

  protected isPartial(i: number): boolean {
    return i === this.floorRating() + 1 && this.rating() % 1 !== 0;
  }

  /** Fill percentage for star at position i (1 = leftmost, 5 = rightmost). */
  protected fillPercent(i: number): number {
    const ratingVal = this.rating();
    const floor = this.floorRating();

    // Stars at or before the floor are fully filled.
    if (i <= floor) return 100;

    // The star after the floor takes the decimal part.
    if (ratingVal % 1 !== 0 && i === floor + 1) {
      return Math.round((ratingVal % 1) * 100);
    }

    return 0;
  }
}
