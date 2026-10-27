import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ThemeService } from '../../../../core/theme/theme.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalizedDateService } from '../../../../core/i18n/localized-date.service';
import { formatCurrency, formatCompactCurrency, formatSignedPercent } from '../../../utils/locale-format';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { computeDelta } from '../../../../core/dashboard/delta';

/** The font size of the axis labels, in pixels. */
const AXIS_FONT_PX = 11;
import { LocalizedDateComponent } from '../../../ui/localized-date/localized-date.component';

/**
 * The revenue chart — the hero of the dashboard.
 *
 * Decisions, and why:
 *
 *  - **BARS, not a line.** Daily revenue is a set of discrete values. A
 *    line draws a slope between them, so a single spike reads as a trend
 *    that never happened.
 *  - **320 px tall**, because it is the page's main chart.
 *  - **Zero days are included**, so the reader sees the gaps.
 *  - **Compact y-axis with the currency**, the same in both languages.
 *  - **A summary line** (total, average per day, best day) under the
 *    chart: the number a reader wants first, before they read the shape.
 *  - **An aria-label and a "view as table" toggle**, so the data is
 *    available without seeing the picture.
 *
 * The previous-period line is DASHED and only drawn when the API returns
 * it. The API does return a previous window (derived client-side in
 * Phase 1), so the comparison is drawn.
 */
@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, HlmButtonImports, LocalizedDateComponent],
  templateUrl: './revenue-chart.component.html',
  styleUrl: './revenue-chart.component.css',
})
export class RevenueChartComponent {
  /** The current period, one entry per day (zero days included). */
  readonly data = input<{ date: string; revenue: number }[]>([]);
  /** The previous period, aligned by index. */
  readonly previousPeriodData = input<{ date: string; revenue: number }[]>([]);
  /** The store currency. */
  readonly currency = input<string>('USD');

  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  protected readonly dates = inject(LocalizedDateService);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** The measured width, so the tick density can adapt to it. */
  readonly width = signal(0);

  /** Whether the table view is open. */
  readonly showTable = signal(false);

  private readonly hostRef = viewChild<ElementRef<HTMLElement>>('chartHost');

  /** The chart height. */
  readonly height = 240;

  /**
   * The padding around the plot area.
   *
   * The LEFT padding is the WIDEST Y-AXIS LABEL plus a gap. It used to be
   * a fixed 48 px, which was enough for the old "E£1.2K" and not enough
   * for the new "EGP 1.2K": the label was drawn past the left edge of the
   * SVG and the first two characters were cut off.
   */
  readonly pad = computed(() => {
    const widest = this.yTicks().reduce(
      (max, tick) => Math.max(max, this.measureText(this.axisLabel(tick), AXIS_FONT_PX)),
      0,
    );
    return {
      top: 16,
      right: 12,
      bottom: 28,
      left: Math.max(40, Math.ceil(widest) + 12),
    };
  });

  /** A canvas context, used only to measure text. */
  private measureContext: CanvasRenderingContext2D | null = null;

  /** The measured width of a string, in pixels, in the chart's font. */
  private measureText(text: string, fontSizePx: number): number {
    if (!this.measureContext) {
      this.measureContext = document.createElement('canvas').getContext('2d');
    }
    const ctx = this.measureContext;
    if (!ctx) return text.length * fontSizePx * 0.6;
    const family = getComputedStyle(this.host.nativeElement).fontFamily;
    ctx.font = `400 ${fontSizePx}px ${family}`;
    return ctx.measureText(text).width;
  }

  /** The plot area. */
  readonly plot = computed(() => ({
    w: Math.max(40, this.width() - this.pad().left - this.pad().right),
    h: this.height - this.pad().top - this.pad().bottom,
  }));

  /** The maximum value on the y-axis, so the top bar is never clipped. */
  readonly maxValue = computed(() => {
    const all = [
      ...this.data().map((d) => d.revenue || 0),
      ...this.previousPeriodData().map((d) => d.revenue || 0),
    ];
    return Math.max(1, ...all);
  });

  /** The delta result for the previous period comparison */
  readonly previousPeriodDelta = computed(() => {
    if (!this.previousPeriodData().length) return null;
    const currentTotal = this.data().reduce((sum, d) => sum + (d.revenue || 0), 0);
    const previousTotal = this.previousPeriodData().reduce((sum, d) => sum + (d.revenue || 0), 0);
    return computeDelta(currentTotal, previousTotal);
  });

