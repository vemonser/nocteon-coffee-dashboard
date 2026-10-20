import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrendingDown, lucideTrendingUp } from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatSignedPercent } from '../../../utils/locale-format';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import type { DeltaResult } from '../../../../core/dashboard/delta';

/**
 * A KPI card: label, value, delta chip, and (when the API has the data) a
 * sparkline.
 *
 * The chip carries the ARROW, the PERCENT and the WORD "No change" / "New" —
 * never the colour alone. The comparison itself lives in the toolbar, so the
 * caption is not repeated on eight cards; the card keeps an accessible
 * description of what it is compared against.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe, NgIcon, HlmCardImports],
  providers: [provideIcons({ lucideTrendingUp, lucideTrendingDown })],
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

  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** The delta's text. */
  readonly deltaText = computed(() => {
    const d = this.delta();
    if (!d) return '';
    if (d.tone === 'new') return this.transloco.translate('dashboard.delta.new');
    if (d.tone === 'flat') return this.transloco.translate('dashboard.delta.noChange');
    if (d.tone === 'none') return '';
    return formatSignedPercent(d.percent ?? 0, this.language.language());
  });

  /** The delta's colour. */
  readonly deltaTone = computed(() => {
    const d = this.delta();
    if (!d) return 'text-muted-foreground';
    if (d.tone === 'up') return 'text-success';
    if (d.tone === 'down') return 'text-destructive';
    if (d.tone === 'new') return 'text-success';
    return 'text-muted-foreground';
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
  readonly spark = computed(() => {
    const values = this.sparkline().filter((v) => Number.isFinite(v));
    if (values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const w = 100;
    const h = 24;
    const points = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / span) * h;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
    return { points, area: `0,${h} ${points} ${w},${h}`, w, h };
  });
}
