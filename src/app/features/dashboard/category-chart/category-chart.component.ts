// features/dashboard/components/category-chart/category-chart.component.ts
import { Component, Input, ViewChild, inject, effect, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexFill,
  ApexDataLabels,
  ApexGrid,
  ApexTooltip,
  ApexLegend,
  ApexPlotOptions,
  ApexNonAxisChartSeries,
} from 'ng-apexcharts';
import { ThemeService } from '../../../core/theme/theme.service';
import { formatCompactCurrency, formatCurrency } from '../../../shared/utils/locale-format';
import { getCssVarColor } from '../../../shared/utils/utils';
import { LanguageService } from '../../../core/i18n/language.service';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { TranslocoService } from '@jsverse/transloco';

// Union type to support both bar and donut
export type CategoryChartOptions = {
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  chart: ApexChart;
  responsive?: any;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  labels: string[];
  colors: string[];
  legend: ApexLegend;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  tooltip: ApexTooltip;
  stroke: ApexStroke;
};

@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, MoneyPipe],
  templateUrl: './category-chart.component.html',
})
export class CategoryChartComponent implements OnChanges {
  @Input() data: { categoryName: string; revenue: number; percentage: number }[] = [];
  @Input() currency = 'USD';
  @ViewChild('chart') chart!: ChartComponent;

  private themeService = inject(ThemeService);
  private language = inject(LanguageService);
  private transloco = inject(TranslocoService);

  fmtMoneySingle(value: unknown): string {
    return formatCurrency(value, this.language.current(), this.currency);
  }

  chartOptions: CategoryChartOptions;

  // Use horizontal bars when >4 categories, donut otherwise
  readonly isBarChart = computed(() => this.sortedData().length > 4);

  // Sort by revenue descending
  readonly sortedData = computed(() =>
    [...this.data].sort((a, b) => b.revenue - a.revenue)
  );

  // Compact currency formatter for axis labels
  /**
   * The axis label: the COMPACT amount with the currency, in the same
   * style as every other axis on the page.
   */
  readonly axisFormatter = (val: number): string =>
    formatCompactCurrency(val, this.language.current(), this.currency);

  // Tooltip formatter with category name and currency
  readonly tooltipFormatter = (opts: { w: { globals: { labels: string[]; series: number[][]; seriesIndex: number; dataPointIndex: number } } }): string => {
    const idx = opts.w.globals.dataPointIndex;
    const val = this.isBarChart()
      ? opts.w.globals.series[opts.w.globals.seriesIndex][idx]
      : opts.w.globals.series[idx];
    const label = this.sortedData()[idx]?.categoryName || opts.w.globals.labels[idx];
    const money = formatCurrency(val, this.language.current(), this.currency);
    return `<div class="px-2 py-1"><strong>${label}</strong><br>${money}</div>`;
  };

