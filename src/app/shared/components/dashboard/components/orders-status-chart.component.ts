import { Component, Input, OnChanges, effect, inject, ViewChild } from '@angular/core';
import { NgApexchartsModule, ChartComponent, ApexNonAxisChartSeries, ApexChart, ApexLegend, ApexPlotOptions } from 'ng-apexcharts';
import { ThemeService } from '../../../../core/theme/theme.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { getCssVarColor } from '../../../../shared/utils/utils';
import { LocalizedNameService } from '../../../../core/i18n/localized-name.service';
import { WidgetHeaderComponent } from '../../widget-header/widget-header.component';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-orders-status-chart',
  standalone: true,
  imports: [NgApexchartsModule, TranslocoPipe, WidgetHeaderComponent],
  templateUrl: "./orders-status-chart.component.html",
})
export class OrdersStatusChartComponent implements OnChanges {
  @Input() data: { status: string; count: number }[] = [];
  @ViewChild('chartObj') chartObj!: ChartComponent;

  private themeService = inject(ThemeService);
  private language = inject(LanguageService);
  private names = inject(LocalizedNameService);

  series: ApexNonAxisChartSeries = [];
  labels: string[] = [];
  colors: string[] = [];
  chart: ApexChart = { type: 'donut', height: 300, fontFamily: 'inherit' };
  legend: ApexLegend = { position: 'right' as const, labels: { colors: getCssVarColor('--foreground') } };
  responsive = [
    {
      breakpoint: 768,
      options: {
        legend: { position: 'bottom' as const },
      },
    },
  ];
  plotOptions: ApexPlotOptions = {
    pie: {
      donut: {
        size: '65%',
        labels: {
          show: true,
          name: { color: 'var(--foreground)', fontSize: '12px' },
          value: { color: 'var(--foreground)', fontSize: '14px', fontWeight: 600 },
          total: {
            show: true,
            label: 'Orders',
            color: 'var(--muted-foreground)',
            fontSize: '11px',
            formatter: () => '',
          },
        },
      },
    },
  };

  /**
   * The status swatches, from the theme.
   *
   * The same tokens the new chart card uses: the statuses are SEMANTIC, so
   * they never take a categorical colour, and the two dashboards must not
   * paint the same status in two different colours.
   */
  private statusColorVars: Record<string, string> = {
    PENDING: '--status-pending',
    CONFIRMED: '--status-confirmed',
    PROCESSING: '--status-processing',
    SHIPPED: '--status-shipped',
    DELIVERED: '--status-delivered',
    CANCELLED: '--status-cancelled',
    REFUNDED: '--status-refunded',
  };

  constructor() {
    effect(() => {
      this.themeService.themeVersion();
      this.updateColors();
      this.applyColorsToChart();
    });
    effect(() => {
      // re-translate labels when language changes
      this.language.current();
      this.updateData();
    });
  }

  ngOnChanges() {
    this.updateData();
  }

  /**
   * The status label comes from the SHARED localized-name helper, which
   * never returns a raw key. The dashboard used to show the literal
   * `orders.statuses.DELIVERED` because `translate()` returns the key
   * itself when a key is missing, so the `|| status` fallback never fired.
   */
  private statusLabel(status: string): string {
    return this.names.orderStatus(status);
  }

  private updateColors() {
    this.colors = this.data.map((d) =>
      getCssVarColor(this.statusColorVars[d.status] || '--color-muted'),
    );
  }

  private updateData() {
    this.series = this.data.map((d) => d.count);
    this.labels = this.data.map((d) => this.statusLabel(d.status));
    this.updateColors();
  }

  private applyColorsToChart() {
    if (this.chartObj) {
      this.chartObj.updateOptions({ colors: this.colors, labels: this.labels, legend: { labels: { colors: getCssVarColor('--foreground') } } }, false, false);
    }
  }
}
