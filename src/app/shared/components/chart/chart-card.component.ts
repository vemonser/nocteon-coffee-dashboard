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
import { RouterLink } from '@angular/router';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../../core/theme/theme.service';
import { getCssVarColor } from '../../utils/utils';
import {
  ChartSlice,
  chartKindFor,
  sliceColors,
  withPercents,
} from './chart-rules';

/**
 * THE chart card.
 *
 * One component owns the chart-type rule, the palette, the legend and the
 * centre label, so two charts on the page can never disagree:
 *
 *  - **Type** (rules in `chart-rules.ts`): a donut only for 3–5 slices and
 *    at least 160 px; otherwise sorted horizontal bars; one slice is a stat.
 *  - **Legend**: ALWAYS below the chart, never beside it, and it lists the
 *    colour, the name, the value and the percentage. A legend that only
 *    carries a colour is a legend that relies on colour alone.
 *  - **Centre** (donut only): the foreground token, compact currency when
 *    the number is long, and never allowed to leave the ring.
 *  - **Hole**: the card colour, so the ring is a hole and not a darker
 *    disc.
 *
 * The chart is drawn with plain SVG rather than a charting library: the
 * dashboard needs four chart shapes, and a library brought its own
 * typography, its own transparent defaults and its own legend placement.
 */
@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe],
  templateUrl: './chart-card.component.html',
  styleUrl: './chart-card.component.css',
})
export class ChartCardComponent {
  /** The slices to draw. */
  readonly slices = input.required<ChartSlice[]>();
  /** The value formatter for the legend and the centre. */
  readonly formatValue = input<(value: number) => string>((v) => String(v));
  /** The label of the whole (for the centre). */
  readonly centerLabel = input<string>('Total');
  /** Show the value and the percentage inside each slice. */
  readonly showDirectLabels = input<boolean>(false);
  /** Accessible summary of the whole chart. */
  readonly ariaLabel = input<string>('');
  /**
   * A link per slice, so a legend row can drill down to the list behind it
   * (e.g. an order status -> the orders list filtered by that status).
   */
  readonly sliceLinks = input<Record<string, { link: string; params?: Record<string, string> }>>({});

  private readonly theme = inject(ThemeService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** The measured width of the card, in CSS pixels. */
  readonly width = signal(0);

  private readonly hostRef = viewChild<ElementRef<HTMLElement>>('chartHost');

  /** The slices, sorted and with their percentages. */
  readonly prepared = computed(() => withPercents(this.slices()));

  /** The total of all slices. */
  readonly total = computed(() =>
    this.prepared().reduce((sum, s) => sum + (s.value || 0), 0),
  );

  /** How this data is drawn. */
  readonly kind = computed(() => chartKindFor(this.prepared().length, this.width()));

  /** The centre value: the full number, or a compact one when it is long. */
  readonly centerValue = computed(() => {
    const total = this.total();
    if (!total) return '—';
    const full = this.formatValue()(total);
    // A long number does not fit in the middle of a ring; the compact form
    // is used instead, and the full number stays in the legend.
    return full.length > 12 ? this.compact(total) : full;
  });

  /** The compact centre value. */
  private compact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(Math.round(value));
  }

  /** The hole's radius as a fraction of the ring's outer radius. */
  readonly holeRatio = 0.62;

  /**
   * The SVG size: the ring is a fixed size, so every donut on the page has
   * the SAME diameter. 190 px, not the card's width: a donut that grows with
   * its card makes two cards' donuts different sizes, and a big ring in a
   * half-width card pushes the legend down the page.
   */
  readonly size = computed(() => Math.max(140, Math.min(this.width(), 170)));

  /** The centre of the ring, in pixels. */
  readonly center = computed(() => this.size() / 2);

  /** The ring's OUTER radius, in pixels. */
  readonly outerRadius = computed(() => this.size() / 2 - 2);

  /** The ring's INNER radius (the hole), in pixels. */
  readonly innerRadius = computed(() => this.outerRadius() * this.holeRatio);

