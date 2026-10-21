import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalizedNameService } from '../../../../core/i18n/localized-name.service';
import { WidgetHeaderComponent } from '../../widget-header/widget-header.component';
import { ChartCardComponent } from '../../chart/chart-card.component';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { ChartSlice, OTHER, statusColor } from '../../chart/chart-rules';

type OrdersTab = 'status' | 'paymentMethod';

/**
 * ONE "Orders by" card with two tabs: status and payment method.
 *
 * A status is not a category: it has a MEANING (delivered is good, failed
 * is bad), so it gets the semantic colours, not the categorical palette.
 * A payment method IS a category, so it gets the categorical palette —
 * and, being a single series in the end, the first colour.
 */
@Component({
  selector: 'app-orders-breakdown-card',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, WidgetHeaderComponent, ChartCardComponent, HlmButtonImports],
  templateUrl: './orders-breakdown-card.component.html',
})
export class OrdersBreakdownCardComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly language = inject(LanguageService);
  private readonly names = inject(LocalizedNameService);
  private readonly transloco = inject(TranslocoService);

  readonly tab = signal<OrdersTab>('status');

  readonly tabs: Array<{ id: OrdersTab; labelKey: string }> = [
    { id: 'status', labelKey: 'dashboard.tabs.status' },
    { id: 'paymentMethod', labelKey: 'dashboard.tabs.paymentMethod' },
  ];

  /** Orders by status. */
  readonly statusData = computed(() =>
    (this.stats.statusChartData() ?? []).map((d) => ({
      label: this.names.orderStatus(d.status),
      value: d.count,
      color: statusColor(d.status),
      // The raw status, so the drill-down can carry it.
      status: d.status,
    })),
  );

  /** Orders by payment method. */
  readonly paymentData = computed(() =>
    (this.stats.ordersByPaymentMethod() ?? []).map((d, i) => ({
      label: this.names.paymentMethod(d.paymentMethod),
      value: d.count,
      // A single series -> the first colour.
      color: i === 0 ? 'var(--chart-1)' : OTHER,
    })),
  );

  /** The slices for the active tab. */
  readonly slices = computed<ChartSlice[]>(() =>
    this.tab() === 'status' ? this.statusData() : this.paymentData(),
  );

  /**
   * A link per slice: a status drills down to the orders list filtered by
   * that status, so the reader can go from the chart to the rows behind it.
   */
  readonly sliceLinks = computed(() => {
    const out: Record<string, { link: string; params?: Record<string, string> }> = {};
    if (this.tab() !== 'status') return out;
    for (const row of this.statusData()) {
      out[row.label] = { link: '/dashboard/orders', params: { status: row.status } };
    }
    return out;
  });

  /** The label of the centre of the donut. */
  readonly centerLabel = computed(() =>
    this.transloco.translate(
      this.tabs.find((t) => t.id === this.tab())?.labelKey ?? 'dashboard.tabs.status',
    ),
  );

  /** Counts are whole numbers. */
  readonly formatValue = (value: number): string =>
    new Intl.NumberFormat(
      this.language.current() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US',
      { maximumFractionDigits: 0 },
    ).format(value);

  /** The accessible summary. */
  readonly ariaLabel = computed(() => {
    const total = this.slices().reduce((sum, s) => sum + (s.value || 0), 0);
    return `${this.centerLabel()}: ${this.formatValue(total)}`;
  });
}
