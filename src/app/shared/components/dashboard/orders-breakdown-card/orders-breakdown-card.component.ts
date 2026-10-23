import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { formatCount } from '../../../utils/locale-format';
import { LocalizedNameService } from '../../../../core/i18n/localized-name.service';
import { WidgetHeaderComponent } from '../../widget-header/widget-header.component';
import { WidgetStateComponent } from '../../widget-state/widget-state.component';
import { ChartCardComponent } from '../../chart/chart-card.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { TabsComponent } from '../../ui/tabs/tabs.component';
import { ChartSlice, OTHER, sliceColors, statusColor } from '../../chart/chart-rules';
import {
  DASHBOARD_ORDER_SCOPE,
  orderScopeDefinition,
} from '../../../../core/dashboard/order-scope';

type OrdersTab = 'status' | 'paymentMethod';

/**
 * ONE "Orders by" card with two tabs: status and payment method.
 *
 * A status is not a category: it has a MEANING (delivered is good, failed
 * is bad), so it gets the semantic colours, not the categorical palette.
 * A payment method IS a category, so it gets the categorical palette —
 * and, being a single series in the end, the first colour.
 *
 * THE TITLE FOLLOWS THE TAB (Round 2, ticket 2.3): "Orders by status",
 * "Orders by payment method".
 *
 * THE SCOPE (Round 2, ticket 1.2): the status breakdown counts the PAID
 * orders — the same set the dashboard's order KPI counts — so the card
 * says so, with the same sentence the Orders page uses.
 */
@Component({
  selector: 'app-orders-breakdown-card',
  standalone: true,
  imports: [
    CommonModule,
    WidgetHeaderComponent,
    WidgetStateComponent,
    ChartCardComponent,
    TabsComponent,
    HlmCardImports,
    TranslocoPipe,
  ],
  templateUrl: './orders-breakdown-card.component.html',
})
export class OrdersBreakdownCardComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly language = inject(LanguageService);
  private readonly names = inject(LocalizedNameService);
  private readonly transloco = inject(TranslocoService);

  readonly tab = signal<OrdersTab>('status');

  /** The first load of the overview, before any slices exist. */
  readonly loading = computed(() => this.stats.loading() && !this.stats.loaded());

  /** The overview failed; the card shows the reason and a retry. */
  readonly error = this.stats.overviewError;

  /** Retry the overview after a failure. */
  readonly retry = (): void => this.stats.retry();

  readonly tabs: Array<{ id: OrdersTab; labelKey: string; titleKey: string }> = [
    { id: 'status', labelKey: 'dashboard.tabs.status', titleKey: 'dashboard.ordersByStatus' },
    {
      id: 'paymentMethod',
      labelKey: 'dashboard.tabs.paymentMethod',
      titleKey: 'dashboard.ordersByPaymentMethod',
    },
  ];

  /** The tab items, translated. */
  readonly tabItems = computed(() => {
    this.language.language();
    return this.tabs.map((tab) => ({
      id: tab.id,
      label: this.transloco.translate(tab.labelKey),
    }));
  });

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
  readonly paymentData = computed(() => {
    const data = (this.stats.ordersByPaymentMethod() ?? []).map((d) => ({
      label: this.names.paymentMethod(d.paymentMethod),
      value: d.count,
    }));
    // A payment method IS a category, so it takes the categorical palette —
    // and NOT the neutral "Other" token, which means "everything else" and
    // would mislabel a real payment method.
    const colors = sliceColors(data.length, 'categorical');
    return data.map((d, i) => ({ ...d, color: colors[i] ?? OTHER }));
  });

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

  /**
   * The label of the centre of the donut.
   *
   * It says WHAT THE NUMBER IS ("Orders"), not which tab is open
   * ("Status").
   */
  readonly centerLabel = computed(() => {
    this.language.language();
    return this.transloco.translate('dashboard.donutOrders');
  });

  /** Counts are whole numbers, from the SHARED count formatter. */
  readonly formatValue = (value: number): string =>
    formatCount(value, this.language.language());

  /** The compact count, for the centre of the donut. */
  readonly formatCompactValue = (value: number): string => this.formatValue(value);

  /** The accessible summary. */
  readonly ariaLabel = computed(() => {
    const total = this.slices().reduce((sum, s) => sum + (s.value || 0), 0);
    return `${this.title()}: ${this.formatValue(total)}`;
  });

  /** The title of the card — it follows the active tab. */
  readonly title = computed(() => {
    this.language.language();
    const tab = this.tabs.find((t) => t.id === this.tab());
    return this.transloco.translate(tab?.titleKey ?? 'dashboard.ordersByStatus');
  });

  /**
   * What the count covers.
   *
   * The same sentence the dashboard's order KPI and the Orders page use —
   * one definition, three surfaces.
   */
  readonly scopeNote = computed(() => {
    this.language.language();
    return this.transloco.translate(
      orderScopeDefinition(DASHBOARD_ORDER_SCOPE).helpKey,
    );
  });
}