  constructor() {
    this.chartOptions = {
      series: [],
      chart: {
        type: 'donut',
        height: 300,
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 400 },
      },
      xaxis: {
        categories: [],
        labels: {
          style: { colors: 'var(--muted-foreground)', fontSize: '11px' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: 'var(--muted-foreground)', fontSize: '11px' },
          formatter: this.axisFormatter,
        },
        forceNiceScale: true,
      },
      labels: [],
      colors: [
        'var(--chart-1)',
        'var(--chart-2)',
        'var(--chart-3)',
        'var(--chart-4)',
        'var(--chart-5)',
      ],
      legend: {
        position: 'right',
        labels: { colors: getCssVarColor('--foreground') },
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            legend: { position: 'bottom' },
          },
        },
      ],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '60%',
          distributed: true,
          dataLabels: { position: 'top' },
        },
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: this.transloco.translate('dashboard.revenueTotal'),
                  fontSize: '12px',
                color: 'var(--foreground)',
                formatter: (w: any) => {
                  const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                  return formatCurrency(total, this.language.current(), this.currency);
                },
              },
              name: { color: 'var(--foreground)', fontSize: '12px' },
              value: { color: 'var(--foreground)', fontSize: '14px', fontWeight: 600 },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: 'var(--border)',
        strokeDashArray: 4,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      tooltip: {
        theme: this.themeService.theme() === 'dark' ? 'dark' : 'light',
        custom: this.tooltipFormatter,
        x: { show: false },
        y: { formatter: undefined },
      },
      stroke: {
        show: true,
        width: 0,
        colors: ['transparent'],
      },
    };

    effect(() => {
      this.themeService.themeVersion();
      this.updateTheme();
    });

    // The donut centre label and the money are built into the chart options,
    // which ApexCharts only re-reads when they are pushed back into it. A
    // runtime language switch (or a late currency load) therefore left the
    // centre reading the language it was constructed with — the English
    // dashboard showed an Arabic "الإجمالي". Re-apply on every change.
    effect(() => {
      this.language.current();
      this.currency;
      this.updateData();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['currency']) {
      this.updateData();
    }
  }

  private updateData(): void {
    const sorted = [...this.data].sort((a, b) => b.revenue - a.revenue);
    const revenues = sorted.map((d) => d.revenue);
    const labels = sorted.map((d) => d.categoryName);

    if (this.isBarChart()) {
      // Horizontal bar chart
      this.chartOptions = {
        ...this.chartOptions,
        series: [{ name: 'Revenue', data: revenues }],
        chart: { ...this.chartOptions.chart, type: 'bar' },
        xaxis: {
          categories: labels,
          labels: { style: { colors: 'var(--muted-foreground)', fontSize: '11px' } },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          labels: { style: { colors: 'var(--muted-foreground)', fontSize: '11px' }, formatter: this.axisFormatter },
          forceNiceScale: true,
        },
        plotOptions: {
          ...this.chartOptions.plotOptions,
          bar: { horizontal: true, barHeight: '60%', distributed: true },
        },
        tooltip: {
          ...this.chartOptions.tooltip,
          custom: this.tooltipFormatter,
        },
        stroke: { show: true, width: 0, colors: ['transparent'] },
      };
    } else {
      // Donut chart
      this.chartOptions = {
        ...this.chartOptions,
        series: revenues,
        chart: { ...this.chartOptions.chart, type: 'donut' },
        labels,
        plotOptions: {
          ...this.chartOptions.plotOptions,
          pie: {
            donut: {
              size: '65%',
              labels: {
                show: true,
                total: {
                  show: true,
                  label: this.transloco.translate('dashboard.revenueTotal'),
                  fontSize: '12px',
                  color: 'var(--foreground)',
                  formatter: (w: any) => {
                    const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                    return formatCurrency(total, this.language.current(), this.currency);
                  },
                },
                name: { color: 'var(--foreground)', fontSize: '12px' },
                value: { color: 'var(--foreground)', fontSize: '14px', fontWeight: 600 },
              },
            },
          },
        },
        tooltip: {
          ...this.chartOptions.tooltip,
          custom: this.tooltipFormatter,
        },
        stroke: { show: true, width: 0, colors: ['transparent'] },
      };
    }

    if (this.chart) {
      this.chart.updateOptions({
        series: this.chartOptions.series,
        chart: { type: this.chartOptions.chart.type },
        xaxis: this.chartOptions.xaxis,
        yaxis: this.chartOptions.yaxis,
        labels: this.chartOptions.labels,
        plotOptions: this.chartOptions.plotOptions,
        tooltip: this.chartOptions.tooltip,
        stroke: this.chartOptions.stroke,
      });
    }
  }

  private updateTheme(): void {
    const isDark = this.themeService.theme() === 'dark';
    const colors = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
    ];

    if (this.chart) {
      this.chart.updateOptions({
        colors,
        tooltip: {
          ...this.chartOptions.tooltip,
          theme: isDark ? 'dark' : 'light',
        },
        grid: {
          ...this.chartOptions.grid,
          borderColor: 'var(--border)',
        },
        xaxis: {
          ...this.chartOptions.xaxis,
          labels: {
            ...this.chartOptions.xaxis?.labels,
            style: { colors: 'var(--muted-foreground)', fontSize: '11px' },
          },
        },
        yaxis: {
          ...this.chartOptions.yaxis,
          labels: {
            ...this.chartOptions.yaxis?.labels,
            style: { colors: 'var(--muted-foreground)', fontSize: '11px' },
          },
        },
        legend: {
          ...this.chartOptions.legend,
          labels: { colors: getCssVarColor('--foreground') },
        },
      });
    }
  }
}