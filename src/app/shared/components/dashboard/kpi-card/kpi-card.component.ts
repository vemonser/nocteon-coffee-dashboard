import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideBadgeCheck,
  lucideClock,
  lucideCoffee,
  lucideGlobe,
  lucideInfo,
  lucidePackage,
  lucidePercent,
  lucideReceipt,
  lucideTag,
  lucideTicket,
  lucideRefreshCw,
  lucideRepeat,
  lucideShoppingBag,
  lucideShoppingCart,
  lucideTrendingDown,
  lucideTrendingUp,
  lucideUserPlus,
  lucideUsers,
  lucideWallet,
  lucideXCircle,
} from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatSignedPercent } from '../../../utils/locale-format';
import { LanguageService } from '../../../../core/i18n/language.service';
import { computeDelta, deltaDisplay, type DeltaResult } from '../../../../core/dashboard/delta';
import { sparklineGeometry } from '../../../../core/dashboard/sparkline';

/**
 * The ONE KPI card used by every page (dashboard, orders, carts, reviews).
 *
 * ANATOMY
 * -------
 * Every card is the same grid, so eight cards on one page line up:
 *
 *   padding     20px            (token: 16-20)
 *   icon        32px, corner    (decorative)
 *   label       13px / 500      muted
 *   value       26-28px / 600   tabular-nums, currency 14px muted
 *   foot row    12px / 500      caption and delta chip share one line
 *
 * The delta chip lives in the FOOT row, never above the label: a chip in the
 * flow above the label pushed the label of the cards that had one down, and
 * that is exactly why the labels on a row did not share a baseline.
 *
 * A NO-BASELINE DELTA
 * -------------------
 * When the previous period is 0 and the current one is not, there is no
 * percentage: the card shows "New" ONLY where newness is the meaning (the
 * new-customers card). Everywhere else it shows nothing and the toolbar
 * carries the explanation — an em dash on four cards in a row says nothing.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon, HlmCardImports],
  providers: [
    provideIcons({
      lucideActivity,
      lucideBadgeCheck,
      lucideClock,
      lucideCoffee,
      lucideGlobe,
      lucideInfo,
      lucidePackage,
      lucidePercent,
      lucideReceipt,
      lucideTag,
      lucideTicket,
      lucideRefreshCw,
      lucideRepeat,
      lucideShoppingBag,
      lucideShoppingCart,
      lucideTrendingDown,
      lucideTrendingUp,
      lucideUserPlus,
      lucideUsers,
      lucideWallet,
      lucideXCircle,
    }),
  ],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.css',
})
export class KpiCardComponent {
  /** The label. */
  readonly label = input<string>('');
  /** The formatted value. */
  readonly value = input<string>('');
  /** The metric's icon, as an `@ng-icons/lucide` name. Decorative. */
  readonly icon = input<string>('lucideWallet');
  /** When the value is money: the ISO code to print at 14px, muted. */
  readonly currency = input<string | undefined>(undefined);
  /** The delta, when there is a comparison. */
  readonly delta = input<DeltaResult | null | undefined>(null);
  /** The daily series for the sparkline — real data only. */
  readonly sparkline = input<number[]>([]);
  /** The accessible description of what the delta compares. */
  readonly comparisonLabel = input<string | undefined>(undefined);
  /** The list page this card drills down to. */
  readonly link = input<string | undefined>(undefined);
  /** The query parameters the link carries (the pre-filter). */
  readonly linkParams = input<Record<string, string> | undefined>(undefined);
  /** True only where "New" IS the meaning — the new-customers card. */
  readonly newMeansNew = input<boolean>(false);
  /** The scope of the number, as a tooltip. */
  readonly scopeNote = input<string | undefined>(undefined);
  /** Optional subtitle shown below the value (e.g. "4 of 5 customers"). */
  readonly caption = input<string | undefined>(undefined);
  /** When true, shows a live (online) indicator dot. */
  readonly live = input<boolean>(false);
  /**
   * Compact variant for the secondary KPI strip.
   *
   * It drops the per-card surface (the strip owns one surface for all four),
   * so the secondary metrics read as supporting detail rather than as four
   * more heroes next to the four primary cards. The anatomy is the same:
   * label, value, foot row.
   */
  readonly plain = input<boolean>(false);
  /** The metric type - used for delta color inversion (refundRate, onlineUsers, etc.) */
  readonly metric = input<'revenue' | 'orders' | 'customers' | 'coffee' | 'aov' | 'refundRate' | 'refunded' | 'repeat' | 'onlineUsers' | 'generic' | undefined>(undefined);

  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** True when the value is money and the symbol must be split off. */
  protected readonly isMonetary = computed(() => !!this.currency());

  /**
   * The value split so the symbol can carry the 14px muted style WITHOUT
   * re-ordering it: `formatCurrency` prints "EGP 1,234.00" in English and
   * "1,234.00 ج.م" in Arabic, and the card must not disagree with the pipe.
   */
  protected readonly displayValue = computed(() => {
    const raw = this.value().replace(/[\u2066\u2069]/g, '').trim();
    if (!this.currency()) return { prefix: null, number: raw, suffix: null };

    const leading = raw.match(/^([A-Za-z]{2,4})\s+/);
    if (leading) {
      return { prefix: leading[1], number: raw.slice(leading[0].length).trim(), suffix: null };
    }

    const symbolAt = raw.search(/[^\d.,\s-]/);
    if (symbolAt > 0) {
      return { prefix: null, number: raw.slice(0, symbolAt).trim(), suffix: raw.slice(symbolAt).trim() };
    }

    return { prefix: null, number: raw, suffix: null };
  });

  /** The delta text, or '' when there is no chip to render. */
  readonly deltaText = computed(() => {
    const d = this.delta();
    this.language.language();
    const display = deltaDisplay(d);
    if (display === 'flat') return this.transloco.translate('dashboard.delta.noChange');
    if (display !== 'percent') return '';
    return formatSignedPercent(d?.percent ?? 0, this.language.language());
  });

  /** The delta chip's fill and ink. Never colour alone: the chip carries an
      arrow and a percentage too. */
  readonly deltaTone = computed(() => {
    const d = this.delta();
    if (!d) return 'bg-muted text-muted-foreground';
    switch (d.tone) {
      case 'up':
        return 'bg-success-soft text-success';
      case 'down':
        return 'bg-destructive-soft text-destructive-text';
      default:
        return 'bg-muted text-muted-foreground';
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

  /** The sparkline geometry, or null when there is nothing to draw. */
  readonly spark = computed(() => sparklineGeometry(this.sparkline()));
}
