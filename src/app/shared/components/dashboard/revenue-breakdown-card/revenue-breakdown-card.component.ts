import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import { formatCompactCurrency, formatCurrency } from '../../../utils/locale-format';
import { LanguageService } from '../../../../core/i18n/language.service';
import { WidgetHeaderComponent } from '../../widget-header/widget-header.component';
import { ChartCardComponent } from '../../chart/chart-card.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { TabsComponent } from '../../ui/tabs/tabs.component';
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
 * THE TITLE FOLLOWS THE TAB (Round 2, ticket 2.3): "Revenue by origin",
 * "Revenue by roast level", "Revenue by category". "Revenue by" on its own
 * reads as an unfinished sentence, and the tab was the only thing that said
 * which breakdown was on screen.
 *
 * ALL THREE TABS ARE ALWAYS SHOWN. A tab whose data has one value is not
 * hidden any more: it renders the STAT (the number) and the single bar,
 * because "Revenue by category" is a question the reader may well want
 * answered even when the store sells one category.
 */
@Component({
  selector: 'app-revenue-breakdown-card',
  standalone: true,
  imports: [
    CommonModule,
    WidgetHeaderComponent,
    ChartCardComponent,
    HlmCardImports,
    TabsComponent,
  ],
  templateUrl: './revenue-breakdown-card.component.html',
})
export class RevenueBreakdownCardComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** The active tab. */
  readonly tab = signal<BreakdownTab>('origin');

  readonly tabs: Array<{ id: BreakdownTab; labelKey: string; titleKey: string }> = [
    {
      id: 'origin',
      labelKey: 'dashboard.tabs.origin',
      titleKey: 'dashboard.revenueByOrigin',
    },
    {
      id: 'roast',
      labelKey: 'dashboard.tabs.roastLevel',
      titleKey: 'dashboard.revenueByRoastLevel',
    },
    {
      id: 'category',
      labelKey: 'dashboard.tabs.category',
      titleKey: 'dashboard.revenueByCategory',
    },
  ];

  /** The tab items, translated. */
  readonly tabItems = computed(() =>
    this.tabs.map((tab) => ({
      id: tab.id,
      label: this.transloco.translate(tab.labelKey),
    })),
  );

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

  /**
   * The label of the centre of the donut.
   *
   * It says WHAT THE NUMBER IS ("Revenue"), not which tab is open
   * ("Origin"): the centre of a revenue donut is the revenue, and the
   * title above the card already says which breakdown it is broken down
   * by.
   */
  readonly centerLabel = computed(() =>
    this.transloco.translate('dashboard.donutRevenue'),
  );

  /** Money, in the store currency. */
  readonly formatValue = (value: number): string =>
    formatCurrency(value, this.language.language(), this.stats.storeCurrency());

  /** The compact money, for the centre of the donut. */
  readonly formatCompactValue = (value: number): string =>
    formatCompactCurrency(value, this.language.language(), this.stats.storeCurrency());

  /** The accessible summary of the whole card. */
  readonly ariaLabel = computed(() => {
    const total = this.slices().reduce((sum, s) => sum + (s.value || 0), 0);
    return `${this.title()}: ${this.formatValue(total)}`;
  });

  /** The title of the card — it follows the active tab. */
  readonly title = computed(() => {
    const tab = this.tabs.find((t) => t.id === this.tab());
    return this.transloco.translate(tab?.titleKey ?? 'dashboard.revenueByOrigin');
  });

  /**
   * What this chart measures.
   *
   * The breakdown sums the LINE ITEMS; the Total revenue card sums the
   * order totals. The two do not add up to each other, and the reader has
   * to be told which one they are looking at.
   */
  readonly measureNote = computed(() =>
    this.transloco.translate('dashboard.breakdownNote'),
  );
}
