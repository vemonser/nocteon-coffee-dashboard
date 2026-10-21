import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrendingDown, lucideTrendingUp, lucideInfo } from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatSignedPercent } from '../../../utils/locale-format';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import { deltaDisplay, type DeltaResult } from '../../../../core/dashboard/delta';
import { sparklineGeometry } from '../../../../core/dashboard/sparkline';

/**
 * A KPI card: label, value, delta chip, and (when the API has the data) a
 * sparkline.
 *
 * The chip carries the ARROW, the PERCENT and the WORD "No change" — never
 * the colour alone. The comparison itself lives in the toolbar, so the
 * caption is not repeated on eight cards; the card keeps an accessible
 * description of what it is compared against.
 *
 * ANATOMY (Round 2, ticket 4.1)
 * ------------------------------
 * The three rows have FIXED heights, so the label, the value and the delta
 * sit on the same baseline in all four cards of the row:
 *
 *   row 1  the label (+ the sparkline), 24 px
 *   row 2  the value,                   the value's own line box
 *   row 3  the delta chip,              20 px
 *
 * The row used to be `justify-between`, so a card with a sparkline (a
 * taller first row) pushed its VALUE down and the four cards' values no
 * longer lined up.
 *
 * A NO-BASELINE DELTA (Round 2, ticket 1.3)
 * -----------------------------------------
 * When the previous period is 0 and the current one is not, there is no
 * percentage to show: "New" on four cards in a row says nothing, because
 * the store simply had no data to compare against. The card then shows an
 * em dash with the explanation "No data in the previous period" as its
 * tooltip. The "New" badge is kept ONLY where it is the agreed meaning —
 * the new-customers card, where "new" IS the news.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon, HlmCardImports],
  providers: [provideIcons({ lucideTrendingUp, lucideTrendingDown, lucideInfo })],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.css',
})
export class KpiCardComponent {
  /** The label. */
  readonly label = input<string>('');
  /** The formatted value. */
  readonly value = input<string>('');
  /** The delta, when there is a comparison. */
  readonly delta = input<DeltaResult | null | undefined>(null);
  /** The daily series for the sparkline — real data only. */
  readonly sparkline = input<number[]>([]);
  /** The accessible description of what the delta compares. */
  readonly comparisonLabel = input<string | undefined>(undefined);
  /**
   * The list page this card drills down to, pre-filtered.
   *
   * The card is a REAL LINK, not a click handler on a div: it is focusable,
   * it opens in a new tab, and a screen reader announces it as a link.
   */
  readonly link = input<string | undefined>(undefined);
  /** The query parameters the link carries (the pre-filter). */
  readonly linkParams = input<Record<string, string> | undefined>(undefined);
  /**
   * True when "New" is the MEANING of this card and not a symptom of an
   * empty previous period — true for the new-customers card only.
   */
  readonly newMeansNew = input<boolean>(false);
  /**
   * The scope of the number, as a tooltip.
   *
   * A count that does not say what it counts cannot be reconciled with the
   * same count on another page, so the scope is stated on the card.
   */
  readonly scopeNote = input<string | undefined>(undefined);

  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** True when the delta has no baseline to compare against. */
  protected readonly isNoBaseline = computed(() => this.delta()?.tone === 'new');

  /**
   * The delta's text.
   *
   * `null` means "render the em dash instead": there was no previous
   * period, so there is no percentage and no "New" badge.
   */
  readonly deltaText = computed(() => {
    const d = this.delta();
    this.language.language();
    const display = deltaDisplay(d, this.newMeansNew());
    if (display === 'new') return this.transloco.translate('dashboard.delta.new');
    if (display === 'flat') return this.transloco.translate('dashboard.delta.noChange');
    if (display !== 'percent') return '';
    return formatSignedPercent(d?.percent ?? 0, this.language.language());
  });

  /** The tooltip that explains an empty previous period. */
  readonly noBaselineTitle = computed(() => {
    this.language.language();
    return this.transloco.translate('dashboard.delta.noBaseline');
  });

  /** The delta's colour. */
  readonly deltaTone = computed(() => {
    const d = this.delta();
    if (!d) return 'text-muted-foreground';
    switch (d.tone) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      case 'new':
        return this.newMeansNew() ? 'text-success' : 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  });

  /** The arrow — only for a real increase or decrease. */
  readonly arrow = computed<'up' | 'down' | null>(() => {
    const d = this.delta();
    if (!d) return null;
    if (d.tone === 'up') return 'up';
    if (d.tone === 'down') return 'down';
    return null;
  });

  /**
   * The sparkline geometry, or null when there is nothing to draw.
   *
   * The rule lives in `core/dashboard/sparkline.ts`: at least three points,
   * and at least three of them carrying a value. The revenue card's series
   * is thirty days in which only one day had revenue, and drawing that was
   * the "stray line in the corner" the report named.
   */
  readonly spark = computed(() => sparklineGeometry(this.sparkline()));
}