  /**
   * The step between two y-axis ticks.
   *
   * The previous "nice" ladder (1, 1.2, 1.5, 2, …) produced ticks such as
   * 3.8K / 7.5K / 11.3K — four slices of an arbitrary maximum, which
   * read as noise. The reader wants round numbers, so the step is the
   * largest value from {1, 2, 5} × 10^n that still leaves at least three
   * intervals below the maximum.
   */
  readonly axisStep = computed(() => {
    const max = this.maxValue();
    const steps = [500, 1000, 2000, 2500, 5000, 10000, 20000];
    // Find the step that gives 4-5 ticks and max >= data max
    for (const step of steps) {
      const numTicks = Math.ceil(max / step) + 1;
      if (numTicks >= 4 && numTicks <= 5 && max <= Math.ceil(max / step) * step) {
        return step;
      }
    }
    // Fallback to the smallest step that covers the max
    for (const step of steps) {
      if (max <= Math.ceil(max / step) * step) {
        return step;
      }
    }
    return steps[steps.length - 1];
  });

  /** A "nice" y-axis maximum, on a round step. */
  readonly axisMax = computed(() => {
    const step = this.axisStep();
    return Math.ceil(this.maxValue() / step) * step;
  });

  /** The y-axis ticks, on the round step. */
  readonly yTicks = computed(() => {
    const max = this.axisMax();
    const step = this.axisStep();
    const out: number[] = [];
    for (let v = 0; v <= max + step / 2; v += step) out.push(v);
    return out;
  });

  /** The x-axis ticks, built from the END backwards. */
  readonly xTicks = computed(() => {
    const n = this.data().length;
    if (!n) return [];
    
    const step = this.getAxisStep();
    
    const out: { index: number; label: string }[] = [];
    // Build from the end backwards
    let i = n - 1;
    while (i >= 0) {
      out.unshift({ index: i, label: this.dates.formatDayMonth(this.data()[i].date) });
      i -= step;
    }
    
    return out;
  });

  /** Calculate the axis step based on available data days */
  readonly getAxisStep = computed(() => {
    const n = this.data().length;
    if (n <= 7) return 1; // Daily for 7 days or less
    if (n <= 30) return 7; // 7-day steps for 30 days
    if (n <= 90) return 14; // 14-day steps for 90 days
    return 30; // 30-day steps for 365 days
  });

  /**
   * The gap between two bars, adapted to how many bars there are.
   *
   * A 7-day chart can afford a 4px gap; a 365-day chart cannot — a fixed gap
   * ate the bar itself and the year read as a solid block.
   */
  readonly barGap = computed(() => {
    const n = this.data().length;
    if (!n) return 0;
    const slot = this.plot().w / n;
    if (slot >= 18) return 4;
    if (slot >= 10) return 2;
    if (slot >= 5) return 1;
    return 0;
  });

  /** The bar geometry. */
  readonly bars = computed(() => {
    const n = this.data().length;
    if (!n) return [];
    const w = this.plot().w;
    const h = this.plot().h;
    const max = this.axisMax();
    const slot = w / n;
    const barWidth = Math.max(1, Math.min(28, slot - this.barGap()));
    return this.data().map((d, i) => {
      const value = d.revenue || 0;
      const barHeight = max > 0 ? (value / max) * h : 0;
      return {
        date: d.date,
        value,
        x: this.pad().left + slot * i + (slot - barWidth) / 2,
        y: this.pad().top + h - barHeight,
        width: barWidth,
        height: barHeight,
        radius: barWidth >= 4 ? 2 : 1,
        previous: this.previousPeriodData()[i]?.revenue ?? null,
      };
    });
  });

  /** The previous-period bar geometry, drawn as a dashed outline. */
  readonly previousBars = computed(() => {
    if (!this.previousPeriodData().length) return [];
    const n = this.data().length;
    if (!n) return [];
    const w = this.plot().w;
    const h = this.plot().h;
    const max = this.axisMax();
    const slot = w / n;
    const barWidth = Math.max(1, Math.min(28, slot - this.barGap()));
    return this.previousPeriodData().slice(0, n).map((d, i) => {
      const value = d.revenue || 0;
      const barHeight = max > 0 ? (value / max) * h : 0;
      return {
        x: this.pad().left + slot * i + (slot - barWidth) / 2,
        y: this.pad().top + h - barHeight,
        width: barWidth,
        height: barHeight,
        radius: barWidth >= 4 ? 2 : 1,
      };
    });
  });

