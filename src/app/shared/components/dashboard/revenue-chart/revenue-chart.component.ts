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
import { formatCurrency, formatCompactCurrency } from '../../../utils/locale-format';
import { HlmButtonImports } from '@spartan-ng/helm/button';

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
  readonly height = 270;

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

  /** A "nice" y-axis maximum (1, 2, 5 × 10^n). */
  readonly axisMax = computed(() => {
    const max = this.maxValue();
    const mag = Math.pow(10, Math.floor(Math.log10(max)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
      if (m * mag >= max) return m * mag;
    }
    return 10 * mag;
  });

  /** The y-axis ticks. */
  readonly yTicks = computed(() => {
    const max = this.axisMax();
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
  });

  /** The x-axis ticks, adapted to the width. */
  readonly xTicks = computed(() => {
    const n = this.data().length;
    if (!n) return [];
    // Roughly one label per 90 px, and never fewer than 3.
    const wanted = Math.max(3, Math.min(8, Math.floor(this.plot().w / 90)));
    const step = Math.max(1, Math.ceil(n / wanted));
    const out: { index: number; label: string }[] = [];
    for (let i = 0; i < n; i += step) {
      out.push({ index: i, label: this.dates.formatDayMonth(this.data()[i].date) });
    }
    // The last day is the one a reader looks for, but it must not collide
    // with the tick before it: "19 Oct" and "20 Oct" printed next to each
    // other are unreadable. When they would touch, the earlier tick is
    // dropped instead.
    const last = n - 1;
    if (out.length === 0) {
      out.push({ index: last, label: this.dates.formatDayMonth(this.data()[last].date) });
    } else if (out[out.length - 1].index !== last) {
      if (last - out[out.length - 1].index < step / 2) {
        out.pop();
      }
      out.push({ index: last, label: this.dates.formatDayMonth(this.data()[last].date) });
    }
    return out;
  });

  /** The bar geometry. */
  readonly bars = computed(() => {
    const n = this.data().length;
    if (!n) return [];
    const w = this.plot().w;
    const h = this.plot().h;
    const max = this.axisMax();
    const slot = w / n;
    // A gap of 2 px keeps a single-day chart readable.
    const barWidth = Math.max(1, Math.min(28, slot - 2));
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
    const barWidth = Math.max(1, Math.min(28, slot - 2));
    return this.previousPeriodData().slice(0, n).map((d, i) => {
      const value = d.revenue || 0;
      const barHeight = max > 0 ? (value / max) * h : 0;
      return {
        x: this.pad().left + slot * i + (slot - barWidth) / 2,
        y: this.pad().top + h - barHeight,
        width: barWidth,
        height: barHeight,
      };
    });
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
  readonly axisLabel = (value: number): string =>
    formatCompactCurrency(value, this.language.language(), this.currency());

  /** The accessible summary of the whole chart. */
  readonly ariaLabel = computed(() => {
    const s = this.summary();
    if (!s) return this.transloco.translate('dashboard.revenue.noData');
    return `${this.transloco.translate('dashboard.revenueOverview')}: ${this.formatMoney(s.total)}`;
  });

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