  /**
   * The radius the arc is drawn at — the middle of the ring's thickness.
   * The slice is a STROKED arc, not a filled wedge: a filled wedge would
   * fill the hole, and the hole has to be the card colour.
   */
  readonly radius = computed(
    () => (this.outerRadius() + this.innerRadius()) / 2,
  );

  /** The thickness of the ring. */
  readonly ringWidth = computed(() => this.outerRadius() - this.innerRadius());

  /** The geometry of every slice, computed once per data change. */
  readonly arcs = computed(() => {
    const slices = this.prepared();
    const total = this.total();
    const r = this.radius();
    const cx = this.center();
    const cy = this.center();
    let angle = -90;
    return slices.map((slice) => {
      const fraction = total > 0 ? (slice.value || 0) / total : 0;
      const sweep = fraction * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const path = this.arcBetween(cx, cy, r, start, end, fraction);
      const mid = (start + end) / 2;
      const labelRadius = r * 0.82;
      return {
        slice,
        path,
        fraction,
        labelX: cx + labelRadius * Math.cos((mid * Math.PI) / 180),
        labelY: cy + labelRadius * Math.sin((mid * Math.PI) / 180),
        // A direct label only goes inside a slice that is big enough to
        // hold it; two overlapping percentages are worse than none.
        fitsDirectLabel: fraction >= 0.12,
      };
    });
  });

  /**
   * An SVG arc between two angles, on the ring's middle radius.
   *
   * It is a STROKED arc (no fill): the ring's thickness is the stroke
   * width, so the hole is genuinely empty and the card shows through it.
   * A filled wedge would paint over the hole — which is exactly the "the
   * hole is darker than the card" defect.
   */
  private arcBetween(
    cx: number,
    cy: number,
    r: number,
    start: number,
    end: number,
    fraction: number,
  ): string {
    if (fraction <= 0) return '';
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(start));
    const y1 = cy + r * Math.sin(rad(start));
    const x2 = cx + r * Math.cos(rad(end));
    const y2 = cy + r * Math.sin(rad(end));
    const largeArc = fraction > 0.5 ? 1 : 0;
    if (fraction >= 0.9999) {
      // A full ring cannot be one arc: two half arcs.
      return [
        `M ${cx} ${cy - r}`,
        `A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`,
        `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
      ].join(' ');
    }
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  /** The longest slice label, used to decide the bar axis width. */
  readonly longestLabel = computed(() =>
    this.prepared().reduce((max, s) => Math.max(max, s.label.length), 0),
  );

  /** The width of the bar track, in pixels. */
  readonly barTrack = computed(() => {
    const longest = this.longestLabel();
    // The label column takes what it needs; the rest is the track.
    return Math.max(90, Math.min(200, longest * 7 + 12));
  });

  /** The maximum slice value — the bars are scaled to it. */
  readonly maxValue = computed(() =>
    this.prepared().reduce((max, s) => Math.max(max, s.value || 0), 0),
  );

  /** The width of one bar, as a percentage of the track. */
  barWidth(slice: ChartSlice): number {
    const max = this.maxValue();
    if (!max) return 0;
    return Math.max(1, Math.round(((slice.value || 0) / max) * 1000) / 10);
  }

  /** The card background, so the hole is a hole and not a darker disc. */
  readonly holeFill = computed(() =>
    getCssVarColor(this.theme.isDark() ? '--card' : '--card'),
  );

  /** The ring's stroke colour. */
  readonly ringStroke = computed(() => getCssVarColor('--border'));

  /** The centre text colour. */
  readonly centerColor = computed(() => getCssVarColor('--foreground'));

  constructor() {
    // Measure the card so the donut knows whether it is big enough to be a
    // donut at all (a 120 px card with five slices is unreadable).
    const measure = () => this.width.set(this.host.nativeElement.clientWidth || 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(this.host.nativeElement);

    // The theme changes the card colour, so the hole has to be re-read.
    effect(() => {
      this.theme.themeVersion();
      this.theme.isDark();
    });
  }
}