  /**
   * The hovered bar's tooltip, CLAMPED to the chart.
   *
   * The old tooltip was positioned at `bar.x + 10` and translated -50 %,
   * so the last few days of the month put half of it outside the card.
   * The centre is clamped to a half-width inset, and the top is kept under
   * the card's top edge.
   */
  readonly tooltip = computed(() => {
    const h = this.hovered();
    if (!h) return null;
    const half = 72;
    const width = this.width();
    const center = Math.min(Math.max(h.x + 8, half), Math.max(half, width - half));
    return {
      ...h,
      left: Math.round(center),
      top: Math.round(Math.max(4, h.y - 48)),
    };
  });

  /** The summary line. */
  readonly summary = computed(() => {
    const values = this.data().map((d) => d.revenue || 0);
    if (!values.length) return null;
    const total = values.reduce((a, b) => a + b, 0);
    const average = total / values.length;
    const best = Math.max(...values);
    const bestIndex = values.indexOf(best);
    return {
      total,
      average,
      best,
      bestDate: this.data()[bestIndex].date,
    };
  });

  /** Get the previous period delta text */
  readonly previousPeriodDeltaText = computed(() => {
    const delta = this.previousPeriodDelta();
    if (!delta) return 'No prior data';
    if (delta.tone === 'flat') return 'No change';
    if (delta.tone === 'none') return 'No prior data';
    if (delta.tone === 'new') return 'No prior data';
    const pct = formatSignedPercent(delta.percent ?? 0, this.language.language());
    return pct;
  });

  /** Get the previous period delta sign for icon */
  readonly previousPeriodDeltaSign = computed(() => {
    const delta = this.previousPeriodDelta();
    if (!delta) return null;
    if (delta.tone === 'up') return 'up';
    if (delta.tone === 'down') return 'down';
    return null;
  });

  /** The money formatter. */
  readonly formatMoney = (value: number): string =>
    formatCurrency(value, this.language.language(), this.currency());

  /**
   * The y-axis label: the COMPACT amount with the currency, in the same
   * style as every other amount on the page.
   *
   * The old version built the label by stripping the digits out of a
   * formatted amount, which produced "جم1.2K" in Arabic — the symbol glued
   * to the number, in the wrong order, and with the dot of "ج.م." already
   * stripped. The compact formatter is the one rule for both languages.
   */
  readonly axisLabel = (value: number): string => {
    // Format as compact number without currency prefix
    const compact = formatCompactCurrency(value, this.language.language(), this.currency());
    // Remove currency prefix/suffix
    return compact.replace(/EGP\s*/g, '').replace(/\s*ج\.م/g, '').trim();
  };

  /** The accessible summary of the whole chart. */
  readonly ariaLabel = computed(() => {
    const s = this.summary();
    if (!s) return this.transloco.translate('dashboard.revenue.noData');
    return `${this.transloco.translate('dashboard.revenueOverview')}: ${this.formatMoney(s.total)}`;
  });

  /** The formatted previous period delta percentage */
  readonly formatPreviousPeriodDelta = (delta: any): string => {
    if (!delta) return 'No prior data';
    if (delta.tone === 'flat') return 'No change';
    if (delta.tone === 'none') return 'No prior data';
    if (delta.tone === 'new') return 'No prior data';
    return formatSignedPercent(delta.percent ?? 0, this.language.language());
  };

  /** The text of the summary line, for the accessible name. */
  readonly summaryLabel = computed(() => {
    const s = this.summary();
    if (!s) return '';
    const t = (k: string) => this.transloco.translate(k);
    return [
      `${t('dashboard.revenueTotal')}: ${this.formatMoney(s.total)}`,
      `${t('dashboard.revenueAverage')}: ${this.formatMoney(s.average)}`,
      `${t('dashboard.revenueBest')}: ${this.formatMoney(s.best)}`,
    ].join('  ·  ');
  });

  /** The grid lines' positions. */
  readonly gridLines = computed(() =>
    this.yTicks().map((v) => ({
      y: this.pad().top + this.plot().h - (v / this.axisMax()) * this.plot().h,
      label: this.axisLabel(v),
    })),
  );

  /** The hovered bar, for the tooltip. */
  readonly hovered = signal<{ date: string; value: number; x: number; y: number } | null>(null);

  /** The date formatter, exposed for the template. */
  protected readonly dateLabel = (value: string): string => this.dates.format(value);

  /** The bar colours. */
  readonly barFill = computed(() => 'var(--chart-1)');
  readonly previousStroke = computed(() => 'var(--chart-2)');
  readonly gridStroke = computed(() => 'var(--border)');
  readonly axisText = computed(() => 'var(--muted-foreground)');
  readonly labelText = computed(() => 'var(--foreground)');

  constructor() {
    const measure = () => this.width.set(this.host.nativeElement.clientWidth || 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(this.host.nativeElement);

    effect(() => {
      this.theme.themeVersion();
    });
  }
}
