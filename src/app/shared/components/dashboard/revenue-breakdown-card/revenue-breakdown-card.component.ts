import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import { formatCurrency } from '../../../utils/locale-format';
import { LanguageService } from '../../../../core/i18n/language.service';
import { WidgetHeaderComponent } from '../../widget-header/widget-header.component';
import { ChartCardComponent } from '../../chart/chart-card.component';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { ChartSlice, OTHER, SEQUENTIAL, sliceColors } from '../../chart/chart-rules';

type BreakdownTab = 'origin' | 'roast' | 'category';

/**
 * ONE "Revenue by" card with three tabs.
 *
 * The three breakdowns (origin, roast level, category) were three separate
 * donut cards. They are the same question asked three ways, so they are one
 * card with three tabs:
 *
 *  - **Origin** — unordered, so the CATEGORICAL palette.
 *  - **Roast level** — ORDERED (light -> dark), so the SEQUENTIAL ramp:
 *    the reader has to see the order, and a categorical palette cannot
 *    carry it.
 *  - **Category** — unordered, categorical palette.
 *
 * A tab whose data has only ONE value is hidden: a single-slice donut is
 * not a chart, and the rule in `chart-rules.ts` says so — the card shows a
 * stat instead.
 */
@Component({
  selector: 'app-revenue-breakdown-card',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    WidgetHeaderComponent,
    ChartCardComponent,
    HlmButtonImports,
  ],
  templateUrl: './revenue-breakdown-card.component.html',
})
export class RevenueBreakdownCardComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** The active tab. */
  readonly tab = signal<BreakdownTab>('origin');

  readonly tabs: Array<{ id: BreakdownTab; labelKey: string }> = [
    { id: 'origin', labelKey: 'dashboard.tabs.origin' },
    { id: 'roast', labelKey: 'dashboard.tabs.roastLevel' },
    { id: 'category', labelKey: 'dashboard.tabs.category' },
  ];

  /** The origin breakdown. */
  readonly originData = computed(() =>
    (this.stats.revenueByOrigin() ?? []).map((d) => ({
      label: d.originName,
      value: d.revenue,
    })),
  );

  /** The roast-level breakdown. */
  readonly roastData = computed(() =>
    (this.stats.revenueByRoastLevel() ?? []).map((d) => ({
      label: d.roastLevelName,
      value: d.revenue,
    })),
  );

  /** The category breakdown. */
  readonly categoryData = computed(() =>
    (this.stats.categoryChartData() ?? []).map((d) => ({
      label: d.categoryName,
      value: d.revenue,
    })),
  );

  private dataFor(id: BreakdownTab) {
    return id === 'origin'
      ? this.originData()
      : id === 'roast'
        ? this.roastData()
        : this.categoryData();
  }

  /**
   * The slices for the active tab, coloured by the tab's palette.
   *
   * The ROAST tab is different: the ramp follows the ROAST (light -> dark),
   * not the revenue. The overview endpoint returns the roast breakdown
   * ordered by revenue, so a ramp applied to that order would give a dark
   * roast the lightest colour. The order comes from the canonical roast
   * list, and each slice takes the ramp step of its own roast level.
   */
  readonly slices = computed<ChartSlice[]>(() => {
    const id = this.tab();
    const data = this.dataFor(id);

    if (id === 'roast') {
      const order = this.stats.roastOrder();
      const rank = new Map(order.map((name, i) => [name, i]));
      // A slice whose roast is not in the canonical list keeps its place.
      const fallback = order.length;
      return data
        .map((d, i) => ({
          label: d.label,
          value: d.value,
          rank: rank.get(d.label) ?? fallback + i,
        }))
        .sort((a, b) => a.rank - b.rank)
        .map((d, i) => ({
          label: d.label,
          value: d.value,
          color: SEQUENTIAL[i % SEQUENTIAL.length] ?? OTHER,
        }));
    }

    const colors = sliceColors(data.length, 'categorical');
    return data.map((d, i) => ({
      label: d.label,
      value: d.value,
      color: colors[i] ?? OTHER,
    }));
  });

  /** A tab is hidden when it has only one value — it would be a stat. */
  tabHasData(id: BreakdownTab): boolean {
    return this.dataFor(id).length > 1;
  }

  /** The visible tabs. */
  readonly visibleTabs = computed(() => this.tabs.filter((t) => this.tabHasData(t.id)));

  /** The label of the centre of the donut. */
  readonly centerLabel = computed(() => {
    const id = this.tab();
    return this.transloco.translate(
      this.tabs.find((t) => t.id === id)?.labelKey ?? 'dashboard.tabs.origin',
    );
  });

  /** Money, in the store currency. */
  readonly formatValue = (value: number): string =>
    formatCurrency(value, this.language.language(), this.stats.storeCurrency());

  /** The accessible summary of the whole card. */
  readonly ariaLabel = computed(() => {
    const total = this.slices().reduce((sum, s) => sum + (s.value || 0), 0);
    return `${this.centerLabel()}: ${this.formatValue(total)}`;
  });

  /** The title of the card. */
  readonly title = computed(() => this.transloco.translate('dashboard.revenueBy'));
}
